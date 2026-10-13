import React, { useState } from 'react';
import { OrderItem } from '@/src/types';
import { Utensils, X, Check, Sparkles } from 'lucide-react';

interface PrepNoteModalProps {
  item: OrderItem;
  onSaveNote: (prepNote: string) => void;
  onClose: () => void;
}

const PRESET_NOTES = [
  'Chặt miếng vừa ăn',
  'Để nguyên không chặt',
  'Chặt góc tư (1/4 con)',
  'Chặt đĩa ăn tại quán',
  'Gói mang về kỹ',
  'Nước chấm cay',
  'Nước chấm không cay',
  'Xin thêm nước sốt vịt',
  'Xin thêm dưa chua / rau',
];

export const PrepNoteModal: React.FC<PrepNoteModalProps> = ({
  item,
  onSaveNote,
  onClose,
}) => {
  const [note, setNote] = useState(item.prepNote || '');

  const handleSelectPreset = (preset: string) => {
    if (!note) {
      setNote(preset);
    } else if (!note.includes(preset)) {
      setNote(`${note}, ${preset}`);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveNote(note.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Utensils className="w-4 h-4 text-amber-400" />
            Yêu cầu chế biến: <span className="text-amber-300 truncate max-w-[150px]">{item.name}</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-neutral-400">
          Chọn nhanh ghi chú yêu cầu chặt vịt hoặc gia vị kèm theo:
        </p>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {PRESET_NOTES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="text-[11px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 px-2.5 py-1 rounded-lg transition-colors active:scale-95"
            >
              + {preset}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSave} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Ghi chú đầy đủ:
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Chặt miếng, nước chấm không cay..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Check className="w-4 h-4" />
              Lưu yêu cầu
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveNote('');
                onClose();
              }}
              className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
            >
              Xóa ghi chú
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
