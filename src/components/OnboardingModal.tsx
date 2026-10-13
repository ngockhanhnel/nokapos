import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { VIETNAMESE_BANKS } from '@/src/lib/formatters';
import { Store, Phone, MapPin, CreditCard, Building, User, Loader2, Sparkles } from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const { createShop } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    bankName: 'VCB',
    bankAccountNumber: '',
    bankAccountName: '',
    receiptNote: 'Cảm ơn quý khách và hẹn gặp lại!',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên quán vịt quay của bạn');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createShop(formData);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Không thể khởi tạo quán. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 my-8 shadow-2xl relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-red-900/80 border border-red-700/60 flex items-center justify-center text-amber-400 font-bold text-xl">
            🦆
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Khởi tạo Quán Vịt Quay
            </h2>
            <p className="text-xs text-neutral-400">
              Thiết lập thông tin cửa hàng của bạn để bắt đầu vận hành bán hàng
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Tên quán vịt quay <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Store className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="Ví dụ: Vịt Quay Phát Tài, Vịt Quay A Lộc..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  placeholder="0912 345 678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Địa chỉ quán
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Số 88 Phố Huế, Hà Nội"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Bank details for VietQR */}
          <div className="pt-2 border-t border-neutral-800">
            <h3 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Tài khoản nhận tiền VietQR (Quét mã thanh toán)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-300 mb-1">Ngân hàng</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <select
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                  >
                    {VIETNAMESE_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-300 mb-1">Số tài khoản</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 1903348888..."
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 mb-1">Tên chủ tài khoản</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="NGUYEN VAN A"
                      value={formData.bankAccountName}
                      onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value.toUpperCase() })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500 uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-300 mb-1">Lời cảm ơn trên hóa đơn</label>
            <input
              type="text"
              value={formData.receiptNote}
              onChange={(e) => setFormData({ ...formData, receiptNote: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang khởi tạo quán...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Bắt đầu sử dụng DuckPOS Pro
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
