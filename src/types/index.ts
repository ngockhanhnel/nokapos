export type UserRole = 'owner' | 'manager' | 'cashier';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  currentShopId?: string;
  createdAt: string;
}

export interface SepayConfig {
  apiKey: string;
  transferPrefix: string; // e.g. "DUCK"
  autoCompleteOrder: boolean;
  autoPrintReceipt: boolean;
  enabled: boolean;
}

export interface TelegramCustomReminder {
  id: string;
  title: string;
  message: string;
  enabled: boolean;
  scheduleType: 'interval' | 'daily_time';
  intervalMinutes?: number; // e.g. 30, 60, 90, 120, 180, 240 phút
  dailyTime?: string; // e.g. "09:00", "15:30", "21:30"
  lastSentAt?: string;
  repeat: boolean;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyNewOrder: boolean;
  notifySepayTransfer: boolean;
  notifyLowStock: boolean;
  notifyShiftClosing: boolean;
  notifyPeriodicRevenue?: boolean;
  periodicRevenueIntervalHours?: number; // e.g. 1, 2, 3, 4 giờ
  lastPeriodicRevenueSentAt?: string;
  customReminders?: TelegramCustomReminder[];
}

export interface ConversionUnit {
  id?: string;
  unitName: string;
  name?: string;
  conversionRate: number; // e.g., 24
  price: number;
  costPrice?: number;
  barcode?: string;
}

export interface BatchItem {
  id: string;
  batchCode: string;
  mfgDate?: string;
  expDate: string;
  quantity: number;
  costPrice: number;
  createdAt: string;
}

export interface EnterpriseSettings {
  enableBarcode: boolean;
  autoSuggestInfo: boolean;
  unitsList: string[];
  categoriesList: string[];
  brandsList: string[];
  locationsList: string[];
  attributesList: { name: string; values: string[] }[];
  costMethod: 'fixed' | 'average';
  enableBatchTracking: boolean;
  enableManufacturing: boolean;
  enableCategoryRBAC: boolean;
  allowChangeTransactionTime: boolean;
}

export interface BrandConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  fontFamily: string;
}

export interface Shop {
  id: string;
  name: string;
  phone: string;
  address: string;
  ownerId: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  receiptNote: string;
  currency: string;
  sepayConfig?: SepayConfig;
  telegramConfig?: TelegramConfig;
  enterpriseSettings?: EnterpriseSettings;
  brandConfig?: BrandConfig;
  createdAt: string;
}

export interface ShopMember {
  id: string; // memberId or userId
  userId: string;
  email: string;
  role: UserRole;
  allowedCategories?: string[]; // Phân quyền theo nhóm hàng
  joinedAt: string;
}

export type ProductUnit = string;

export const DEFAULT_UNITS = [
  'Chiếc',
  'Cái',
  'Lon',
  'Chai',
  'Hộp',
  'Lốc',
  'Thùng',
  'Gói',
  'Kg',
  'Gram',
  'Phần',
  'Đĩa',
  'Bao',
  'Bộ',
  'Cuộn',
];

export const UNIT_LABELS: Record<string, string> = {
  con: 'Con',
  nua_con: 'Nửa con',
  goc_tu: 'Góc tư (1/4)',
  kg: 'Kg',
  phan: 'Phần',
  chiec: 'Chiếc',
  dia: 'Đĩa',
  chai: 'Chai',
  lon: 'Lon',
  thung: 'Thùng',
  loc: 'Lốc',
  hop: 'Hộp',
};

export interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  category: string;
  brand?: string;
  location?: string;
  unit: string;
  price: number;
  costPrice: number;
  costMethod?: 'fixed' | 'average';
  stockQuantity: number;
  minStockAlert: number;
  isAvailable: boolean;
  hasBatchTracking?: boolean;
  batches?: BatchItem[];
  conversionUnits?: ConversionUnit[];
  attributes?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

export type DiningOption = 'takeaway' | 'dine_in';

export interface OrderItem {
  productId: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  weightKg?: number;
  totalPrice: number;
  selectedUnit?: string;
  conversionRate?: number;
  batchId?: string;
  batchCode?: string;
  expDate?: string;
  note?: string;
  prepNote?: string;
}

export type PaymentMethod = 'cash' | 'transfer';
export type PaymentStatus = 'paid' | 'pending' | 'failed';
export type OrderStatus = 'completed' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  orderCode: string;
  shiftId?: string;
  diningOption?: DiningOption;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  finalTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  pointsEarned?: number;
  customerCash?: number;
  changeCash?: number;
  cancellationReason?: string;
  createdAt: string;
}

export interface HoldOrder {
  id: string;
  code: string;
  label: string;
  items: OrderItem[];
  diningOption: DiningOption;
  discountType: 'vnd' | 'percent';
  discountValue: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
}

export type ShiftStatus = 'open' | 'closed';

export interface Shift {
  id: string;
  shiftCode: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  initialCash: number;
  totalCashSales: number;
  totalTransferSales: number;
  totalSales: number;
  ordersCount: number;
  actualCashCounted?: number;
  discrepancy?: number;
  status: ShiftStatus;
  note?: string;
  createdAt: string;
}

