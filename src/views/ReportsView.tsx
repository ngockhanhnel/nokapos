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
import { Order, Product, Expense, Shift, EXPENSE_CATEGORY_LABELS, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatNumber, formatDateTime } from '@/src/lib/formatters';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Wallet,
  PieChart,
  Loader2,
  Printer,
  Boxes,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Banknote,
  QrCode,
  FileSpreadsheet,
  CheckCircle2,
  Users,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { currentShop } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Time filter state
  const [timeRange, setTimeRange] = useState<
    'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom'
  >('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Active view tab in Reports
  const [activeTab, setActiveTab] = useState<'pnl' | 'products' | 'shifts' | 'expenses'>('pnl');

  useEffect(() => {
    if (!currentShop?.id) return;

    // 1. Subscribe to orders
    const ordRef = collection(db, 'shops', currentShop.id, 'orders');
    const unsubOrd = onSnapshot(
      ordRef,
      (snap) => {
        const list: Order[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
        setOrders(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/orders`);
      }
    );

    // 2. Subscribe to products
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

    // 3. Subscribe to expenses
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

    // 4. Subscribe to shifts
    const shiftRef = collection(db, 'shops', currentShop.id, 'shifts');
    const unsubShift = onSnapshot(
      shiftRef,
      (snap) => {
        const list: Shift[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Shift, 'id'>) }));
        setShifts(list);
        setLoading(false);
      },
      (error) => {
        console.error('Shifts listener error:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubOrd();
      unsubProd();
      unsubExp();
      unsubShift();
    };
  }, [currentShop?.id]);

  // Compute date filter boundary
  const now = new Date();

  const getDateBoundaries = (): { startIso: string; endIso: string; label: string } => {
    let start = new Date(0);
    let end = new Date();

    if (timeRange === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startIso: start.toISOString(), endIso: end.toISOString(), label: 'Hôm nay' };
    }

    if (timeRange === 'yesterday') {
      const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
      return { startIso: yStart.toISOString(), endIso: yEnd.toISOString(), label: 'Hôm qua' };
    }

    if (timeRange === '7days') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startIso: start.toISOString(), endIso: end.toISOString(), label: '7 ngày qua' };
    }

    if (timeRange === '30days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startIso: start.toISOString(), endIso: end.toISOString(), label: '30 ngày qua' };
    }

    if (timeRange === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startIso: start.toISOString(), endIso: end.toISOString(), label: 'Tháng này' };
    }

    if (timeRange === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { startIso: start.toISOString(), endIso: end.toISOString(), label: 'Tháng trước' };
    }

    if (timeRange === 'custom') {
      const s = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
      const e = customEndDate ? new Date(`${customEndDate}T23:59:59`) : new Date();
      return {
        startIso: s.toISOString(),
        endIso: e.toISOString(),
        label: `${customStartDate || 'Bắt đầu'} - ${customEndDate || 'Hiện tại'}`,
      };
    }

    return { startIso: start.toISOString(), endIso: end.toISOString(), label: 'Toàn bộ thời gian' };
  };

  const { startIso, endIso, label: timeLabel } = getDateBoundaries();

  // Filter completed orders in period
  const filteredOrders = orders.filter(
    (o) => o.status === 'completed' && o.createdAt >= startIso && o.createdAt <= endIso
  );

  // Filter expenses in period
  const startDateStr = startIso.split('T')[0];
  const endDateStr = endIso.split('T')[0];
  const filteredExpenses = expenses.filter(
    (e) => e.date >= startDateStr && e.date <= endDateStr
  );

  // Filter shifts in period
  const filteredShifts = shifts.filter(
    (s) => s.startTime >= startIso && s.startTime <= endIso
  );

  // 1. REVENUE CALCULATIONS
  const totalGrossSales = filteredOrders.reduce((acc, o) => acc + (o.subtotal || o.finalTotal), 0);
  const totalDiscount = filteredOrders.reduce((acc, o) => acc + (o.discount || 0), 0);
  const totalRevenue = filteredOrders.reduce((acc, o) => acc + o.finalTotal, 0); // Net Revenue
  const totalOrdersCount = filteredOrders.length;
  const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // 2. COGS (Cost of Goods Sold)
  const productCostMap = new Map<string, number>();
  products.forEach((p) => {
    productCostMap.set(p.id, p.costPrice || 0);
  });

  let totalCogs = 0;
  let itemsSoldWithoutCost = 0;

  filteredOrders.forEach((o) => {
    o.items?.forEach((item) => {
      const cost = productCostMap.get(item.productId) || 0;
      const qty = item.unit === 'kg' ? (item.weightKg || 1) : item.quantity;
      if (cost <= 0) {
        itemsSoldWithoutCost++;
      }
      totalCogs += cost * qty;
    });
  });

  // 3. PROFIT METRICS
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

  const totalOperatingExpense = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netProfit = grossProfit - totalOperatingExpense;
  const netMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

  // 4. PAYMENT METHODS BREAKDOWN
  const cashTotal = filteredOrders
    .filter((o) => o.paymentMethod === 'cash')
    .reduce((acc, o) => acc + o.finalTotal, 0);
  const transferTotal = filteredOrders
    .filter((o) => o.paymentMethod === 'transfer')
    .reduce((acc, o) => acc + o.finalTotal, 0);
  const cashPercent = totalRevenue > 0 ? Math.round((cashTotal / totalRevenue) * 100) : 0;
  const transferPercent = totalRevenue > 0 ? Math.round((transferTotal / totalRevenue) * 100) : 0;

  // 5. EXPENSES BY CATEGORY
  const expenseByCategory = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  // 6. PRODUCT PROFITABILITY MATRIX
  interface ProductMetric {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    revenue: number;
    cogs: number;
    profit: number;
    marginPercent: number;
    costPrice: number;
  }

  const productMatrixMap = new Map<string, ProductMetric>();

  filteredOrders.forEach((o) => {
    o.items?.forEach((item) => {
      const pCost = productCostMap.get(item.productId) || 0;
      const qty = item.unit === 'kg' ? (item.weightKg || 1) : item.quantity;
      const itemCogs = pCost * qty;
      const itemProfit = item.totalPrice - itemCogs;

      const existing = productMatrixMap.get(item.productId) || {
        id: item.productId,
        name: item.name,
        unit: item.unit,
        quantity: 0,
        revenue: 0,
        cogs: 0,
        profit: 0,
        marginPercent: 0,
        costPrice: pCost,
      };

      existing.quantity += qty;
      existing.revenue += item.totalPrice;
      existing.cogs += itemCogs;
      existing.profit += itemProfit;
      existing.marginPercent = existing.revenue > 0 ? Math.round((existing.profit / existing.revenue) * 100) : 0;

      productMatrixMap.set(item.productId, existing);
    });
  });

  const productMatrixList = Array.from(productMatrixMap.values()).sort((a, b) => b.profit - a.profit);

  // 7. SHIFTS RECONCILIATION SUMMARY
  const totalShiftCashSales = filteredShifts.reduce((acc, s) => acc + (s.totalCashSales || 0), 0);
  const totalShiftDiscrepancy = filteredShifts.reduce((acc, s) => acc + (s.discrepancy || 0), 0);

  // EXPORT TO CSV (EXCEL)
  const handleExportCSV = () => {
    if (filteredOrders.length === 0 && filteredExpenses.length === 0) {
      alert('Không có dữ liệu phát sinh trong khoảng thời gian này để xuất file.');
      return;
    }

    const rows: string[] = [];
    rows.push(`BÁO CÁO KẾT QUẢ KINH DOANH VÀ LỢI NHUẬN (P&L)`);
    rows.push(`Cửa hàng: ${currentShop?.name || 'DuckPOS Pro'}`);
    rows.push(`Khoảng thời gian: ${timeLabel}`);
    rows.push(`Ngày xuất file: ${formatDateTime(new Date().toISOString())}`);
    rows.push('');

    rows.push('--- BẢNG TỔNG HỢP P&L (KẾT QUẢ KINH DOANH) ---');
    rows.push('Chỉ số tài chính,Số tiền (VND),Ghi chú / Tỷ lệ');
    rows.push(`Tổng doanh số bán,${totalGrossSales},Doanh thu chưa trừ giảm giá`);
    rows.push(`Chiết khấu / Giảm giá,${totalDiscount},Giảm giá khuyến mãi`);
    rows.push(`Doanh thu thuần (Net Sales),${totalRevenue},Doanh thu thực nhận`);
    rows.push(`Giá vốn hàng bán (COGS),${totalCogs},Chi phí nguyên vật liệu`);
    rows.push(`Lợi nhuận gộp (Gross Profit),${grossProfit},Biên lợi nhuận gộp ${grossMarginPercent}%`);
    rows.push(`Chi phí vận hành (OPEX),${totalOperatingExpense},Tổng các phiếu chi`);
    rows.push(`LỢI NHUẬN RÒNG (NET PROFIT),${netProfit},Biên lợi nhuận ròng ${netMarginPercent}%`);
    rows.push(`Thu tiền mặt,${cashTotal},Tỷ trọng ${cashPercent}%`);
    rows.push(`Thu chuyển khoản VietQR,${transferTotal},Tỷ trọng ${transferPercent}%`);
    rows.push('');

    rows.push('--- CHI TIẾT HIỆU QUẢ TỪNG MẶT HÀNG ---');
    rows.push('Tên món,Đơn vị,Số lượng bán,Doanh thu (VND),Giá vốn (VND),Lãi gộp (VND),Biên lãi (%)');
    productMatrixList.forEach((p) => {
      rows.push(
        `"${p.name}",${UNIT_LABELS[p.unit as keyof typeof UNIT_LABELS] || p.unit},${p.quantity},${p.revenue},${p.cogs},${p.profit},${p.marginPercent}%`
      );
    });
    rows.push('');

    rows.push('--- CHI TIẾT CHI PHÍ VẬN HÀNH (OPEX) ---');
    rows.push('Ngày,Danh mục,Khoản chi,Số tiền (VND),Người chi,Ghi chú');
    filteredExpenses.forEach((e) => {
      rows.push(
        `${e.date},"${EXPENSE_CATEGORY_LABELS[e.category] || e.category}","${e.title}",${e.amount},"${e.performedBy}","${e.note || ''}"`
      );
    });

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Bao_Cao_PnL_${currentShop?.name ? currentShop.name.replace(/\s+/g, '_') : 'DuckPOS'}_${timeRange}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* Header Banner - Printable Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-neutral-900 via-neutral-900 to-red-950/40 p-4 sm:p-6 rounded-2xl border border-neutral-800 shadow-xl print:border-none print:shadow-none print:p-0 print:bg-transparent">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-red-950 border border-red-800/60 text-amber-400 shadow-inner shrink-0 print:hidden">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight uppercase print:text-black">
                Báo cáo Doanh thu & Lợi nhuận P&L
              </h1>
              <p className="text-[11px] sm:text-xs text-neutral-400 print:text-gray-600">
                {currentShop?.name || 'DuckPOS Pro'} · Thời gian: <span className="text-amber-400 font-bold print:text-black">{timeLabel}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Xuất Excel / CSV</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 border border-red-600/50"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>In Báo Cáo</span>
          </button>
        </div>
      </div>

      {/* Time Range Selector Bar */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-lg print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-400" />
            Khoảng thời gian:
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: 'yesterday', label: 'Hôm qua' },
              { id: '7days', label: '7 ngày qua' },
              { id: '30days', label: '30 ngày qua' },
              { id: 'this_month', label: 'Tháng này' },
              { id: 'last_month', label: 'Tháng trước' },
              { id: 'custom', label: 'Tùy chọn ngày' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id as typeof timeRange)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  timeRange === tab.id
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {timeRange === 'custom' && (
          <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Từ ngày:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Đến ngày:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-56 text-neutral-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="text-xs">Đang tổng hợp dữ liệu tài chính thời gian thực...</span>
        </div>
      ) : (
        <>
          {/* Main P&L Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Net Revenue */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-1">
              <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block">Doanh thu thuần</span>
              <h3 className="text-base sm:text-2xl font-black text-white truncate">
                {formatCurrency(totalRevenue)}
              </h3>
              <div className="text-[10px] text-neutral-400 flex items-center justify-between pt-1">
                <span>{totalOrdersCount} đơn hàng</span>
                <span>TB {formatCurrency(averageOrderValue)}/đơn</span>
              </div>
            </div>

            {/* COGS (Giá vốn) */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-1">
              <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block">Giá vốn hàng bán (COGS)</span>
              <h3 className="text-base sm:text-2xl font-black text-amber-400 truncate">
                {formatCurrency(totalCogs)}
              </h3>
              <div className="text-[10px] text-neutral-400 pt-1">
                {totalRevenue > 0 ? `${((totalCogs / totalRevenue) * 100).toFixed(1)}% doanh thu` : '0%'}
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-1">
              <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block">Lợi nhuận gộp</span>
              <h3 className="text-base sm:text-2xl font-black text-emerald-400 truncate">
                {formatCurrency(grossProfit)}
              </h3>
              <div className="text-[10px] text-emerald-400 font-semibold pt-1">
                Biên lãi gộp: {grossMarginPercent}%
              </div>
            </div>

            {/* Net Profit (Lãi ròng) */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-1">
              <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block">Lợi nhuận ròng (Net Profit)</span>
              <h3
                className={`text-base sm:text-2xl font-black truncate ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(netProfit)}
              </h3>
              <div className="text-[10px] text-neutral-400 pt-1">
                Biên lãi ròng: <strong className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{netMarginPercent}%</strong>
              </div>
            </div>
          </div>

          {/* Visual Cost & Profit Breakdown Bar */}
          {totalRevenue > 0 && (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-amber-400" />
                  Cấu trúc phân bổ 100% doanh thu
                </span>
                <span className="text-neutral-400 text-[11px]">Tổng 100% Net Sales</span>
              </div>

              {/* Multi-segment bar */}
              <div className="h-4 w-full bg-neutral-950 rounded-full overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, (totalCogs / totalRevenue) * 100))}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`Giá vốn COGS: ${((totalCogs / totalRevenue) * 100).toFixed(1)}%`}
                />
                <div
                  style={{ width: `${Math.min(100, Math.max(0, (totalOperatingExpense / totalRevenue) * 100))}%` }}
                  className="bg-purple-500 h-full transition-all"
                  title={`Chi phí vận hành: ${((totalOperatingExpense / totalRevenue) * 100).toFixed(1)}%`}
                />
                <div
                  style={{ width: `${Math.min(100, Math.max(0, (Math.max(0, netProfit) / totalRevenue) * 100))}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Lợi nhuận ròng: ${netMarginPercent}%`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-neutral-400">Giá vốn:</span>
                  <strong className="text-white">{formatCurrency(totalCogs)} ({((totalCogs / totalRevenue) * 100).toFixed(1)}%)</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-neutral-400">Chi phí vận hành:</span>
                  <strong className="text-white">{formatCurrency(totalOperatingExpense)} ({((totalOperatingExpense / totalRevenue) * 100).toFixed(1)}%)</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-neutral-400">Lãi ròng thực nhận:</span>
                  <strong className="text-emerald-400">{formatCurrency(netProfit)} ({netMarginPercent}%)</strong>
                </div>
              </div>
            </div>
          )}

          {/* Payment breakdown & Cashflow summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
                Dòng tiền Tiền mặt (Cash)
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                    {formatCurrency(cashTotal)}
                  </div>
                  <span className="text-xs text-neutral-400">Chiếm {cashPercent}% tổng doanh thu</span>
                </div>
                <div className="text-right text-xs text-neutral-400">
                  <div>Thu ngân thu trực tiếp</div>
                  <div className="text-neutral-300 font-mono mt-0.5">{filteredOrders.filter((o) => o.paymentMethod === 'cash').length} đơn</div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-400" />
                Dòng tiền Chuyển khoản (VietQR / Autobank)
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-blue-400 tabular-nums">
                    {formatCurrency(transferTotal)}
                  </div>
                  <span className="text-xs text-neutral-400">Chiếm {transferPercent}% tổng doanh thu</span>
                </div>
                <div className="text-right text-xs text-neutral-400">
                  <div>Tài khoản ngân hàng của quán</div>
                  <div className="text-neutral-300 font-mono mt-0.5">{filteredOrders.filter((o) => o.paymentMethod === 'transfer').length} đơn</div>
                </div>
              </div>
            </div>
          </div>

          {/* Missing cost price alert */}
          {itemsSoldWithoutCost > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Phát hiện <strong>{itemsSoldWithoutCost}</strong> lượt bán của món ăn chưa cập nhật giá vốn (costPrice = 0₫).
                Vui lòng cập nhật giá vốn trong mục Sản phẩm để báo cáo P&L tính chính xác nhất.
              </span>
            </div>
          )}

          {/* Detailed Reports Navigation Tabs */}
          <div className="flex border-b border-neutral-800 print:hidden">
            <button
              onClick={() => setActiveTab('pnl')}
              className={`py-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'pnl' ? 'border-amber-500 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Bảng kê P&L Chi tiết</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`py-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'products' ? 'border-amber-500 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Ma trận Lợi nhuận Món ({productMatrixList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`py-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'shifts' ? 'border-amber-500 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Đối soát Ca làm việc ({filteredShifts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'expenses' ? 'border-amber-500 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Chi phí Vận hành OPEX ({filteredExpenses.length})</span>
            </button>
          </div>

          {/* TAB 1: P&L FORMAL STATEMENT */}
          {activeTab === 'pnl' && (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl p-4 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-neutral-800 pb-3">
                <Receipt className="w-4 h-4 text-amber-400" />
                Báo cáo kết quả hoạt động kinh doanh (P&L Formal Statement)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase bg-neutral-950/60">
                      <th className="py-2.5 px-4">Khoản mục</th>
                      <th className="py-2.5 px-4 text-right">Số tiền (₫)</th>
                      <th className="py-2.5 px-4 text-right">Tỷ lệ % Doanh thu</th>
                      <th className="py-2.5 px-4">Ghi chú nghiệp vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 text-xs">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">1. Tổng doanh số bán (Gross Sales)</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">{formatCurrency(totalGrossSales)}</td>
                      <td className="py-3 px-4 text-right text-neutral-400">100%</td>
                      <td className="py-3 px-4 text-neutral-400 text-[11px]">Tổng giá niêm yết các món đã bán</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-red-300">2. Giảm giá & Chiết khấu (Discounts)</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-400 tabular-nums">-{formatCurrency(totalDiscount)}</td>
                      <td className="py-3 px-4 text-right text-red-400">{totalGrossSales > 0 ? ((totalDiscount / totalGrossSales) * 100).toFixed(1) : 0}%</td>
                      <td className="py-3 px-4 text-neutral-400 text-[11px]">Chiết khấu khuyến mãi tại quầy</td>
                    </tr>
                    <tr className="bg-neutral-950/50 font-bold">
                      <td className="py-3 px-4 text-amber-300">3. DOANH THU THUẦN (Net Revenue)</td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400 tabular-nums">{formatCurrency(totalRevenue)}</td>
                      <td className="py-3 px-4 text-right text-amber-400">100.0%</td>
                      <td className="py-3 px-4 text-neutral-300 text-[11px]">Doanh thu thực tế sau chiết khấu</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-neutral-300">4. Giá vốn hàng bán (COGS - Nguyên vật liệu)</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-300 tabular-nums">-{formatCurrency(totalCogs)}</td>
                      <td className="py-3 px-4 text-right text-neutral-400">{totalRevenue > 0 ? ((totalCogs / totalRevenue) * 100).toFixed(1) : 0}%</td>
                      <td className="py-3 px-4 text-neutral-400 text-[11px]">Vịt thịt, rau dưa, bánh bao, gia vị xuất bán</td>
                    </tr>
                    <tr className="bg-emerald-950/20 font-bold">
                      <td className="py-3 px-4 text-emerald-300">5. LỢI NHUẬN GỘP (Gross Profit)</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 tabular-nums">{formatCurrency(grossProfit)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">{grossMarginPercent}%</td>
                      <td className="py-3 px-4 text-neutral-300 text-[11px]">Lãi gộp sản phẩm</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-neutral-300">6. Chi phí vận hành cửa hàng (OPEX)</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-400 tabular-nums">-{formatCurrency(totalOperatingExpense)}</td>
                      <td className="py-3 px-4 text-right text-neutral-400">{totalRevenue > 0 ? ((totalOperatingExpense / totalRevenue) * 100).toFixed(1) : 0}%</td>
                      <td className="py-3 px-4 text-neutral-400 text-[11px]">Điện, than nướng, lương nhân viên, bao bì...</td>
                    </tr>
                    <tr className="bg-neutral-950 font-black text-sm border-t-2 border-neutral-700">
                      <td className="py-3.5 px-4 text-white">7. LỢI NHUẬN THUẦN RÒNG (Net Profit)</td>
                      <td className={`py-3.5 px-4 text-right font-mono tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(netProfit)}
                      </td>
                      <td className={`py-3.5 px-4 text-right ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {netMarginPercent}%
                      </td>
                      <td className="py-3.5 px-4 text-neutral-300 text-xs font-normal">
                        {netProfit >= 0 ? 'Hoạt động kinh doanh sinh lời tốt' : 'Đang tạm thời chịu lỗ trong kỳ này'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT PROFITABILITY MATRIX */}
          {activeTab === 'products' && (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
              {productMatrixList.length === 0 ? (
                <div className="p-10 text-center text-xs text-neutral-400">
                  Chưa phát sinh lượt bán món nào trong khoảng thời gian này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase bg-neutral-950/60">
                        <th className="py-3 px-4">Tên món ăn</th>
                        <th className="py-3 px-4 text-center">Đơn vị</th>
                        <th className="py-3 px-4 text-center">SL bán ra</th>
                        <th className="py-3 px-4 text-right">Tổng doanh thu</th>
                        <th className="py-3 px-4 text-right">Tổng giá vốn</th>
                        <th className="py-3 px-4 text-right">Lợi nhuận gộp</th>
                        <th className="py-3 px-4 text-right">Biên lãi %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-xs">
                      {productMatrixList.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            <div>{item.name}</div>
                            {item.costPrice <= 0 && (
                              <span className="text-[10px] text-amber-400 font-normal">Chưa có giá vốn</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center text-neutral-400">
                            {UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS] || item.unit}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-400 tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-white tabular-nums">
                            {formatCurrency(item.revenue)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                            {formatCurrency(item.cogs)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400 tabular-nums">
                            {formatCurrency(item.profit)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums">
                            <span className={item.marginPercent >= 30 ? 'text-emerald-400' : 'text-amber-400'}>
                              {item.marginPercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SHIFTS RECONCILIATION */}
          {activeTab === 'shifts' && (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
              {filteredShifts.length === 0 ? (
                <div className="p-10 text-center text-xs text-neutral-400">
                  Chưa có ca làm việc nào được mở/đóng trong khoảng thời gian này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase bg-neutral-950/60">
                        <th className="py-3 px-4">Mã ca</th>
                        <th className="py-3 px-4">Thu ngân</th>
                        <th className="py-3 px-4">Bắt đầu</th>
                        <th className="py-3 px-4">Kết thúc</th>
                        <th className="py-3 px-4 text-right">Tiền mặt bán</th>
                        <th className="py-3 px-4 text-right">Chuyển khoản</th>
                        <th className="py-3 px-4 text-right">Tiền đếm két</th>
                        <th className="py-3 px-4 text-center">Độ lệch két</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-xs">
                      {filteredShifts.map((s) => (
                        <tr key={s.id} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-amber-400 font-mono">
                            {s.shiftCode}
                          </td>
                          <td className="py-3 px-4 text-white font-medium">
                            {s.cashierName}
                          </td>
                          <td className="py-3 px-4 text-neutral-400 text-[11px]">
                            {formatDateTime(s.startTime)}
                          </td>
                          <td className="py-3 px-4 text-neutral-400 text-[11px]">
                            {s.endTime ? formatDateTime(s.endTime) : <span className="text-emerald-400 font-bold">Đang mở</span>}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400 tabular-nums">
                            {formatCurrency(s.totalCashSales || 0)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-blue-400 tabular-nums">
                            {formatCurrency(s.totalTransferSales || 0)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-white tabular-nums">
                            {s.actualCashCounted !== undefined ? formatCurrency(s.actualCashCounted) : '---'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {s.discrepancy === undefined ? (
                              <span className="text-neutral-500">Chưa chốt</span>
                            ) : s.discrepancy === 0 ? (
                              <span className="text-[11px] text-emerald-400 font-bold">Khớp 100%</span>
                            ) : s.discrepancy > 0 ? (
                              <span className="text-[11px] text-blue-400 font-bold">Thừa +{formatCurrency(s.discrepancy)}</span>
                            ) : (
                              <span className="text-[11px] text-red-400 font-bold">Thiếu {formatCurrency(s.discrepancy)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OPERATING EXPENSES DETAIL */}
          {activeTab === 'expenses' && (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
              {filteredExpenses.length === 0 ? (
                <div className="p-10 text-center text-xs text-neutral-400">
                  Chưa có phiếu chi vận hành nào được ghi nhận trong khoảng thời gian này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase bg-neutral-950/60">
                        <th className="py-3 px-4">Ngày chi</th>
                        <th className="py-3 px-4">Danh mục</th>
                        <th className="py-3 px-4">Nội dung chi phí</th>
                        <th className="py-3 px-4 text-right">Số tiền chi</th>
                        <th className="py-3 px-4">Người thực hiện</th>
                        <th className="py-3 px-4">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-xs">
                      {filteredExpenses.map((e) => (
                        <tr key={e.id} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-neutral-400">{e.date}</td>
                          <td className="py-3 px-4 font-semibold text-amber-300">
                            {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{e.title}</td>
                          <td className="py-3 px-4 text-right font-bold text-red-400 tabular-nums">
                            -{formatCurrency(e.amount)}
                          </td>
                          <td className="py-3 px-4 text-neutral-300">{e.performedBy}</td>
                          <td className="py-3 px-4 text-neutral-500 text-[11px]">{e.note || '---'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
