import React, { useState, useEffect } from 'react';
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
import { Expense, ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '@/src/types';
import { formatCurrency, formatDate } from '@/src/lib/formatters';
import {
  Wallet,
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  Check,
  TrendingDown,
  DollarSign,
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { currentShop, user, userProfile, userRole } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('raw_material');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  useEffect(() => {
    if (!currentShop?.id) return;

    const expRef = collection(db, 'shops', currentShop.id, 'expenses');
    const q = query(expRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Expense[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }));
        setExpenses(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/expenses`);
      }
    );

    return () => unsubscribe();
  }, [currentShop?.id]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !user) return;

    const parsedAmt = parseFloat(amount) || 0;
    if (parsedAmt <= 0) {
      setErrorMsg('Vui lòng nhập số tiền chi lớn hơn 0');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tên khoản chi');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const now = new Date().toISOString();

      await addDoc(collection(db, 'shops', currentShop.id, 'expenses'), {
        title: title.trim(),
        category,
        amount: parsedAmt,
        date,
        performedBy: userProfile?.displayName || user.email?.split('@')[0] || 'Quản lý',
        note: note.trim(),
        createdAt: now,
      });

      setModalOpen(false);
      setTitle('');
      setAmount('');
      setNote('');
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Không thể lưu khoản chi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!currentShop?.id || !isManagerOrOwner) return;
    if (!confirm('Bạn có chắc chắn muốn xóa phiếu chi này?')) return;

    try {
      await deleteDoc(doc(db, 'shops', currentShop.id, 'expenses', id));
    } catch (err: unknown) {
      console.error(err);
      alert('Không thể xóa phiếu chi.');
    }
  };

  // Summaries
  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
  const rawMaterialExpense = expenses
    .filter((e) => e.category === 'raw_material')
    .reduce((acc, e) => acc + e.amount, 0);
  const utilityExpense = expenses
    .filter((e) => e.category === 'utilities')
    .reduce((acc, e) => acc + e.amount, 0);

  const filtered = expenses.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.note && e.note.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = catFilter === 'all' || e.category === catFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            Sổ Quỹ & Quản lý Chi Phí
          </h2>
          <p className="text-xs text-neutral-400">
            Ghi nhận chi phí mua vịt sống, than nướng, điện nước, lương và chi phí vận hành
          </p>
        </div>

        {isManagerOrOwner && (
          <button
            onClick={() => {
              setTitle('');
              setAmount('');
              setNote('');
              setDate(new Date().toISOString().split('T')[0]);
              setErrorMsg(null);
              setModalOpen(true);
            }}
            className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Ghi nhận khoản chi mới
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-400 text-xs flex items-center justify-between mb-1">
            <span>Tổng chi đã ghi nhận</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-extrabold text-white tabular-nums">
            {formatCurrency(totalExpense)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Toàn bộ chi phí trong sổ quỹ</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-400 text-xs flex items-center justify-between mb-1">
            <span>Chi mua vịt & Nguyên vật liệu</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-400 tabular-nums">
            {formatCurrency(rawMaterialExpense)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Tiền nhập vịt sống & gia vị tẩm ướp</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-400 text-xs flex items-center justify-between mb-1">
            <span>Điện, Than nướng & Vận hành</span>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-extrabold text-blue-400 tabular-nums">
            {formatCurrency(utilityExpense)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Chi phí nung than và tiện ích</div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm khoản chi, ghi chú..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500"
        >
          <option value="all">Tất cả danh mục chi</option>
          <option value="raw_material">Thịt vịt & Nguyên vật liệu</option>
          <option value="utilities">Điện, than nướng, nước</option>
          <option value="salary">Lương nhân viên</option>
          <option value="packaging">Hộp, bao bì, gia vị</option>
          <option value="other">Chi phí khác</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải sổ quỹ...
        </div>
      ) : expenses.length === 0 ? (
        /* Empty state */
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-amber-500 mb-3">
            <Wallet className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Chưa có khoản chi nào</h3>
          <p className="text-xs text-neutral-400 max-w-sm mb-4">
            Quán chưa ghi nhận phiếu chi thực tế nào. Hãy bắt đầu ghi chép các chi phí mua vịt sống, than nướng để tính toán lợi nhuận chính xác.
          </p>
          {isManagerOrOwner && (
            <button
              onClick={() => setModalOpen(true)}
              className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Tạo phiếu chi đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Ngày chi</th>
                  <th className="py-3 px-4">Nội dung chi</th>
                  <th className="py-3 px-4">Phân loại</th>
                  <th className="py-3 px-4 text-right">Số tiền (VND)</th>
                  <th className="py-3 px-4">Người ghi nhận</th>
                  <th className="py-3 px-4">Ghi chú</th>
                  {isManagerOrOwner && <th className="py-3 px-4 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 text-neutral-400 tabular-nums">
                      {formatDate(item.date)}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{item.title}</td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-amber-400 bg-amber-950/60 border border-amber-800/60 rounded px-2 py-0.5">
                        {EXPENSE_CATEGORY_LABELS[item.category] || item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-red-400 tabular-nums">
                      -{formatCurrency(item.amount)}
                    </td>
                    <td className="py-3 px-4 text-neutral-400">{item.performedBy}</td>
                    <td className="py-3 px-4 text-neutral-400 max-w-xs truncate">{item.note || '—'}</td>
                    {isManagerOrOwner && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Xóa phiếu chi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE EXPENSE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-500" />
                Ghi nhận khoản chi mới
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Nội dung chi <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nhập 20 con vịt sống lò mổ..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Phân loại chi phí <span className="text-red-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                >
                  <option value="raw_material">Thịt vịt & Nguyên vật liệu</option>
                  <option value="utilities">Điện, than nướng, nước</option>
                  <option value="salary">Lương nhân viên</option>
                  <option value="packaging">Hộp, bao bì, gia vị</option>
                  <option value="other">Chi phí khác</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Số tiền chi (VND) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="5000"
                    min="1000"
                    required
                    placeholder="500000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Ngày chi <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Ghi chú thêm
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú người nhận tiền hoặc số hóa đơn..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Lưu phiếu chi
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
