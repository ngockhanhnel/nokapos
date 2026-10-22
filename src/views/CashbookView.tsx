import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { CashTransaction, CashTransactionType } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Filter,
  Calendar,
  CreditCard,
  Banknote,
  Printer,
  Trash2,
  FileText,
  X,
  Check,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Layers,
} from 'lucide-react';

const INCOME_CATEGORIES = [
  'Thu tiền bán hàng',
  'Thu nợ khách hàng',
  'Thu hoàn ứng nhân viên',
  'Thu lãi ngân hàng / đầu tư',
  'Thu khác',
];

const EXPENSE_CATEGORIES = [
  'Chi trả tiền nhà cung cấp',
  'Chi lương & thưởng nhân viên',
  'Chi thuê mặt bằng & điện nước',
  'Chi mua nguyên vật liệu & bao bì',
  'Chi bảo trì & mua sắm thiết bị',
  'Chi tiếp khách & quảng cáo',
  'Chi khác',
];

export const CashbookView: React.FC = () => {
  const { currentShop, user, userProfile, userRole } = useAuth();
  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receipt' | 'payment'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'transfer'>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<CashTransactionType>('receipt');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [recipientOrPayer, setRecipientOrPayer] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Print voucher preview state
  const [printVoucher, setPrintVoucher] = useState<CashTransaction | null>(null);

  // Subscribe to Cash Transactions
  useEffect(() => {
    if (!currentShop?.id) return;

    const ref = collection(db, 'shops', currentShop.id, 'cashTransactions');
    const q = query(ref, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CashTransaction[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<CashTransaction, 'id'>) });
        });
        setTransactions(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/cashTransactions`);
      }
    );

    return () => unsubscribe();
  }, [currentShop?.id]);

  // Financial Summaries
  const summaries = useMemo(() => {
    let totalCashReceipt = 0;
    let totalCashPayment = 0;
    let totalBankReceipt = 0;
    let totalBankPayment = 0;
    let todayReceipt = 0;
    let todayPayment = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    transactions.forEach((tx) => {
      const amt = tx.amount || 0;
      const isToday = tx.date === todayStr;

      if (tx.type === 'receipt') {
        if (tx.paymentMethod === 'cash') totalCashReceipt += amt;
        else totalBankReceipt += amt;
        if (isToday) todayReceipt += amt;
      } else {
        if (tx.paymentMethod === 'cash') totalCashPayment += amt;
        else totalBankPayment += amt;
        if (isToday) todayPayment += amt;
      }
    });

    const cashBalance = totalCashReceipt - totalCashPayment;
    const bankBalance = totalBankReceipt - totalBankPayment;
    const totalBalance = cashBalance + bankBalance;

    return {
      cashBalance,
      bankBalance,
      totalBalance,
      todayReceipt,
      todayPayment,
    };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesMethod = methodFilter === 'all' || t.paymentMethod === methodFilter;
      const queryStr = search.toLowerCase().trim();
      const matchesSearch =
        !queryStr ||
        (t.code && t.code.toLowerCase().includes(queryStr)) ||
        (t.recipientOrPayer && t.recipientOrPayer.toLowerCase().includes(queryStr)) ||
        (t.category && t.category.toLowerCase().includes(queryStr)) ||
        (t.referenceCode && t.referenceCode.toLowerCase().includes(queryStr)) ||
        (t.note && t.note.toLowerCase().includes(queryStr));

      return matchesType && matchesMethod && matchesSearch;
    });
  }, [transactions, typeFilter, methodFilter, search]);

  const openCreateModal = (type: CashTransactionType) => {
    setModalType(type);
    setCategory(type === 'receipt' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setAmount('');
    setPaymentMethod('cash');
    setRecipientOrPayer('');
    setReferenceCode('');
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id) return;

    const parsedAmount = parseFloat(amount.replace(/[^0-9]/g, '')) || 0;
    if (parsedAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền lớn hơn 0');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const now = new Date();
      const datePrefix = now.toISOString().slice(2, 10).replace(/-/g, '');
      const code = `${modalType === 'receipt' ? 'PT' : 'PC'}-${datePrefix}-${Math.floor(100 + Math.random() * 900)}`;

      const newTx: Omit<CashTransaction, 'id'> = {
        code,
        type: modalType,
        category,
        amount: parsedAmount,
        paymentMethod,
        date: date || now.toISOString().split('T')[0],
        recipientOrPayer: recipientOrPayer.trim() || (modalType === 'receipt' ? 'Khách hàng' : 'Nhà cung cấp/Đối tác'),
        referenceCode: referenceCode.trim() || undefined,
        note: note.trim() || undefined,
        creatorId: user?.uid || 'system',
        creatorName: userProfile?.displayName || user?.displayName || 'Thu ngân',
        createdAt: now.toISOString(),
      };

      await addDoc(collection(db, 'shops', currentShop.id, 'cashTransactions'), newTx);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('Lỗi khi lưu phiếu thu/chi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!currentShop?.id || !isManagerOrOwner) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa phiếu thu/chi này không?')) return;

    try {
      await deleteDoc(doc(db, 'shops', currentShop.id, 'cashTransactions', id));
    } catch (err) {
      console.error(err);
      alert('Không thể xóa phiếu thu/chi.');
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen text-neutral-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Sổ Quỹ & Dòng Tiền Thu Chi
          </h2>
          <p className="text-xs text-neutral-400">
            Theo dõi chi tiết dòng tiền mặt tại két, tài khoản ngân hàng và các khoản thu chi hoạt động
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreateModal('receipt')}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Lập Phiếu Thu</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateModal('payment')}
            className="px-3.5 py-2 bg-red-800 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Lập Phiếu Chi</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Tổng quỹ tồn</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-black text-white font-mono tabular-nums">
            {formatCurrency(summaries.totalBalance)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Tiền mặt + Ngân hàng</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Tiền mặt tại quầy</span>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-emerald-400 font-mono tabular-nums">
            {formatCurrency(summaries.cashBalance)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Quỹ tiền mặt</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Tài khoản ngân hàng</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-base font-bold text-blue-400 font-mono tabular-nums">
            {formatCurrency(summaries.bankBalance)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Chuyển khoản VietQR</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Thu hôm nay</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-white font-mono tabular-nums">
            +{formatCurrency(summaries.todayReceipt)}
          </div>
          <div className="text-[11px] text-emerald-500 mt-1">Dòng tiền vào</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Chi hôm nay</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-base font-bold text-white font-mono tabular-nums">
            -{formatCurrency(summaries.todayPayment)}
          </div>
          <div className="text-[11px] text-red-500 mt-1">Dòng tiền ra</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo mã phiếu, người nộp/nhận..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-xs font-semibold shrink-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${typeFilter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setTypeFilter('receipt')}
              className={`px-2.5 py-1 rounded-md transition-colors ${typeFilter === 'receipt' ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800' : 'text-neutral-400 hover:text-white'}`}
            >
              Thu
            </button>
            <button
              onClick={() => setTypeFilter('payment')}
              className={`px-2.5 py-1 rounded-md transition-colors ${typeFilter === 'payment' ? 'bg-red-950 text-red-300 font-bold border border-red-800' : 'text-neutral-400 hover:text-white'}`}
            >
              Chi
            </button>
          </div>

          {/* Method Filter */}
          <div className="flex bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-xs font-semibold shrink-0 hidden md:flex">
            <button
              onClick={() => setMethodFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${methodFilter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              Tất cả PT
            </button>
            <button
              onClick={() => setMethodFilter('cash')}
              className={`px-2.5 py-1 rounded-md transition-colors ${methodFilter === 'cash' ? 'bg-neutral-800 text-amber-300' : 'text-neutral-400 hover:text-white'}`}
            >
              Tiền mặt
            </button>
            <button
              onClick={() => setMethodFilter('transfer')}
              className={`px-2.5 py-1 rounded-md transition-colors ${methodFilter === 'transfer' ? 'bg-neutral-800 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
            >
              Chuyển khoản
            </button>
          </div>
        </div>

        <div className="text-xs text-neutral-400 font-mono self-end sm:self-center">
          Tổng cộng: <strong className="text-white">{filteredTransactions.length}</strong> phiếu
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-md">
        {loading ? (
          <div className="p-12 text-center text-neutral-400 flex items-center justify-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Đang tải dữ liệu sổ quỹ...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Wallet className="w-10 h-10 text-neutral-600 mx-auto" />
            <p className="text-sm font-semibold text-neutral-300">Chưa có phiếu thu chi nào</p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Bắt đầu ghi nhận dòng tiền thu hoặc chi để theo dõi số dư quỹ tiền mặt và ngân hàng chính xác.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300 border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Mã phiếu</th>
                  <th className="py-3 px-4">Ngày giao dịch</th>
                  <th className="py-3 px-4">Loại thu / chi</th>
                  <th className="py-3 px-4">Người nộp / nhận</th>
                  <th className="py-3 px-4">Phương thức</th>
                  <th className="py-3 px-4 text-right">Số tiền (VNĐ)</th>
                  <th className="py-3 px-4">Người tạo</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {tx.code}
                      {tx.referenceCode && (
                        <span className="block text-[10px] text-neutral-500 font-normal">
                          Ref: {tx.referenceCode}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">
                      {tx.date}
                      <span className="block text-[10px] text-neutral-500">
                        {formatDateTime(tx.createdAt).split(' ')[1]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{tx.category}</div>
                      {tx.note && (
                        <div className="text-[11px] text-neutral-400 truncate max-w-xs">{tx.note}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-300 font-medium">{tx.recipientOrPayer}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        tx.paymentMethod === 'cash'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                          : 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                      }`}>
                        {tx.paymentMethod === 'cash' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                        {tx.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold tabular-nums text-sm ${
                      tx.type === 'receipt' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {tx.type === 'receipt' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">{tx.creatorName}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPrintVoucher(tx)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                          title="In phiếu K80"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {isManagerOrOwner && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 transition-colors"
                            title="Xóa phiếu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {modalType === 'receipt' ? (
                  <>
                    <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                    <span>Lập Phiếu Thu Tiền</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-5 h-5 text-red-400" />
                    <span>Lập Phiếu Chi Tiền</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateTransaction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Nhóm {modalType === 'receipt' ? 'thu' : 'chi'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                >
                  {(modalType === 'receipt' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Số tiền (VNĐ) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 500,000"
                  value={amount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
                  }}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Phương thức</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'transfer')}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="cash">Tiền mặt (Két)</option>
                    <option value="transfer">Chuyển khoản (Ngân hàng)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Ngày ghi nhận</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Người {modalType === 'receipt' ? 'nộp tiền' : 'nhận tiền'}
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Khách hàng Nguyễn Văn A, Nhà cung cấp B..."
                  value={recipientOrPayer}
                  onChange={(e) => setRecipientOrPayer(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Mã chứng từ / Đơn tham chiếu (nếu có)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: DH-261013-001 hoặc PN-102"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Ghi chú chi tiết</label>
                <textarea
                  rows={2}
                  placeholder="Nội dung thu/chi cụ thể..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2.5 px-3 text-white rounded-xl text-xs font-bold transition-colors shadow-md ${
                    modalType === 'receipt' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-700 hover:bg-red-600'
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    `Lưu ${modalType === 'receipt' ? 'Phiếu Thu' : 'Phiếu Chi'}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT VOUCHER MODAL */}
      {printVoucher && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-950 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative font-sans">
            <button
              onClick={() => setPrintVoucher(null)}
              className="absolute top-4 right-4 p-1.5 text-neutral-500 hover:text-neutral-900"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center border-b border-dashed border-neutral-300 pb-4 mb-4">
              <h3 className="text-base font-black uppercase tracking-tight">{currentShop?.name || 'HỆ THỐNG POS'}</h3>
              <p className="text-[11px] text-neutral-600">{currentShop?.address || 'Địa chỉ cửa hàng'}</p>
              <p className="text-[11px] text-neutral-600">SĐT: {currentShop?.phone || '0900000000'}</p>
              <div className="mt-3">
                <span className="text-lg font-black uppercase">
                  {printVoucher.type === 'receipt' ? 'PHIẾU THU TIỀN' : 'PHIẾU CHI TIỀN'}
                </span>
                <span className="block text-xs font-mono text-neutral-500">Mã: {printVoucher.code}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-600">Ngày lập:</span>
                <span className="font-semibold">{printVoucher.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">{printVoucher.type === 'receipt' ? 'Người nộp:' : 'Người nhận:'}</span>
                <span className="font-bold">{printVoucher.recipientOrPayer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Hạng mục:</span>
                <span className="font-semibold">{printVoucher.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Hình thức:</span>
                <span className="font-semibold">{printVoucher.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
              </div>
              {printVoucher.referenceCode && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Chứng từ gốc:</span>
                  <span className="font-mono">{printVoucher.referenceCode}</span>
                </div>
              )}
              {printVoucher.note && (
                <div className="pt-1 border-t border-dashed border-neutral-200 text-neutral-600 italic">
                  Ghi chú: {printVoucher.note}
                </div>
              )}
              <div className="pt-2 border-t border-neutral-300 flex justify-between items-center text-sm font-black">
                <span>Số tiền:</span>
                <span className="text-base font-mono">{formatCurrency(printVoucher.amount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-[11px] pt-6 mt-4 border-t border-dashed border-neutral-300">
              <div>
                <span className="block font-semibold">Người lập phiếu</span>
                <span className="text-neutral-400 italic text-[10px]">(Ký, họ tên)</span>
                <div className="h-10" />
                <span className="text-neutral-700">{printVoucher.creatorName}</span>
              </div>
              <div>
                <span className="block font-semibold">{printVoucher.type === 'receipt' ? 'Người nộp tiền' : 'Người nhận tiền'}</span>
                <span className="text-neutral-400 italic text-[10px]">(Ký, họ tên)</span>
                <div className="h-10" />
                <span className="text-neutral-700">{printVoucher.recipientOrPayer}</span>
              </div>
            </div>

            <div className="pt-6 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>In Phiếu Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