export type MovementType = 'in' | 'out' | 'adjust' | 'sale';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export type ExpenseCategory = 'raw_material' | 'utilities' | 'salary' | 'packaging' | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  raw_material: 'Thịt vịt & Nguyên vật liệu',
  utilities: 'Điện, than nướng, nước',
  salary: 'Lương nhân viên',
  packaging: 'Hộp, bao bì, gia vị',
  other: 'Chi phí khác',
};

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  performedBy: string;
  note?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  details: string;
  timestamp: string;
}

export interface SepayTransaction {
  id: string;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  content: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  accumulated?: number;
  referenceCode: string;
  matchedOrderCode?: string;
  matchedOrderId?: string;
  status: 'matched' | 'unmatched' | 'ignored';
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  debt: number; // Công nợ phải trả
  notes?: string;
  createdAt: string;
}

export interface PurchaseInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  items: { productName: string; quantity: number; unit: string; price: number }[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export type CustomerTier = 'retail' | 'wholesale' | 'vip';

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  retail: 'Khách lẻ',
  wholesale: 'Khách sỉ / Đại lý',
  vip: 'Khách VIP',
};

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tier: CustomerTier;
  totalSpent: number;
  loyaltyPoints: number;
  debt: number;
  notes?: string;
  createdAt: string;
}

export interface LoginSession {
  id: string;
  userId: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export type PreOrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PreOrderType = 'takeaway' | 'delivery' | 'dine_in' | 'party';

export const PRE_ORDER_STATUS_LABELS: Record<PreOrderStatus, { label: string; color: string; badgeClass: string }> = {
  pending: { label: 'Chờ xác nhận', color: '#f59e0b', badgeClass: 'bg-amber-950/70 border-amber-800/80 text-amber-300' },
  confirmed: { label: 'Đã xác nhận', color: '#3b82f6', badgeClass: 'bg-blue-950/70 border-blue-800/80 text-blue-300' },
  preparing: { label: 'Đang chuẩn bị', color: '#8b5cf6', badgeClass: 'bg-purple-950/70 border-purple-800/80 text-purple-300' },
  ready: { label: 'Sẵn sàng giao', color: '#10b981', badgeClass: 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300' },
  completed: { label: 'Đã hoàn tất', color: '#6b7280', badgeClass: 'bg-neutral-800 border-neutral-700 text-neutral-400' },
  cancelled: { label: 'Đã hủy', color: '#ef4444', badgeClass: 'bg-red-950/70 border-red-800/80 text-red-400' },
};

export const PRE_ORDER_TYPE_LABELS: Record<PreOrderType, string> = {
  takeaway: 'Mang về',
  delivery: 'Giao hàng tận nơi',
  dine_in: 'Ăn tại quán',
  party: 'Đặt tiệc / Sự kiện',
};

export interface PreOrderReminderConfig {
  enabled: boolean;
  advanceMinutes: number[]; // e.g. [15, 30, 60, 120, 1440]
  repeatIntervalMinutes?: number; // e.g. 15, 30 (lặp lại nhắc sau mỗi X phút)
  notifyTelegram: boolean;
  notifyAudio: boolean;
  lastNotifiedAt?: string;
  notifiedStages?: number[]; // các mốc phút đã thông báo
}

export interface PreOrder {
  id: string;
  orderCode: string; // e.g. DT-261013-001
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // HH:mm
  items: OrderItem[];
  totalAmount: number;
  depositAmount: number; // Tiền đặt cọc (0 nếu không cọc)
  remainingAmount: number;
  status: PreOrderStatus;
  orderType: PreOrderType;
  notes?: string;
  reminderConfig: PreOrderReminderConfig;
  convertedToOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

// ========================
// SỔ QUỸ & TÀI CHÍNH (CASHBOOK)
// ========================
export type CashTransactionType = 'receipt' | 'payment'; // Phiếu thu / Phiếu chi

export interface CashTransaction {
  id: string;
  code: string; // PT-0001, PC-0001
  type: CashTransactionType;
  category: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  date: string;
  recipientOrPayer: string;
  referenceCode?: string;
  note?: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
}

// ========================
// KIỂM KHO (STOCK AUDIT)
// ========================
export type StockAuditStatus = 'draft' | 'balanced' | 'cancelled';

export interface StockAuditItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  systemQuantity: number;
  actualQuantity: number;
  differenceQuantity: number;
  costPrice: number;
  differenceValue: number;
  batchCode?: string;
  note?: string;
}

export interface StockAudit {
  id: string;
  auditCode: string;
  code?: string;
  creatorId: string;
  creatorName: string;
  performedBy?: string;
  status: StockAuditStatus;
  items: StockAuditItem[];
  totalSystemQty: number;
  totalActualQty: number;
  totalDiffQty: number;
  totalDiffValue: number;
  note?: string;
  notes?: string;
  auditDate?: string;
  createdAt: string;
  balancedAt?: string;
}


