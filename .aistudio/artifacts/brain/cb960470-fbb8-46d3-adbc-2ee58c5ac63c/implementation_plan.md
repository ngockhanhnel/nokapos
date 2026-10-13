# Kế hoạch Triển khai: Phân hệ Quản lý Đặt Hàng Trước (Pre-Orders) & Lịch Hẹn Giao Nhận Tự Động

Kế hoạch xây dựng phân hệ Đặt hàng trước chuyên sâu cho quán vịt quay, hỗ trợ tiếp nhận đơn đặt tiệc / đặt món hẹn trước theo ngày/tháng/năm và giờ cụ thể, tích hợp chuông cảnh báo nội bộ và thông báo Telegram tự động trước giờ hẹn với chu kỳ lặp lại tùy chỉnh, liên kết mượt mà với màn hình POS để thu nốt tiền cọc và in hóa đơn.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Dựa trên phản hồi xác nhận ở Bước 1, hệ thống được thiết lập theo các tiêu chuẩn cốt lõi sau:

- **Vị trí tích hợp**: Bổ sung tab riêng **"Đặt hàng trước" (Pre-Orders)** trên thanh điều hướng chính (Sidebar & Mobile Nav), đồng thời tích hợp phím tắt liên kết nhanh ngay trong màn hình Thu ngân POS.
- **Kênh thông báo & nhắc nhở**: Kích hoạt song song cả **Chuông âm thanh nội bộ + Thông báo đẩy trong ứng dụng** và **Tin nhắn Telegram tự động** gửi đến nhóm quản lý & bếp nướng.
- **Chính sách đặt cọc**: **Linh hoạt**, không bắt buộc cọc cố định. Cho phép cọc 0đ, cọc một phần bằng Tiền mặt hoặc Chuyển khoản VietQR/SePay, tự động tính toán số tiền còn lại phải thu khi giao hàng.

---

## 1. Tổng quan & Luồng Vận hành Nghiệp vụ

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LUỒNG VẬN HÀNH ĐƠN ĐẶT TRƯỚC (PRE-ORDER)             │
└────────────────────────────────────────────────────────────────────────┘

    1. Tiếp nhận & Đặt hẹn          2. Chuẩn bị & Nhắc nhở          3. Trả hàng & Quyết toán
 ┌───────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
 │ • Khách đặt tiệc / vịt    │    │ • Quét tự động định kỳ    │    │ • Khách nhận tại quán/giao│
 │ • Chọn Ngày/Giờ giao hẹn  │───>│ • Chuông báo D5/A5 nội bộ │───>│ • 1 chạm nạp vào POS      │
 │ • Chọn món & ghi chú lò   │    │ • Bắn bot Telegram bếp lò │    │ • Thu nốt tiền còn lại    │
 │ • Ghi nhận cọc (nếu có)   │    │ • Nhắc lặp lại nếu trễ    │    │ • In hóa đơn hoàn tất     │
 └───────────────────────────┘    └───────────────────────────┘    └───────────────────────────┘
