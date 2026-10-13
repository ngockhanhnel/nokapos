import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { Order, Product, Expense, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import {
  TrendingUp,
  Receipt,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Loader2,
  DollarSign,
  ShoppingCart,
  Clock,
  Sparkles,
  Filter,
  Calendar,
  Building2,
  CreditCard,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { currentShop } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [timeRange, setTimeRange] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'transfer'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  useEffect(() => {
    if (!currentShop?.id) return;

    // 1. Orders
    const ordRef = collection(db, 'shops', currentShop.id, 'orders');
    const qOrd = query(ordRef, orderBy('createdAt', 'desc'));
    const unsubOrd = onSnapshot(
      qOrd,
      (snap) => {
        const list: Order[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
        setOrders(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/orders`);
      }
    );

    // 2. Products
    const prodRef = collection(db, 'shops', currentShop.id, 'products');
    const unsubProd = onSnapshot(
      prodRef,
      (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
        setProducts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/products`);
      }
    );

    // 3. Expenses
    const expRef = collection(db, 'shops', currentShop.id, 'expenses');
    const unsubExp = onSnapshot(
      expRef,
      (snap) => {
        const list: Expense[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }));
        setExpenses(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/expenses`);
      }
    );

    // 4. Branches
    const branchRef = collection(db, 'shops', currentShop.id, 'branches');
    const unsubBranch = onSnapshot(
      branchRef,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setBranches(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsubOrd();
      unsubProd();
      unsubExp();
      unsubBranch();
    };
  }, [currentShop?.id]);

  // Date filters helper
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

  const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

  // Filter orders based on timeRange & paymentMethod & branchFilter
  const filteredOrders = orders.filter((o) => {
    // Status completed
    if (o.status !== 'completed') return false;

    // Time filter
    const orderDate = o.createdAt.split('T')[0];
    if (timeRange === 'today' && orderDate !== todayStr) return false;
    if (timeRange === '7days' && orderDate < sevenDaysStr) return false;
    if (timeRange === 'month' && !o.createdAt.startsWith(currentMonthPrefix)) return false;

    // Payment Method filter
    if (paymentMethodFilter !== 'all' && o.paymentMethod !== paymentMethodFilter) return false;

    // Branch filter
    if (branchFilter !== 'all' && (o as any).branchId && (o as any).branchId !== branchFilter) return false;

    return true;
  });

  const totalRevenue = filteredOrders.reduce((acc, o) => acc + o.finalTotal, 0);
  const totalOrdersCount = filteredOrders.length;
  const totalGoodsAmount = filteredOrders.reduce((acc, o) => acc + o.subtotal, 0);

  // Filter expenses based on timeRange
  const filteredExpenses = expenses.filter((e) => {
    if (timeRange === 'today' && e.date !== todayStr) return false;
    if (timeRange === '7days' && e.date < sevenDaysStr) return false;
    if (timeRange === 'month' && !e.date.startsWith(currentMonthPrefix)) return false;
    return true;
  });

  const totalExpensesAmount = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Check product cost
  const productCostMap = new Map<string, number>();
  let hasMissingCost = false;
  products.forEach((p) => {
    if (!p.costPrice || p.costPrice <= 0) {
      hasMissingCost = true;
    }
    productCostMap.set(p.id, p.costPrice || 0);
  });

  // Estimated COGS for filtered orders
  let totalCogs = 0;
  filteredOrders.forEach((o) => {
    o.items.forEach((item) => {
      const unitCost = productCostMap.get(item.productId) || 0;
      const qty = item.unit === 'kg' ? (item.weightKg || 1) : item.quantity;
      totalCogs += unitCost * qty;
    });
  });

  const totalEstProfit = totalRevenue - totalCogs - totalExpensesAmount;

  // Low stock products
  const lowStockProducts = products.filter((p) => p.stockQuantity <= (p.minStockAlert || 5));

  // Recent filtered orders (top 5)
  const recentOrders = filteredOrders.slice(0, 5);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-neutral-950 min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-5 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-r from-red-950/80 to-neutral-900 border border-red-900/60 rounded-2xl p-4 sm:p-5">
        <div>
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Bảng điều khiển kinh doanh Real-time
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
            {currentShop ? currentShop.name : 'DuckPOS Pro'}
          </h2>
          <p className="text-xs text-neutral-300 mt-1">
            Số liệu tự động cập nhật ngay khi có giao dịch mới phát sinh từ quầy POS
          </p>
        </div>

        <button
          onClick={() => onNavigate('pos')}
          className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shrink-0"
        >
          <ShoppingCart className="w-4 h-4 text-amber-300" />
          Mở quầy bán hàng ngay
        </button>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 text-xs text-neutral-300 font-semibold">
          <Filter className="w-4 h-4 text-red-400" />
          <span>Bộ lọc dữ liệu:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Range Filter */}
          <div className="flex items-center bg-neutral-950 rounded-xl border border-neutral-800 p-1">
            <Calendar className="w-3.5 h-3.5 text-neutral-400 ml-2 mr-1" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-transparent text-xs text-white font-medium focus:outline-none pr-2 py-1"
            >
              <option value="today" className="bg-neutral-900">Hôm nay</option>
              <option value="7days" className="bg-neutral-900">7 ngày qua</option>
              <option value="month" className="bg-neutral-900">Tháng này</option>
              <option value="all" className="bg-neutral-900">Tất cả thời gian</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center bg-neutral-950 rounded-xl border border-neutral-800 p-1">
            <CreditCard className="w-3.5 h-3.5 text-neutral-400 ml-2 mr-1" />
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
              className="bg-transparent text-xs text-white font-medium focus:outline-none pr-2 py-1"
            >
              <option value="all" className="bg-neutral-900">Mọi thanh toán</option>
              <option value="cash" className="bg-neutral-900">Tiền mặt</option>
              <option value="transfer" className="bg-neutral-900">Chuyển khoản (SePay)</option>
            </select>
          </div>

          {/* Branch Filter (if branches exist) */}
          {branches.length > 0 && (
            <div className="flex items-center bg-neutral-950 rounded-xl border border-neutral-800 p-1">
              <Building2 className="w-3.5 h-3.5 text-neutral-400 ml-2 mr-1" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="bg-transparent text-xs text-white font-medium focus:outline-none pr-2 py-1"
              >
                <option value="all" className="bg-neutral-900">Tất cả chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-neutral-900">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Doanh thu */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span>Doanh thu thực</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-white tabular-nums">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1">
            <span>Tiền hàng:</span>
            <span className="font-semibold text-neutral-200 tabular-nums">
              {formatCurrency(totalGoodsAmount)}
            </span>
          </div>
        </div>

        {/* Số đơn hoàn tất */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span>Số đơn hoàn tất</span>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-amber-400 tabular-nums">
            {totalOrdersCount} <span className="text-xs font-normal text-neutral-400">đơn</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1.5">
            {orders.length > 0 ? `Tổng ${orders.length} đơn trong hệ thống` : 'Chưa có đơn hàng'}
          </div>
        </div>

        {/* Chi phí ghi nhận */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span>Chi phí phát sinh</span>
            <Wallet className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-red-400 tabular-nums">
            {formatCurrency(totalExpensesAmount)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1.5">
            {filteredExpenses.length} phiếu chi trong kỳ
          </div>
        </div>

        {/* Lợi nhuận ước tính */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span>Lợi nhuận ước tính</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div
            className={`text-lg sm:text-2xl font-extrabold tabular-nums ${
              totalEstProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatCurrency(totalEstProfit)}
          </div>
          <div className="text-[10px] text-neutral-400 mt-1.5">
            {hasMissingCost ? (
              <span className="text-amber-400 italic">
                * Thiếu giá vốn một số món
              </span>
            ) : (
              'Doanh thu - Giá vốn - Chi phí'
            )}
          </div>
        </div>
      </div>

      {/* 2 COLUMN SECTION: ALERTS & RECENT ORDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LOW STOCK ALERTS */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Cảnh báo tồn kho ({lowStockProducts.length})
              </h3>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
              >
                Vào kho
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
                Mọi mặt hàng đều đang có đủ lượng tồn an toàn.
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-[10px] text-neutral-400">
                        Cảnh báo khi ≤ {p.minStockAlert || 5}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-red-400 tabular-nums">
                        {p.stockQuantity} {UNIT_LABELS[p.unit] || p.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-neutral-800">
            <button
              onClick={() => onNavigate('inventory')}
              className="w-full py-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-neutral-800"
            >
              <span>Kiểm kê & Nhập hàng</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RECENT ORDERS */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              Đơn hàng theo bộ lọc ({filteredOrders.length})
            </h3>
            <button
              onClick={() => onNavigate('orders')}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
            >
              Xem tất cả
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
              Không có đơn hàng nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/60">
              {recentOrders.map((ord) => (
                <div key={ord.id} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400 tabular-nums">
                        {ord.orderCode}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          ord.status === 'completed'
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : 'bg-red-950/60 text-red-400'
                        }`}
                      >
                        {ord.status === 'completed' ? 'Hoàn tất' : 'Đã hủy'}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {formatDateTime(ord.createdAt)} · Thu ngân: {ord.cashierName}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-extrabold text-white tabular-nums">
                      {formatCurrency(ord.finalTotal)}
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {ord.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
