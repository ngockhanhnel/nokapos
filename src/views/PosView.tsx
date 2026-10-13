import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  doc,
  setDoc,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import {
  Product,
  OrderItem,
  PaymentMethod,
  Order,
  Shift,
  DiningOption,
  HoldOrder,
  Customer,
  CUSTOMER_TIER_LABELS,
  PreOrder,
  PreOrderStatus,
  PRE_ORDER_STATUS_LABELS,
  PRE_ORDER_TYPE_LABELS,
} from '@/src/types';
import {
  formatCurrency,
  formatNumber,
  formatInputCurrency,
  parseInputCurrency,
  generateOrderCode,
  generateShiftCode,
  getVietQRUrl,
  UNIT_LABELS,
} from '@/src/lib/formatters';
import { ReceiptPrintModal } from '@/src/components/ReceiptPrintModal';
import { ShiftHandoverModal } from '@/src/components/ShiftHandoverModal';
import { SmartNumpad } from '@/src/components/SmartNumpad';
import { PrepNoteModal } from '@/src/components/PrepNoteModal';
import { HoldOrdersModal } from '@/src/components/HoldOrdersModal';
import { generateTransferMemo, matchTransferContent } from '@/src/lib/sepay';
import {
  sendTelegramNotification,
  formatOrderTelegramMessage,
  formatSepayTelegramMessage,
} from '@/src/lib/telegram';
import { TelegramService } from '@/src/lib/telegramService';
import { playNotificationSound } from '@/src/lib/notifications';
import { SepayTransaction } from '@/src/types';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Loader2,
  Scale,
  UtensilsCrossed,
  X,
  Printer,
  Sparkles,
  Percent,
  Clock,
  Lock,
  Unlock,
  PauseCircle,
  FileText,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
  Store,
  ArrowLeft,
  Bell,
  Copy,
  Check,
  Zap,
  CheckCircle2,
  User,
  UserPlus,
  CalendarClock,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface PosViewProps {
  onExitToMenu?: () => void;
  onNavigateToProducts: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToPreOrders?: () => void;
  preOrderToLoad?: PreOrder | null;
  onClearPreOrderToLoad?: () => void;
  unreadNotificationsCount?: number;
}