```

- **Mục tiêu**: Giúp chủ quán và thu ngân kiểm soát tuyệt đối các đơn đặt tiệc cúng, liên hoan, rằm/mùng một, tiệc gia đình; không bao giờ bị quên hoặc trễ giờ giao vịt nóng hổi cho khách.
- **Đối tượng sử dụng**: Chủ quán, Quản lý, Thu ngân và Bếp nướng lò than.

---

## 2. Trải nghiệm Người dùng & Giao diện (UX/UI Design)

### 2.1. Phân hệ Đặt hàng trước (`PreOrdersView`)
- **Bộ lọc thời gian trực quan**:
  - `Hôm nay`: Đơn cần giao trong ngày (ưu tiên số 1).
  - `Ngày mai`: Chuẩn bị nguyên liệu ướp vịt từ chiều tối hôm trước.
  - `7 ngày tới` & `Tất cả`: Xem lịch tiệc trong tuần.
  - Bộ lọc theo trạng thái: `Chờ xác nhận`, `Đã cọc`, `Đang chuẩn bị/quay`, `Sẵn sàng giao`, `Hoàn tất`, `Đã hủy`.
- **Thẻ thống kê nhịp độ vận hành**:
  - Số đơn hẹn hôm nay.
  - Đơn khẩn cấp (còn dưới 60 phút tới giờ hẹn).
  - Tổng tiền cọc đã giữ & tổng doanh thu dự kiến.
- **Danh sách đơn đặt trước dạng thẻ & bảng**:
  - Hiển thị nổi bật: Giờ hẹn, Tên khách + SĐT, Hình thức (Lấy tại quán / Giao hàng / Ăn tại bàn), Danh sách món, Tiền cọc & Tiền còn lại.
  - Nút chuyển trạng thái nhanh 1 chạm và nút **"In phiếu đặt hẹn"**.

### 2.2. Modal Đặt hàng & Cấu hình Nhắc hẹn Thông minh
- **Thông tin khách hàng & Thời gian hẹn**:
  - Chọn nhanh khách hàng quen từ CRM hoặc nhập tên, SĐT, địa chỉ giao.
  - Chọn Ngày hẹn (`YYYY-MM-DD`) và Giờ hẹn (`HH:mm`).
- **Chọn món ăn & Ghi chú lò nướng**:
  - Chọn món từ thực đơn quán, điều chỉnh số lượng (con, phần, kg).
  - Ghi chú riêng cho bếp: *"Chặt sẵn chia 2 hộp", "Nước chấm chua ngọt", "Giao nóng lúc 11h30"*.
- **Tài chính & Đặt cọc**:
  - Tổng tiền đơn hàng, ô nhập số tiền cọc thực nhận, phương thức cọc (Tiền mặt / VietQR).
  - Tự động hiển thị số tiền còn lại khách cần thanh toán khi nhận hàng.
- **Cấu hình Báo trước & Lặp lại (Custom Reminder)**:
  - Bật/tắt nhắc trước giờ hẹn.
  - Thời gian báo trước linh hoạt: `15 phút`, `30 phút`, `60 phút`, `2 giờ`, `1 ngày (24h)`.
  - Tùy chọn lặp lại: Cảnh báo lặp lại mỗi `15 phút` hoặc `30 phút` nếu đơn chưa được đánh dấu đang chế biến / sẵn sàng.
  - Kênh nhận tin: Tích chọn Chuông/Popup hệ thống và Tin nhắn Telegram.

### 2.3. Tích hợp Nhanh tại Màn hình Thu Ngân (POS)
- Thêm nút tiện ích **"📦 Đơn đặt hẹn ([Số lượng])"** trên thanh công cụ POS.
- Thu ngân có thể mở danh sách đơn hôm nay, bấm **"Nạp vào POS thanh toán"**:
  - Đơn tự động chuyển vào giỏ hàng POS, trừ đi số tiền cọc đã nhận, hiển thị số tiền còn lại phải thu, khớp ca làm việc và in hóa đơn chuẩn.

---

## 3. Kiến trúc Hệ thống & Luồng Dữ liệu

```
┌────────────────────────────────────────────────────────────────────────┐
│                      KIẾN TRÚC & TÍCH HỢP HỆ THỐNG                     │
└────────────────────────────────────────────────────────────────────────┘

 [ Firestore DB ]
   └─ shops/{shopId}/pre_orders
        ├─ customerId, customerName, customerPhone
        ├─ scheduledDate, scheduledTime (Ngày & giờ giao)
        ├─ items: OrderItem[] (Món & ghi chú)
        ├─ total, depositAmount, remainingAmount
        ├─ status: pending | confirmed | preparing | ready | completed
        └─ reminderConfig: { advanceMinutes, repeatAlert, repeatInterval, ... }
                 │
                 ├── [ PreOrdersView ]: Quản lý danh sách, tạo/sửa đơn, in phiếu hẹn
                 │
                 ├── [ PosView ]: Nút liên kết nhanh, nạp đơn vào giỏ hàng để thu nốt tiền
                 │
                 ├── [ notifications.ts ]: Auto-scan hẹn giờ, kích hoạt chuông D5/A5 & popup
                 │
                 └── [ telegramService.ts ]: Gửi thông báo Telegram trước giờ hẹn & khi có đơn mới
```

---

## 4. Kế hoạch Triển khai Chi tiết

1. **Bước 1: Mở rộng Schema Types (`src/types/index.ts`)**
   - Bổ sung interface `PreOrder`, `PreOrderStatus`, `PreOrderReminderConfig`.
2. **Bước 2: Xây dựng Module `PreOrdersView.tsx` & Phiếu In Hẹn Giờ**
   - Triển khai toàn bộ giao diện quản lý đơn đặt trước, bộ lọc ngày, thẻ trạng thái.
   - Xây dựng Form tạo/sửa đơn đặt tiệc với bộ chọn món, tính tiền cọc, và bộ cấu hình nhắc nhở thời gian linh hoạt.
   - Tích hợp in phiếu nhận đơn đặt trước.
3. **Bước 3: Tích hợp Cảnh báo Tự động & Telegram Bot**
   - Bổ sung hàm quét đơn đặt hẹn trong `src/lib/notifications.ts` (quét theo `advanceMinutes` và chu kỳ lặp lại).
   - Bổ sung định dạng tin nhắn Telegram thông báo đơn hẹn trước trong `src/lib/telegramService.ts`.
4. **Bước 4: Liên kết Nhanh với POS & Điều hướng Ứng dụng**
   - Thêm nút gọi đơn đặt trước tại `PosView.tsx` để thu nốt tiền.
   - Thêm mục điều hướng **"Đặt hàng trước"** vào `Sidebar.tsx`, `MobileNav.tsx` và `App.tsx`.
5. **Bước 5: Kiểm thử Toàn diện & Biên dịch**
   - Chạy `lint_applet` và `compile_applet` để xác thực hệ thống hoạt động hoàn hảo 100%.
