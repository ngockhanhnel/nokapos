import React from 'react';
import { HoldOrder, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { PauseCircle, PlayCircle, Trash2, X, Clock, ShoppingCart } from 'lucide-react';

interface HoldOrdersModalProps {
  holdOrders: HoldOrder[];
  onRecallOrder: (order: HoldOrder) => void;
  onDeleteHoldOrder: (id: string) => void;
  onClose: () => void;
}

export const HoldOrdersModal: React.FC<HoldOrdersModalProps> = ({
  holdOrders,
  onRecallOrder,
  onDeleteHoldOrder,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Danh sách đơn đang treo ({holdOrders.length})
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-neutral-400 shrink-0">
          Các đơn hàng tạm hoãn để phục vụ khách khác. Chọn "Tiếp tục bán" để khôi phục lại giỏ hàng:
        </p>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {holdOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Không có đơn nào đang treo.
            </div>
          ) : (
            holdOrders.map((h) => {
              const totalAmount = h.items.reduce((s, it) => s + it.totalPrice, 0);
              return (
                <div
                  key={h.id}
                  className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="text-amber-400">{h.code}</span>
                        <span>·</span>
                        <span>{h.label}</span>
                        {h.customerName && (
                          <span className="text-[10px] bg-red-950/70 border border-red-800 text-red-200 px-1.5 py-0.5 rounded font-medium">
                            Khách: {h.customerName}
                          </span>
                        )}
                        <span className="text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                          {h.diningOption === 'takeaway' ? 'Mang về' : 'Tại quán'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(h.createdAt)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-extrabold text-amber-300 tabular-nums">
                        {formatCurrency(totalAmount)}
                      </div>
                      <div className="text-[10px] text-neutral-500">{h.items.length} món</div>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="text-[11px] text-neutral-400 border-t border-neutral-900 pt-1.5 space-y-0.5">
                    {h.items.map((it, idx) => (
                      <div key={idx} className="truncate flex justify-between">
                        <span>
                          {it.unit === 'kg' ? `${it.weightKg} kg` : `${it.quantity} ${UNIT_LABELS[it.unit] || it.unit}`}{' '}
                          {it.name}
                        </span>
                        <span className="tabular-nums">{formatCurrency(it.totalPrice)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-900">
                    <button
                      onClick={() => onDeleteHoldOrder(h.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hủy</span>
                    </button>

                    <button
                      onClick={() => onRecallOrder(h)}
                      className="py-1 px-3 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Tiếp tục thanh toán</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-neutral-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
