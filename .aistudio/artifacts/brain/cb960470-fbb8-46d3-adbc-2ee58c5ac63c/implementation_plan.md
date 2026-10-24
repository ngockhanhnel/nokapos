# Kế hoạch Tích hợp Tính Năng Cài Đặt Món Tự Định Nghĩa & Định Giá Chuyên Sâu

Bổ sung tính năng cho phép Chủ quán tự khai báo các món ăn / mặt hàng riêng của cửa hàng vào Công cụ Tính Giá Chuyên Sâu (`AdvancedPricingEngine`), tự động tính toán chi tiết giá vốn COGS và đề xuất giá bán lẻ/sỉ/sàn giao đồ ăn. **Đảm bảo không sử dụng bất kỳ dữ liệu mẫu hay giả lập nào** — danh sách mặc định để trống hoàn toàn để Chủ quán tự thêm dữ liệu thật và lưu trữ an toàn trên server Firestore.

## Quyết Định Cốt Lõi Từ Người Dùng (User Confirmed)

> [!IMPORTANT]
> - **Dữ liệu thật 100% (Zero Mock Data)**: Mặc định danh sách món tự setup là mảng rỗng `[]`. Khách hàng tự thêm, chỉnh sửa thông tin món và chi phí thật.
> - **Cơ chế lưu trữ**: Có nút **"Lưu Thiết Lập Món Tự Định Nghĩa"** riêng kèm thông báo xác nhận thành công sau khi lưu lên Firestore.
> - **Cập nhật giá thực tế**: Hệ thống tự động tính toán giá vốn & giá bán gợi ý, cung cấp nút **"Áp dụng vào Sản phẩm thực tế"** để Chủ quán cập nhật giá bán chính thức cho thực đơn quán.
> - **Bảo mật Chủ quán**: Giới hạn quyền truy cập độc quyền cho Chủ quán (`userRole === 'owner'`) cả trên giao diện và phía Server API.

---

## 1. Tổng Quan Kiến Trúc & Luồng Dữ Liệu

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CÀI ĐẶT BẢNG GIÁ / MÓN TỰ ĐỊNH NGHĨA                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Danh sách ban đầu: [Để trống 100% - Không tạo dữ liệu giả]             │
│  2. Chủ quán bấm "+ Thêm món mới cần tính giá"                              │
│  3. Nhập chi phí chi tiết:                                                  │
│     - Tên món (vd: Heo quay nguyên con, Gà nướng muối ớt...)               │
│     - Trọng lượng tươi (kg) & Giá mua tươi (/kg)                            │
│     - Tỷ lệ hao hụt khi chế biến (%)                                         │
│     - Chi phí gia vị + Chi phí than/gas + Bao bì + Điện nước mặt bằng        │
│  4. Hệ thống tự động tính:                                                 │
│     - Giá vốn 1 phần (COGS)                                                 │
│     - Giá bán lẻ đề xuất (biên lãi %)                                       │
│     - Giá bán sỉ & Giá bán sàn Grab/Shopee (bù hoa hồng)                    │
│  5. Thao tác:                                                               │
│     - Nút "Lưu Cấu Hình Món" → Ghi dữ liệu thật vào Firestore               │
│     - Nút "Áp dụng Giá Thực Tế" → Cập nhật trực tiếp vào Thực đơn sản phẩm   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Các Hạng Mục Cần Triển Khai

### A. Cập Nhật Cấu Trúc Dữ Liệu (`src/types/index.ts`)
Bổ sung interface `CustomPricingItem`:
```typescript
export interface CustomPricingItem {
  id: string;
  name: string;
  unit: string; // 'con', 'kg', 'phan', 'chiec'...
  rawWeightKg: number; // Trọng lượng nguyên liệu tươi
  rawCostPerKg: number; // Giá mua tươi / kg
  shrinkagePercent: number; // % hao hụt chế biến
  marinadeCost: number; // Tiền gia vị ướp / phần
  fuelCost: number; // Tiền gas, than, điện nướng / phần
  packagingCost: number; // Tiền hộp, bịch, nước chấm / phần
  overheadCost: number; // Phân bổ điện nước, mặt bằng / phần
  targetMarginPercent: number; // Biên lãi mong muốn (%)
  createdAt: string;
}
```
Cập nhật `PricingConfig` lưu mảng `customItems?: CustomPricingItem[]`.

### B. Mở Rộng Công Cụ Tính Giá (`AdvancedPricingEngine.tsx`)
1. **Phần Quản Lý Món Tự Định Nghĩa (Custom Dishes Section)**:
   - Hiển thị danh sách các món do Chủ quán tự khởi tạo. Khi chưa có món nào, hiển thị ô Trạng thái trống (*"Chưa có món tự định nghĩa nào. Hãy bấm '+ Thêm món mới' để bắt đầu tính giá vốn"*).
   - Nút bấm **"+ Thêm món/mặt hàng mới"**: Thêm 1 dòng trống hoàn toàn.
   - Các ô nhập dữ liệu dạng số tự động tính toán lại thời gian thực (Real-time recalculation).
   - Nút **"Lưu Cấu Hình Món Tự Định Nghĩa"**: Lưu mảng `customItems` vào Firestore `shops/{shopId}` kèm thông báo Toast/Alert xác nhận.
   - Nút **"Áp Dụng Giá Này Vào Thực Đơn Bán Hàng"**: Cho phép Chủ quán chọn sản phẩm trong hệ thống để cập nhật đơn giá bán ra thực tế ngay lập tức.

### C. Kiểm Tra Bảo Mật Server-Side (`server.ts`)
1. Bổ sung API Endpoint `/api/shops/:shopId/pricing`:
   - Kiểm tra header xác thực người dùng hoặc thông tin chủ quán (`userRole === 'owner'`).
   - Ngăn chặn các tài khoản nhân viên hoặc đối tượng không thẩm quyền cập nhật cấu hình định giá của cửa hàng.

---

## 3. Kế Hoạch Kiểm Tra & Xác Minh (Verification Status: COMPLETED)

1. **Kiểm tra dữ liệu rỗng (Zero Mock Data)**: ✅ Đã xác nhận danh sách món tự setup hoàn toàn rỗng `[]`, người dùng tự thêm và tùy chỉnh dữ liệu thật.
2. **Kiểm tra tính toán COGS & Biên Lãi**: ✅ Công thức tính giá vốn True COGS, giá bán lẻ, bán sỉ và bù phí sàn giao hàng hoạt động chính xác theo thời gian thực.
3. **Kiểm tra Lưu & Áp dụng**: ✅ Đã tích hợp nút "Lưu Thiết Lập" lên Firestore kèm thông báo xác nhận, và Modal "Áp dụng vào Thực đơn" cập nhật trực tiếp bảng giá sản phẩm.
4. **Kiểm tra Phân quyền Chủ quán**: ✅ Đã bảo mật giao diện và API server chỉ cho phép tài khoản `userRole === 'owner'` xem và chỉnh sửa.
5. **Kiểm tra Biên dịch**: ✅ `compile_applet` và `lint_applet` thành công 100% không có lỗi.
