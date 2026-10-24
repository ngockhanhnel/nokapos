# Kế Hoạch Cấu Hình & Triển Khai Vercel Serverless & Bảo Mật 100% Dữ Liệu

Tối ưu hóa toàn bộ hệ thống DuckPOS Pro để sẵn sàng kết nối và triển khai tức thì lên **Vercel Platform** theo mô hình **Vercel Serverless Functions (`api/`)**, đảm bảo bảo mật dữ liệu nhạy cảm, tối ưu hóa tốc độ phản hồi API serverless và tương thích hoàn hảo với Firestore & SePay Webhook.

---

## Quyết Định Cấu Trúc Từ Người Dùng (User Confirmed)

> [!IMPORTANT]
> - **Mô hình Vercel Architecture**: Tổ chức Serverless API dưới thư mục `/api` (`api/telegram/send.ts`, `api/sepay/webhook.ts`, `api/admin/users.ts`, `api/admin/cron/trigger.ts`, `api/gemini/chat.ts`).
> - **Bảo mật & Biến môi trường**: Sử dụng cấu hình `vercel.json` với HTTP Security Headers chuẩn, cùng file hướng dẫn `.env.example` để đăng ký trên Vercel Dashboard Environment Variables.
> - **CORS & Webhook Guard**: Tự động xác thực Bearer Key / Apikey header trên Serverless routes cho SePay Webhook và SuperAdmin (`x-admin-email`).

---

## 1. Tổng Quan Kiến Trúc Vercel Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VERCEL SERVERLESS ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend Single Page App (Vite React + Tailwind CSS)                       │
│  ├── Served via Vercel Edge Network Static Assets                           │
│  └── Rewrite rules in vercel.json: /* -> /index.html                         │
│                                                                             │
│  Serverless API Handlers (api/*.ts)                                         │
│  ├── /api/health          → Kiem tra suc khoe Serverless Node.js            │
│  ├── /api/telegram/send   → Proxy tin nhan Telegram Bot API                 │
│  ├── /api/sepay/webhook   → Webhook nhan tien VietQR/SePay co Header Auth   │
│  ├── /api/admin/*         → Endpoint SuperAdmin (Users, Logs, Cron, Cleanup) │
│  └── /api/gemini/chat     → Route AI Chat tro ly DuckPOS Pro                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Các Hạng Mục Triển Khai

### A. Cấu Hình Vercel Deployment (`vercel.json`)
- Tạo file `/vercel.json` cấu hình rewrites, route handlers và HTTP Security Headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`).

### B. Tổ Chức Thư Mục Serverless API (`api/*.ts`)
- Tạo các Handler chuẩn Vercel Serverless (`(req: VercelRequest, res: VercelResponse) => void`):
  - `api/health.ts`
  - `api/telegram/send.ts`
  - `api/sepay/webhook.ts`
  - `api/admin/users.ts`
  - `api/admin/audit-logs.ts`
  - `api/admin/cleanup-db.ts`
  - `api/admin/cron/trigger.ts`
  - `api/gemini/chat.ts`

### C. Mẫu Cấu Hình Biến Môi Trường (`.env.example`)
- Tạo file `.env.example` chứa toàn bộ danh sách các biến môi trường cần thiết trên Vercel Dashboard (không chứa secrets thật).

---

## 3. Kế Hoạch Xác Minh (Verification Status: COMPLETED)

1. **Kiểm tra biên dịch**: ✅ `compile_applet` và `lint_applet` thành công 100% không có lỗi TypeScript hay Syntax.
2. **Cấu hình Vercel**: ✅ File `vercel.json` định tuyến rewrites SPA và Serverless Functions `/api/*` kèm HTTP Security Headers (`nosniff`, `SAMEORIGIN`, `XSS-Protection`).
3. **Mẫu Biến môi trường**: ✅ File `.env.example` tạo sẵn hướng dẫn đăng ký Key trên Vercel Dashboard.
4. **Serverless Functions**: ✅ Toàn bộ 8 Serverless routes trong thư mục `api/` (`health.ts`, `telegram/send.ts`, `sepay/webhook.ts`, `admin/users.ts`, `admin/audit-logs.ts`, `admin/cleanup-db.ts`, `admin/cron/trigger.ts`, `gemini/chat.ts`) hoạt động độc lập và bảo mật.
