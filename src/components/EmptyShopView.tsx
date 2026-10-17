import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { VIETNAMESE_BANKS } from '@/src/lib/formatters';
import {
  Store,
  Phone,
  MapPin,
  CreditCard,
  Building,
  User,
  Loader2,
  Sparkles,
  LogOut,
  ShoppingBag,
  Flame,
  CalendarClock,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

export const EmptyShopView: React.FC = () => {
  const { user, userProfile, createShop, reloadShopData, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [checkingJoin, setCheckingJoin] = useState(false);

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

  const handleCheckMembership = async () => {
    try {
      setCheckingJoin(true);
      setError(null);
      await reloadShopData();
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setCheckingJoin(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-red-950/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="h-16 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-900/90 border border-red-700/60 flex items-center justify-center text-2xl shadow-md">
            🦆
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              DuckPOS Pro
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-950/80 text-amber-400 border border-red-800/80 rounded-full">
                Khởi tạo Cửa hàng
              </span>
            </h1>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
              Hệ thống Quản lý Bán hàng Chuyên nghiệp cho Quán Vịt Quay
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-neutral-200">
              {userProfile?.displayName || user?.displayName || 'Chủ tài khoản'}
            </p>
            <p className="text-[11px] text-neutral-400">{user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Đăng xuất khỏi tài khoản"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 z-10">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-red-950/60 via-neutral-900 to-neutral-900 border border-red-900/40 rounded-2xl p-6 sm:p-8 mb-8 shadow-xl">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Chào mừng bạn đến với DuckPOS Pro
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Tài khoản của bạn chưa liên kết với cửa hàng nào
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
              Bạn có thể <strong>khởi tạo quán mới</strong> ngay bây giờ để trở thành Chủ quán (Owner) với toàn quyền quản trị, hoặc <strong>chờ chủ quán mời bạn</strong> vào nhân sự theo email đăng ký.
            </p>
          </div>

          {/* Quick feature badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-neutral-800/80">
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Thu ngân POS & VietQR</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <CalendarClock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Đặt hàng hẹn tiệc & nhắc nhở</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <Flame className="w-4 h-4 text-red-400 shrink-0" />
              <span>Màn hình Bếp & Lò KDS</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Bảo mật dữ liệu chuẩn Cloud</span>
            </div>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex gap-2 max-w-md mx-auto mb-6 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
          <button
            onClick={() => {
              setActiveTab('create');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'create'
                ? 'bg-red-800 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            Khởi tạo Quán mới (Chủ quán)
          </button>
          <button
            onClick={() => {
              setActiveTab('join');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'join'
                ? 'bg-neutral-800 text-amber-400 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Nhân viên tham gia quán
          </button>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl bg-red-950/90 border border-red-800 text-red-200 text-xs flex items-center gap-2 shadow-lg">
            <span>{error}</span>
          </div>
        )}

        {/* CREATE SHOP FORM */}
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="mb-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-red-400" />
                Thông tin Quán Vịt Quay
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Người khởi tạo sẽ tự động được cấp quyền <strong>Chủ quán (Owner)</strong> với đầy đủ quyền thiết lập menu, phân quyền nhân sự, cấu hình SePay và xem báo cáo tài chính.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Tên quán vịt quay <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Vịt Quay Phát Tài, Vịt Quay A Lộc..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Số điện thoại liên hệ
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      placeholder="0912 345 678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Địa chỉ quán
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Số 88 Phố Huế, Hà Nội"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Bank VietQR */}
              <div className="pt-3 border-t border-neutral-800">
                <h4 className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  Tài khoản nhận tiền VietQR (Quét mã thanh toán tại quầy)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1.5">Ngân hàng thụ hưởng</label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                      <select
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-amber-500"
                      >
                        {VIETNAMESE_BANKS.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.code} - {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1.5">Số tài khoản</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: 1903348888..."
                        value={formData.bankAccountNumber}
                        onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-300 mb-1.5">Tên chủ tài khoản</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          placeholder="NGUYEN VAN A"
                          value={formData.bankAccountName}
                          onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value.toUpperCase() })}
                          className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-300 mb-1.5">Lời cảm ơn in trên hóa đơn</label>
                <input
                  type="text"
                  value={formData.receiptNote}
                  onChange={(e) => setFormData({ ...formData, receiptNote: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-red-500"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang khởi tạo cửa hàng & cấp quyền...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Hoàn tất khởi tạo & Bắt đầu bán hàng
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* JOIN SHOP TAB */}
        {activeTab === 'join' && (
          <div className="max-w-xl mx-auto bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-800/80 mx-auto flex items-center justify-center text-amber-400 mb-4 shadow-md">
              <User className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-white mb-2">
              Bạn là Thu ngân / Quản lý của quán?
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-md mx-auto mb-6">
              Vui lòng cung cấp địa chỉ email của bạn: <strong className="text-amber-400">{user?.email}</strong> cho Chủ quán. Chủ quán chỉ cần vào mục <strong>"Nhân sự & Phân quyền"</strong> và thêm bạn với vai trò Quản lý hoặc Thu ngân.
            </p>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-left mb-6 space-y-2 text-xs text-neutral-300">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <span>Chủ quán vào <strong>Nhân sự & Phân quyền</strong> &gt; Bấm <strong>Thêm nhân viên</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <span>Điền email: <code className="text-amber-400 bg-neutral-900 px-1 py-0.5 rounded">{user?.email}</code> và chọn vai trò.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <span>Sau khi chủ quán thêm, bấm nút <strong>Kiểm tra quyền truy cập</strong> bên dưới để vào hệ thống.</span>
              </div>
            </div>

            <button
              onClick={handleCheckMembership}
              disabled={checkingJoin}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              {checkingJoin ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang đồng bộ dữ liệu quán...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Kiểm tra quyền truy cập ngay
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
