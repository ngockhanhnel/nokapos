import React, { useState } from 'react';
import { Shift, Shop } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import {
  Clock,
  Banknote,
  QrCode,
  DollarSign,
  Printer,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Unlock,
} from 'lucide-react';

interface ShiftHandoverModalProps {
  currentShift: Shift | null;
  shop: Shop | null;
  onOpenShift: (initialCash: number) => Promise<void>;
  onCloseShift: (actualCash: number, note: string) => Promise<void>;
  onDismiss: () => void;
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({
  currentShift,
  shop,
  onOpenShift,
  onCloseShift,
  onDismiss,
}) => {
  const [mode, setMode] = useState<'view' | 'close'>('view');
  const [initialCashInput, setInitialCashInput] = useState('500000');
  const [actualCashInput, setActualCashInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If no shift open -> Open Shift Form
  if (!currentShift || currentShift.status === 'closed') {
    const handleStart = async (e: React.FormEvent) => {
      e.preventDefault();
      const cash = parseFloat(initialCashInput) || 0;
      if (cash < 0) {
        setErrorMsg('Số tiền đầu ca không hợp lệ');
        return;
      }
      try {
        setSubmitting(true);
        setErrorMsg(null);
        await onOpenShift(cash);
        onDismiss();
      } catch (err: unknown) {
        console.error(err);
        setErrorMsg('Không thể mở ca làm việc.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Unlock className="w-4 h-4 text-amber-400" />
              Mở ca bán hàng mới
            </h3>
            <button onClick={onDismiss} className="text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-neutral-300">
            Nhập số tiền mặt có sẵn trong ngăn kéo thu ngân trước khi bắt đầu nhận đơn khách:
          </p>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleStart} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Tiền mặt đầu ca (Tiền lẻ thối)
              </label>
              <div className="relative">
                <Banknote className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  step="10000"
                  min="0"
                  required
                  placeholder="500000"
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white tabular-nums font-bold focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            {/* Quick cash suggestions */}
            <div className="flex gap-1.5 justify-end">
              {['200000', '500000', '1000000'].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setInitialCashInput(amt)}
                  className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded tabular-nums"
                >
                  {formatCurrency(parseInt(amt))}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Bắt đầu ca bán hàng
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Active shift calculations
  const expectedCashInDrawer = currentShift.initialCash + currentShift.totalCashSales;
  const parsedActualCash = parseFloat(actualCashInput) || 0;
  const discrepancy = parsedActualCash - expectedCashInDrawer;

  const handleFinishClose = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await onCloseShift(parsedActualCash, noteInput);
      setMode('view');
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Không thể chốt ca.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintShiftTicket = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 print:border-none print:shadow-none print:p-2 print:text-black print:bg-white print:max-w-none print:w-[80mm]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800 print:hidden">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Ca thu ngân: {currentShift.shiftCode}
            </h3>
          </div>
          <button onClick={onDismiss} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Ticket Area */}
        <div className="font-mono text-xs bg-white text-black p-4 rounded-xl shadow-inner print:shadow-none print:p-0">
          <div className="text-center pb-3 border-b border-dashed border-gray-400 space-y-0.5">
            <h2 className="text-sm font-bold uppercase">{shop?.name || 'QUÁN VỊT QUAY'}</h2>
            <h3 className="text-xs font-bold uppercase pt-1">PHIẾU CHỐT CA THU NGÂN</h3>
            <p className="text-[11px] text-gray-700">Mã ca: {currentShift.shiftCode}</p>
            <p className="text-[10px] text-gray-600">Thu ngân: {currentShift.cashierName}</p>
            <p className="text-[10px] text-gray-600">Bắt đầu: {formatDateTime(currentShift.startTime)}</p>
            {currentShift.endTime && (
              <p className="text-[10px] text-gray-600">Kết thúc: {formatDateTime(currentShift.endTime)}</p>
            )}
          </div>

          <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span>Tiền mặt đầu ca:</span>
              <span className="font-semibold tabular-nums">{formatCurrency(currentShift.initialCash)}</span>
            </div>
            <div className="flex justify-between">
              <span>Doanh thu Tiền mặt (+):</span>
              <span className="font-bold tabular-nums">{formatCurrency(currentShift.totalCashSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>Doanh thu VietQR:</span>
              <span className="tabular-nums">{formatCurrency(currentShift.totalTransferSales)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-gray-200">
              <span>TỔNG DOANH THU CA:</span>
              <span className="text-sm tabular-nums">{formatCurrency(currentShift.totalSales)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Số đơn hoàn thành:</span>
              <span className="font-semibold tabular-nums">{currentShift.ordersCount} đơn</span>
            </div>
          </div>

          <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
            <div className="flex justify-between font-semibold">
              <span>Tiền mặt lý thuyết trong két:</span>
              <span className="tabular-nums">{formatCurrency(expectedCashInDrawer)}</span>
            </div>
            {currentShift.actualCashCounted !== undefined && (
              <>
                <div className="flex justify-between font-bold">
                  <span>Tiền mặt thực kiểm đếm:</span>
                  <span className="tabular-nums">{formatCurrency(currentShift.actualCashCounted)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-gray-200">
                  <span>Chênh lệch tiền mặt:</span>
                  <span
                    className={`tabular-nums ${
                      (currentShift.discrepancy || 0) === 0
                        ? 'text-gray-800'
                        : (currentShift.discrepancy || 0) > 0
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {(currentShift.discrepancy || 0) === 0
                      ? 'Khớp 100%'
                      : (currentShift.discrepancy || 0) > 0
                      ? `+${formatCurrency(currentShift.discrepancy || 0)} (Thừa)`
                      : `${formatCurrency(currentShift.discrepancy || 0)} (Thiếu)`}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="pt-2 text-center text-[10px] text-gray-500 italic">
            Phiếu bàn giao có giá trị kiểm toán nội bộ ca trực
          </div>
        </div>

        {/* Closing form controls */}
        {mode === 'close' && currentShift.status === 'open' && (
          <form onSubmit={handleFinishClose} className="space-y-3 print:hidden">
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Tiền mặt dự kiến có trong két:</span>
                <span className="font-bold text-amber-400 tabular-nums">
                  {formatCurrency(expectedCashInDrawer)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Tiền mặt thực tế đếm được <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="5000"
                  min="0"
                  required
                  autoFocus
                  placeholder={expectedCashInDrawer.toString()}
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums font-bold focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {actualCashInput && (
                <div className="flex justify-between text-xs pt-1 border-t border-neutral-800 font-semibold">
                  <span className="text-neutral-400">Chênh lệch:</span>
                  <span
                    className={`tabular-nums ${
                      discrepancy === 0
                        ? 'text-neutral-200'
                        : discrepancy > 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    {discrepancy === 0
                      ? 'Khớp tiền 100%'
                      : discrepancy > 0
                      ? `Thừa +${formatCurrency(discrepancy)}`
                      : `Thiếu ${formatCurrency(discrepancy)}`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Ghi chú ca</label>
                <input
                  type="text"
                  placeholder="Ghi chú bàn giao..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Xác nhận đóng ca
              </button>
              <button
                type="button"
                onClick={() => setMode('view')}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
              >
                Quay lại
              </button>
            </div>
          </form>
        )}

        {/* Buttons (Screen only) */}
        {mode === 'view' && (
          <div className="flex gap-2 print:hidden">
            <button
              onClick={handlePrintShiftTicket}
              className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              In phiếu ca (80mm)
            </button>

            {currentShift.status === 'open' && (
              <button
                onClick={() => {
                  setActualCashInput(expectedCashInDrawer.toString());
                  setMode('close');
                }}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <Lock className="w-4 h-4" />
                Chốt ca này
              </button>
            )}

            <button
              onClick={onDismiss}
              className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
