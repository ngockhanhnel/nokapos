import React from 'react';
import { formatCurrency, formatInputCurrency, parseInputCurrency } from '@/src/lib/formatters';
import { Delete, Check, X, Banknote, Sparkles } from 'lucide-react';

interface SmartNumpadProps {
  value: string;
  totalNeeded: number;
  onChange: (newValueFormatted: string) => void;
  onDone: () => void;
  onClose: () => void;
}

export const SmartNumpad: React.FC<SmartNumpadProps> = ({
  value,
  totalNeeded,
  onChange,
  onDone,
  onClose,
}) => {
  const currentNum = parseInputCurrency(value);
  const changeAmount = Math.max(0, currentNum - totalNeeded);

  const handleKeyPress = (key: string) => {
    let rawStr = currentNum.toString();
    if (rawStr === '0') rawStr = '';

    if (key === 'C') {
      onChange('');
      return;
    }

    if (key === 'DEL') {
      const nextStr = rawStr.slice(0, -1);
      onChange(formatInputCurrency(nextStr));
      return;
    }

    if (key === '000') {
      if (!rawStr || rawStr === '0') return;
      const nextStr = rawStr + '000';
      onChange(formatInputCurrency(nextStr));
      return;
    }

    const nextStr = rawStr + key;
    onChange(formatInputCurrency(nextStr));
  };

  const handleAddQuickAmount = (amount: number) => {
    const nextVal = currentNum + amount;
    onChange(formatInputCurrency(nextVal));
  };

  const handleExactAmount = () => {
    onChange(formatInputCurrency(totalNeeded));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full sm:max-w-md bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 pb-safe animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Bàn phím nhập tiền khách đưa
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display calculation box */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3 space-y-1">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Khách cần trả:</span>
            <span className="font-bold text-white tabular-nums">{formatCurrency(totalNeeded)}</span>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs font-semibold text-neutral-300">Tiền khách đưa:</span>
            <div className="text-2xl font-black text-amber-400 tabular-nums">
              {value ? `${value} ₫` : '0 ₫'}
            </div>
          </div>

          <div className="flex justify-between items-baseline pt-1.5 border-t border-neutral-900 text-xs">
            <span className="text-neutral-400">Tiền thừa trả khách:</span>
            <span
              className={`text-base font-extrabold tabular-nums ${
                currentNum >= totalNeeded ? 'text-emerald-400' : 'text-neutral-500'
              }`}
            >
              {currentNum >= totalNeeded ? formatCurrency(changeAmount) : 'Chưa đủ tiền'}
            </span>
          </div>
        </div>

        {/* Quick Cash Buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={handleExactAmount}
            className="py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-[11px] font-bold transition-transform active:scale-95 col-span-2"
          >
            Khách đưa đủ ({formatCurrency(totalNeeded)})
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(50000)}
            className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold tabular-nums active:scale-95 transition-transform"
          >
            +50.000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(100000)}
            className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold tabular-nums active:scale-95 transition-transform"
          >
            +100.000
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleAddQuickAmount(200000)}
            className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold tabular-nums active:scale-95 transition-transform"
          >
            +200.000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(500000)}
            className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold tabular-nums active:scale-95 transition-transform"
          >
            +500.000
          </button>
          <button
            type="button"
            onClick={() => onChange(formatInputCurrency(500000))}
            className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-xl text-xs font-bold tabular-nums active:scale-95 transition-transform"
          >
            Chẵn 500k
          </button>
        </div>

        {/* Numpad Key Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '000'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeyPress(k)}
              className={`h-12 rounded-xl text-lg font-bold flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                k === 'C'
                  ? 'bg-neutral-800 text-red-400 hover:bg-neutral-700'
                  : 'bg-neutral-950 hover:bg-neutral-800 text-white border border-neutral-800'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleKeyPress('DEL')}
            className="h-12 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl flex items-center justify-center font-bold active:scale-95 transition-transform"
          >
            <Delete className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onDone}
            className="col-span-2 h-12 bg-red-700 hover:bg-red-600 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg border border-red-500/40"
          >
            <Check className="w-5 h-5" />
            Xác nhận số tiền
          </button>
        </div>
      </div>
    </div>
  );
};
