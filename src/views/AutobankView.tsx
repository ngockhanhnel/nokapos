import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import {
  doc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { SepayConfig, SepayTransaction } from '@/src/types';
import { generateSepayApiKey, generateTransferMemo } from '@/src/lib/sepay';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { sendTelegramNotification, formatSepayTelegramMessage } from '@/src/lib/telegram';
import {
  CreditCard,
  Building,
  Key,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Save,
  Send,
  Eye,
  EyeOff,
  Zap,
  ArrowRight,
  Receipt,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  Speaker,
} from 'lucide-react';
import {
  SoundboxSettings,
  getSoundboxSettings,
  saveSoundboxSettings,
  testSoundbox,
} from '@/src/lib/soundbox';

interface AutobankViewProps {
  onNavigateToPos?: () => void;
}

export const AutobankView: React.FC<AutobankViewProps> = ({ onNavigateToPos }) => {
  const { currentShop, userRole } = useAuth();
  const isOwner = userRole === 'owner';

  // State for configuration
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [transferPrefix, setTransferPrefix] = useState('DUCK');
  const [autoCompleteOrder, setAutoCompleteOrder] = useState(true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  // Status & Transactions
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<SepayTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  // Soundbox Settings State
  const [soundboxSettings, setSoundboxSettings] = useState<SoundboxSettings>(getSoundboxSettings());
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // Compute webhook URL automatically from app domain
  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/sepay/webhook`
      : 'https://domain.com/api/sepay/webhook';

  // Load configuration from shop
  useEffect(() => {
    if (currentShop?.sepayConfig) {
      setEnabled(currentShop.sepayConfig.enabled ?? true);
      setApiKey(currentShop.sepayConfig.apiKey || '');
      setTransferPrefix(currentShop.sepayConfig.transferPrefix || 'DUCK');
      setAutoCompleteOrder(currentShop.sepayConfig.autoCompleteOrder ?? true);
      setAutoPrintReceipt(currentShop.sepayConfig.autoPrintReceipt ?? true);
    } else {
      // Default initial API key if empty
      setApiKey(generateSepayApiKey());
      setEnabled(true);
      setTransferPrefix('DUCK');
    }
  }, [currentShop]);

  // Listen to SePay transactions in real-time
  useEffect(() => {
    if (!currentShop?.id) return;
    setLoadingTx(true);

    const q = query(
      collection(db, 'shops', currentShop.id, 'sepayTransactions'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SepayTransaction[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as SepayTransaction);
        });
        setTransactions(list);
        setLoadingTx(false);
      },
      (error) => {
        console.error('Error listening to transactions:', error);
        setLoadingTx(false);
      }
    );

    return () => unsubscribe();
  }, [currentShop?.id]);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerateApiKey = () => {
    const newKey = generateSepayApiKey();
    setApiKey(newKey);
    setShowApiKey(true);
  };

  const handleSaveSettings = async () => {
    if (!currentShop?.id) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const sepayConfig: SepayConfig = {
        enabled,
        apiKey: apiKey.trim(),
        transferPrefix: transferPrefix.trim().toUpperCase() || 'DUCK',
        autoCompleteOrder,
        autoPrintReceipt,
      };

      await updateDoc(doc(db, 'shops', currentShop.id), {
        sepayConfig,
        updatedAt: new Date().toISOString(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `shops/${currentShop.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSoundboxSetting = (key: keyof SoundboxSettings, value: any) => {
    const updated = { ...soundboxSettings, [key]: value };
    setSoundboxSettings(updated);
    saveSoundboxSettings(updated);
  };

  const handleTestSpeaker = async () => {
    if (isPlayingTestSound) return;
    setIsPlayingTestSound(true);
    try {
      await testSoundbox(285000);
    } catch (e) {
      console.warn('Test speaker error:', e);
    } finally {
      setIsPlayingTestSound(false);
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-950/80 border border-red-800 text-amber-400">
              <Zap className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Autobank — Tự Động Xác Nhận Chuyển Khoản SePay
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Tích hợp thanh toán quét mã VietQR tự động khớp đơn, tự động bung bill và thông báo tức thời
            qua SePay Webhook. Không cần mở ứng dụng ngân hàng kiểm tra thủ công.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 cursor-pointer hover:border-neutral-700">
            <span>Kích hoạt Autobank:</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4"
            />
          </label>
        </div>
      </div>

      {/* 4-Step Setup Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BƯỚC 1: TÀI KHOẢN NGÂN HÀNG */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Tài khoản ngân hàng nhận tiền
                </h3>
              </div>
              <a
                href="https://my.sepay.vn/bankaccount"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Mở SePay BankAccount</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
              Vào <code className="text-amber-300">my.sepay.vn/bankaccount</code> để liên kết tài khoản ngân hàng của quán.
              Mục "Khi tài khoản ngân hàng là" chọn Ngân hàng vừa thêm:
            </p>

            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 mt-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-500">Ngân hàng:</span>
                <span className="font-bold text-white">{currentShop?.bankName || 'Chưa thiết lập'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Số tài khoản:</span>
                <span className="font-mono font-bold text-amber-300">
                  {currentShop?.bankAccountNumber || 'Chưa có số tài khoản'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Chủ tài khoản:</span>
                <span className="font-bold text-neutral-200">
                  {currentShop?.bankAccountName || 'Chưa có tên chủ thẻ'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500">
            * Nếu muốn đổi tài khoản nhận tiền, hãy cập nhật trong mục <b>Cài đặt quán</b>.
          </div>
        </div>

        {/* BƯỚC 2: CẤU HÌNH WEBHOOK */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Thêm Webhook trên SePay
                </h3>
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tự động theo Domain
              </span>
            </div>

            <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
              Tạo Webhook mới tại <code className="text-amber-300">my.sepay.vn/webhook</code> và điền các trường sau:
            </p>

            <div className="space-y-2 mt-3 text-xs">
              <div>
                <span className="text-neutral-400 text-[11px]">URL nhận Webhook (tự động):</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono select-all focus:outline-hidden"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookUrl, 'webhookUrl')}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 border border-neutral-700 transition-colors"
                  >
                    {copiedField === 'webhookUrl' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Chép URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="bg-neutral-950 border border-neutral-800 p-2 rounded-lg">
                  <div className="text-neutral-500">Loại giao dịch:</div>
                  <div className="font-bold text-emerald-400 mt-0.5">Tiền vào (in)</div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-2 rounded-lg">
                  <div className="text-neutral-500">Định dạng dữ liệu:</div>
                  <div className="font-bold text-white mt-0.5">JSON (application/json)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500">
            Tên webhook trên SePay bạn có thể đặt tùy ý, ví dụ: <b>DuckPOS Quán Vịt</b>.
          </div>
        </div>

        {/* BƯỚC 3: BẢO MẬT & API KEY */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Bảo Mật Xác Thực & API Key
                </h3>
              </div>
              <span className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Mã hóa Server
              </span>
            </div>

            <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
              Tại mục <b>Phương thức xác thực</b> trên SePay, chọn <b>API Key</b>, sau đó nhập mã API Key dưới đây:
            </p>

            <div className="space-y-3 mt-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-400 text-[11px]">SePay API Key của quán:</span>
                  <button
                    type="button"
                    onClick={handleGenerateApiKey}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Tạo mã mới
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="spk_..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-3 pr-9 py-2 text-xs text-amber-300 font-mono focus:outline-hidden focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    onClick={() => copyToClipboard(apiKey, 'apiKey')}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 border border-neutral-700 transition-colors"
                  >
                    {copiedField === 'apiKey' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Chép Key</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Transfer memo prefix customization */}
              <div>
                <span className="text-neutral-400 text-[11px]">Tiền tố nội dung chuyển khoản tùy chỉnh:</span>
                <input
                  type="text"
                  value={transferPrefix}
                  onChange={(e) => setTransferPrefix(e.target.value.toUpperCase())}
                  placeholder="DUCK"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase mt-1 focus:outline-hidden focus:border-amber-500"
                />
                <div className="text-[11px] text-neutral-500 mt-1">
                  Ví dụ khách chuyển: <span className="font-mono text-amber-400">{transferPrefix || 'DUCK'} VQ261012-101</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500">
            Hệ thống chỉ chấp nhận webhook khi header <code>Authorization: Apikey</code> trùng khớp tuyệt đối.
          </div>
        </div>

        {/* BƯỚC 4: TỰ ĐỘNG HÓA & LƯU THIẾT LẬP */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                  4
                </span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Hành Động Tự Động Hóa & Lưu Cấu Hình
                </h3>
              </div>
            </div>

            <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
              Cấu hình hành vi khi SePay bắn webhook báo có giao dịch tiền vào khớp mã đơn:
            </p>

            <div className="space-y-3 mt-3 text-xs bg-neutral-950 p-3.5 rounded-xl border border-neutral-800">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Tự động chốt đơn thành công</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Tự động lưu đơn vào hệ thống và trừ kho ngay khi tiền về
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoCompleteOrder}
                  onChange={(e) => setAutoCompleteOrder(e.target.checked)}
                  className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-neutral-800/60">
                <div>
                  <div className="font-semibold text-white">Tự động bung màn hình in bill</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Mở hộp thoại in hóa đơn nhiệt ngay lập tức cho thu ngân
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoPrintReceipt}
                  onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                  className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving || !isOwner}
              className="w-full py-2.5 px-4 bg-linear-to-r from-red-700 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang lưu thiết lập...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Đã lưu thành công!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu Thiết Lập Autobank</span>
                </>
              )}
            </button>

            {/* LOA THANH TOÁN THÔNG MINH (SOUNDBOX) */}
            <div className="pt-2 border-t border-neutral-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Speaker className="w-3.5 h-3.5" />
                  <span>Loa Thanh Toán Thông Minh</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                  Chuông + Tiếng Việt
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer bg-neutral-950 p-2 rounded-lg border border-neutral-800 text-neutral-300">
                  <input
                    type="checkbox"
                    checked={soundboxSettings.enableChime}
                    onChange={(e) => handleToggleSoundboxSetting('enableChime', e.target.checked)}
                    className="rounded border-neutral-700 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Chuông Ting-Ting</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer bg-neutral-950 p-2 rounded-lg border border-neutral-800 text-neutral-300">
                  <input
                    type="checkbox"
                    checked={soundboxSettings.enableVoice}
                    onChange={(e) => handleToggleSoundboxSetting('enableVoice', e.target.checked)}
                    className="rounded border-neutral-700 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Giọng đọc số tiền</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleTestSpeaker}
                disabled={isPlayingTestSound}
                className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-amber-500/30 active:scale-95 disabled:opacity-50"
              >
                <Volume2 className={`w-4 h-4 ${isPlayingTestSound ? 'animate-bounce text-amber-400' : ''}`} />
                <span>{isPlayingTestSound ? 'Loa đang phát thông báo mẫu...' : '🔊 Bấm Nghe Thử Loa Thanh Toán'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE SEPAY TRANSACTIONS LEDGER */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Nhật Ký Giao Dịch Tiền Vào SePay Thực Tế ({transactions.length})
            </h3>
          </div>
          <span className="text-[11px] text-neutral-400">
            Tự động cập nhật thời gian thực khi ngân hàng báo tiền về
          </span>
        </div>

        {loadingTx ? (
          <div className="py-8 text-center text-xs text-neutral-500">Đang tải nhật ký giao dịch...</div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500 flex flex-col items-center justify-center">
            <CreditCard className="w-10 h-10 mb-2 opacity-30 text-amber-500" />
            <p className="font-semibold text-neutral-300">Chưa có giao dịch tiền vào nào</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Khi khách hàng quét VietQR và chuyển tiền qua SePay, các biến động số dư sẽ hiển thị ngay tại đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Thời gian</th>
                  <th className="py-2.5 px-3 font-semibold">Ngân hàng</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Số tiền</th>
                  <th className="py-2.5 px-3 font-semibold">Nội dung chuyển khoản</th>
                  <th className="py-2.5 px-3 font-semibold">Mã đơn khớp</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-neutral-400 tabular-nums">
                      {tx.transactionDate || formatDateTime(tx.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-200">
                      <div className="font-semibold">{tx.gateway}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{tx.accountNumber}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-400 tabular-nums">
                      +{formatCurrency(tx.transferAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-300 font-mono text-[11px] max-w-xs truncate">
                      {tx.content}
                    </td>
                    <td className="py-2.5 px-3 text-amber-400 font-mono font-bold">
                      {tx.matchedOrderCode || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {tx.status === 'matched' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3" />
                          Khớp đơn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400 bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded-md">
                          Tiền vào khác
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
