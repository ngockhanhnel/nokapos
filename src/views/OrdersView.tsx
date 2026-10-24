import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { Order, Product, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { ReceiptPrintModal } from '@/src/components/ReceiptPrintModal';
import { EditOrderModal } from '@/src/components/EditOrderModal';
import { OrderDetailModal } from '@/src/components/OrderDetailModal';
import {
  Receipt,
  Search,
  Printer,
  Ban,
  Clock,
  Loader2,
  Eye,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Edit3,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface OrdersViewProps {
  onNavigateToPos: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onNavigateToPos }) => {
  const { currentShop, userRole, userProfile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // Modals & Actions
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [orderForDetail, setOrderForDetail] = useState<Order | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Delete modal (Owner only)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleteRestockOption, setDeleteRestockOption] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const isOwner = userRole === 'owner';
  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  // Listen to orders
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

  // Listen to products for edit modal
  useEffect(() => {
    if (!currentShop?.id) return;
    const prodRef = collection(db, 'shops', currentShop.id, 'products');
    const unsubscribe = onSnapshot(prodRef, (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
      setProducts(list);
    });
    return () => unsubscribe();
  }, [currentShop?.id]);

  // Cancel order handler
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

  // Hard Delete order handler (Owner only)
  const handleConfirmDelete = async () => {
    if (!currentShop?.id || !orderToDelete || !isOwner) return;

    try {
      setDeleting(true);
      const now = new Date().toISOString();

      await runTransaction(db, async (t) => {
        const orderRef = doc(db, 'shops', currentShop.id, 'orders', orderToDelete.id);

        // If restock is selected and order was not already cancelled
        if (deleteRestockOption && orderToDelete.status !== 'cancelled') {
          for (const item of orderToDelete.items) {
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
                reason: `Hoàn kho do xóa vĩnh viễn đơn ${orderToDelete.orderCode}`,
                performedBy: userProfile?.displayName || user?.email || 'Chủ quán',
                createdAt: now,
              });
            }
          }
        }

        // Delete order document
        t.delete(orderRef);
      });

      setOrderToDelete(null);
    } catch (err: unknown) {
      console.error(err);
      alert('Không thể xóa đơn hàng. Vui lòng thử lại.');
    } finally {
      setDeleting(false);
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
    <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen pb-24 lg:pb-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            Lịch Sử & Quản Trị Hóa Đơn Chuyên Sâu
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Xem chi tiết, in lại hóa đơn, chỉnh sửa món ăn/hoàn trả tồn kho và quản lý xóa/hủy đơn an toàn
          </p>
        </div>

        <button
          onClick={onNavigateToPos}
          className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto active:scale-95"
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
            placeholder="Tìm theo mã đơn (VQ...), tên khách, SĐT, thu ngân..."
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

      {/* Orders List / Empty State */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải dữ liệu hóa đơn...
        </div>
      ) : orders.length === 0 ? (
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
        <div className="space-y-3">
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden lg:block bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Mã đơn hàng</th>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Thu ngân</th>
                    <th className="py-3 px-4">Chi tiết món đã bán</th>
                    <th className="py-3 px-4 text-center">Hình thức</th>
                    <th className="py-3 px-4 text-right">Tổng tiền</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Tác vụ quản trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {filteredOrders.map((ord) => {
                    const isCancelled = ord.status === 'cancelled';
                    return (
                      <tr
                        key={ord.id}
                        className={`hover:bg-neutral-800/40 transition-colors ${
                          isCancelled ? 'opacity-65 bg-red-950/10' : ''
                        }`}
                      >
                        <td className="py-3 px-4 tabular-nums">
                          <button
                            type="button"
                            onClick={() => setOrderForDetail(ord)}
                            className="font-bold text-amber-400 hover:underline text-left block"
                          >
                            {ord.orderCode}
                          </button>
                          {ord.customerName && (
                            <div className="text-[11px] text-neutral-400 font-normal flex items-center gap-1 mt-0.5">
                              <span className="text-white font-medium">{ord.customerName}</span>
                              {ord.customerPhone && (
                                <span className="text-neutral-500 font-mono text-[10px]">({ord.customerPhone})</span>
                              )}
                            </div>
                          )}
                          {ord.editedAt && (
                            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Đã sửa món
                            </span>
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setOrderForDetail(ord)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                              title="Xem chi tiết hóa đơn"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setSelectedOrderForReceipt(ord)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                              title="In lại hóa đơn"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Edit button: Owner only */}
                            {!isCancelled && isOwner && (
                              <button
                                onClick={() => setOrderToEdit(ord)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
                                title="Chỉnh sửa hóa đơn & cân đối kho (Chỉ Chủ quán)"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Cancel button */}
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

                            {/* Hard delete button: Owner only */}
                            {isOwner && (
                              <button
                                onClick={() => {
                                  setOrderToDelete(ord);
                                  setDeleteRestockOption(ord.status !== 'cancelled');
                                }}
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-neutral-800 transition-colors"
                                title="Xóa vĩnh viễn hóa đơn (Chỉ Chủ quán)"
                              >
                                <Trash2 className="w-4 h-4" />
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

          {/* MOBILE RESPONSIVE CARD VIEW */}
          <div className="lg:hidden space-y-2.5">
            {filteredOrders.map((ord) => {
              const isCancelled = ord.status === 'cancelled';
              return (
                <div
                  key={ord.id}
                  className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 space-y-3 shadow-sm ${
                    isCancelled ? 'opacity-70 bg-red-950/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOrderForDetail(ord)}
                          className="font-extrabold text-amber-400 text-sm hover:underline"
                        >
                          {ord.orderCode}
                        </button>
                        {isCancelled ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-bold">
                            Đã hủy
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                            Hoàn tất
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        <span>{formatDateTime(ord.createdAt)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-amber-300 text-sm tabular-nums">
                        {formatCurrency(ord.finalTotal)}
                      </div>
                      <div className="text-[10px] text-neutral-400 flex items-center justify-end gap-1 mt-0.5">
                        {ord.paymentMethod === 'cash' ? (
                          <>
                            <Banknote className="w-3 h-3 text-emerald-400" />
                            <span>Tiền mặt</span>
                          </>
                        ) : (
                          <>
                            <QrCode className="w-3 h-3 text-blue-400" />
                            <span>VietQR</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer line */}
                  {ord.customerName && (
                    <div className="text-xs text-neutral-300 bg-neutral-950 px-2.5 py-1.5 rounded-lg border border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-400">Khách: {ord.customerName}</span>
                      {ord.customerPhone && (
                        <span className="text-neutral-500 font-mono text-[11px]">{ord.customerPhone}</span>
                      )}
                    </div>
                  )}

                  {/* Items summary */}
                  <div className="text-[11px] text-neutral-300 space-y-1 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/60">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-neutral-200">
                          {it.unit === 'kg' ? `${it.weightKg} kg` : `${it.quantity} ${UNIT_LABELS[it.unit] || it.unit}`} · {it.name}
                        </span>
                        <span className="text-neutral-400 tabular-nums">{formatCurrency(it.totalPrice)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-xs">
                    <button
                      type="button"
                      onClick={() => setOrderForDetail(ord)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Chi tiết</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForReceipt(ord)}
                        className="p-1.5 rounded-lg text-neutral-300 hover:bg-neutral-800 border border-neutral-700"
                        title="In bill"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {!isCancelled && isOwner && (
                        <button
                          type="button"
                          onClick={() => setOrderToEdit(ord)}
                          className="px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                      )}

                      {!isCancelled && isManagerOrOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderToCancel(ord);
                            setCancelReason('');
                          }}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-neutral-800 border border-red-900/60"
                          title="Hủy đơn"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderToDelete(ord);
                            setDeleteRestockOption(ord.status !== 'cancelled');
                          }}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800"
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {orderForDetail && (
        <OrderDetailModal
          order={orderForDetail}
          isOwner={isOwner}
          onClose={() => setOrderForDetail(null)}
          onPrint={() => {
            setSelectedOrderForReceipt(orderForDetail);
          }}
          onEdit={() => {
            const current = orderForDetail;
            setOrderForDetail(null);
            setOrderToEdit(current);
          }}
          onCancel={() => {
            const current = orderForDetail;
            setOrderForDetail(null);
            setOrderToCancel(current);
            setCancelReason('');
          }}
          onDelete={() => {
            const current = orderForDetail;
            setOrderForDetail(null);
            setOrderToDelete(current);
            setDeleteRestockOption(current.status !== 'cancelled');
          }}
        />
      )}

      {/* EDIT MODAL (Owner only) */}
      {currentShop && orderToEdit && (
        <EditOrderModal
          order={orderToEdit}
          shopId={currentShop.id}
          products={products}
          onClose={() => setOrderToEdit(null)}
          onSuccess={(updated) => {
            setOrderToEdit(null);
            alert(`Đã cập nhật hóa đơn ${updated.orderCode} và điều chỉnh tồn kho tự động thành công!`);
          }}
        />
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

      {/* HARD DELETE CONFIRMATION MODAL (Owner only) */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-red-900/60 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-red-500 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Xóa Vĩnh Viễn Hóa Đơn {orderToDelete.orderCode}
              </h3>
              <button
                onClick={() => setOrderToDelete(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Cảnh báo nguy hiểm!</span>
              </div>
              <p>
                Thao tác này sẽ xóa hoàn toàn hóa đơn khỏi cơ sở dữ liệu và không thể hoàn tác.
              </p>
            </div>

            {orderToDelete.status !== 'cancelled' && (
              <label className="flex items-start gap-2 text-xs text-neutral-300 cursor-pointer bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                <input
                  type="checkbox"
                  checked={deleteRestockOption}
                  onChange={(e) => setDeleteRestockOption(e.target.checked)}
                  className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4 mt-0.5 shrink-0"
                />
                <div>
                  <span className="font-semibold text-white">Tự động hoàn trả tồn kho</span>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Cộng ngược lại số lượng các món trong đơn ({formatCurrency(orderToDelete.finalTotal)}) vào kho hàng.
                  </p>
                </div>
              </label>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Xác nhận xóa vĩnh viễn
              </button>
              <button
                onClick={() => setOrderToDelete(null)}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
