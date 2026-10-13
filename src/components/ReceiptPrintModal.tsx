import React, { useRef } from 'react';
import { Order, Shop } from '@/src/types';
import { formatCurrency, formatDateTime, UNIT_LABELS } from '@/src/lib/formatters';
import { Printer, X, CheckCircle } from 'lucide-react';

interface ReceiptPrintModalProps {
  order: Order;
  shop: Shop | null;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  order,
  shop,
  onClose,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      {/* Container - on screen it is a modal; during print it takes full thermal paper */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-neutral-100 print:border-none print:shadow-none print:p-2 print:text-black print:bg-white print:max-w-none print:w-[80mm]">
        {/* Modal actions (hidden in print) */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Đơn hàng đã ghi nhận
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Body */}
        <div
          ref={receiptRef}
          className="font-mono text-xs bg-white text-black p-4 rounded-lg shadow-inner print:shadow-none print:p-0"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-gray-400 space-y-1">
            <h2 className="text-base font-bold tracking-tight uppercase">
              {shop?.name || 'QUÁN VỊT QUAY'}
            </h2>
            {shop?.address && <p className="text-[11px] text-gray-700">{shop.address}</p>}
            {shop?.phone && <p className="text-[11px] text-gray-700">Hotline: {shop.phone}</p>}
            <h3 className="text-sm font-bold pt-2 uppercase">HÓA ĐƠN BÁN HÀNG</h3>
            <p className="text-[11px] text-gray-600">Số: {order.orderCode}</p>
            <p className="text-[10px] text-gray-600">{formatDateTime(order.createdAt)}</p>
            <p className="text-[10px] text-gray-600">Thu ngân: {order.cashierName}</p>
            {order.customerName && (
              <p className="text-[10px] font-semibold text-gray-800">
                Khách hàng: {order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ''}
                {order.pointsEarned ? ` [ +${order.pointsEarned} điểm ]` : ''}
              </p>
            )}
            <p className="text-[10px] font-bold text-gray-800 pt-0.5">
              Hình thức: {order.diningOption === 'dine_in' ? 'ĂN TẠI QUÁN' : 'MANG VỀ'}
            </p>
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-gray-400">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-300 text-gray-700 text-left font-bold">
                  <th className="pb-1">Mặt hàng</th>
                  <th className="pb-1 text-center">SL / Cân</th>
                  <th className="pb-1 text-right">Đơn giá</th>
                  <th className="pb-1 text-right">T.Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-1 pr-1">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-[10px] text-gray-500">
                        ĐVT: {UNIT_LABELS[item.unit] || item.unit}
                      </div>
                      {item.prepNote && (
                        <div className="text-[9px] text-gray-700 italic font-mono">
                          * {item.prepNote}
                        </div>
                      )}
                    </td>
                    <td className="py-1 text-center font-semibold">
                      {item.unit === 'kg' && item.weightKg
                        ? `${item.weightKg} kg`
                        : item.quantity}
                    </td>
                    <td className="py-1 text-right text-gray-700">
                      {formatCurrency(item.unitPrice).replace(' ₫', '')}
                    </td>
                    <td className="py-1 text-right font-bold">
                      {formatCurrency(item.totalPrice).replace(' ₫', '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="py-3 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Tổng tiền hàng:</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Giảm giá:</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200">
              <span>KHÁCH PHẢI TRẢ:</span>
              <span>{formatCurrency(order.finalTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 pt-1">
              <span>Hình thức:</span>
              <span className="font-semibold">
                {order.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản VietQR'}
              </span>
            </div>
            {order.paymentMethod === 'cash' && order.customerCash !== undefined && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Tiền khách đưa:</span>
                  <span>{formatCurrency(order.customerCash)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tiền trả lại:</span>
                  <span className="font-bold">{formatCurrency(order.changeCash || 0)}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 text-center text-[10px] text-gray-600 space-y-1">
            <p className="italic">{shop?.receiptNote || 'Cảm ơn quý khách và hẹn gặp lại!'}</p>
            <p className="text-[9px] text-gray-400">DuckPOS Pro - Quản lý bán hàng vịt quay</p>
          </div>
        </div>

        {/* Buttons (Screen only) */}
        <div className="flex gap-2 mt-4 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            In hóa đơn (80mm/58mm)
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-lg text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
