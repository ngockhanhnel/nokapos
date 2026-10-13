import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Customer, CustomerTier, CUSTOMER_TIER_LABELS, Order } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit,
  DollarSign,
  Crown,
  ShoppingBag,
  AlertTriangle,
  X,
  Check,
  TrendingUp,
  Receipt,
  Copy,
  CreditCard,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { currentShop } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    tier: 'retail' as CustomerTier,
    loyaltyPoints: 0,
    debt: 0,
    notes: '',
  });

  // Debt Payment Modal
  const [settleDebtCustomer, setSettleDebtCustomer] = useState<Customer | null>(null);
  const [settleDebtAmount, setSettleDebtAmount] = useState('');
  const [settleDebtNote, setSettleDebtNote] = useState('');
  const [settlingDebt, setSettlingDebt] = useState(false);

  // Copy feedback
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Detail Modal
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);

  // Fetch customers from Firestore
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(collection(db, 'shops', currentShop.id, 'customers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Customer[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Customer);
      });
      setCustomers(list);
    });
    return () => unsub();
  }, [currentShop?.id]);

  // When customer detail is selected, fetch their order history
  useEffect(() => {
    if (!currentShop?.id || !selectedCustomerForDetail) {
      setCustomerOrders([]);
      return;
    }

    const ordersRef = collection(db, 'shops', currentShop.id, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Order[] = [];
      const cId = selectedCustomerForDetail.id;
      const cPhone = selectedCustomerForDetail.phone.trim();

      snap.forEach((d) => {
        const orderData = { id: d.id, ...d.data() } as Order;
        if (
          orderData.customerId === cId ||
          (cPhone && orderData.customerPhone && orderData.customerPhone.includes(cPhone))
        ) {
          list.push(orderData);
        }
      });
      setCustomerOrders(list);
    });

    return () => unsub();
  }, [currentShop?.id, selectedCustomerForDetail]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setCustomerForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      tier: 'retail',
      loyaltyPoints: 0,
      debt: 0,
      notes: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      tier: customer.tier || 'retail',
      loyaltyPoints: customer.loyaltyPoints || 0,
      debt: customer.debt || 0,
      notes: customer.notes || '',
    });
    setShowModal(true);
  };

  const handleCopyPhone = (e: React.MouseEvent, phone: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !customerForm.name.trim() || !customerForm.phone.trim()) {
      alert('Vui lòng nhập đầy đủ Tên và Số điện thoại khách hàng.');
      return;
    }

    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'shops', currentShop.id, 'customers', editingCustomer.id), {
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          address: customerForm.address.trim(),
          tier: customerForm.tier,
          loyaltyPoints: Number(customerForm.loyaltyPoints) || 0,
          debt: Number(customerForm.debt) || 0,
          notes: customerForm.notes.trim(),
        });
        if (selectedCustomerForDetail?.id === editingCustomer.id) {
          setSelectedCustomerForDetail({
            ...selectedCustomerForDetail,
            name: customerForm.name.trim(),
            phone: customerForm.phone.trim(),
            email: customerForm.email.trim(),
            address: customerForm.address.trim(),
            tier: customerForm.tier,
            loyaltyPoints: Number(customerForm.loyaltyPoints) || 0,
            debt: Number(customerForm.debt) || 0,
            notes: customerForm.notes.trim(),
          });
        }
      } else {
        await addDoc(collection(db, 'shops', currentShop.id, 'customers'), {
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          address: customerForm.address.trim(),
          tier: customerForm.tier,
          totalSpent: 0,
          loyaltyPoints: Number(customerForm.loyaltyPoints) || 0,
          debt: Number(customerForm.debt) || 0,
          notes: customerForm.notes.trim(),
          createdAt: new Date().toISOString(),
        });
      }
      setShowModal(false);
      setEditingCustomer(null);
    } catch (err) {
      console.error(err);
      alert('Lỗi lưu thông tin khách hàng.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentShop?.id) return;
    try {
      await deleteDoc(doc(db, 'shops', currentShop.id, 'customers', id));
      setDeleteConfirmId(null);
      if (selectedCustomerForDetail?.id === id) {
        setSelectedCustomerForDetail(null);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi xóa khách hàng.');
    }
  };

  const handleSettleDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !settleDebtCustomer) return;

    const amount = parseFloat(settleDebtAmount) || 0;
    if (amount <= 0) {
      alert('Vui lòng nhập số tiền thanh toán nợ hợp lệ');
      return;
    }

    try {
      setSettlingDebt(true);
      const currentDebt = settleDebtCustomer.debt || 0;
      const newDebt = Math.max(0, currentDebt - amount);

      await updateDoc(doc(db, 'shops', currentShop.id, 'customers', settleDebtCustomer.id), {
        debt: newDebt,
      });

      if (selectedCustomerForDetail?.id === settleDebtCustomer.id) {
        setSelectedCustomerForDetail({
          ...selectedCustomerForDetail,
          debt: newDebt,
        });
      }

      setSettleDebtCustomer(null);
      setSettleDebtAmount('');
      setSettleDebtNote('');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi ghi nhận thu nợ khách hàng');
    } finally {
      setSettlingDebt(false);
    }
  };

  // Filtered customers
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTier = selectedTier === 'all' || c.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

  // Statistics
  const totalCustomersCount = customers.length;
  const totalRevenueAll = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
  const totalDebtAll = customers.reduce((acc, c) => acc + (c.debt || 0), 0);
  const vipCount = customers.filter((c) => c.tier === 'vip' || c.tier === 'wholesale').length;

  return (
    <div className="p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-neutral-900 via-neutral-900 to-red-950/40 p-4 sm:p-6 rounded-2xl border border-neutral-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-red-950 border border-red-800/60 text-amber-400 shadow-inner shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                Quản lý Khách hàng (CRM)
              </h1>
              <p className="text-[11px] sm:text-xs text-neutral-400">
                Hồ sơ thành viên, tích điểm mua hàng và quản lý công nợ
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-950/50 transition-all border border-red-600/50 active:scale-95"
        >
          <UserPlus className="w-4 h-4 text-amber-300" />
          <span>Thêm khách hàng mới</span>
        </button>
      </div>

      {/* Stats Cards - Optimized 2x2 on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-neutral-400">Tổng khách hàng</p>
            <h3 className="text-lg sm:text-2xl font-black text-white">{totalCustomersCount}</h3>
            <p className="text-[10px] sm:text-[11px] text-emerald-400 font-semibold flex items-center gap-1 truncate">
              <TrendingUp className="w-3 h-3 shrink-0" />
              <span>Đồng bộ POS</span>
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-400 border border-neutral-700 shrink-0">
            <Users className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-neutral-400">Khách VIP & Sỉ</p>
            <h3 className="text-lg sm:text-2xl font-black text-amber-400">{vipCount}</h3>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Hội viên ưu tiên</p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-amber-950/40 flex items-center justify-center text-amber-400 border border-amber-800/50 shrink-0">
            <Crown className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-neutral-400">Doanh số mua</p>
            <h3 className="text-sm sm:text-xl font-black text-emerald-400 truncate">
              {formatCurrency(totalRevenueAll)}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Tổng tích lũy</p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-emerald-950/40 flex items-center justify-center text-emerald-400 border border-emerald-800/50 shrink-0">
            <DollarSign className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-neutral-400">Tổng nợ phải thu</p>
            <h3 className="text-sm sm:text-xl font-black text-red-400 truncate">
              {formatCurrency(totalDebtAll)}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Cần thu hồi</p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-red-950/40 flex items-center justify-center text-red-400 border border-red-800/50 shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-8 py-2 sm:py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills - Horizontal scrollable on phone */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedTier('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              selectedTier === 'all'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Tất cả ({customers.length})
          </button>
          <button
            onClick={() => setSelectedTier('retail')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              selectedTier === 'retail'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Khách lẻ
          </button>
          <button
            onClick={() => setSelectedTier('wholesale')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              selectedTier === 'wholesale'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Khách sỉ / Đại lý
          </button>
          <button
            onClick={() => setSelectedTier('vip')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              selectedTier === 'vip'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Khách VIP
          </button>
        </div>
      </div>

      {/* Customer List: Mobile Touch Cards (< md) + Desktop Table (>= md) */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredCustomers.length === 0 ? (
          <div className="p-10 sm:p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white">Chưa có khách hàng nào</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Không tìm thấy khách hàng khớp với điều kiện tìm kiếm. Hãy thêm mới hoặc xóa bộ lọc.
            </p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-md"
            >
              <UserPlus className="w-4 h-4" /> Thêm khách hàng ngay
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View (< md) */}
            <div className="block md:hidden divide-y divide-neutral-800/80">
              {filteredCustomers.map((c) => {
                const tierColor =
                  c.tier === 'vip'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                    : c.tier === 'wholesale'
                    ? 'bg-blue-950/60 text-blue-300 border-blue-700/60'
                    : 'bg-neutral-800 text-neutral-300 border-neutral-700';

                return (
                  <div
                    key={c.id}
                    className="p-3.5 space-y-3 hover:bg-neutral-800/30 transition-colors active:bg-neutral-800/50"
                  >
                    {/* Top Row: Avatar, Name, Tier Badge, Direct Call */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        onClick={() => setSelectedCustomerForDetail(c)}
                        className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0 shadow">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-xs sm:text-sm truncate flex items-center gap-1">
                            <span>{c.name}</span>
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-neutral-400 font-mono">{c.phone}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyPhone(e, c.phone, c.id)}
                              className="text-neutral-500 hover:text-amber-300"
                              title="Sao chép số"
                            >
                              {copiedPhoneId === c.id ? (
                                <span className="text-[9px] text-emerald-400 font-bold">Đã chép</span>
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tierColor}`}
                        >
                          {c.tier === 'vip' && <Crown className="w-3 h-3 text-amber-400" />}
                          {CUSTOMER_TIER_LABELS[c.tier] || 'Khách lẻ'}
                        </span>
                        <a
                          href={`tel:${c.phone}`}
                          className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center active:scale-95 transition-transform"
                          title="Gọi điện"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Stats 3-Grid */}
                    <div
                      onClick={() => setSelectedCustomerForDetail(c)}
                      className="grid grid-cols-3 gap-1.5 bg-neutral-950/80 border border-neutral-800/80 rounded-xl p-2 text-center cursor-pointer"
                    >
                      <div>
                        <span className="text-[10px] text-neutral-400 block">Chi tiêu</span>
                        <span className="text-xs font-bold text-emerald-400 truncate block">
                          {formatCurrency(c.totalSpent || 0)}
                        </span>
                      </div>
                      <div className="border-x border-neutral-800">
                        <span className="text-[10px] text-neutral-400 block">Tích điểm</span>
                        <span className="text-xs font-bold text-amber-400 block">
                          {c.loyaltyPoints || 0} đ
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block">Công nợ</span>
                        <span
                          className={`text-xs font-bold block ${
                            c.debt > 0 ? 'text-red-400' : 'text-neutral-500'
                          }`}
                        >
                          {c.debt > 0 ? formatCurrency(c.debt) : '0 ₫'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[10px] text-neutral-400 truncate max-w-[170px]">
                        <MapPin className="w-3 h-3 inline mr-1 text-neutral-500" />
                        {c.address || 'Chưa cập nhật địa chỉ'}
                      </p>

                      <div className="flex items-center gap-1.5">
                        {c.debt > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSettleDebtCustomer(c);
                              setSettleDebtAmount(String(c.debt));
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/20 active:scale-95"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Thu nợ</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForDetail(c)}
                          className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-semibold flex items-center gap-1"
                        >
                          <span>Xem</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white active:scale-95"
                          title="Sửa"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(c.id)}
                          className="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:text-white border border-red-900/60 active:scale-95"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase bg-neutral-950/60">
                    <th className="py-3.5 px-5">Khách hàng</th>
                    <th className="py-3.5 px-4">Số điện thoại</th>
                    <th className="py-3.5 px-4">Hạng thành viên</th>
                    <th className="py-3.5 px-4 text-right">Tổng chi tiêu</th>
                    <th className="py-3.5 px-4 text-right">Điểm tích lũy</th>
                    <th className="py-3.5 px-4 text-right">Công nợ</th>
                    <th className="py-3.5 px-5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-xs">
                  {filteredCustomers.map((c) => {
                    const tierColor =
                      c.tier === 'vip'
                        ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                        : c.tier === 'wholesale'
                        ? 'bg-blue-950/60 text-blue-300 border-blue-700/60'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700';

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCustomerForDetail(c)}
                        className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-amber-400 transition-colors">
                                {c.name}
                              </div>
                              {c.address && (
                                <div className="text-[11px] text-neutral-500 truncate max-w-xs">
                                  {c.address}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-300">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${c.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-amber-400 hover:underline"
                            >
                              {c.phone}
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleCopyPhone(e, c.phone, c.id)}
                              className="text-neutral-500 hover:text-white"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tierColor}`}
                          >
                            {c.tier === 'vip' && <Crown className="w-3 h-3 text-amber-400" />}
                            {CUSTOMER_TIER_LABELS[c.tier] || 'Khách lẻ'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400 tabular-nums">
                          {formatCurrency(c.totalSpent || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-400 tabular-nums">
                          {c.loyaltyPoints || 0} điểm
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums">
                          <span className={c.debt > 0 ? 'text-red-400' : 'text-neutral-500'}>
                            {c.debt > 0 ? formatCurrency(c.debt) : '0 ₫'}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {c.debt > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSettleDebtCustomer(c);
                                  setSettleDebtAmount(String(c.debt));
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold hover:bg-amber-500/20"
                                title="Thu nợ"
                              >
                                Thu nợ
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700"
                              title="Sửa"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(c.id)}
                              className="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:text-white border border-red-900/60"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800 bg-neutral-950 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>{editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Tên khách hàng (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Số điện thoại (*)</label>
                  <input
                    type="tel"
                    required
                    placeholder="0912345678"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Email</label>
                  <input
                    type="email"
                    placeholder="khachhang@gmail.com"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Hạng thành viên</label>
                  <select
                    value={customerForm.tier}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, tier: e.target.value as CustomerTier })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="retail">Khách lẻ</option>
                    <option value="wholesale">Khách sỉ / Đại lý</option>
                    <option value="vip">Khách VIP</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Địa chỉ</label>
                <input
                  type="text"
                  placeholder="Số nhà, đường phố, khu vực..."
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Điểm tích lũy</label>
                  <input
                    type="number"
                    min="0"
                    value={customerForm.loyaltyPoints}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, loyaltyPoints: Number(e.target.value) })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Công nợ (₫)</label>
                  <input
                    type="number"
                    min="0"
                    value={customerForm.debt}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, debt: Number(e.target.value) })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Ghi chú sở thích / phục vụ</label>
                <textarea
                  rows={2}
                  placeholder="Sở thích món ăn, chặt nhỏ, gia vị ướp..."
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800 mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white font-semibold text-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs shadow-lg shadow-red-950/50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingCustomer ? 'Lưu cập nhật' : 'Thêm khách hàng'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail & Orders History Modal */}
      {selectedCustomerForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-800 bg-neutral-950 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 flex items-center justify-center text-amber-400 font-bold text-base shrink-0 shadow">
                  {selectedCustomerForDetail.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                    <span>{selectedCustomerForDetail.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-amber-300 font-semibold border border-neutral-700">
                      {CUSTOMER_TIER_LABELS[selectedCustomerForDetail.tier] || 'Khách lẻ'}
                    </span>
                  </h3>
                  <a
                    href={`tel:${selectedCustomerForDetail.phone}`}
                    className="text-xs text-amber-400 font-mono hover:underline inline-flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    {selectedCustomerForDetail.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${selectedCustomerForDetail.phone}`}
                  className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 hover:text-white"
                  title="Gọi điện"
                >
                  <Phone className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedCustomerForDetail(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Stats overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-neutral-400 block">Tổng chi tiêu</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-400 block mt-0.5">
                    {formatCurrency(selectedCustomerForDetail.totalSpent || 0)}
                  </span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-neutral-400 block">Điểm tích lũy</span>
                  <span className="text-xs sm:text-sm font-bold text-amber-400 block mt-0.5">
                    {selectedCustomerForDetail.loyaltyPoints || 0} điểm
                  </span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-neutral-400 block">Công nợ hiện tại</span>
                  <span
                    className={`text-xs sm:text-sm font-bold block mt-0.5 ${
                      selectedCustomerForDetail.debt > 0 ? 'text-red-400' : 'text-neutral-500'
                    }`}
                  >
                    {selectedCustomerForDetail.debt > 0
                      ? formatCurrency(selectedCustomerForDetail.debt)
                      : '0 ₫'}
                  </span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-neutral-400 block">Đơn hàng đã mua</span>
                  <span className="text-xs sm:text-sm font-bold text-white block mt-0.5">
                    {customerOrders.length} đơn
                  </span>
                </div>
              </div>

              {/* Extra Info */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-1.5 text-xs">
                {selectedCustomerForDetail.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <span className="text-neutral-300">{selectedCustomerForDetail.address}</span>
                  </div>
                )}
                {selectedCustomerForDetail.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="text-neutral-300">{selectedCustomerForDetail.email}</span>
                  </div>
                )}
                {selectedCustomerForDetail.notes && (
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 text-neutral-300 text-[11px] italic">
                    * Ghi chú: {selectedCustomerForDetail.notes}
                  </div>
                )}
              </div>

              {/* Action buttons inside detail */}
              <div className="flex items-center gap-2">
                {selectedCustomerForDetail.debt > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettleDebtCustomer(selectedCustomerForDetail);
                      setSettleDebtAmount(String(selectedCustomerForDetail.debt));
                    }}
                    className="flex-1 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Thu nợ khách hàng</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCustomerForDetail;
                    setSelectedCustomerForDetail(null);
                    handleOpenEdit(c);
                  }}
                  className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Sửa thông tin</span>
                </button>
              </div>

              {/* Orders History Tab */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span>Lịch sử đơn hàng gần đây ({customerOrders.length})</span>
                </h4>

                {customerOrders.length === 0 ? (
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 text-center text-xs text-neutral-500">
                    Chưa có đơn hàng nào liên kết với số điện thoại hoặc mã khách hàng này.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {customerOrders.slice(0, 10).map((ord) => (
                      <div
                        key={ord.id}
                        className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-amber-400 flex items-center gap-2">
                            <span>#{ord.orderCode}</span>
                            <span className="text-[10px] text-neutral-400 font-normal">
                              {formatDateTime(ord.createdAt)}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {ord.items.map((it) => `${it.quantity} ${it.name}`).join(', ')}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-emerald-400 block">
                            {formatCurrency(ord.finalTotal)}
                          </span>
                          <span className="text-[10px] text-neutral-400 block">
                            {ord.paymentMethod === 'cash' ? 'Tiền mặt' : 'VietQR'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedCustomerForDetail(null)}
                className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {settleDebtCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Thu nợ khách hàng</h3>
              </div>
              <button
                onClick={() => setSettleDebtCustomer(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl text-xs space-y-1">
              <div className="text-neutral-400">Khách hàng: <strong className="text-white">{settleDebtCustomer.name}</strong></div>
              <div className="text-neutral-400">Số điện thoại: <strong className="text-amber-400 font-mono">{settleDebtCustomer.phone}</strong></div>
              <div className="text-neutral-400">Công nợ hiện tại: <strong className="text-red-400">{formatCurrency(settleDebtCustomer.debt)}</strong></div>
            </div>

            <form onSubmit={handleSettleDebt} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Số tiền khách thanh toán (₫) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ví dụ: 500000"
                  value={settleDebtAmount}
                  onChange={(e) => setSettleDebtAmount(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Khách trả tiền mặt / chuyển khoản..."
                  value={settleDebtNote}
                  onChange={(e) => setSettleDebtNote(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setSettleDebtCustomer(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={settlingDebt}
                  className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Xác nhận thu nợ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-xl bg-red-950/80 border border-red-800 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Xác nhận xóa khách hàng</h3>
                <p className="text-xs text-neutral-400">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300">
              Bạn có chắc chắn muốn xóa khách hàng này khỏi hệ thống cơ sở dữ liệu Firestore của quán?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
