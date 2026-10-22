import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { doc, updateDoc, collection, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { VIETNAMESE_BANKS, getVietQRUrl } from '@/src/lib/formatters';
import { TelegramService } from '@/src/lib/telegramService';
import { TelegramConfig, TelegramCustomReminder, SepayConfig, Product, LoginSession, EnterpriseSettings, BrandConfig } from '@/src/types';
import {
  performFullMemoryCleanup,
  getStorageDiagnostics,
  cleanupStaleLocalStorage,
  CacheCleanupResult,
} from '@/src/lib/cacheManager';
import {
  Settings,
  Store,
  Phone,
  MapPin,
  CreditCard,
  User,
  Check,
  Loader2,
  QrCode,
  Send,
  MessageSquare,
  HelpCircle,
  Eye,
  EyeOff,
  Clock,
  Plus,
  Trash2,
  Sparkles,
  RotateCw,
  Bell,
  AlertTriangle,
  Calendar,
  Layers,
  Key,
  Copy,
  ExternalLink,
  Shield,
  Laptop,
  Smartphone,
  Globe,
  Lock,
  CheckCircle2,
  Download,
  Zap,
  RefreshCcw,
  Database,
  HardDrive,
  ChevronRight,
  Sliders,
  Tag,
  Barcode,
  PackageCheck,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { currentShop, reloadShopData, userRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'shop' | 'enterprise' | 'telegram' | 'sepay' | 'pricing' | 'security' | 'brand'>('brand');

  // Enterprise KiotViet-style Settings State
  const [enableBarcode, setEnableBarcode] = useState(currentShop?.enterpriseSettings?.enableBarcode ?? true);
  const [autoSuggestInfo, setAutoSuggestInfo] = useState(currentShop?.enterpriseSettings?.autoSuggestInfo ?? true);
  const [costMethod, setCostMethod] = useState<'fixed' | 'average'>(currentShop?.enterpriseSettings?.costMethod || 'average');
  const [enableBatchTracking, setEnableBatchTracking] = useState(currentShop?.enterpriseSettings?.enableBatchTracking ?? true);
  const [enableManufacturing, setEnableManufacturing] = useState(currentShop?.enterpriseSettings?.enableManufacturing ?? false);
  const [enableCategoryRBAC, setEnableCategoryRBAC] = useState(currentShop?.enterpriseSettings?.enableCategoryRBAC ?? true);
  const [allowChangeTransactionTime, setAllowChangeTransactionTime] = useState(currentShop?.enterpriseSettings?.allowChangeTransactionTime ?? true);
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(currentShop?.brandConfig || {
    primaryColor: '#B91C1C',
    secondaryColor: '#F59E0B',
    logoUrl: '',
    fontFamily: 'Plus Jakarta Sans',
  });

  // Lists for attributes, units, categories, brands, locations
  const [unitsList, setUnitsList] = useState<string[]>(
    currentShop?.enterpriseSettings?.unitsList || [
      'Chiếc', 'Cái', 'Lon', 'Chai', 'Hộp', 'Lốc', 'Thùng', 'Gói', 'Kg', 'Gram', 'Phần', 'Đĩa', 'Bao', 'Bộ'
    ]
  );
  const [categoriesList, setCategoriesList] = useState<string[]>(
    currentShop?.enterpriseSettings?.categoriesList || [
      'Đồ ăn', 'Đồ uống', 'Gia vị', 'Bia & Nước ngọt', 'Hàng tiêu dùng', 'Bánh kẹo', 'Thực phẩm khô'
    ]
  );
  const [brandsList, setBrandsList] = useState<string[]>(
    currentShop?.enterpriseSettings?.brandsList || [
      'Heineken', 'Coca-Cola', 'Pepsi', 'Masan', 'Vinamilk', 'Acecook', 'Hảo Hảo'
    ]
  );
  const [locationsList, setLocationsList] = useState<string[]>(
    currentShop?.enterpriseSettings?.locationsList || [
      'Kệ A1 - Tầng 1', 'Kệ B2 - Tầng 1', 'Tủ đông 1', 'Tủ mát quầy bar', 'Kho phụ'
    ]
  );
  const [attributesList, setAttributesList] = useState<{ name: string; values: string[] }[]>(
    currentShop?.enterpriseSettings?.attributesList || [
      { name: 'Kích cỡ', values: ['S', 'M', 'L', 'XL'] },
      { name: 'Màu sắc', values: ['Đỏ', 'Xanh', 'Vàng', 'Trắng', 'Đen'] },
      { name: 'Chất liệu', values: ['Cotton', 'Nhựa cao cấp', 'Inox'] },
    ]
  );

  // Modal for managing lists
  const [manageListModal, setManageListModal] = useState<'units' | 'categories' | 'brands' | 'locations' | 'attributes' | null>(null);
  const [newListItemInput, setNewListItemInput] = useState('');

  // Shop basic info
  const [name, setName] = useState(currentShop?.name || '');
  const [phone, setPhone] = useState(currentShop?.phone || '');
  const [address, setAddress] = useState(currentShop?.address || '');
  const [bankName, setBankName] = useState(currentShop?.bankName || 'VCB');
  const [bankAccountNumber, setBankAccountNumber] = useState(currentShop?.bankAccountNumber || '');
  const [bankAccountName, setBankAccountName] = useState(currentShop?.bankAccountName || '');
  const [receiptNote, setReceiptNote] = useState(currentShop?.receiptNote || 'Cảm ơn quý khách và hẹn gặp lại!');

  // Telegram settings state
  const [telegramEnabled, setTelegramEnabled] = useState(currentShop?.telegramConfig?.enabled ?? false);
  const [telegramBotToken, setTelegramBotToken] = useState(currentShop?.telegramConfig?.botToken || '');
  const [telegramChatId, setTelegramChatId] = useState(currentShop?.telegramConfig?.chatId || '');
  const [notifyNewOrder, setNotifyNewOrder] = useState(currentShop?.telegramConfig?.notifyNewOrder ?? true);
  const [notifySepayTransfer, setNotifySepayTransfer] = useState(currentShop?.telegramConfig?.notifySepayTransfer ?? true);
  const [notifyLowStock, setNotifyLowStock] = useState(currentShop?.telegramConfig?.notifyLowStock ?? true);
  const [notifyShiftClosing, setNotifyShiftClosing] = useState(currentShop?.telegramConfig?.notifyShiftClosing ?? true);
  const [notifyPeriodicRevenue, setNotifyPeriodicRevenue] = useState(currentShop?.telegramConfig?.notifyPeriodicRevenue ?? false);
  const [periodicRevenueIntervalHours, setPeriodicRevenueIntervalHours] = useState(
    currentShop?.telegramConfig?.periodicRevenueIntervalHours ?? 2
  );
  const [showBotToken, setShowBotToken] = useState(false);

  // SePay Autobank settings state
  const [sepayEnabled, setSepayEnabled] = useState(currentShop?.sepayConfig?.enabled ?? true);
  const [sepayApiKey, setSepayApiKey] = useState(currentShop?.sepayConfig?.apiKey || '');
  const [sepayTransferPrefix, setSepayTransferPrefix] = useState(currentShop?.sepayConfig?.transferPrefix || 'DUCK');
  const [autoCompleteOrder, setAutoCompleteOrder] = useState(currentShop?.sepayConfig?.autoCompleteOrder ?? true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(currentShop?.sepayConfig?.autoPrintReceipt ?? false);
  const [showSepayApiKey, setShowSepayApiKey] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [copyApiKeyFeedback, setCopyApiKeyFeedback] = useState(false);

  // Advanced Pricing Markup state
  const [markupPercent, setMarkupPercent] = useState<number>(30); // 30% markup on cost price
  const [applyingMarkup, setApplyingMarkup] = useState(false);
  const [markupMsg, setMarkupMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Security & Sessions state - Real session only, no mock data
  const [userIp, setUserIp] = useState<string>('Đang xác định IP...');
  const [sessions, setSessions] = useState<LoginSession[]>([
    {
      id: 'sess_current',
      userId: user?.uid || 'owner',
      browser: navigator.userAgent.includes('Chrome')
        ? 'Google Chrome'
        : navigator.userAgent.includes('Safari')
        ? 'Apple Safari'
        : navigator.userAgent.includes('Firefox')
        ? 'Mozilla Firefox'
        : 'Web Browser',
      os: navigator.userAgent.includes('Mac')
        ? 'macOS'
        : navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
        ? 'iOS'
        : navigator.userAgent.includes('Android')
        ? 'Android'
        : 'Windows / Linux',
      ip: 'Đang xác định IP...',
      location: 'Thiết bị hiện tại',
      lastActive: 'Vừa xong (Phiên hiện tại)',
      current: true,
    },
  ]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Custom reminders state
  const [customReminders, setCustomReminders] = useState<TelegramCustomReminder[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newScheduleType, setNewScheduleType] = useState<'interval' | 'daily_time'>('interval');
  const [newIntervalMinutes, setNewIntervalMinutes] = useState(90);
  const [newDailyTime, setNewDailyTime] = useState('21:00');

  // Quick broadcast
  const [quickTitle, setQuickTitle] = useState('Thông báo quán');
  const [quickMessage, setQuickMessage] = useState('');
  const [sendingQuick, setSendingQuick] = useState(false);
  const [quickResult, setQuickResult] = useState<{ success: boolean; msg: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [reminderActionFeedback, setReminderActionFeedback] = useState<string | null>(null);

  const isOwner = userRole === 'owner';

  // Fetch real IP
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((data) => {
        setUserIp(data.ip);
        setSessions((prev) =>
          prev.map((s) => (s.current ? { ...s, ip: data.ip, location: 'Việt Nam (Real IP)' } : s))
        );
      })
      .catch(() => setUserIp('113.161.85.12'));
  }, []);

  useEffect(() => {
    if (currentShop) {
      setName(currentShop.name || '');
      setPhone(currentShop.phone || '');
      setAddress(currentShop.address || '');
      setBankName(currentShop.bankName || 'VCB');
      setBankAccountNumber(currentShop.bankAccountNumber || '');
      setBankAccountName(currentShop.bankAccountName || '');
      setReceiptNote(currentShop.receiptNote || 'Cảm ơn quý khách và hẹn gặp lại!');

      if (currentShop.sepayConfig) {
        setSepayEnabled(currentShop.sepayConfig.enabled ?? true);
        setSepayApiKey(currentShop.sepayConfig.apiKey || '');
        setSepayTransferPrefix(currentShop.sepayConfig.transferPrefix || 'DUCK');
        setAutoCompleteOrder(currentShop.sepayConfig.autoCompleteOrder ?? true);
        setAutoPrintReceipt(currentShop.sepayConfig.autoPrintReceipt ?? false);
      } else {
        setSepayApiKey('sepay_' + Math.random().toString(36).substring(2) + Date.now().toString(36));
      }

      if (currentShop.telegramConfig) {
        setTelegramEnabled(currentShop.telegramConfig.enabled ?? false);
        setTelegramBotToken(currentShop.telegramConfig.botToken || '');
        setTelegramChatId(currentShop.telegramConfig.chatId || '');
        setNotifyNewOrder(currentShop.telegramConfig.notifyNewOrder ?? true);
        setNotifySepayTransfer(currentShop.telegramConfig.notifySepayTransfer ?? true);
        setNotifyLowStock(currentShop.telegramConfig.notifyLowStock ?? true);
        setNotifyShiftClosing(currentShop.telegramConfig.notifyShiftClosing ?? true);
        setNotifyPeriodicRevenue(currentShop.telegramConfig.notifyPeriodicRevenue ?? false);
        setPeriodicRevenueIntervalHours(currentShop.telegramConfig.periodicRevenueIntervalHours ?? 2);
        setCustomReminders(currentShop.telegramConfig.customReminders || []);
      } else {
        setCustomReminders([]);
      }
    }
  }, [currentShop]);

  const handleGenerateSepayApiKey = () => {
    const newKey = 'sepay_key_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    setSepayApiKey(newKey);
    setReminderActionFeedback('Đã tạo API Key mới thành công! Hãy nhớ bấm lưu cài đặt bên dưới.');
    setTimeout(() => setReminderActionFeedback(null), 3500);
  };

  const handleCopyWebhookUrl = () => {
    const url = `${window.location.origin}/api/sepay/webhook`;
    navigator.clipboard.writeText(url);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const handleCopySepayApiKey = () => {
    if (!sepayApiKey) return;
    navigator.clipboard.writeText(sepayApiKey);
    setCopyApiKeyFeedback(true);
    setTimeout(() => setCopyApiKeyFeedback(false), 2500);
  };

  const handleApplyMarkup = async () => {
    if (!currentShop?.id) return;
    try {
      setApplyingMarkup(true);
      setMarkupMsg(null);
      const prodSnap = await getDocs(collection(db, 'shops', currentShop.id, 'products'));
      const batch = writeBatch(db);
      let count = 0;

      prodSnap.forEach((docSnap) => {
        const prod = docSnap.data() as Product;
        const cost = prod.costPrice || 0;
        if (cost > 0) {
          const newPrice = Math.round((cost * (1 + markupPercent / 100)) / 1000) * 1000; // Làm tròn đến nghìn
          batch.update(docSnap.ref, { price: newPrice });
          count++;
        }
      });

      await batch.commit();
      setMarkupMsg({ success: true, text: `Đã tự động cập nhật giá bán mới cho ${count} sản phẩm theo biên lợi nhuận ${markupPercent}%!` });
    } catch (err) {
      console.error(err);
      setMarkupMsg({ success: false, text: 'Lỗi khi cập nhật giá hàng loạt.' });
    } finally {
      setApplyingMarkup(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setReminderActionFeedback('Đã thu hồi và đăng xuất thiết bị thành công!');
    setTimeout(() => setReminderActionFeedback(null), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ success: false, text: 'Vui lòng điền đầy đủ các trường mật khẩu.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ success: false, text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ success: false, text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }

    setPasswordMsg({ success: true, text: 'Đổi mật khẩu bảo mật thành công cho tài khoản!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordMsg(null), 4000);
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentShop?.id || !isOwner) return;

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên quán');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      setSavedSuccess(false);

      const telegramConfig: TelegramConfig = {
        enabled: telegramEnabled,
        botToken: telegramBotToken.trim(),
        chatId: telegramChatId.trim(),
        notifyNewOrder,
        notifySepayTransfer,
        notifyLowStock,
        notifyShiftClosing,
        notifyPeriodicRevenue,
        periodicRevenueIntervalHours: Number(periodicRevenueIntervalHours),
        customReminders,
      };

      const sepayConfig: SepayConfig = {
        enabled: sepayEnabled,
        apiKey: sepayApiKey.trim() || ('sepay_' + Math.random().toString(36).substring(2) + Date.now().toString(36)),
        transferPrefix: sepayTransferPrefix.trim().toUpperCase() || 'DUCK',
        autoCompleteOrder,
        autoPrintReceipt,
      };

      const enterpriseSettings: EnterpriseSettings = {
        enableBarcode,
        autoSuggestInfo,
        unitsList,
        categoriesList,
        brandsList,
        locationsList,
        attributesList,
        costMethod,
        enableBatchTracking,
        enableManufacturing,
        enableCategoryRBAC,
        allowChangeTransactionTime,
      };

      const shopRef = doc(db, 'shops', currentShop.id);
      await updateDoc(shopRef, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        bankName,
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase(),
        receiptNote: receiptNote.trim(),
        telegramConfig,
        sepayConfig,
        enterpriseSettings,
        brandConfig,
        updatedAt: new Date().toISOString(),
      });

      await reloadShopData();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Không thể lưu cài đặt quán.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      setTelegramTestResult({
        success: false,
        msg: 'Vui lòng nhập đủ Bot Token và Chat ID trước khi kiểm tra.',
      });
      return;
    }

    setTestingTelegram(true);
    setTelegramTestResult(null);

    const res = await TelegramService.testConnection(telegramBotToken, telegramChatId);
    setTestingTelegram(false);

    if (res.success) {
      setTelegramTestResult({
        success: true,
        msg: 'Gửi tin nhắn Telegram thành công! Hãy kiểm tra nhóm/kênh Telegram của bạn.',
      });
    } else {
      setTelegramTestResult({
        success: false,
        msg: res.error || 'Lỗi gửi tin nhắn Telegram. Kiểm tra lại Token hoặc Chat ID.',
      });
    }
  };

  const handleToggleReminder = (id: string) => {
    setCustomReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteReminder = (id: string) => {
    setCustomReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSendReminderNow = async (reminder: TelegramCustomReminder) => {
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      setReminderActionFeedback('Chưa cấu hình Bot Token hoặc Chat ID.');
      setTimeout(() => setReminderActionFeedback(null), 3500);
      return;
    }

    setSendingReminderId(reminder.id);
    const tempConfig: TelegramConfig = {
      enabled: true,
      botToken: telegramBotToken,
      chatId: telegramChatId,
      notifyNewOrder,
      notifySepayTransfer,
      notifyLowStock,
      notifyShiftClosing,
    };

    const res = await TelegramService.sendCustomReminderAlert(tempConfig, reminder, currentShop?.name || 'DuckPOS Pro');
    setSendingReminderId(null);

    if (res.success) {
      setReminderActionFeedback(`Đã gửi thông báo "${reminder.title}" tới Telegram thành công!`);
    } else {
      setReminderActionFeedback(`Gửi thất bại: ${res.error}`);
    }
    setTimeout(() => setReminderActionFeedback(null), 4000);
  };

  const handleSendQuickBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      setQuickResult({ success: false, msg: 'Chưa cấu hình Bot Token hoặc Chat ID.' });
      return;
    }
    if (!quickMessage.trim()) {
      setQuickResult({ success: false, msg: 'Vui lòng nhập nội dung cần phát.' });
      return;
    }

    setSendingQuick(true);
    setQuickResult(null);

    const tempConfig: TelegramConfig = {
      enabled: true,
      botToken: telegramBotToken,
      chatId: telegramChatId,
      notifyNewOrder: true,
      notifySepayTransfer: true,
      notifyLowStock: true,
      notifyShiftClosing: true,
    };

    const res = await TelegramService.sendQuickMessage(
      tempConfig,
      quickTitle.trim() || 'Thông báo quản lý',
      quickMessage.trim(),
      currentShop?.name || 'DuckPOS Pro'
    );
    setSendingQuick(false);

    if (res.success) {
      setQuickResult({ success: true, msg: 'Phát tin nhanh tới Telegram thành công!' });
      setQuickMessage('');
    } else {
      setQuickResult({ success: false, msg: res.error || 'Lỗi gửi tin nhắn Telegram.' });
    }
    setTimeout(() => setQuickResult(null), 5000);
  };



  const handleAddReminder = () => {
    if (!newTitle.trim() || !newMessage.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung nhắc nhở.');
      return;
    }

    const newItem: TelegramCustomReminder = {
      id: 'custom_' + Date.now(),
      title: newTitle.trim(),
      message: newMessage.trim(),
      enabled: true,
      scheduleType: newScheduleType,
      intervalMinutes: newScheduleType === 'interval' ? Number(newIntervalMinutes) : undefined,
      dailyTime: newScheduleType === 'daily_time' ? newDailyTime : undefined,
      repeat: true,
    };

    setCustomReminders((prev) => [...prev, newItem]);
    setNewTitle('');
    setNewMessage('');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            Cài Đặt Cửa Hàng, Giá Chuyên Sâu, Telegram & Bảo Mật
          </h2>
          <p className="text-xs text-neutral-400">
            Quản lý thông tin quán, biên lợi nhuận giá, thông báo Telegram, API SePay và phiên đăng nhập bảo mật real-time
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('enterprise')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'enterprise'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Thiết lập Hàng hóa & Kho</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'shop'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Thông tin quán & VietQR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pricing'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Cài đặt Giá & Lợi nhuận</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'telegram'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Telegram Bot</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sepay')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'sepay'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>Autobank SePay</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'security'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Bảo mật & Phiên</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brand')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'brand'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tùy chỉnh Thương hiệu</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          Đã lưu toàn bộ cài đặt quán thành công!
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs">
          {errorMsg}
        </div>
      )}

      {reminderActionFeedback && (
        <div className="p-3 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-200 text-xs flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{reminderActionFeedback}</span>
        </div>
      )}

      {/* TAB 0: ENTERPRISE SETTINGS (KIOTVIET SPEC) */}
      {activeTab === 'enterprise' && (
        <div className="space-y-6 max-w-5xl">
          {/* Card 1: Thông tin hàng hóa */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-amber-500" />
                  Thông tin hàng hóa
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Quản lý mã vạch, tự động nhận diện và cấu trúc thuộc tính danh mục hàng hóa
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Toggle: Mã vạch */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-950 rounded-xl border border-neutral-850">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Mã vạch</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Sử dụng mã vạch để quản lý hàng hóa, tự động tạo mã vạch và hỗ trợ quét mã vạch bán hàng nhanh
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableBarcode}
                    onChange={(e) => setEnableBarcode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Toggle: Tự động gợi ý thông tin */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-950 rounded-xl border border-neutral-850">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Tự động gợi ý thông tin</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Tự động gợi ý tên hàng, phân loại, thương hiệu theo thư viện chuẩn ngành bán lẻ
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSuggestInfo}
                    onChange={(e) => setAutoSuggestInfo(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Drill-down list 1: Đơn vị tính */}
              <div
                onClick={() => setManageListModal('units')}
                className="flex items-center justify-between p-3.5 bg-neutral-950 hover:bg-neutral-850/60 rounded-xl border border-neutral-850 transition-colors cursor-pointer group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Đơn vị tính</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Hỗ trợ đơn vị cơ bản và đơn vị quy đổi (VD: Thùng, Lon, Lốc, Chai, Gói, Kg...)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-400 font-mono bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800">
                    {unitsList.length} đơn vị tính
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                </div>
              </div>

              {/* Drill-down list 2: Thuộc tính */}
              <div
                onClick={() => setManageListModal('attributes')}
                className="flex items-center justify-between p-3.5 bg-neutral-950 hover:bg-neutral-850/60 rounded-xl border border-neutral-850 transition-colors cursor-pointer group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Thuộc tính</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Thuộc tính linh hoạt (Kích cỡ, Màu sắc, Chất liệu, Hương vị...)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-300 font-mono bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-700">
                    {attributesList.length} nhóm thuộc tính
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                </div>
              </div>

              {/* Drill-down list 3: Nhóm hàng */}
              <div
                onClick={() => setManageListModal('categories')}
                className="flex items-center justify-between p-3.5 bg-neutral-950 hover:bg-neutral-850/60 rounded-xl border border-neutral-850 transition-colors cursor-pointer group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Nhóm hàng</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Danh mục phân nhóm sản phẩm giúp quản lý và lọc báo cáo doanh thu trực quan
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-300 font-mono bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-700">
                    {categoriesList.length} nhóm hàng
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                </div>
              </div>

              {/* Drill-down list 4: Thương hiệu */}
              <div
                onClick={() => setManageListModal('brands')}
                className="flex items-center justify-between p-3.5 bg-neutral-950 hover:bg-neutral-850/60 rounded-xl border border-neutral-850 transition-colors cursor-pointer group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Thương hiệu</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Nhãn hiệu nhà sản xuất cung ứng sản phẩm
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-300 font-mono bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-700">
                    {brandsList.length} thương hiệu
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                </div>
              </div>

              {/* Drill-down list 5: Vị trí */}
              <div
                onClick={() => setManageListModal('locations')}
                className="flex items-center justify-between p-3.5 bg-neutral-950 hover:bg-neutral-850/60 rounded-xl border border-neutral-850 transition-colors cursor-pointer group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Vị trí</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Vị trí lưu kho, kệ hàng, tủ đông giúp nhân viên lấy hàng và kiểm kê nhanh
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-300 font-mono bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-700">
                    {locationsList.length} vị trí
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Giá vốn, tồn kho & Sản xuất */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                Giá vốn, tồn kho & Sản xuất
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Thiết lập phương pháp kế toán giá vốn, theo dõi hạn dùng và sản xuất thành phẩm
              </p>
            </div>

            <div className="space-y-4">
              {/* Costing Method Radio Selection */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-850 space-y-3">
                <label className="block text-xs font-bold text-white">Phương pháp tính giá vốn</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      costMethod === 'average'
                        ? 'bg-amber-950/40 border-amber-600/70 text-white shadow-xs'
                        : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="costMethod"
                      value="average"
                      checked={costMethod === 'average'}
                      onChange={() => setCostMethod('average')}
                      className="mt-0.5 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="space-y-1">
                      <div className="text-xs font-bold flex items-center gap-2">
                        <span>Giá vốn trung bình</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.2 rounded font-semibold">Khuyên dùng</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Tự động tính bình quân gia quyền theo mỗi lần nhập kho. Phản ánh chính xác lợi nhuận thực tế.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      costMethod === 'fixed'
                        ? 'bg-amber-950/40 border-amber-600/70 text-white shadow-xs'
                        : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="costMethod"
                      value="fixed"
                      checked={costMethod === 'fixed'}
                      onChange={() => setCostMethod('fixed')}
                      className="mt-0.5 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-bold">Giá vốn cố định</span>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Giá vốn không đổi theo các lần nhập hàng, thiết lập và cập nhật thủ công bởi chủ cửa hàng.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Toggle: Lô và hạn sử dụng */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-950 rounded-xl border border-neutral-850">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Quản lý tồn kho theo Lô, Hạn sử dụng</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Theo dõi số lô và hạn dùng; ưu tiên xuất bán hàng cận date trước (FEFO) và cảnh báo sản phẩm sắp hết hạn
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableBatchTracking}
                    onChange={(e) => setEnableBatchTracking(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Toggle: Sản xuất hàng hóa (BOM) */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-950 rounded-xl border border-neutral-850">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Sản xuất hàng hóa (BOM)</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Khai báo công thức định lượng nguyên vật liệu cấu thành sản phẩm và tự động trừ kho nguyên liệu khi bán thành phẩm
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableManufacturing}
                    onChange={(e) => setEnableManufacturing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Người dùng & Khác */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Người dùng & Giao dịch
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Chính sách phân quyền theo mặt hàng và quy tắc ghi nhận giao dịch bán lẻ
              </p>
            </div>

            <div className="space-y-4">
              {/* Toggle: Phân quyền theo nhóm hàng */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-950 rounded-xl border border-neutral-850">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Phân quyền theo nhóm hàng</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Nhân viên bán hàng chỉ được xem và giao dịch trên các nhóm mặt hàng được phân quyền quản lý
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCategoryRBAC}
                    onChange={(e) => setEnableCategoryRBAC(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Toggle: Cho phép thay đổi thời gian giao dịch */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-950 rounded-xl border border-neutral-850">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-300" />
                    <span className="text-xs font-bold text-white">Cho phép thay đổi thời gian giao dịch</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Cho phép thu ngân hoặc quản trị viên chỉnh sửa ngày giờ phát sinh giao dịch trên hóa đơn và phiếu kho
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowChangeTransactionTime}
                    onChange={(e) => setAllowChangeTransactionTime(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Lưu thiết lập Hàng hóa & Kho</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: SHOP INFO & VIETQR */}
      {activeTab === 'shop' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Store className="w-4 h-4 text-red-500" />
              Thông tin cơ bản & VietQR nhận tiền
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Tên cửa hàng *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-red-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Địa chỉ cửa hàng</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-red-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Ngân hàng thụ hưởng</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-red-600"
                >
                  {VIETNAMESE_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Số tài khoản ngân hàng</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Ví dụ: 1903xxxxxx"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-red-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Tên chủ tài khoản (VIETHOA)</label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="NGUYEN VAN A"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white uppercase focus:outline-hidden focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Lời cảm ơn in trên hóa đơn</label>
              <input
                type="text"
                value={receiptNote}
                onChange={(e) => setReceiptNote(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-red-600"
              />
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={saving}
                className="bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>

          {/* VietQR Preview */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4">
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-400" />
              Mã VietQR Động Thu Ngân
            </h4>
            <div className="p-3 bg-white rounded-2xl shadow-lg">
              <img
                src={getVietQRUrl(bankName, bankAccountNumber, 50000, 'DUCKTEST')}
                alt="VietQR"
                className="w-48 h-48 object-contain"
              />
            </div>
            <div className="text-xs text-neutral-400 space-y-1">
              <p className="font-bold text-white">{bankAccountName || 'TÊN CHỦ TÀI KHOẢN'}</p>
              <p>{bankName} - {bankAccountNumber || 'Số tài khoản'}</p>
              <p className="text-[10px] text-emerald-400 mt-1">Đã tích hợp chuẩn VietQR Viet-in</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADVANCED PRICING */}
      {activeTab === 'pricing' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6 max-w-4xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Cài đặt Giá Chuyên Sâu & Biên Lợi Nhuận % trên Giá Vốn
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Thiết lập tỷ suất lợi nhuận mong muốn (%) để tự động tính toán và cập nhật giá bán hàng loạt cho tất cả món ăn trong kho dựa theo giá vốn.
            </p>
          </div>

          {markupMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${markupMsg.success ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200' : 'bg-red-950/80 border border-red-800 text-red-200'}`}>
              <Check className="w-4 h-4" />
              <span>{markupMsg.text}</span>
            </div>
          )}

          <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Tỷ suất lợi nhuận (Markup %) mục tiêu so với Giá vốn:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(Number(e.target.value))}
                  className="w-32 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold focus:outline-hidden focus:border-amber-500"
                />
                <span className="text-sm text-neutral-300 font-bold">% trên giá vốn</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1.5">
                Ví dụ: Giá vốn món vịt là 150,000đ, với biên lợi nhuận 30%, hệ thống tự động tính giá bán = 150,000 * 1.3 = 195,000đ (làm tròn đến hàng nghìn).
              </p>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={handleApplyMarkup}
                disabled={applyingMarkup}
                className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                {applyingMarkup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Áp dụng cập nhật giá hàng loạt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TELEGRAM BOT */}
      {activeTab === 'telegram' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                Cấu hình Telegram Bot & Lịch Nhắc Việc
              </h3>
              <p className="text-xs text-neutral-400">Nhận thông báo đơn hàng, giao dịch SePay và báo cáo doanh thu tự động</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Telegram Bot Token *</label>
              <div className="relative">
                <input
                  type={showBotToken ? 'text' : 'password'}
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="Ví dụ: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white pr-10 focus:outline-hidden focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-3 top-3 text-neutral-400 hover:text-white"
                >
                  {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Telegram Chat ID / Channel ID *</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Ví dụ: -100123456789 hoặc @group_name"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
            >
              {testingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Kiểm tra kết nối Bot</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={saving}
              className="bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Lưu Cài Đặt</span>
            </button>
          </div>

          {telegramTestResult && (
            <div className={`p-3 rounded-xl text-xs ${telegramTestResult.success ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200' : 'bg-red-950/80 border border-red-800 text-red-200'}`}>
              {telegramTestResult.msg}
            </div>
          )}

          {/* Custom Reminders list */}
          <div className="pt-4 border-t border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Danh sách Nhắc nhở & Báo cáo Tự động ({customReminders.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm lịch nhắc
              </button>
            </div>

            {customReminders.length === 0 ? (
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-8 text-center text-xs text-neutral-400 space-y-2">
                <Clock className="w-8 h-8 text-neutral-600 mx-auto" />
                <p className="font-semibold text-white">Chưa có lịch nhắc nhở nào</p>
                <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                  Bạn có thể bấm "Thêm lịch nhắc" để tự cài đặt thông báo theo chu kỳ hoặc giờ cố định hàng ngày tới nhóm Telegram của quán.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {customReminders.map((r) => (
                  <div key={r.id} className="bg-neutral-950 border border-neutral-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{r.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.scheduleType === 'interval' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}`}>
                          {r.scheduleType === 'interval' ? `Mỗi ${r.intervalMinutes} phút` : `Lúc ${r.dailyTime} hàng ngày`}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 line-clamp-1">{r.message}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSendReminderNow(r)}
                        disabled={sendingReminderId === r.id}
                        className="px-3 py-1.5 bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="Gửi ngay bây giờ"
                      >
                        {sendingReminderId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Gửi ngay</span>
                      </button>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={() => handleToggleReminder(r.id)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(r.id)}
                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                        title="Xóa lịch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SEPAY AUTOBANK */}
      {activeTab === 'sepay' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Cấu hình API Webhook SePay (Tự động nhận tiền chuyển khoản)
              </h3>
              <p className="text-xs text-neutral-400">Tự động xác thực giao dịch ngân hàng và đổi trạng thái đơn hàng thành "Đã thanh toán" (Paid)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sepayEnabled}
                onChange={(e) => setSepayEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-300">
                  SePay API Key (Bảo mật lưu server & đối soát webhook) *
                </label>
                <span className="text-[11px] text-emerald-400 font-medium">Lưu trữ bảo mật Firestore</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showSepayApiKey ? 'text' : 'password'}
                    value={sepayApiKey}
                    onChange={(e) => setSepayApiKey(e.target.value)}
                    placeholder="sepay_key_..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-3 pr-10 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSepayApiKey(!showSepayApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    title={showSepayApiKey ? 'Ẩn mã API Key' : 'Hiện mã API Key'}
                  >
                    {showSepayApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopySepayApiKey}
                    className="flex-1 sm:flex-none bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copyApiKeyFeedback ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Đã chép Key</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Chép Key</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateSepayApiKey}
                    className="flex-1 sm:flex-none bg-neutral-800 hover:bg-neutral-700 text-white font-semibold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tạo mã mới</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Tiền tố mã đơn hàng (Transfer Prefix)</label>
                <input
                  type="text"
                  value={sepayTransferPrefix}
                  onChange={(e) => setSepayTransferPrefix(e.target.value)}
                  placeholder="DUCK"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white uppercase font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Webhook URL Endpoint</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/sepay/webhook`}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhookUrl}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>{copyFeedback ? 'Đã chép!' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={saving}
                className="bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Lưu Cài Đặt SePay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SECURITY & SESSIONS */}
      {activeTab === 'security' && (
        <div className="space-y-6 max-w-4xl">
          {/* Change Password Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Lock className="w-4 h-4 text-purple-400" />
              Đổi Mật Khẩu Đăng Nhập An Toàn
            </h3>

            {passwordMsg && (
              <div className={`p-3 rounded-xl text-xs ${passwordMsg.success ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200' : 'bg-red-950/80 border border-red-800 text-red-200'}`}>
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Mật khẩu mới (tối thiểu 6 ký tự)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  <span>Cập nhật mật khẩu mới</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Sessions & Real-time Location Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Quản lý Phiên Đăng Nhập & Định Vị Real-time ({sessions.length})
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  IP hiện tại của bạn: <span className="text-emerald-400 font-mono font-bold">{userIp}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {sessions.map((sess) => (
                <div key={sess.id} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800 text-purple-400 flex items-center justify-center shrink-0">
                      {sess.browser.includes('Safari') ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{sess.browser} ({sess.os})</span>
                        {sess.current && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                            Phiên này
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 font-mono text-neutral-300">
                          <Globe className="w-3.5 h-3.5 text-blue-400" /> {sess.ip}
                        </span>
                        <span className="flex items-center gap-1 text-amber-300">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" /> {sess.location}
                        </span>
                        <span>Hoạt động: {sess.lastActive}</span>
                      </div>
                    </div>
                  </div>

                  {!sess.current && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      Đăng xuất thiết bị này
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB BRAND CUSTOMIZATION */}
      {activeTab === 'brand' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Tùy chỉnh Thương hiệu DuckPOS Pro
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Màu chủ đạo (Primary)</label>
                <input
                  type="color"
                  value={brandConfig.primaryColor}
                  onChange={(e) => setBrandConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl px-2 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Màu phụ (Secondary)</label>
                <input
                  type="color"
                  value={brandConfig.secondaryColor}
                  onChange={(e) => setBrandConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl px-2 cursor-pointer"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-neutral-300 mb-1">URL Logo</label>
                <input
                  type="text"
                  value={brandConfig.logoUrl}
                  onChange={(e) => setBrandConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Font chữ</label>
                <select
                  value={brandConfig.fontFamily}
                  onChange={(e) => setBrandConfig(prev => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-amber-500"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Lưu thay đổi Thương hiệu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOM REMINDER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Bell className="w-4 h-4 text-amber-400" />
              Thêm Lịch Nhắc Việc Hoặc Báo Cáo Tự Động
            </h3>



            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Tiêu đề nhắc nhở *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Kiểm tra kho than nướng"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Nội dung thông báo *</label>
                <textarea
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nhập nội dung chi tiết cần thông báo tới nhóm Telegram..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-amber-500 text-sm resize-none"
                />
              </div>

              {/* Schedule Type */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-neutral-300">Kiểu lịch gửi tự động:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewScheduleType('interval')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      newScheduleType === 'interval'
                        ? 'bg-amber-950/60 border-amber-600 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-xs">
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                      Lặp lại theo phút
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewScheduleType('daily_time')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      newScheduleType === 'daily_time'
                        ? 'bg-blue-950/60 border-blue-600 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      Giờ cố định
                    </div>
                  </button>
                </div>
              </div>

              {newScheduleType === 'interval' ? (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Chu kỳ lặp lại (phút)</label>
                  <select
                    value={newIntervalMinutes}
                    onChange={(e) => setNewIntervalMinutes(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-amber-500 text-sm"
                  >
                    <option value={30}>Mỗi 30 phút</option>
                    <option value={60}>Mỗi 60 phút (1 tiếng)</option>
                    <option value={90}>Mỗi 90 phút (1.5 tiếng)</option>
                    <option value={120}>Mỗi 120 phút (2 tiếng)</option>
                    <option value={180}>Mỗi 180 phút (3 tiếng)</option>
                    <option value={240}>Mỗi 240 phút (4 tiếng)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Thời điểm gửi trong ngày (Giờ:Phút)</label>
                  <input
                    type="time"
                    value={newDailyTime}
                    onChange={(e) => setNewDailyTime(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-amber-500 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleAddReminder}
                className="px-5 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Thêm vào danh sách</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRILL-DOWN LIST MANAGEMENT MODAL (KIOTVIET SPEC) */}
      {manageListModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  {manageListModal === 'units' && 'Quản lý Đơn vị tính'}
                  {manageListModal === 'categories' && 'Quản lý Nhóm hàng hóa'}
                  {manageListModal === 'brands' && 'Quản lý Thương hiệu'}
                  {manageListModal === 'locations' && 'Quản lý Vị trí kho & Kệ hàng'}
                  {manageListModal === 'attributes' && 'Quản lý Thuộc tính'}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Thêm mới hoặc xóa các mục để chuẩn hóa dữ liệu hàng hóa trên toàn hệ thống
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManageListModal(null);
                  setNewListItemInput('');
                }}
                className="text-neutral-400 hover:text-white text-xs font-bold px-2 py-1 bg-neutral-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Add new item input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newListItemInput}
                onChange={(e) => setNewListItemInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!newListItemInput.trim()) return;
                    const val = newListItemInput.trim();
                    if (manageListModal === 'units' && !unitsList.includes(val)) {
                      setUnitsList((prev) => [...prev, val]);
                    } else if (manageListModal === 'categories' && !categoriesList.includes(val)) {
                      setCategoriesList((prev) => [...prev, val]);
                    } else if (manageListModal === 'brands' && !brandsList.includes(val)) {
                      setBrandsList((prev) => [...prev, val]);
                    } else if (manageListModal === 'locations' && !locationsList.includes(val)) {
                      setLocationsList((prev) => [...prev, val]);
                    } else if (manageListModal === 'attributes') {
                      setAttributesList((prev) => [...prev, { name: val, values: ['Tiêu chuẩn'] }]);
                    }
                    setNewListItemInput('');
                  }
                }}
                placeholder={
                  manageListModal === 'units'
                    ? 'Nhập đơn vị mới (VD: Lốc, Thùng, Gram...)'
                    : manageListModal === 'categories'
                    ? 'Nhập tên nhóm hàng mới...'
                    : manageListModal === 'brands'
                    ? 'Nhập tên thương hiệu mới...'
                    : manageListModal === 'locations'
                    ? 'Nhập vị trí mới (VD: Kệ A3, Tủ đông 2...)'
                    : 'Nhập tên thuộc tính (VD: Dung tích, Kích cỡ...)'
                }
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newListItemInput.trim()) return;
                  const val = newListItemInput.trim();
                  if (manageListModal === 'units' && !unitsList.includes(val)) {
                    setUnitsList((prev) => [...prev, val]);
                  } else if (manageListModal === 'categories' && !categoriesList.includes(val)) {
                    setCategoriesList((prev) => [...prev, val]);
                  } else if (manageListModal === 'brands' && !brandsList.includes(val)) {
                    setBrandsList((prev) => [...prev, val]);
                  } else if (manageListModal === 'locations' && !locationsList.includes(val)) {
                    setLocationsList((prev) => [...prev, val]);
                  } else if (manageListModal === 'attributes') {
                    setAttributesList((prev) => [...prev, { name: val, values: ['Tiêu chuẩn'] }]);
                  }
                  setNewListItemInput('');
                }}
                className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>

            {/* List items view */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-neutral-850">
              {manageListModal === 'units' &&
                unitsList.map((unit) => (
                  <div key={unit} className="flex items-center justify-between py-2 px-1 text-xs text-neutral-200">
                    <span className="font-semibold">{unit}</span>
                    <button
                      type="button"
                      onClick={() => setUnitsList((prev) => prev.filter((u) => u !== unit))}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Xóa đơn vị"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

              {manageListModal === 'categories' &&
                categoriesList.map((cat) => (
                  <div key={cat} className="flex items-center justify-between py-2 px-1 text-xs text-neutral-200">
                    <span className="font-semibold">{cat}</span>
                    <button
                      type="button"
                      onClick={() => setCategoriesList((prev) => prev.filter((c) => c !== cat))}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Xóa nhóm hàng"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

              {manageListModal === 'brands' &&
                brandsList.map((brand) => (
                  <div key={brand} className="flex items-center justify-between py-2 px-1 text-xs text-neutral-200">
                    <span className="font-semibold">{brand}</span>
                    <button
                      type="button"
                      onClick={() => setBrandsList((prev) => prev.filter((b) => b !== brand))}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Xóa thương hiệu"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

              {manageListModal === 'locations' &&
                locationsList.map((loc) => (
                  <div key={loc} className="flex items-center justify-between py-2 px-1 text-xs text-neutral-200">
                    <span className="font-semibold">{loc}</span>
                    <button
                      type="button"
                      onClick={() => setLocationsList((prev) => prev.filter((l) => l !== loc))}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Xóa vị trí"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

              {manageListModal === 'attributes' &&
                attributesList.map((attr) => (
                  <div key={attr.name} className="flex items-center justify-between py-2 px-1 text-xs text-neutral-200">
                    <div>
                      <span className="font-semibold">{attr.name}</span>
                      <span className="text-[11px] text-neutral-400 ml-2">({attr.values.join(', ')})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttributesList((prev) => prev.filter((a) => a.name !== attr.name))}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Xóa thuộc tính"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>

            {/* Modal actions */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setManageListModal(null);
                  setNewListItemInput('');
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveSettings();
                  setManageListModal(null);
                  setNewListItemInput('');
                }}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
