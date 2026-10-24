import React from 'react';
import { Order, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import {
  X,
  Receipt,
  Printer,
  Edit3,
  Ban,
  Trash2,
  User,
  Phone,
  Clock,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertOctagon,
  FileText,
  UtensilsCrossed,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: Order;
  isOwner: boolean;
  onClose: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOwner,
  onClose,
  onPrint,
  onEdit,
  onCancel,
  onDelete,
}) => {
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Chi Tiết Hóa Đơn {order.orderCode}
                </h3>
                {isCancelled ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-bold">
                    Đã hủy
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                    Đã thanh toán
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3" />
                <span>{formatDateTime(order.createdAt)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-[11px]">
            <div>
              <span className="text-neutral-500 block">Thu ngân lập đơn:</span>
              <span className="font-semibold text-white">{order.cashierName || 'Thu ngân'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Hình thức:</span>
              <span className="font-semibold text-neutral-200">
                {order.diningOption === 'dine_in' ? 'Tại quán' : 'Mang về'}
              </span>
            </div>
            {order.customerName && (
              <div className="col-span-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                <div>
                  <span className="text-neutral-500 block">Khách hàng:</span>
                  <span className="font-bold text-amber-300">{order.customerName}</span>
                </div>
                {order.customerPhone && (
                  <span className="text-neutral-400 font-mono">{order.customerPhone}</span>
                )}
              </div>
            )}
            <div className="col-span-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
              <span className="text-neutral-500">Phương thức thanh toán:</span>
              <span className="font-bold text-white flex items-center gap-1">
                {order.paymentMethod === 'cash' ? (
                  <>
                    <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tiền mặt</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>Chuyển khoản VietQR (SePay)</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Cancellation Info (if cancelled) */}
          {isCancelled && order.cancellationReason && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-red-400">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Thông tin hủy đơn:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Lý do: <i>"{order.cancellationReason}"</i>
              </p>
              <p className="text-[10px] text-red-400/80">
                Toàn bộ nguyên liệu của đơn hàng đã được hệ thống tự động hoàn lại kho.
              </p>
            </div>
          )}

          {/* Edit History (if edited) */}
          {order.editedAt && (
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Lịch sử chỉnh sửa hóa đơn:</span>
              </div>
              <p className="text-neutral-400">
                Sửa lúc: {formatDateTime(order.editedAt)} bởi{' '}
                <strong className="text-white">{order.editedBy || 'Chủ quán'}</strong>
              </p>
              {order.editReason && (
                <p className="text-neutral-300 italic">
                  Lý do: "{order.editReason}"
                </p>
              )}
            </div>
          )}

          {/* Item Lines */}
          <div className="space-y-2">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
              Chi Tiết Món Ăn ({order.items.length})
            </span>

            <div className="bg-neutral-950 rounded-xl border border-neutral-800 divide-y divide-neutral-800/80 overflow-hidden">
              {order.items.map((it, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{it.name}</div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                      <span>
                        {it.unit === 'kg' ? `${it.weightKg} kg` : `${it.quantity} ${UNIT_LABELS[it.unit] || it.unit}`}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">{formatCurrency(it.unitPrice)}</span>
                    </div>
                    {it.prepNote && (
                      <div className="text-[10px] text-amber-300 italic mt-0.5">
                        Ghi chú: {it.prepNote}
                      </div>
                    )}
                  </div>
                  <div className="font-bold text-amber-400 tabular-nums">
                    {formatCurrency(it.totalPrice)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Tổng tiền hàng:</span>
              <span className="font-semibold text-white tabular-nums">
                {formatCurrency(order.subtotal)}
              </span>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Giảm giá:</span>
                <span className="font-semibold tabular-nums">
                  -{formatCurrency(order.discount)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-neutral-800">
              <span>Khách đã trả:</span>
              <span className="text-base text-amber-400 tabular-nums font-black">
                {formatCurrency(order.finalTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {isOwner && (
              <button
                type="button"
                onClick={onDelete}
                className="py-2 px-2.5 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-900 border border-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Xóa vĩnh viễn hóa đơn (Chỉ Chủ quán)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xóa vĩnh viễn</span>
              </button>
            )}

            {!isCancelled && (
              <button
                type="button"
                onClick={onCancel}
                className="py-2 px-2.5 rounded-xl text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 border border-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Hủy hóa đơn và hoàn tồn kho"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Hủy đơn</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCancelled && isOwner && (
              <button
                type="button"
                onClick={onEdit}
                className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-amber-500/30 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa hóa đơn</span>
              </button>
            )}

            <button
              type="button"
              onClick={onPrint}
              className="py-2 px-3.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In lại hóa đơn</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
