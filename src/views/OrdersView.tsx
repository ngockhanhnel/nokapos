import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { Order, OrderStatus, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { ReceiptPrintModal } from '@/src/components/ReceiptPrintModal';
import {
  Receipt,
  Search,
  Printer,
  Ban,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  X,
  CreditCard,
  Banknote,
  QrCode,
} from 'lucide-react';

interface OrdersViewProps {
  onNavigateToPos: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onNavigateToPos }) => {
  const { currentShop, userRole, userProfile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // Modals
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  useEffect(() => {
    if (!currentShop?.id) return;

    const ordRef = collection(db, 'shops', currentShop.id, 'orders');
    const q = query(ordRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Order[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
        setOrders(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/orders`);
      }
    );

    return () => unsubscribe();
  }, [currentShop?.id]);

  const handleConfirmCancel = async () => {
    if (!currentShop?.id || !orderToCancel || !isManagerOrOwner) return;
    if (!cancelReason.trim()) {
      alert('Vui lòng nhập lý do hủy đơn hàng.');
      return;
    }

    try {
      setCancelling(true);
      const now = new Date().toISOString();

      await runTransaction(db, async (t) => {
        const orderRef = doc(db, 'shops', currentShop.id, 'orders', orderToCancel.id);
        t.update(orderRef, {
          status: 'cancelled',
          cancellationReason: cancelReason.trim(),
          updatedAt: now,
        });

        // Restock inventory for items in cancelled order
        for (const item of orderToCancel.items) {
          const productRef = doc(db, 'shops', currentShop.id, 'products', item.productId);
          const pDoc = await t.get(productRef);
          if (pDoc.exists()) {
            const currentStock = pDoc.data().stockQuantity || 0;
            const refundQty = item.unit === 'kg' ? (item.weightKg || 1) : item.quantity;
            t.update(productRef, {
              stockQuantity: currentStock + refundQty,
              updatedAt: now,
            });

            const movId = 'mov_' + Math.random().toString(36).substring(2, 10);
            const movRef = doc(db, 'shops', currentShop.id, 'inventoryMovements', movId);
            t.set(movRef, {
              productId: item.productId,
              productName: item.name,
              type: 'in',
              quantity: refundQty,
              reason: `Hoàn kho do hủy đơn ${orderToCancel.orderCode}`,
              performedBy: userProfile?.displayName || user?.email || 'Quản lý',
              createdAt: now,
            });
          }
        }
      });

      setOrderToCancel(null);
      setCancelReason('');
    } catch (err: unknown) {
      console.error(err);
      alert('Không thể hủy đơn hàng. Vui lòng thử lại.');
    } finally {
      setCancelling(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderCode.toLowerCase().includes(search.toLowerCase()) ||
      (o.cashierName && o.cashierName.toLowerCase().includes(search.toLowerCase())) ||
      (o.customerName && o.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (o.customerPhone && o.customerPhone.includes(search));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || o.paymentMethod === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            Lịch sử Đơn hàng
          </h2>
          <p className="text-xs text-neutral-400">
            Xem chi tiết giao dịch quầy, in lại hóa đơn nhiệt và hủy đơn hoàn kho
          </p>
        </div>

        <button
          onClick={onNavigateToPos}
          className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Receipt className="w-4 h-4" />
          Mở quầy bán hàng POS
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn (VQ...), tên thu ngân..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="cancelled">Đã hủy đơn</option>
          </select>

          {/* Payment filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500"
          >
            <option value="all">Tất cả phương thức</option>
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản VietQR</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải dữ liệu đơn hàng...
        </div>
      ) : orders.length === 0 ? (
        /* Empty state */
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-amber-500 mb-3">
            <Receipt className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Chưa có đơn hàng nào</h3>
          <p className="text-xs text-neutral-400 max-w-sm mb-4">
            Quán chưa phát sinh giao dịch bán hàng nào. Hãy chuyển sang màn hình Bán hàng (POS) để tạo đơn đầu tiên.
          </p>
          <button
            onClick={onNavigateToPos}
            className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
          >
            Tạo đơn hàng ngay
          </button>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Mã đơn hàng</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Thu ngân</th>
                  <th className="py-3 px-4">Chi tiết món đã bán</th>
                  <th className="py-3 px-4 text-center">Hình thức</th>
                  <th className="py-3 px-4 text-right">Tổng thanh toán</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                {filteredOrders.map((ord) => {
                  const isCancelled = ord.status === 'cancelled';
                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        isCancelled ? 'opacity-60 bg-red-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 tabular-nums">
                        <div className="font-bold text-amber-400">{ord.orderCode}</div>
                        {ord.customerName && (
                          <div className="text-[11px] text-neutral-400 font-normal flex items-center gap-1 mt-0.5">
                            <span className="text-white font-medium">{ord.customerName}</span>
                            {ord.customerPhone && (
                              <span className="text-neutral-500 font-mono text-[10px]">({ord.customerPhone})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-400 tabular-nums">
                        {formatDateTime(ord.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-neutral-300">{ord.cashierName}</td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-[11px] text-neutral-300 space-y-0.5">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="truncate">
                              <span className="font-semibold text-white">
                                {it.unit === 'kg' ? `${it.weightKg} kg` : `${it.quantity} ${UNIT_LABELS[it.unit] || it.unit}`}
                              </span>{' '}
                              {it.name}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-300">
                          {ord.paymentMethod === 'cash' ? (
                            <>
                              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                              Tiền mặt
                            </>
                          ) : (
                            <>
                              <QrCode className="w-3.5 h-3.5 text-blue-400" />
                              VietQR
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-amber-300 tabular-nums">
                        {formatCurrency(ord.finalTotal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCancelled ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-[11px] font-bold text-red-400 bg-red-950/80 border border-red-800/60 rounded px-2 py-0.5">
                              Đã hủy
                            </span>
                            {ord.cancellationReason && (
                              <span className="text-[10px] text-neutral-500 mt-0.5 max-w-[120px] truncate" title={ord.cancellationReason}>
                                {ord.cancellationReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded px-2 py-0.5">
                            Hoàn tất
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOrderForReceipt(ord)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            title="In lại hóa đơn"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {!isCancelled && isManagerOrOwner && (
                            <button
                              onClick={() => {
                                setOrderToCancel(ord);
                                setCancelReason('');
                              }}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                              title="Hủy đơn và hoàn tồn kho"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPRINT RECEIPT MODAL */}
      {selectedOrderForReceipt && (
        <ReceiptPrintModal
          order={selectedOrderForReceipt}
          shop={currentShop}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}

      {/* CANCEL ORDER CONFIRMATION MODAL */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <Ban className="w-4 h-4" />
                Hủy đơn hàng {orderToCancel.orderCode}
              </h3>
              <button
                onClick={() => setOrderToCancel(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300">
              Khi hủy đơn hàng, toàn bộ các món trong đơn ({formatCurrency(orderToCancel.finalTotal)}) sẽ được tự động hoàn lại tồn kho tương ứng.
            </p>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Lý do hủy đơn <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Ví dụ: Khách đổi ý, Nhập sai số ký..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Xác nhận hủy đơn
              </button>
              <button
                onClick={() => setOrderToCancel(null)}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
