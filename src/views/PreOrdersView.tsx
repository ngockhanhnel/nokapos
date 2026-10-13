import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import {
  PreOrder,
  PreOrderStatus,
  PreOrderType,
  PRE_ORDER_STATUS_LABELS,
  PRE_ORDER_TYPE_LABELS,
  Product,
  Customer,
  OrderItem,
} from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { TelegramService } from '@/src/lib/telegramService';
import { playNotificationSound } from '@/src/lib/notifications';
import {
  CalendarClock,
  Plus,
  Search,
  Filter,
  Clock,
  Calendar,
  User,
  Phone,
  MapPin,
  UtensilsCrossed,
  Printer,
  Send,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit,
  ShoppingCart,
  ChevronRight,
  BellRing,
  Volume2,
  Repeat,
  X,
  Loader2,
  DollarSign,
  ChefHat,
  Truck,
  Building,
  PartyPopper,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface PreOrdersViewProps {
  onNavigateToPos?: (preOrder?: PreOrder) => void;
}

export const PreOrdersView: React.FC<PreOrdersViewProps> = ({ onNavigateToPos }) => {
  const { currentShop, userProfile } = useAuth();

  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today'); // 'all' | 'today' | 'tomorrow' | 'upcoming7' | 'custom'
  const [customDate, setCustomDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPreOrder, setEditingPreOrder] = useState<PreOrder | null>(null);
  const [printPreOrder, setPrintPreOrder] = useState<PreOrder | null>(null);

  // Form State
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formCustomerPhone, setFormCustomerPhone] = useState<string>('');
  const [formCustomerAddress, setFormCustomerAddress] = useState<string>('');
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formDeliveryDate, setFormDeliveryDate] = useState<string>('');
  const [formDeliveryTime, setFormDeliveryTime] = useState<string>('11:30');
  const [formOrderType, setFormOrderType] = useState<PreOrderType>('takeaway');
  const [formItems, setFormItems] = useState<OrderItem[]>([]);
  const [formDepositAmount, setFormDepositAmount] = useState<string>('0');
  const [formNotes, setFormNotes] = useState<string>('');

  // Reminder Form State
  const [formReminderEnabled, setFormReminderEnabled] = useState<boolean>(true);
  const [formAdvanceStages, setFormAdvanceStages] = useState<number[]>([15, 30, 60]);
  const [formRepeatInterval, setFormRepeatInterval] = useState<number>(15);
  const [formNotifyTelegram, setFormNotifyTelegram] = useState<boolean>(true);
  const [formNotifyAudio, setFormNotifyAudio] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Quick product selector in modal
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductQty, setSelectedProductQty] = useState<number>(1);
  const [selectedProductWeight, setSelectedProductWeight] = useState<string>('1.5');
  const [selectedProductPrepNote, setSelectedProductPrepNote] = useState<string>('');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Set default date when opening modal
  useEffect(() => {
    if (!formDeliveryDate) {
      setFormDeliveryDate(todayStr);
    }
  }, [todayStr, formDeliveryDate]);

  // Load Real-time Data from Firestore
  useEffect(() => {
    if (!currentShop?.id) return;

    setLoading(true);

    // 1. Listen for Pre-Orders
    const preOrdersRef = collection(db, 'shops', currentShop.id, 'preOrders');
    const qPreOrders = query(preOrdersRef, orderBy('createdAt', 'desc'));
    const unsubPreOrders = onSnapshot(
      qPreOrders,
      (snapshot) => {
        const list: PreOrder[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as PreOrder);
        });
        setPreOrders(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `shops/${currentShop.id}/preOrders`);
        setLoading(false);
      }
    );

    // 2. Listen for Products
    const productsRef = collection(db, 'shops', currentShop.id, 'products');
    const unsubProducts = onSnapshot(productsRef, (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(list);
    });

    // 3. Listen for CRM Customers
    const customersRef = collection(db, 'shops', currentShop.id, 'customers');
    const unsubCustomers = onSnapshot(customersRef, (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
      });
      setCustomers(list);
    });

    return () => {
      unsubPreOrders();
      unsubProducts();
      unsubCustomers();
    };
  }, [currentShop?.id]);

  // Temporary feedback alert
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Filter Pre-Orders
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const tomorrowDate = new Date(now.getTime() + 86400000);
    const tomorrowYMD = tomorrowDate.toISOString().slice(0, 10);
    const day7Date = new Date(now.getTime() + 7 * 86400000);
    const day7YMD = day7Date.toISOString().slice(0, 10);

    return preOrders.filter((po) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = po.orderCode.toLowerCase().includes(q);
        const matchName = po.customerName.toLowerCase().includes(q);
        const matchPhone = po.customerPhone.includes(q);
        const matchItem = po.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchCode && !matchName && !matchPhone && !matchItem) return false;
      }

      // Status
      if (statusFilter !== 'all' && po.status !== statusFilter) {
        return false;
      }

      // Order Type
      if (typeFilter !== 'all' && po.orderType !== typeFilter) {
        return false;
      }

      // Date
      if (dateFilter === 'today') {
        if (po.deliveryDate !== todayYMD) return false;
      } else if (dateFilter === 'tomorrow') {
        if (po.deliveryDate !== tomorrowYMD) return false;
      } else if (dateFilter === 'upcoming7') {
        if (po.deliveryDate < todayYMD || po.deliveryDate > day7YMD) return false;
      } else if (dateFilter === 'custom' && customDate) {
        if (po.deliveryDate !== customDate) return false;
      }

      return true;
    });
  }, [preOrders, searchQuery, statusFilter, dateFilter, customDate, typeFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = preOrders.filter((po) => po.deliveryDate === today);
    const pendingCount = preOrders.filter((po) => po.status === 'pending').length;
    const preparingCount = preOrders.filter(
      (po) => po.status === 'preparing' || po.status === 'ready'
    ).length;
    const todayRevenue = todayOrders
      .filter((po) => po.status === 'completed')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      todayCount: todayOrders.length,
      todayRevenue,
      pendingCount,
      preparingCount,
    };
  }, [preOrders]);

  // Handle Customer Selection in form
  const handleSelectCustomer = (customerId: string) => {
    setFormCustomerId(customerId);
    const found = customers.find((c) => c.id === customerId);
    if (found) {
      setFormCustomerName(found.name);
      setFormCustomerPhone(found.phone);
      if (found.address) setFormCustomerAddress(found.address);
    }
  };

  // Add Item to form
  const handleAddItemToForm = () => {
    if (!selectedProductId) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const isKg = product.unit === 'kg';
    const weightNum = isKg ? parseFloat(selectedProductWeight) || 1 : undefined;
    const quantity = isKg ? 1 : Math.max(1, selectedProductQty);
    const totalPrice = isKg ? Math.round(product.price * (weightNum || 1)) : product.price * quantity;

    const newItem: OrderItem = {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      unitPrice: product.price,
      quantity,
      weightKg: weightNum,
      totalPrice,
      prepNote: selectedProductPrepNote.trim() || undefined,
    };

    setFormItems((prev) => [...prev, newItem]);
    setSelectedProductId('');
    setSelectedProductQty(1);
    setSelectedProductWeight('1.5');
    setSelectedProductPrepNote('');
  };

  const handleRemoveFormItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate form totals
  const formTotalAmount = useMemo(() => {
    return formItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [formItems]);

  const formDepositNum = useMemo(() => {
    return Math.max(0, parseInt(formDepositAmount.replace(/\D/g, '') || '0', 10));
  }, [formDepositAmount]);

  const formRemainingNum = useMemo(() => {
    return Math.max(0, formTotalAmount - formDepositNum);
  }, [formTotalAmount, formDepositNum]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingPreOrder(null);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerAddress('');
    setFormCustomerId('');
    setFormDeliveryDate(todayStr);
    setFormDeliveryTime('11:30');
    setFormOrderType('takeaway');
    setFormItems([]);
    setFormDepositAmount('0');
    setFormNotes('');
    setFormReminderEnabled(true);
    setFormAdvanceStages([15, 30, 60]);
    setFormRepeatInterval(15);
    setFormNotifyTelegram(true);
    setFormNotifyAudio(true);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (order: PreOrder) => {
    setEditingPreOrder(order);
    setFormCustomerName(order.customerName);
    setFormCustomerPhone(order.customerPhone);
    setFormCustomerAddress(order.customerAddress || '');
    setFormCustomerId(order.customerId || '');
    setFormDeliveryDate(order.deliveryDate);
    setFormDeliveryTime(order.deliveryTime);
    setFormOrderType(order.orderType);
    setFormItems(order.items || []);
    setFormDepositAmount(order.depositAmount ? order.depositAmount.toLocaleString('vi-VN') : '0');
    setFormNotes(order.notes || '');
    setFormReminderEnabled(order.reminderConfig?.enabled ?? true);
    setFormAdvanceStages(order.reminderConfig?.advanceMinutes || [15, 30, 60]);
    setFormRepeatInterval(order.reminderConfig?.repeatIntervalMinutes || 15);
    setFormNotifyTelegram(order.reminderConfig?.notifyTelegram ?? true);
    setFormNotifyAudio(order.reminderConfig?.notifyAudio ?? true);
    setIsModalOpen(true);
  };

  // Submit Pre-Order (Create or Update)
  const handleSubmitPreOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id) return;

    if (!formCustomerName.trim()) {
      showFeedback('Vui lòng nhập tên khách hàng', 'error');
      return;
    }
    if (!formCustomerPhone.trim()) {
      showFeedback('Vui lòng nhập số điện thoại khách hàng', 'error');
      return;
    }
    if (!formDeliveryDate) {
      showFeedback('Vui lòng chọn ngày giao hàng', 'error');
      return;
    }
    if (!formDeliveryTime) {
      showFeedback('Vui lòng chọn giờ hẹn giao hàng', 'error');
      return;
    }
    if (formItems.length === 0) {
      showFeedback('Vui lòng thêm ít nhất 1 món ăn vào đơn đặt trước', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const codeDate = formDeliveryDate.replace(/-/g, '').slice(2);
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const generatedCode = editingPreOrder ? editingPreOrder.orderCode : `DT-${codeDate}-${randomSuffix}`;
      const preOrderId = editingPreOrder ? editingPreOrder.id : `pre_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const preOrderData: PreOrder = {
        id: preOrderId,
        orderCode: generatedCode,
        customerId: formCustomerId || undefined,
        customerName: formCustomerName.trim(),
        customerPhone: formCustomerPhone.trim(),
        customerAddress: formCustomerAddress.trim() || undefined,
        deliveryDate: formDeliveryDate,
        deliveryTime: formDeliveryTime,
        items: formItems,
        totalAmount: formTotalAmount,
        depositAmount: formDepositNum,
        remainingAmount: formRemainingNum,
        status: editingPreOrder ? editingPreOrder.status : 'confirmed',
        orderType: formOrderType,
        notes: formNotes.trim() || undefined,
        reminderConfig: {
          enabled: formReminderEnabled,
          advanceMinutes: formAdvanceStages,
          repeatIntervalMinutes: formRepeatInterval,
          notifyTelegram: formNotifyTelegram,
          notifyAudio: formNotifyAudio,
          notifiedStages: editingPreOrder ? editingPreOrder.reminderConfig?.notifiedStages || [] : [],
          lastNotifiedAt: editingPreOrder ? editingPreOrder.reminderConfig?.lastNotifiedAt : undefined,
        },
        createdAt: editingPreOrder ? editingPreOrder.createdAt : nowIso,
        updatedAt: nowIso,
      };

      const docRef = doc(db, 'shops', currentShop.id, 'preOrders', preOrderId);
      await setDoc(docRef, preOrderData, { merge: true });

      // Send initial Telegram alert if configured
      if (formNotifyTelegram && currentShop.telegramConfig?.enabled) {
        TelegramService.sendPreOrderAlert(currentShop.telegramConfig, preOrderData, currentShop.name);
      }

      // Play audio confirmation
      if (formNotifyAudio) {
        playNotificationSound();
      }

      setIsModalOpen(false);
      showFeedback(
        editingPreOrder
          ? `Đã cập nhật đơn đặt trước ${generatedCode}`
          : `Đã tạo đơn đặt trước ${generatedCode} thành công!`
      );
    } catch (err: unknown) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, `shops/${currentShop.id}/preOrders`);
      showFeedback('Có lỗi xảy ra khi lưu đơn đặt trước', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Transition
  const handleUpdateStatus = async (order: PreOrder, newStatus: PreOrderStatus) => {
    if (!currentShop?.id) return;
    try {
      const docRef = doc(db, 'shops', currentShop.id, 'preOrders', order.id);
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      showFeedback(`Đã chuyển đơn ${order.orderCode} sang "${PRE_ORDER_STATUS_LABELS[newStatus].label}"`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${currentShop.id}/preOrders/${order.id}`);
    }
  };

  // Delete Pre-Order
  const handleDeletePreOrder = async (order: PreOrder) => {
    if (!currentShop?.id) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đơn đặt trước ${order.orderCode} của khách ${order.customerName}?`)) {
      return;
    }

    try {
      const docRef = doc(db, 'shops', currentShop.id, 'preOrders', order.id);
      await deleteDoc(docRef);
      showFeedback(`Đã xóa đơn đặt trước ${order.orderCode}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shops/${currentShop.id}/preOrders/${order.id}`);
    }
  };

  // Send Manual Test Telegram Reminder
  const handleSendManualTelegram = async (order: PreOrder) => {
    if (!currentShop?.telegramConfig || !currentShop.telegramConfig.enabled) {
      showFeedback('Vui lòng bật cấu hình Telegram trong Cài đặt quán trước', 'error');
      return;
    }

    try {
      const res = await TelegramService.sendPreOrderReminder(
        currentShop.telegramConfig,
        order,
        `Nhắc hẹn thủ công: Giờ giao ${order.deliveryTime} ngày ${order.deliveryDate}`,
        currentShop.name
      );

      if (res.success) {
        showFeedback(`Đã gửi thông báo Telegram cho đơn ${order.orderCode}`);
      } else {
        showFeedback(`Lỗi gửi Telegram: ${res.error || 'Kiểm tra Token / ChatId'}`, 'error');
      }
    } catch (err) {
      showFeedback('Lỗi khi gửi thông báo Telegram', 'error');
    }
  };

  // Load into POS
  const handleLoadToPos = (order: PreOrder) => {
    if (onNavigateToPos) {
      onNavigateToPos(order);
    }
  };

  // Format Urgency
  const getUrgencyBadge = (order: PreOrder) => {
    if (order.status === 'completed') {
      return <span className="text-[11px] text-neutral-500 font-semibold">Đã hoàn tất</span>;
    }
    if (order.status === 'cancelled') {
      return <span className="text-[11px] text-red-500 font-semibold">Đã hủy</span>;
    }

    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const orderDateTimeStr = `${order.deliveryDate}T${order.deliveryTime}:00`;
    const orderTimestamp = new Date(orderDateTimeStr).getTime();

    if (order.deliveryDate !== todayYMD) {
      return (
        <span className="text-[11px] text-neutral-400 font-medium">
          Hẹn ngày {order.deliveryDate}
        </span>
      );
    }

    if (isNaN(orderTimestamp)) {
      return null;
    }

    const diffMinutes = Math.round((orderTimestamp - now.getTime()) / 60000);

    if (diffMinutes > 120) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-blue-950/70 border border-blue-800/60 text-blue-300 text-[10px] font-bold">
          Hôm nay lúc {order.deliveryTime}
        </span>
      );
    } else if (diffMinutes > 0) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-700/80 text-amber-300 text-[10px] font-black animate-pulse flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" />
          Còn {diffMinutes} phút nữa
        </span>
      );
    } else if (diffMinutes === 0) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-600 text-red-300 text-[10px] font-black flex items-center gap-1 animate-bounce">
          <AlertCircle className="w-3 h-3 text-red-400" />
          ĐẾN GIỜ GIAO!
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 rounded-full bg-red-950/90 border border-red-700 text-red-400 text-[10px] font-bold flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-red-400" />
          Quá giờ {Math.abs(diffMinutes)}p
        </span>
      );
    }
  };

  return (
    <div className="flex-1 bg-neutral-950 text-neutral-100 flex flex-col min-h-screen">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm font-bold flex items-center gap-2 shadow-2xl transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
              : 'bg-red-950/90 border-red-700 text-red-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur px-4 lg:px-8 py-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-red-700 flex items-center justify-center text-white shadow-md">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-black text-white tracking-tight">
                  Quản lý Đặt Hàng Trước (Pre-Orders)
                </h1>
                <p className="text-xs text-neutral-400">
                  Lịch hẹn giao món ngày/tháng/năm, cấu hình báo trước & liên kết POS tự động
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToPos && (
              <button
                onClick={() => onNavigateToPos()}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                <span>Mở Thu ngân POS</span>
              </button>
            )}

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-800 to-amber-700 hover:from-red-700 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-950/40 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tiếp nhận Đặt Hàng Mới</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
          <div className="p-3 bg-neutral-950/70 border border-neutral-800/80 rounded-xl">
            <span className="text-[11px] font-semibold text-neutral-400">Đơn hẹn giao hôm nay</span>
            <div className="text-lg font-black text-white mt-0.5">{metrics.todayCount} đơn</div>
          </div>
          <div className="p-3 bg-neutral-950/70 border border-amber-900/40 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-400">Chờ xác nhận</span>
            <div className="text-lg font-black text-amber-300 mt-0.5">{metrics.pendingCount} đơn</div>
          </div>
          <div className="p-3 bg-neutral-950/70 border border-purple-900/40 rounded-xl">
            <span className="text-[11px] font-semibold text-purple-400">Đang chuẩn bị & Sẵn sàng</span>
            <div className="text-lg font-black text-purple-300 mt-0.5">{metrics.preparingCount} đơn</div>
          </div>
          <div className="p-3 bg-neutral-950/70 border border-emerald-900/40 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-400">Doanh số đơn hoàn tất hôm nay</span>
            <div className="text-lg font-black text-emerald-300 mt-0.5">
              {formatCurrency(metrics.todayRevenue)}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="p-4 lg:px-8 border-b border-neutral-800/80 bg-neutral-950/60 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo tên khách, SĐT, mã DT-xxx, món ăn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Presets */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-xs font-bold">
            <span className="text-neutral-500 text-[11px] mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Lịch hẹn:
            </span>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                dateFilter === 'today'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setDateFilter('tomorrow')}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                dateFilter === 'tomorrow'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Ngày mai
            </button>
            <button
              onClick={() => setDateFilter('upcoming7')}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                dateFilter === 'upcoming7'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              7 ngày tới
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                dateFilter === 'all'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Tất cả
            </button>

            {/* Custom Date Input */}
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter('custom');
              }}
              className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </div>

        {/* Status Tab Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-neutral-100 text-neutral-900 font-bold'
                : 'bg-neutral-900/80 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Tất cả ({preOrders.length})
          </button>
          {(Object.keys(PRE_ORDER_STATUS_LABELS) as PreOrderStatus[]).map((st) => {
            const count = preOrders.filter((po) => po.status === st).length;
            const meta = PRE_ORDER_STATUS_LABELS[st];
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? `${meta.badgeClass} font-bold ring-1 ring-white/20`
                    : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>{meta.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT LIST */}
      <div className="flex-1 p-4 lg:px-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            <span className="text-xs">Đang tải danh sách đơn đặt trước...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30 p-8 max-w-xl mx-auto">
            <CalendarClock className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Chưa có đơn đặt hàng trước nào</h3>
            <p className="text-xs text-neutral-400 mb-5">
              {searchQuery || statusFilter !== 'all' || dateFilter !== 'all'
                ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc hiện tại.'
                : 'Tiếp nhận các đơn tiệc, đặt trước theo ngày/giờ để lên kế hoạch nướng vịt chuẩn xác.'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-red-800 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tiếp nhận Đặt Hàng Mới</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const statusMeta = PRE_ORDER_STATUS_LABELS[order.status] || PRE_ORDER_STATUS_LABELS.pending;
              const typeLabel = PRE_ORDER_TYPE_LABELS[order.orderType] || 'Mang về';

              return (
                <div
                  key={order.id}
                  className="bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-all relative overflow-hidden"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-amber-400 text-xs tracking-wider">
                            {order.orderCode}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-semibold">
                            {typeLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="font-bold text-white flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            {order.deliveryTime}
                          </span>
                          <span className="text-neutral-400 text-[11px]">
                            ngày {order.deliveryDate}
                          </span>
                          {getUrgencyBadge(order)}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-xl border font-bold ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-neutral-950/60 rounded-xl p-2.5 border border-neutral-800/80 mb-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {order.customerName}
                        </span>
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="font-mono text-amber-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                          title="Bấm để gọi điện"
                        >
                          <Phone className="w-3 h-3" />
                          {order.customerPhone}
                        </a>
                      </div>

                      {order.customerAddress && (
                        <div className="text-[11px] text-neutral-400 flex items-start gap-1.5 pt-0.5">
                          <MapPin className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{order.customerAddress}</span>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-1 mb-3">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        Món đặt ({order.items.length}):
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                        {order.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-0.5 border-b border-neutral-800/40 last:border-0"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-medium text-neutral-200">
                                {it.name}
                              </span>
                              {it.prepNote && (
                                <span className="text-[10px] text-amber-400/90 ml-1.5 italic">
                                  ({it.prepNote})
                                </span>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-neutral-400 font-mono text-[11px]">
                                {it.unit === 'kg' && it.weightKg ? `${it.weightKg}kg` : `x${it.quantity}`}
                              </span>
                              <span className="text-neutral-300 font-bold ml-2">
                                {formatCurrency(it.totalPrice)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs mb-3 space-y-1">
                      <div className="flex justify-between items-center text-neutral-400">
                        <span>Tổng tiền món:</span>
                        <span className="font-bold text-white">{formatCurrency(order.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-400">
                        <span>Tiền đặt cọc:</span>
                        <span className="font-bold text-emerald-400">
                          {order.depositAmount > 0 ? formatCurrency(order.depositAmount) : 'Chưa đặt cọc'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-neutral-800">
                        <span className="font-bold text-amber-300">Còn lại cần thu:</span>
                        <span className="font-black text-amber-400 text-sm">
                          {formatCurrency(order.remainingAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Reminder & Notes footer */}
                    {order.notes && (
                      <div className="text-[11px] text-neutral-400 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2 mb-3">
                        <span className="font-semibold text-amber-300">Ghi chú:</span> {order.notes}
                      </div>
                    )}

                    {order.reminderConfig?.enabled && (
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 py-1 border-t border-neutral-800/80 mb-3">
                        <div className="flex items-center gap-1.5">
                          <BellRing className="w-3 h-3 text-amber-400" />
                          <span>
                            Báo trước: {order.reminderConfig.advanceMinutes.map(m => m >= 60 ? `${m/60}h` : `${m}p`).join(', ')}
                          </span>
                        </div>
                        {order.reminderConfig.notifyTelegram && (
                          <span className="text-blue-400 flex items-center gap-1 font-semibold">
                            <Send className="w-2.5 h-2.5" /> Telegram
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                    {/* Primary Flow Advancement */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'confirmed')}
                          className="w-full py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Xác nhận đơn</span>
                        </button>
                      )}

                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'preparing')}
                          className="w-full py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>Bắt đầu nướng/làm</span>
                        </button>
                      )}

                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'ready')}
                          className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Sẵn sàng giao</span>
                        </button>
                      )}

                      {order.status === 'ready' && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'completed')}
                          className="w-full py-1.5 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Hoàn thành đơn</span>
                        </button>
                      )}

                      {/* Load to POS Button */}
                      {onNavigateToPos && order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => handleLoadToPos(order)}
                          className="py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                          title="Nạp vào màn hình thu ngân POS để thu tiền/in bill"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Nạp vào POS</span>
                        </button>
                      )}
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPrintPreOrder(order)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                          title="In phiếu hẹn đặt trước"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleSendManualTelegram(order)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-blue-400 transition-colors"
                          title="Gửi nhắc hẹn Telegram ngay bây giờ"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(order)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                          title="Chỉnh sửa đơn"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {order.status !== 'completed' && order.status !== 'cancelled' ? (
                        <button
                          onClick={() => handleUpdateStatus(order, 'cancelled')}
                          className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors px-2 py-1 rounded"
                        >
                          Hủy đơn
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeletePreOrder(order)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT PRE-ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-900/80 text-amber-400 flex items-center justify-center font-bold">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingPreOrder ? `Chỉnh sửa Đơn Đặt Trước: ${editingPreOrder.orderCode}` : 'Tiếp Nhận Đơn Hàng Đặt Trước Mới'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Hẹn ngày giao, giờ phút, món ăn & cấu hình nhắc chuông/Telegram
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitPreOrder} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Customer Selector / Input */}
              <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Thông tin Khách hàng:
                  </label>
                  {customers.length > 0 && (
                    <select
                      value={formCustomerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[11px] text-amber-300 focus:outline-hidden"
                    >
                      <option value="">-- Chọn khách từ danh bạ CRM --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} - {c.phone}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Tên khách hàng (*):</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Anh Tuấn, Chị Hoa..."
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Số điện thoại (*):</label>
                    <input
                      type="tel"
                      required
                      placeholder="09xx xxx xxx"
                      value={formCustomerPhone}
                      onChange={(e) => setFormCustomerPhone(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Địa chỉ giao hàng (nếu có):</label>
                  <input
                    type="text"
                    placeholder="Số nhà, đường, phường, quận..."
                    value={formCustomerAddress}
                    onChange={(e) => setFormCustomerAddress(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Delivery Schedule & Type */}
              <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800 space-y-2.5">
                <label className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
                  Lịch hẹn ngày & giờ giao nhận:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Ngày hẹn (Ngày/Tháng/Năm) (*):</label>
                    <input
                      type="date"
                      required
                      value={formDeliveryDate}
                      onChange={(e) => setFormDeliveryDate(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Giờ hẹn (Giờ:Phút) (*):</label>
                    <input
                      type="time"
                      required
                      value={formDeliveryTime}
                      onChange={(e) => setFormDeliveryTime(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Hình thức phục vụ:</label>
                    <select
                      value={formOrderType}
                      onChange={(e) => setFormOrderType(e.target.value as PreOrderType)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="takeaway">Mang về</option>
                      <option value="delivery">Giao hàng tận nơi</option>
                      <option value="dine_in">Ăn tại quán</option>
                      <option value="party">Đặt tiệc / Sự kiện</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Items in Pre-Order */}
              <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800 space-y-2.5">
                <label className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                  Danh sách món đặt trước:
                </label>

                {/* Add Item Row */}
                <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <label className="text-[10px] text-neutral-400 block mb-1">Chọn món:</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
                      >
                        <option value="">-- Bấm để chọn món vịt quay/đồ uống --</option>
                        {products
                          .filter((p) => p.isAvailable)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} - {formatCurrency(p.price)}/{p.unit}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      {selectedProductId && products.find((p) => p.id === selectedProductId)?.unit === 'kg' ? (
                        <>
                          <label className="text-[10px] text-neutral-400 block mb-1">Trọng lượng (Kg):</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            value={selectedProductWeight}
                            onChange={(e) => setSelectedProductWeight(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white"
                          />
                        </>
                      ) : (
                        <>
                          <label className="text-[10px] text-neutral-400 block mb-1">Số lượng:</label>
                          <input
                            type="number"
                            min="1"
                            value={selectedProductQty}
                            onChange={(e) => setSelectedProductQty(parseInt(e.target.value) || 1)}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white"
                          />
                        </>
                      )}
                    </div>

                    <div className="sm:col-span-3 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItemToForm}
                        disabled={!selectedProductId}
                        className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold disabled:opacity-40 transition-colors"
                      >
                        + Thêm món
                      </button>
                    </div>
                  </div>

                  {selectedProductId && (
                    <div>
                      <input
                        type="text"
                        placeholder="Dặn dò chế biến (VD: Chặt miếng to, không cay, chặt riêng đầu cánh...)"
                        value={selectedProductPrepNote}
                        onChange={(e) => setSelectedProductPrepNote(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg px-2.5 py-1 text-[11px] text-neutral-300 placeholder-neutral-500"
                      />
                    </div>
                  )}
                </div>

                {/* Items Table */}
                {formItems.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {formItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-white truncate">{item.name}</div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-2">
                            <span>
                              {item.unit === 'kg' && item.weightKg ? `${item.weightKg} kg` : `SL: ${item.quantity}`} x{' '}
                              {formatCurrency(item.unitPrice)}
                            </span>
                            {item.prepNote && (
                              <span className="text-amber-400 italic">[{item.prepNote}]</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-amber-300 font-mono">
                            {formatCurrency(item.totalPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFormItem(idx)}
                            className="text-neutral-500 hover:text-red-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-neutral-500 text-[11px] italic">
                    Chưa có món nào trong đơn đặt trước. Vui lòng chọn món ở trên.
                  </div>
                )}
              </div>

              {/* Deposit and Total Calculation */}
              <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block">Tổng tiền món:</span>
                    <span className="text-base font-black text-white">
                      {formatCurrency(formTotalAmount)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
                    <label className="text-[10px] text-neutral-400 block mb-1">
                      Tiền đặt cọc (tuỳ chọn - không bắt buộc):
                    </label>
                    <input
                      type="text"
                      placeholder="0"
                      value={formDepositAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setFormDepositAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-emerald-400 font-bold"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block">Còn lại cần thu khi giao:</span>
                    <span className="text-base font-black text-amber-400">
                      {formatCurrency(formRemainingNum)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Ghi chú đơn hàng (dặn dò thêm):</label>
                  <textarea
                    rows={2}
                    placeholder="Ví dụ: Khách dặn chặt 2 hộp riêng, đem theo 5 túi tương chấm..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* REMINDER & NOTIFICATION CONFIGURATION */}
              <div className="bg-neutral-950/70 p-3 rounded-xl border border-amber-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="font-bold text-white uppercase text-[11px]">
                        Cấu hình thông báo & nhắc hẹn tự động
                      </span>
                      <p className="text-[10px] text-neutral-400">
                        Hệ thống sẽ báo chuông và gửi tin Telegram khi đến lịch
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formReminderEnabled}
                      onChange={(e) => setFormReminderEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:width-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {formReminderEnabled && (
                  <div className="space-y-3 pt-2 border-t border-neutral-800">
                    {/* Advance Stages checkboxes */}
                    <div>
                      <label className="text-[11px] text-neutral-300 font-semibold block mb-1.5">
                        Mốc thời gian báo trước giờ hẹn:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {[
                          { val: 15, label: '15 phút trước' },
                          { val: 30, label: '30 phút trước' },
                          { val: 60, label: '1 tiếng trước' },
                          { val: 120, label: '2 tiếng trước' },
                          { val: 1440, label: '1 ngày trước' },
                        ].map((stage) => {
                          const isChecked = formAdvanceStages.includes(stage.val);
                          return (
                            <label
                              key={stage.val}
                              className={`p-2 rounded-lg border text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 transition-colors ${
                                isChecked
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormAdvanceStages((prev) => [...prev, stage.val]);
                                  } else {
                                    setFormAdvanceStages((prev) =>
                                      prev.filter((v) => v !== stage.val)
                                    );
                                  }
                                }}
                                className="sr-only"
                              />
                              <div
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                  isChecked ? 'bg-amber-500 border-amber-500 text-black' : 'border-neutral-600'
                                }`}
                              >
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span>{stage.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Repeat Interval */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-neutral-300 font-semibold block mb-1">
                          Lặp lại nhắc nhở nếu chưa làm xong:
                        </label>
                        <select
                          value={formRepeatInterval}
                          onChange={(e) => setFormRepeatInterval(parseInt(e.target.value) || 15)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
                        >
                          <option value="0">Không lặp lại</option>
                          <option value="10">Mỗi 10 phút một lần</option>
                          <option value="15">Mỗi 15 phút một lần (Khuyên dùng)</option>
                          <option value="30">Mỗi 30 phút một lần</option>
                        </select>
                      </div>

                      {/* Channels */}
                      <div>
                        <label className="text-[11px] text-neutral-300 font-semibold block mb-1">
                          Kênh thông báo:
                        </label>
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-300">
                            <input
                              type="checkbox"
                              checked={formNotifyAudio}
                              onChange={(e) => setFormNotifyAudio(e.target.checked)}
                              className="rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0"
                            />
                            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Chuông báo nội bộ</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-300">
                            <input
                              type="checkbox"
                              checked={formNotifyTelegram}
                              onChange={(e) => setFormNotifyTelegram(e.target.checked)}
                              className="rounded border-neutral-700 bg-neutral-900 text-blue-500 focus:ring-0"
                            />
                            <Send className="w-3.5 h-3.5 text-blue-400" />
                            <span>Telegram Bot</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-800 to-amber-700 hover:from-red-700 hover:to-amber-600 text-white font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingPreOrder ? 'Cập Nhật Đơn Đặt Trước' : 'Lưu Đơn Đặt Trước'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {printPreOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white text-neutral-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative font-mono text-xs">
            <button
              onClick={() => setPrintPreOrder(null)}
              className="absolute top-3 right-3 p-1 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center border-b pb-3 mb-3">
              <div className="text-lg font-black tracking-wide">{currentShop?.name || 'DUCKPOS PRO'}</div>
              <div className="text-[11px] text-neutral-600">{currentShop?.address}</div>
              <div className="text-[11px] text-neutral-600">Hotline: {currentShop?.phone}</div>
              <div className="mt-2 inline-block px-2 py-0.5 border border-black font-black text-xs uppercase">
                PHIẾU HẸN ĐẶT TRƯỚC
              </div>
            </div>

            <div className="space-y-1 mb-3 text-[11px]">
              <div><b>Mã đơn:</b> {printPreOrder.orderCode}</div>
              <div><b>Lịch hẹn:</b> {printPreOrder.deliveryTime} ngày {printPreOrder.deliveryDate}</div>
              <div><b>Khách:</b> {printPreOrder.customerName} - {printPreOrder.customerPhone}</div>
              {printPreOrder.customerAddress && <div><b>Địa chỉ:</b> {printPreOrder.customerAddress}</div>}
              <div><b>Hình thức:</b> {PRE_ORDER_TYPE_LABELS[printPreOrder.orderType]}</div>
            </div>

            <div className="border-t border-b py-2 mb-3 space-y-1 text-[11px]">
              {printPreOrder.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span>{it.name} ({it.unit === 'kg' && it.weightKg ? `${it.weightKg}kg` : `x${it.quantity}`})</span>
                  <span className="font-bold">{formatCurrency(it.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-right text-[11px] mb-4">
              <div>Tổng tiền: <b>{formatCurrency(printPreOrder.totalAmount)}</b></div>
              <div>Đã cọc: <b>{formatCurrency(printPreOrder.depositAmount)}</b></div>
              <div className="text-xs font-black">CÒN LẠI CẦN THU: {formatCurrency(printPreOrder.remainingAmount)}</div>
            </div>

            {printPreOrder.notes && (
              <div className="text-[10px] bg-neutral-100 p-2 rounded mb-4">
                <b>Ghi chú:</b> {printPreOrder.notes}
              </div>
            )}

            <div className="text-center text-[10px] text-neutral-500 pt-2 border-t">
              Cảm ơn quý khách đã đặt hàng!
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Phiếu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