export const PosView: React.FC<PosViewProps> = ({
  onExitToMenu,
  onNavigateToProducts,
  onNavigateToNotifications,
  onNavigateToPreOrders,
  preOrderToLoad,
  onClearPreOrderToLoad,
  unreadNotificationsCount = 0,
}) => {
  const { currentShop, user, userProfile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Active Shift state
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [currentOrderCode, setCurrentOrderCode] = useState<string>(() => generateOrderCode());
  const [diningOption, setDiningOption] = useState<DiningOption>('takeaway');
  const [discountType, setDiscountType] = useState<'vnd' | 'percent'>('vnd');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerCashFormatted, setCustomerCashFormatted] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [sepayAutoToast, setSepayAutoToast] = useState<string | null>(null);

  // Modals & Drawers
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null);
  const [inputWeight, setInputWeight] = useState<string>('1.0');
  const [numpadOpen, setNumpadOpen] = useState(false);
  const [prepNoteItemIndex, setPrepNoteItemIndex] = useState<number | null>(null);
  const [holdOrdersModalOpen, setHoldOrdersModalOpen] = useState(false);
  const [mobileCartDrawerOpen, setMobileCartDrawerOpen] = useState(false);

  // Customer & Loyalty state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ name: '', phone: '' });
  const [savingQuickCustomer, setSavingQuickCustomer] = useState(false);

  // Pre-Orders state
  const [todayPreOrders, setTodayPreOrders] = useState<PreOrder[]>([]);
  const [activePreOrderId, setActivePreOrderId] = useState<string | null>(null);
  const [preOrdersModalOpen, setPreOrdersModalOpen] = useState(false);
  const [saveAsPreOrderModalOpen, setSaveAsPreOrderModalOpen] = useState(false);

  // Save Cart as Pre-Order Form state
  const [savePreOrderCustomerName, setSavePreOrderCustomerName] = useState('');
  const [savePreOrderCustomerPhone, setSavePreOrderCustomerPhone] = useState('');
  const [savePreOrderCustomerAddress, setSavePreOrderCustomerAddress] = useState('');
  const [savePreOrderDate, setSavePreOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [savePreOrderTime, setSavePreOrderTime] = useState('11:30');
  const [savePreOrderDeposit, setSavePreOrderDeposit] = useState('0');
  const [savePreOrderNotes, setSavePreOrderNotes] = useState('');
  const [savingPreOrder, setSavingPreOrder] = useState(false);

  // Hold orders local storage cache
  const [holdOrders, setHoldOrders] = useState<HoldOrder[]>(() => {
    try {
      const saved = localStorage.getItem(`duckpos_hold_${currentShop?.id || 'default'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save hold orders to local storage
  useEffect(() => {
    if (currentShop?.id) {
      try {
        localStorage.setItem(`duckpos_hold_${currentShop.id}`, JSON.stringify(holdOrders));
      } catch (e) {
        console.error(e);
      }
    }
  }, [holdOrders, currentShop?.id]);

  // Load products
  useEffect(() => {
    if (!currentShop?.id) return;

    const productsRef = collection(db, 'shops', currentShop.id, 'products');
    const q = query(productsRef, where('isAvailable', '==', true));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Product[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Product, 'id'>) });
        });
        setProducts(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/products`);
      }
    );

    return () => unsubscribe();
  }, [currentShop?.id]);

  // Load active shift
  useEffect(() => {
    if (!currentShop?.id || !user) return;

    const shiftsRef = collection(db, 'shops', currentShop.id, 'shifts');
    const q = query(shiftsRef, where('status', '==', 'open'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const first = snapshot.docs[0];
          setActiveShift({ id: first.id, ...(first.data() as Omit<Shift, 'id'>) });
        } else {
          setActiveShift(null);
        }
      },
      (error) => {
        console.error('Shifts error:', error);
      }
    );

    return () => unsubscribe();
  }, [currentShop?.id, user?.uid]);

  // Subscribe to customers
  useEffect(() => {
    if (!currentShop?.id) return;
    const custRef = collection(db, 'shops', currentShop.id, 'customers');
    const unsub = onSnapshot(
      custRef,
      (snap) => {
        const list: Customer[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Customer, 'id'>) }));
        setCustomers(list);
      },
      (error) => {
        console.error('Customers error:', error);
      }
    );
    return () => unsub();
  }, [currentShop?.id]);

  // Subscribe to Pre-Orders in current shop
  useEffect(() => {
    if (!currentShop?.id) return;
    const preOrdersRef = collection(db, 'shops', currentShop.id, 'preOrders');
    const unsub = onSnapshot(
      preOrdersRef,
      (snap) => {
        const list: PreOrder[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<PreOrder, 'id'>) }));
        setTodayPreOrders(list);
      },
      (error) => {
        console.error('Pre-orders error:', error);
      }
    );
    return () => unsub();
  }, [currentShop?.id]);

  // Load Pre-Order into POS cart if passed via prop
  useEffect(() => {
    if (!preOrderToLoad) return;
    setCartItems(preOrderToLoad.items || []);
    setDiningOption(preOrderToLoad.orderType === 'dine_in' ? 'dine_in' : 'takeaway');
    setActivePreOrderId(preOrderToLoad.id);
    if (preOrderToLoad.customerName && preOrderToLoad.customerPhone) {
      setSelectedCustomer({
        id: preOrderToLoad.customerId || 'cust_temp',
        name: preOrderToLoad.customerName,
        phone: preOrderToLoad.customerPhone,
        address: preOrderToLoad.customerAddress,
        tier: 'retail',
        totalSpent: 0,
        loyaltyPoints: 0,
        debt: 0,
        createdAt: '',
      });
    }
    if (onClearPreOrderToLoad) {
      onClearPreOrderToLoad();
    }
  }, [preOrderToLoad, onClearPreOrderToLoad]);

  // Quick add customer from POS
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !quickCustomerForm.name.trim() || !quickCustomerForm.phone.trim()) return;

    try {
      setSavingQuickCustomer(true);
      const now = new Date().toISOString();
      const newCustData = {
        name: quickCustomerForm.name.trim(),
        phone: quickCustomerForm.phone.trim(),
        tier: 'retail' as const,
        totalSpent: 0,
        loyaltyPoints: 0,
        debt: 0,
        notes: 'Tạo nhanh tại POS',
        createdAt: now,
      };

      const docRef = await addDoc(collection(db, 'shops', currentShop.id, 'customers'), newCustData);
      const createdCustomer: Customer = {
        id: docRef.id,
        ...newCustData,
      };

      setSelectedCustomer(createdCustomer);
      setQuickCustomerForm({ name: '', phone: '' });
      setShowQuickAddCustomer(false);
      setCustomerModalOpen(false);
    } catch (err) {
      console.error('Lỗi khi thêm nhanh khách hàng:', err);
    } finally {
      setSavingQuickCustomer(false);
    }
  };

  // Handle open shift
  const handleOpenShift = async (initialCash: number) => {
    if (!currentShop?.id || !user) return;

    const shiftCode = generateShiftCode();
    const now = new Date().toISOString();
    const shiftId = 'shf_' + Math.random().toString(36).substring(2, 10);

    const newShift: Omit<Shift, 'id'> = {
      shiftCode,
      cashierId: user.uid,
      cashierName: userProfile?.displayName || user.email?.split('@')[0] || 'Thu ngân',
      startTime: now,
      initialCash,
      totalCashSales: 0,
      totalTransferSales: 0,
      totalSales: 0,
      ordersCount: 0,
      status: 'open',
      createdAt: now,
    };

    await setDoc(doc(db, 'shops', currentShop.id, 'shifts', shiftId), newShift);
    setActiveShift({ id: shiftId, ...newShift });
  };

  // Handle close shift
  const handleCloseShift = async (actualCash: number, note: string) => {
    if (!currentShop?.id || !activeShift) return;

    const now = new Date().toISOString();
    const expectedCash = activeShift.initialCash + activeShift.totalCashSales;
    const discrepancy = actualCash - expectedCash;

    await updateDoc(doc(db, 'shops', currentShop.id, 'shifts', activeShift.id), {
      status: 'closed',
      endTime: now,
      actualCashCounted: actualCash,
      discrepancy,
      note,
      updatedAt: now,
    });

    setActiveShift(null);
  };

  // Categories
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  // Add item to cart
  const handleSelectProduct = (product: Product) => {
    if (product.unit === 'kg') {
      setWeightModalProduct(product);
      setInputWeight('1.0');
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex > -1) {
        const next = [...prev];
        const item = next[existingIndex];
        const newQty = item.quantity + 1;
        next[existingIndex] = {
          ...item,
          quantity: newQty,
          totalPrice: newQty * item.unitPrice,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unit,
            unitPrice: product.price,
            quantity: 1,
            totalPrice: product.price,
          },
        ];
      }
    });
  };

  // Add weighted item
  const handleConfirmWeight = () => {
    if (!weightModalProduct) return;
    const weight = parseFloat(inputWeight) || 0;
    if (weight <= 0) return;

    const totalPrice = Math.round(weight * weightModalProduct.price);

    setCartItems((prev) => [
      ...prev,
      {
        productId: weightModalProduct.id,
        name: weightModalProduct.name,
        unit: 'kg',
        unitPrice: weightModalProduct.price,
        quantity: 1,
        weightKg: weight,
        totalPrice,
      },
    ]);

    setWeightModalProduct(null);
  };

  // Update item quantity
  const handleUpdateQuantity = (index: number, delta: number) => {
    setCartItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item.unit === 'kg') {
        const currentW = item.weightKg || 1;
        const newW = Math.max(0.1, Math.round((currentW + delta * 0.1) * 10) / 10);
        next[index] = {
          ...item,
          weightKg: newW,
          totalPrice: Math.round(newW * item.unitPrice),
        };
      } else {
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
          next.splice(index, 1);
        } else {
          next[index] = {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitPrice,
          };
        }
      }
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save prep note for item
  const handleSavePrepNote = (prepNote: string) => {
    if (prepNoteItemIndex === null) return;
    setCartItems((prev) => {
      const next = [...prev];
      next[prepNoteItemIndex] = { ...next[prepNoteItemIndex], prepNote };
      return next;
    });
    setPrepNoteItemIndex(null);
  };

  // Hold current order
  const handleHoldCurrentOrder = () => {
    if (cartItems.length === 0) return;
    const defaultLabel = selectedCustomer?.name || `Khách ${holdOrders.length + 1}`;
    const customerLabel = prompt('Nhập tên hoặc số bàn cho đơn này:', defaultLabel);
    if (customerLabel === null) return;

    const newHold: HoldOrder = {
      id: 'hold_' + Math.random().toString(36).substring(2, 9),
      code: `T${(holdOrders.length + 1).toString().padStart(2, '0')}`,
      label: customerLabel.trim() || defaultLabel,
      items: cartItems,
      diningOption,
      discountType,
      discountValue,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      createdAt: new Date().toISOString(),
    };

    setHoldOrders((prev) => [...prev, newHold]);
    setCartItems([]);
    setSelectedCustomer(null);
    setDiscountValue('');
    setCustomerCashFormatted('');
    setMobileCartDrawerOpen(false);
  };

  // Recall hold order
  const handleRecallOrder = (order: HoldOrder) => {
    setCartItems(order.items);
    setDiningOption(order.diningOption);
    setDiscountType(order.discountType);
    setDiscountValue(order.discountValue);

    if (order.customerId) {
      const matched = customers.find((c) => c.id === order.customerId);
      if (matched) {
        setSelectedCustomer(matched);
      } else if (order.customerName) {
        setSelectedCustomer({
          id: order.customerId,
          name: order.customerName,
          phone: order.customerPhone || '',
          tier: 'retail',
          totalSpent: 0,
          loyaltyPoints: 0,
          debt: 0,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      setSelectedCustomer(null);
    }

    setHoldOrders((prev) => prev.filter((h) => h.id !== order.id));
    setHoldOrdersModalOpen(false);
    setMobileCartDrawerOpen(true);
  };

  const handleDeleteHoldOrder = (id: string) => {
    setHoldOrders((prev) => prev.filter((h) => h.id !== id));
  };

  // Totals & Discount calculation
  const subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);

  const parsedDiscountInput =
    discountType === 'percent'
      ? parseFloat(discountValue) || 0
      : parseInputCurrency(discountValue);

  const calculatedDiscount =
    discountType === 'percent'
      ? Math.round(subtotal * (Math.min(100, Math.max(0, parsedDiscountInput)) / 100))
      : Math.min(subtotal, Math.max(0, parsedDiscountInput));

  const finalTotal = Math.max(0, subtotal - calculatedDiscount);

  // Cash calculation
  const parsedCustomerCash = parseInputCurrency(customerCashFormatted);
  const changeCash = Math.max(0, parsedCustomerCash - finalTotal);

  // Quick cash helper suggestions
  const cashSuggestions = [
    finalTotal,
    Math.ceil(finalTotal / 50000) * 50000,
    Math.ceil(finalTotal / 100000) * 100000,
    Math.ceil(finalTotal / 200000) * 200000,
    500000,
  ]
    .filter((v, i, arr) => v >= finalTotal && arr.indexOf(v) === i)
    .slice(0, 4);

  // Open Save as Pre-Order Modal with prefilled customer
  const handleOpenSaveAsPreOrder = () => {
    if (selectedCustomer) {
      setSavePreOrderCustomerName(selectedCustomer.name);
      setSavePreOrderCustomerPhone(selectedCustomer.phone);
      setSavePreOrderCustomerAddress(selectedCustomer.address || '');
    }
    setSaveAsPreOrderModalOpen(true);
  };

  // Save current Cart as Pre-Order directly from POS
  const handleSaveCartAsPreOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || cartItems.length === 0) return;
    if (!savePreOrderCustomerName.trim() || !savePreOrderCustomerPhone.trim()) return;

    try {
      setSavingPreOrder(true);
      const nowIso = new Date().toISOString();
      const codeDate = savePreOrderDate.replace(/-/g, '').slice(2);
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const generatedCode = `DT-${codeDate}-${randomSuffix}`;
      const preOrderId = `pre_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const depositNum = Math.max(0, parseInt(savePreOrderDeposit.replace(/\D/g, '') || '0', 10));

      const newPreOrder: PreOrder = {
        id: preOrderId,
        orderCode: generatedCode,
        customerId: selectedCustomer?.id,
        customerName: savePreOrderCustomerName.trim(),
        customerPhone: savePreOrderCustomerPhone.trim(),
        customerAddress: savePreOrderCustomerAddress.trim() || undefined,
        deliveryDate: savePreOrderDate,
        deliveryTime: savePreOrderTime,
        items: cartItems,
        totalAmount: finalTotal,
        depositAmount: depositNum,
        remainingAmount: Math.max(0, finalTotal - depositNum),
        status: 'confirmed',
        orderType: diningOption === 'takeaway' ? 'takeaway' : 'dine_in',
        notes: savePreOrderNotes.trim() || undefined,
        reminderConfig: {
          enabled: true,
          advanceMinutes: [15, 30, 60],
          repeatIntervalMinutes: 15,
          notifyTelegram: true,
          notifyAudio: true,
          notifiedStages: [],
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await setDoc(doc(db, 'shops', currentShop.id, 'preOrders', preOrderId), newPreOrder);

      if (currentShop.telegramConfig?.enabled) {
        TelegramService.sendPreOrderAlert(currentShop.telegramConfig, newPreOrder, currentShop.name);
      }
      playNotificationSound();

      setCartItems([]);
      setSelectedCustomer(null);
      setSaveAsPreOrderModalOpen(false);
      setSavePreOrderCustomerName('');
      setSavePreOrderCustomerPhone('');
      setSavePreOrderCustomerAddress('');
      setSavePreOrderNotes('');
      setSavePreOrderDeposit('0');
      alert(`Đã lưu đơn Đặt Trước ${generatedCode} thành công! Lịch hẹn: ${savePreOrderTime} ngày ${savePreOrderDate}`);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu đơn đặt trước');
    } finally {
      setSavingPreOrder(false);
    }
  };

  // Submit Order with Idempotency Protection & SePay / Telegram auto confirmation
  const handleCompleteOrder = async (
    overrideCode?: string,
    overridePaymentMethod?: PaymentMethod,
    overrideTx?: SepayTransaction
  ) => {
    if (!currentShop?.id || !user) return;
    if (cartItems.length === 0) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const orderCode = overrideCode || currentOrderCode || generateOrderCode();
      const pMethod = overridePaymentMethod || paymentMethod;
      const now = new Date().toISOString();
      const orderId = 'ord_' + Math.random().toString(36).substring(2, 10);

      const pointsEarned = selectedCustomer ? Math.floor(finalTotal / 10000) : undefined;

      const newOrder: Order = {
        id: orderId,
        orderCode,
        shiftId: activeShift ? activeShift.id : undefined,
        diningOption,
        items: cartItems,
        subtotal,
        discount: calculatedDiscount,
        finalTotal,
        paymentMethod: pMethod,
        paymentStatus: 'paid',
        status: 'completed',
        cashierId: user.uid,
        cashierName: userProfile?.displayName || user.email?.split('@')[0] || 'Thu ngân',
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        customerPhone: selectedCustomer?.phone,
        pointsEarned,
        customerCash: pMethod === 'cash' ? (parsedCustomerCash || finalTotal) : undefined,
        changeCash: pMethod === 'cash' ? changeCash : undefined,
        createdAt: now,
      };

      // Atomic Transaction
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'shops', currentShop.id, 'orders', orderId);
        transaction.set(orderRef, newOrder);

        // Update customer points and total spent
        if (selectedCustomer) {
          const custRef = doc(db, 'shops', currentShop.id, 'customers', selectedCustomer.id);
          const custDoc = await transaction.get(custRef);
          if (custDoc.exists()) {
            const cData = custDoc.data();
            const currentSpent = cData.totalSpent || 0;
            const currentPoints = cData.loyaltyPoints || 0;
            const pts = Math.floor(finalTotal / 10000);
            transaction.update(custRef, {
              totalSpent: currentSpent + finalTotal,
              loyaltyPoints: currentPoints + pts,
            });
          }
        }

        // If matched from SePay transaction, mark transaction as matched
        if (overrideTx) {
          const txRef = doc(db, 'shops', currentShop.id, 'sepayTransactions', overrideTx.id);
          transaction.update(txRef, {
            status: 'matched',
            matchedOrderCode: orderCode,
            matchedOrderId: orderId,
          });
        }

        // Deduct inventory
        for (const item of cartItems) {
          const productRef = doc(db, 'shops', currentShop.id, 'products', item.productId);
          const pDoc = await transaction.get(productRef);
          if (pDoc.exists()) {
            const currentStock = pDoc.data().stockQuantity || 0;
            const deduction = item.unit === 'kg' ? (item.weightKg || 1) : item.quantity;
            transaction.update(productRef, {
              stockQuantity: Math.max(0, currentStock - deduction),
              updatedAt: now,
            });

            // Log inventory movement
            const moveId = 'mov_' + Math.random().toString(36).substring(2, 10);
            const moveRef = doc(db, 'shops', currentShop.id, 'inventoryMovements', moveId);
            transaction.set(moveRef, {
              productId: item.productId,
              productName: item.name,
              type: 'sale',
              quantity: -deduction,
              reason: `Bán đơn ${orderCode}`,
              performedBy: userProfile?.displayName || user.email || 'POS',
              createdAt: now,
            });
          }
        }

        // Update shift stats
        if (activeShift) {
          const shiftRef = doc(db, 'shops', currentShop.id, 'shifts', activeShift.id);
          const shiftDoc = await transaction.get(shiftRef);
          if (shiftDoc.exists()) {
            const sData = shiftDoc.data();
            const newOrdersCount = (sData.ordersCount || 0) + 1;
            const newTotalSales = (sData.totalSales || 0) + finalTotal;
            const newCashSales = (sData.totalCashSales || 0) + (pMethod === 'cash' ? finalTotal : 0);
            const newTransferSales = (sData.totalTransferSales || 0) + (pMethod === 'transfer' ? finalTotal : 0);

            transaction.update(shiftRef, {
              ordersCount: newOrdersCount,
              totalSales: newTotalSales,
              totalCashSales: newCashSales,
              totalTransferSales: newTransferSales,
              updatedAt: now,
            });
          }
        }

        // Update linked Pre-Order status to completed if this was loaded from a Pre-Order
        if (activePreOrderId) {
          const preOrderRef = doc(db, 'shops', currentShop.id, 'preOrders', activePreOrderId);
          transaction.update(preOrderRef, {
            status: 'completed',
            convertedToOrderId: orderId,
            updatedAt: now,
          });
        }
      });

      // Send Telegram notification if configured
      if (currentShop.telegramConfig?.enabled) {
        if (currentShop.telegramConfig.notifyNewOrder) {
          sendTelegramNotification(
            currentShop.telegramConfig,
            formatOrderTelegramMessage(newOrder, currentShop.name)
          );
        }
        if (overrideTx && currentShop.telegramConfig.notifySepayTransfer) {
          sendTelegramNotification(
            currentShop.telegramConfig,
            formatSepayTelegramMessage(overrideTx, orderCode, currentShop.name)
          );
        }
      }

      // Show receipt modal and reset cart
      setCompletedOrder(newOrder);
      setCartItems([]);
      setSelectedCustomer(null);
      setActivePreOrderId(null);
      setDiscountValue('');
      setCustomerCashFormatted('');
      setMobileCartDrawerOpen(false);
      setCurrentOrderCode(generateOrderCode());
    } catch (err: unknown) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, `shops/${currentShop.id}/orders`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real-time listener for incoming SePay Autobank transactions matching current cart
  useEffect(() => {
    if (
      !currentShop?.id ||
      cartItems.length === 0 ||
      paymentMethod !== 'transfer' ||
      isSubmitting
    ) {
      return;
    }

    const txRef = collection(db, 'shops', currentShop.id, 'sepayTransactions');
    const q = query(txRef, where('transferType', '==', 'in'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const tx = { id: change.doc.id, ...change.doc.data() } as SepayTransaction;
          if (tx.status !== 'ignored' && tx.transferAmount >= finalTotal) {
            const isMatch = matchTransferContent(
              tx.content,
              currentShop.sepayConfig?.transferPrefix || 'DUCK',
              currentOrderCode
            );
            if (isMatch) {
              console.log('⚡ SePay Autobank Matched Order:', currentOrderCode, tx);
              playNotificationSound();
              setSepayAutoToast(
                `🎉 Đã nhận +${formatCurrency(tx.transferAmount)} qua SePay! Đang tự động chốt đơn và mở bill...`
              );
              handleCompleteOrder(currentOrderCode, 'transfer', tx);
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [currentShop?.id, cartItems.length, paymentMethod, finalTotal, currentOrderCode, isSubmitting]);

  return (
    <div className="w-full h-screen flex flex-col lg:flex-row overflow-hidden bg-neutral-950 relative">
      {/* LEFT: Products selection panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-neutral-800 pb-20 lg:pb-0">
        {/* TOP DEDICATED POS TERMINAL HEADER */}
        <div className="p-2 sm:p-3 bg-neutral-900 border-b border-neutral-800 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Exit to Menu button (Mobile/Tablet focus) */}
            <div className="flex items-center gap-1.5">
              {onExitToMenu && (
                <button
                  type="button"
                  onClick={onExitToMenu}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-700 active:scale-95"
                  title="Quay lại Menu quản trị"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Quay lại</span>
                  <span className="sm:hidden">Menu</span>
                </button>
              )}

              {/* Shift pill button */}
              <button
                onClick={() => setShiftModalOpen(true)}
                className={`px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors border shadow-xs ${
                  activeShift
                    ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-amber-950/80 border-amber-700/80 text-amber-300 hover:bg-amber-900/60'
                }`}
              >
                {activeShift ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{activeShift.shiftCode}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mở ca</span>
                  </>
                )}
              </button>
            </div>

            {/* Hold orders button & Pre-Orders quick button & Dining switcher & Notification bell */}
            <div className="flex items-center gap-1.5">
              {/* Pre-Orders quick button */}
              <button
                type="button"
                onClick={() => setPreOrdersModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95 border shadow-xs ${
                  activePreOrderId
                    ? 'bg-amber-500 text-black border-amber-300 font-black animate-pulse'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border-neutral-700'
                }`}
                title="Xem đơn đặt trước hôm nay & Nạp vào POS"
              >
                <CalendarClock className={`w-3.5 h-3.5 ${activePreOrderId ? 'text-black' : 'text-amber-400'}`} />
                <span className="hidden sm:inline">Đặt trước</span>
                {todayPreOrders.filter((po) => po.status !== 'completed' && po.status !== 'cancelled').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black">
                    {todayPreOrders.filter((po) => po.status !== 'completed' && po.status !== 'cancelled').length}
                  </span>
                )}
              </button>

              {holdOrders.length > 0 && (
                <button
                  onClick={() => setHoldOrdersModalOpen(true)}
                  className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-transform active:scale-95"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Đơn chờ ({holdOrders.length})</span>
                </button>
              )}

              {/* Dining option switcher */}
              <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDiningOption('takeaway')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                    diningOption === 'takeaway'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span className="text-[11px]">Mang về</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiningOption('dine_in')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                    diningOption === 'dine_in'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Store className="w-3 h-3" />
                  <span className="text-[11px]">Tại quán</span>
                </button>
              </div>

              {/* Notification button */}
              {onNavigateToNotifications && (
                <button
                  type="button"
                  onClick={onNavigateToNotifications}
                  className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 relative transition-colors"
                  title="Thông báo"
                >
                  <Bell className="w-4 h-4 text-amber-400" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm tên món vịt, mã món..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
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

          {/* Category Filter bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-red-800 text-white shadow-sm'
                  : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              Tất cả món ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-red-800 text-white shadow-sm'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-2 sm:p-3 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang tải danh sách món ăn...
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-500 mb-3">
                <UtensilsCrossed className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                Thực đơn quán chưa có sản phẩm nào
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mb-4">
                Chưa có món vịt quay hoặc đồ uống nào được ghi nhận. Vui lòng thêm các sản phẩm thật vào quán của bạn để bắt đầu bán hàng.
              </p>
              <button
                onClick={onNavigateToProducts}
                className="py-2 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg text-xs flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Thêm sản phẩm ngay
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              Không tìm thấy món ăn nào khớp với từ khóa "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
              {filteredProducts.map((p) => {
                const isKg = p.unit === 'kg';
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="p-3 bg-neutral-900 hover:bg-neutral-800/90 border border-neutral-800 hover:border-red-800/80 rounded-2xl text-left flex flex-col justify-between transition-all active:scale-[0.98] group relative overflow-hidden shadow-xs min-h-[95px]"
                  >
                    <div className="w-full">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-amber-400/90 truncate uppercase tracking-wider">
                          {p.category}
                        </span>
                        {isKg && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-bold bg-amber-950/80 border border-amber-800/60 rounded px-1.5 py-0.5">
                            <Scale className="w-3 h-3" />
                            Cân ký
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-neutral-100 line-clamp-2 leading-tight">
                        {p.name}
                      </h4>
                    </div>

                    <div className="w-full pt-2 border-t border-neutral-800/60 flex items-baseline justify-between mt-1">
                      <span className="text-xs font-black text-amber-300 tabular-nums">
                        {formatCurrency(p.price)}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-medium">
                        /{UNIT_LABELS[p.unit] || p.unit}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FLOATING MOBILE CART TRIGGER BAR (Cleanly positioned on mobile with zero overlay) */}
      <div className="lg:hidden fixed bottom-2 left-2 right-2 z-30">
        <button
          onClick={() => setMobileCartDrawerOpen(true)}
          className="w-full py-2.5 px-4 bg-linear-to-r from-red-800 to-amber-600 rounded-2xl flex items-center justify-between text-white shadow-2xl active:scale-[0.99] transition-transform border border-amber-500/40"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center font-bold text-xs border border-white/20">
              {cartItems.length}
            </div>
            <div className="text-left">
              <div className="text-[11px] font-semibold text-amber-200">
                {diningOption === 'takeaway' ? 'Mang về' : 'Tại quán'}
              </div>
              <div className="text-sm font-black tabular-nums">
                {formatCurrency(finalTotal)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-extrabold bg-white/20 px-3 py-1.5 rounded-xl">
            <span>Thanh toán</span>
            <ChevronUp className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* RIGHT: Cart & Checkout Panel (Desktop split, or Mobile Slide-up Drawer) */}
      <div
        className={`fixed inset-0 z-40 lg:relative lg:inset-auto lg:z-auto lg:w-96 bg-neutral-900 flex flex-col h-full border-t lg:border-t-0 border-neutral-800 shrink-0 transition-transform duration-200 ${
          mobileCartDrawerOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'
        }`}
      >
        {/* Cart Header */}
        <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Đơn hàng ({cartItems.length} món)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleOpenSaveAsPreOrder}
                  className="px-2 py-1 bg-red-950/60 hover:bg-red-900/80 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="Lưu giỏ hàng này làm đơn Đặt Trước (hẹn ngày giờ)"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lưu Đặt Trước</span>
                </button>
                <button
                  onClick={handleHoldCurrentOrder}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="Tạm lưu đơn này"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Treo đơn</span>
                </button>
                <button
                  onClick={() => setCartItems([])}
                  className="text-[11px] text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                  title="Xóa giỏ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* Mobile minimize button */}
            <button
              onClick={() => setMobileCartDrawerOpen(false)}
              className="lg:hidden p-1.5 rounded-xl bg-neutral-800 text-neutral-300"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Linked Pre-Order Active Banner */}
        {activePreOrderId && (
          <div className="px-3.5 py-1.5 bg-amber-950/80 border-b border-amber-600/50 flex items-center justify-between text-xs text-amber-200 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <CalendarClock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate text-[11px] font-bold">
                Đang xử lý đơn Đặt trước:{' '}
                {todayPreOrders.find((p) => p.id === activePreOrderId)?.orderCode || activePreOrderId}
              </span>
            </div>
            <button
              onClick={() => setActivePreOrderId(null)}
              className="text-[10px] text-amber-400 hover:text-white underline ml-2 shrink-0"
              title="Hủy liên kết với đơn đặt trước"
            >
              Hủy liên kết
            </button>
          </div>
        )}

        {/* Customer / Loyalty Badge Bar */}
        <div className="px-3.5 py-2 bg-neutral-950/70 border-b border-neutral-800/80 shrink-0">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-neutral-900 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                    <span>{selectedCustomer.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-semibold">
                      {CUSTOMER_TIER_LABELS[selectedCustomer.tier] || 'Khách lẻ'}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400 flex items-center gap-2">
                    <span className="font-mono text-neutral-300">{selectedCustomer.phone}</span>
                    <span>·</span>
                    <span className="text-amber-400 font-semibold">{selectedCustomer.loyaltyPoints || 0} điểm</span>
                    {selectedCustomer.debt > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-red-400 font-semibold">Nợ: {formatCurrency(selectedCustomer.debt)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-neutral-400 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors shrink-0 ml-1"
                title="Bỏ chọn khách hàng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setCustomerSearch('');
                setShowQuickAddCustomer(false);
                setCustomerModalOpen(true);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 border-dashed text-neutral-400 hover:text-white transition-all text-xs group"
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-neutral-500 group-hover:text-amber-400 transition-colors" />
                <span>Khách hàng & Tích điểm</span>
              </div>
              <span className="text-[10px] bg-neutral-800 group-hover:bg-amber-500/20 text-neutral-400 group-hover:text-amber-300 px-1.5 py-0.5 rounded transition-colors font-semibold">
                + Chọn khách
              </span>
            </button>
          )}
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs">Chưa có món nào được chọn</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                Nhấp vào món ăn bên trái để thêm vào đơn hàng
              </p>
            </div>
          ) : (
            cartItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-2.5 space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{item.name}</div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                      <span className="tabular-nums">{formatCurrency(item.unitPrice)}</span>
                      <span>·</span>
                      <span className="text-amber-400 font-semibold">
                        {item.unit === 'kg' && item.weightKg
                          ? `${item.weightKg} kg`
                          : `${item.quantity} ${UNIT_LABELS[item.unit] || item.unit}`}
                      </span>
                    </div>
                  </div>

                  {/* Counter controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center active:scale-95 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-white min-w-7 text-center tabular-nums">
                      {item.unit === 'kg' ? item.weightKg : item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center active:scale-95 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Prep note button & display */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[10px]">
                  {item.prepNote ? (
                    <button
                      onClick={() => setPrepNoteItemIndex(idx)}
                      className="text-amber-300 italic hover:underline flex items-center gap-1 max-w-[200px] truncate"
                    >
                      <FileText className="w-3 h-3 shrink-0" />
                      <span>{item.prepNote}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setPrepNoteItemIndex(idx)}
                      className="text-neutral-500 hover:text-amber-400 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Yêu cầu chặt / gia vị</span>
                    </button>
                  )}

                  <span className="font-extrabold text-amber-400 tabular-nums text-xs">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation and Payment Panel */}
        <div className="p-3.5 bg-neutral-950 border-t border-neutral-800 space-y-2.5 shrink-0 pb-safe">
          {/* Subtotal & Discount */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Tổng tiền hàng:</span>
              <span className="font-semibold text-neutral-200 tabular-nums">
                {formatCurrency(subtotal)}
              </span>
            </div>

            {/* Flexible Discount (Percent or VND) */}
            <div className="flex items-center justify-between text-neutral-400">
              <div className="flex items-center gap-1">
                <span>Giảm giá:</span>
                <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('vnd');
                      setDiscountValue('');
                    }}
                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                      discountType === 'vnd' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400'
                    }`}
                  >
                    ₫
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('percent');
                      setDiscountValue('');
                    }}
                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                      discountType === 'percent' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={discountValue}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (discountType === 'percent') {
                      const num = parseInt(raw.replace(/[^0-9]/g, '')) || 0;
                      setDiscountValue(num > 100 ? '100' : num ? num.toString() : '');
                    } else {
                      setDiscountValue(formatInputCurrency(raw));
                    }
                  }}
                  className="w-24 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-right text-xs text-amber-400 tabular-nums font-bold focus:outline-hidden focus:border-amber-500"
                />
                <span className="text-[10px]">{discountType === 'percent' ? '%' : '₫'}</span>
                {discountType === 'percent' && calculatedDiscount > 0 && (
                  <span className="text-[10px] text-amber-400/80">
                    (-{formatCurrency(calculatedDiscount)})
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-neutral-800">
              <span>Khách cần trả:</span>
              <span className="text-base text-amber-400 tabular-nums">
                {formatCurrency(finalTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method Switcher */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                paymentMethod === 'cash'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Tiền mặt
            </button>

            <button
              onClick={() => setPaymentMethod('transfer')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                paymentMethod === 'transfer'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              VietQR
            </button>
          </div>

          {/* Payment Details Drawer */}
          {paymentMethod === 'cash' ? (
            <div className="space-y-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Tiền khách đưa:</span>
                <button
                  type="button"
                  onClick={() => setNumpadOpen(true)}
                  className="w-36 bg-neutral-950 border border-neutral-700 hover:border-amber-500 rounded-lg px-2.5 py-1 text-right text-xs text-white tabular-nums font-bold flex items-center justify-between"
                >
                  <span className="text-[10px] text-amber-500">Bấm nhập</span>
                  <span>{customerCashFormatted ? `${customerCashFormatted} ₫` : '0 ₫'}</span>
                </button>
              </div>

              {/* Quick cash pills */}
              <div className="flex flex-wrap gap-1 justify-end">
                {cashSuggestions.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCustomerCashFormatted(formatInputCurrency(amt))}
                    className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded font-medium tabular-nums transition-colors"
                  >
                    {formatNumber(amt)}
                  </button>
                ))}
              </div>

              {parsedCustomerCash > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-neutral-800 font-semibold">
                  <span className="text-neutral-400">Tiền thừa trả khách:</span>
                  <span
                    className={`tabular-nums ${
                      parsedCustomerCash >= finalTotal ? 'text-emerald-400 font-extrabold text-sm' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(changeCash)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* VietQR & SePay Autobank Mode */
            <div className="bg-neutral-900/90 p-2.5 rounded-2xl border border-neutral-800 text-center space-y-2 shadow-xs">
              {currentShop?.bankAccountNumber && currentShop?.bankName ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-neutral-800 text-neutral-300">
                    <span className="font-bold flex items-center gap-1 text-white">
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      Mã VietQR Động
                    </span>
                    <span className="font-extrabold text-amber-400 font-mono text-xs tabular-nums">
                      {formatCurrency(finalTotal)}
                    </span>
                  </div>

                  {/* Dynamic VietQR Image */}
                  <div className="inline-block p-2 bg-white rounded-2xl shadow-xl my-2 border-2 border-amber-500/20">
                    <img
                      src={getVietQRUrl(
                        currentShop.bankName,
                        currentShop.bankAccountNumber,
                        finalTotal,
                        generateTransferMemo(currentShop.sepayConfig?.transferPrefix || 'DUCK', currentOrderCode)
                      )}
                      alt="VietQR Dynamic Payment"
                      className="w-36 h-36 object-contain"
                    />
                  </div>

                  {/* Account & Memo Details with Copy Buttons */}
                  <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-800 text-[11px] space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Ngân hàng:</span>
                      <span className="font-bold text-neutral-200">{currentShop.bankName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Số tài khoản:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-amber-300">{currentShop.bankAccountNumber}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(currentShop.bankAccountNumber);
                            setCopiedAcc(true);
                            setTimeout(() => setCopiedAcc(false), 2000);
                          }}
                          className="p-1 hover:text-white text-neutral-400"
                          title="Sao chép STK"
                        >
                          {copiedAcc ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
                      <span className="text-neutral-500">Nội dung CK:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-emerald-400">
                          {generateTransferMemo(currentShop.sepayConfig?.transferPrefix || 'DUCK', currentOrderCode)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              generateTransferMemo(currentShop.sepayConfig?.transferPrefix || 'DUCK', currentOrderCode)
                            );
                            setCopiedMemo(true);
                            setTimeout(() => setCopiedMemo(false), 2000);
                          }}
                          className="p-1 hover:text-white text-neutral-400"
                          title="Sao chép nội dung"
                        >
                          {copiedMemo ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SePay Autobank live indicator */}
                  <div className="mt-2 p-1.5 rounded-lg bg-red-950/40 border border-red-900/60 flex items-center justify-center gap-1.5 text-[10px] text-amber-300 animate-pulse">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>SePay Autobank: Đang chờ tiền vào để tự động chốt đơn...</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-[11px] text-amber-400/90 bg-amber-950/40 rounded-lg">
                  Quán chưa cấu hình số tài khoản ngân hàng trong phần Cài đặt.
                </div>
              )}
            </div>
          )}

          {/* Complete Button with Idempotency Lock */}
          <button
            onClick={() => handleCompleteOrder()}
            disabled={cartItems.length === 0 || isSubmitting}
            className="w-full py-3 px-4 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.99] shadow-lg border border-red-500/30"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu đơn hàng...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 text-amber-300" />
                Thanh toán & In bill ({formatCurrency(finalTotal)})
              </>
            )}
          </button>
        </div>
      </div>

      {/* WEIGHT MODAL FOR KG PRODUCTS */}
      {weightModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Scale className="w-4 h-4 text-amber-400" />
                Cân ký: {weightModalProduct.name}
              </div>
              <button
                onClick={() => setWeightModalProduct(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-2 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="text-[11px] text-neutral-400">Đơn giá niêm yết</div>
              <div className="text-sm font-bold text-amber-400 tabular-nums">
                {formatCurrency(weightModalProduct.price)} / kg
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Số ký (kg) cân được:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  autoFocus
                  value={inputWeight}
                  onChange={(e) => setInputWeight(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xl font-bold text-white text-center tabular-nums focus:outline-hidden focus:border-amber-500"
                />
                <span className="text-sm font-bold text-neutral-300">kg</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '2.2'].map((w) => (
                <button
                  key={w}
                  onClick={() => setInputWeight(w)}
                  className="py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 rounded-lg tabular-nums transition-colors"
                >
                  {w} kg
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs p-2.5 bg-neutral-950/80 rounded-lg border border-neutral-800/80">
              <span className="text-neutral-400">Thành tiền tạm tính:</span>
              <span className="text-sm font-bold text-amber-300 tabular-nums">
                {formatCurrency(
                  Math.round((parseFloat(inputWeight) || 0) * weightModalProduct.price)
                )}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmWeight}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
              >
                Xác nhận thêm vào đơn
              </button>
              <button
                onClick={() => setWeightModalProduct(null)}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART NUMPAD FOR CASH INPUT */}
      {numpadOpen && (
        <SmartNumpad
          value={customerCashFormatted}
          totalNeeded={finalTotal}
          onChange={(newVal) => setCustomerCashFormatted(newVal)}
          onDone={() => setNumpadOpen(false)}
          onClose={() => setNumpadOpen(false)}
        />
      )}

      {/* PREP NOTE MODAL */}
      {prepNoteItemIndex !== null && cartItems[prepNoteItemIndex] && (
        <PrepNoteModal
          item={cartItems[prepNoteItemIndex]}
          onSaveNote={handleSavePrepNote}
          onClose={() => setPrepNoteItemIndex(null)}
        />
      )}

      {/* HOLD ORDERS MODAL */}
      {holdOrdersModalOpen && (
        <HoldOrdersModal
          holdOrders={holdOrders}
          onRecallOrder={handleRecallOrder}
          onDeleteHoldOrder={handleDeleteHoldOrder}
          onClose={() => setHoldOrdersModalOpen(false)}
        />
      )}

      {/* RECEIPT PRINT MODAL */}
      {completedOrder && (
        <ReceiptPrintModal
          order={completedOrder}
          shop={currentShop}
          onClose={() => setCompletedOrder(null)}
        />
      )}

      {/* SHIFT HANDOVER MODAL */}
      {shiftModalOpen && (
        <ShiftHandoverModal
          currentShift={activeShift}
          shop={currentShop}
          onOpenShift={handleOpenShift}
          onCloseShift={handleCloseShift}
          onDismiss={() => setShiftModalOpen(false)}
        />
      )}

      {/* CUSTOMER SELECTION & QUICK CREATE MODAL */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Khách hàng & Tích điểm</h3>
              </div>
              <button
                onClick={() => setCustomerModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Add Form or Search Bar */}
            <div className="py-3 border-b border-neutral-800 shrink-0 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc số điện thoại..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                  {customerSearch && (
                    <button
                      onClick={() => setCustomerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickAddCustomer(!showQuickAddCustomer)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
                    showQuickAddCustomer
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showQuickAddCustomer ? 'Đóng form' : 'Thêm mới'}</span>
                </button>
              </div>

              {/* Quick Add Customer inline drawer */}
              {showQuickAddCustomer && (
                <form
                  onSubmit={handleQuickAddCustomer}
                  className="bg-neutral-950/80 border border-neutral-800 p-3 rounded-xl space-y-2.5 animate-in slide-in-from-top-2 duration-150"
                >
                  <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" /> Tạo nhanh khách hàng
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Tên khách hàng *"
                      value={quickCustomerForm.name}
                      onChange={(e) =>
                        setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Số điện thoại *"
                      value={quickCustomerForm.phone}
                      onChange={(e) =>
                        setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCustomer(false)}
                      className="px-2.5 py-1 text-[11px] text-neutral-400 hover:text-white"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingQuickCustomer}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {savingQuickCustomer && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Lưu & Chọn ngay</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Customers list */}
            <div className="flex-1 overflow-y-auto py-2 space-y-1.5 pr-1">
              {customers.filter((c) => {
                const q = customerSearch.trim().toLowerCase();
                if (!q) return true;
                return c.name.toLowerCase().includes(q) || c.phone.includes(q);
              }).length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Không tìm thấy khách hàng nào phù hợp.</p>
                  <button
                    onClick={() => {
                      setShowQuickAddCustomer(true);
                      setQuickCustomerForm({ name: customerSearch, phone: '' });
                    }}
                    className="mt-2 text-amber-400 hover:underline font-semibold"
                  >
                    + Nhấp vào đây để thêm nhanh
                  </button>
                </div>
              ) : (
                customers
                  .filter((c) => {
                    const q = customerSearch.trim().toLowerCase();
                    if (!q) return true;
                    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                  })
                  .slice(0, 20)
                  .map((cust) => {
                    const isSelected = selectedCustomer?.id === cust.id;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setCustomerModalOpen(false);
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-xs'
                            : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs truncate">
                              {cust.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-amber-300 font-semibold border border-neutral-700">
                              {CUSTOMER_TIER_LABELS[cust.tier] || 'Khách lẻ'}
                            </span>
                          </div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-neutral-300">{cust.phone}</span>
                            <span>·</span>
                            <span className="text-amber-400 font-semibold">
                              {cust.loyaltyPoints || 0} điểm
                            </span>
                            {cust.debt > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-red-400 font-semibold">
                                  Nợ: {formatCurrency(cust.debt)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ml-2 transition-colors ${
                            isSelected
                              ? 'bg-amber-500 text-neutral-950'
                              : 'bg-neutral-800 text-neutral-200 hover:bg-red-700 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Đã chọn' : 'Chọn'}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerModalOpen(false);
                }}
                className="text-xs text-neutral-400 hover:text-red-400"
              >
                Không chọn khách (Bán vãng lai)
              </button>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS QUICK PRE-ORDERS MODAL */}
      {preOrdersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Đơn Đặt Hàng Trước (Pre-Orders)</h3>
                  <p className="text-[11px] text-neutral-400">
                    Chọn đơn để nạp thẳng vào giỏ hàng POS thanh toán hoặc kiểm tra lịch hẹn
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreOrdersModalOpen(false)}
                className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {todayPreOrders.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 space-y-2">
                  <CalendarClock className="w-10 h-10 mx-auto text-neutral-600 mb-1" />
                  <p className="text-xs">Chưa có đơn hàng đặt trước nào trong hệ thống.</p>
                  {onNavigateToPreOrders && (
                    <button
                      onClick={() => {
                        setPreOrdersModalOpen(false);
                        onNavigateToPreOrders();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-red-800 hover:bg-red-700 text-white text-xs font-bold transition-colors inline-block"
                    >
                      Mở Tab Đặt trước để tạo mới
                    </button>
                  )}
                </div>
              ) : (
                todayPreOrders.map((order) => {
                  const statusMeta = PRE_ORDER_STATUS_LABELS[order.status] || PRE_ORDER_STATUS_LABELS.pending;
                  const isCompleted = order.status === 'completed';
                  const isCurrentActive = activePreOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isCurrentActive
                          ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50'
                          : isCompleted
                          ? 'bg-neutral-950/40 border-neutral-800/60 opacity-60'
                          : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-400 text-xs">
                              {order.orderCode}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                              {PRE_ORDER_TYPE_LABELS[order.orderType]}
                            </span>
                            <span className={`text-[10px] px-2 py-0.2 rounded-full border font-bold ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="text-xs text-white font-bold mt-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{order.deliveryTime}</span>
                            <span className="text-neutral-400 text-[11px]">ngày {order.deliveryDate}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-neutral-400">Cần thu:</div>
                          <div className="text-xs font-black text-amber-400">
                            {formatCurrency(order.remainingAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Customer info */}
                      <div className="text-[11px] text-neutral-300 flex items-center justify-between py-1 border-t border-neutral-800/80">
                        <span className="font-medium text-white">{order.customerName}</span>
                        <a href={`tel:${order.customerPhone}`} className="text-amber-400 font-mono hover:underline">
                          {order.customerPhone}
                        </a>
                      </div>

                      {/* Items */}
                      <div className="text-[11px] text-neutral-400 line-clamp-1 py-0.5">
                        {order.items.map((it) => `${it.name} (x${it.unit === 'kg' && it.weightKg ? `${it.weightKg}kg` : it.quantity})`).join(', ')}
                      </div>

                      {/* Actions */}
                      <div className="pt-2 mt-1 border-t border-neutral-800/80 flex items-center justify-between">
                        {order.notes ? (
                          <span className="text-[10px] text-amber-300/80 italic truncate max-w-[200px]">
                            Ghi chú: {order.notes}
                          </span>
                        ) : <span />}

                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => {
                              setCartItems(order.items || []);
                              setDiningOption(order.orderType === 'dine_in' ? 'dine_in' : 'takeaway');
                              setActivePreOrderId(order.id);
                              if (order.customerName && order.customerPhone) {
                                setSelectedCustomer({
                                  id: order.customerId || 'cust_temp',
                                  name: order.customerName,
                                  phone: order.customerPhone,
                                  address: order.customerAddress,
                                  tier: 'retail',
                                  totalSpent: 0,
                                  loyaltyPoints: 0,
                                  debt: 0,
                                  createdAt: '',
                                });
                              }
                              setPreOrdersModalOpen(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1 transition-colors"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>{isCurrentActive ? 'Đang nạp trong giỏ' : 'Nạp vào giỏ POS'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between shrink-0">
              {onNavigateToPreOrders ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreOrdersModalOpen(false);
                    onNavigateToPreOrders();
                  }}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Mở toàn màn hình Tab Đặt Trước</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : <span />}

              <button
                type="button"
                onClick={() => setPreOrdersModalOpen(false)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE CART AS PRE-ORDER MODAL */}
      {saveAsPreOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-900/80 text-amber-400 flex items-center justify-center font-bold">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Lưu Giỏ Hàng Thành Đơn Đặt Trước</h3>
                  <p className="text-[11px] text-neutral-400">
                    Hẹn ngày giao, giờ phút & tự động lên lịch nhắc thông báo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSaveAsPreOrderModalOpen(false)}
                className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCartAsPreOrder} className="flex-1 overflow-y-auto py-3 space-y-3 text-xs">
              {/* Customer fields */}
              <div className="space-y-2 bg-neutral-950/70 p-3 rounded-xl border border-neutral-800">
                <span className="font-bold text-white text-[11px] uppercase block">
                  Thông tin khách đặt:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Tên khách hàng (*):</label>
                    <input
                      type="text"
                      required
                      placeholder="Anh Tuấn, Chị Hoa..."
                      value={savePreOrderCustomerName}
                      onChange={(e) => setSavePreOrderCustomerName(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Số điện thoại (*):</label>
                    <input
                      type="tel"
                      required
                      placeholder="09xx xxx xxx"
                      value={savePreOrderCustomerPhone}
                      onChange={(e) => setSavePreOrderCustomerPhone(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Địa chỉ giao hàng (nếu có):</label>
                  <input
                    type="text"
                    placeholder="Số nhà, đường..."
                    value={savePreOrderCustomerAddress}
                    onChange={(e) => setSavePreOrderCustomerAddress(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              {/* Date & Time fields */}
              <div className="space-y-2 bg-neutral-950/70 p-3 rounded-xl border border-neutral-800">
                <span className="font-bold text-white text-[11px] uppercase block">
                  Lịch hẹn giao món:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Ngày hẹn (*):</label>
                    <input
                      type="date"
                      required
                      value={savePreOrderDate}
                      onChange={(e) => setSavePreOrderDate(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Giờ hẹn (*):</label>
                    <input
                      type="time"
                      required
                      value={savePreOrderTime}
                      onChange={(e) => setSavePreOrderTime(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Items overview */}
              <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800 space-y-1.5">
                <div className="flex justify-between items-center text-neutral-300 font-bold">
                  <span>Món trong giỏ ({cartItems.length}):</span>
                  <span className="text-amber-400 font-mono">{formatCurrency(finalTotal)}</span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] text-neutral-400">
                  {cartItems.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{it.name} ({it.unit === 'kg' && it.weightKg ? `${it.weightKg}kg` : `x${it.quantity}`})</span>
                      <span>{formatCurrency(it.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deposit & Notes */}
              <div className="space-y-2 bg-neutral-950/70 p-3 rounded-xl border border-neutral-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">
                      Tiền đặt cọc (không bắt buộc):
                    </label>
                    <input
                      type="text"
                      placeholder="0"
                      value={savePreOrderDeposit}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setSavePreOrderDeposit(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-emerald-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Ghi chú đơn hẹn:</label>
                    <input
                      type="text"
                      placeholder="Dặn dò bếp, đóng gói..."
                      value={savePreOrderNotes}
                      onChange={(e) => setSavePreOrderNotes(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaveAsPreOrderModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={savingPreOrder}
                  className="px-4 py-2 rounded-xl bg-red-800 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingPreOrder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Lưu Đơn Đặt Trước</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
