import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { ShopMember, UserRole } from '@/src/types';
import { formatDateTime } from '@/src/lib/formatters';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Shield,
  ShieldAlert,
  Trash2,
  Loader2,
  X,
  Check,
  Mail,
} from 'lucide-react';

export const StaffView: React.FC = () => {
  const { currentShop, userRole, user } = useAuth();
  const [members, setMembers] = useState<ShopMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'cashier'>('cashier');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = userRole === 'owner';

  useEffect(() => {
    if (!currentShop?.id) return;

    const ref = collection(db, 'shops', currentShop.id, 'members');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const list: ShopMember[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<ShopMember, 'id'>) }));
        setMembers(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/members`);
      }
    );

    return () => unsubscribe();
  }, [currentShop?.id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !isOwner) return;
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      // Clean member ID from email
      const memberId = 'mem_' + email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const now = new Date().toISOString();

      await setDoc(doc(db, 'shops', currentShop.id, 'members', memberId), {
        userId: memberId,
        email: email.trim().toLowerCase(),
        role,
        joinedAt: now,
      });

      setModalOpen(false);
      setEmail('');
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Không thể thêm thành viên. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (member: ShopMember) => {
    if (!currentShop?.id || !isOwner) return;
    if (member.role === 'owner') {
      alert('Không thể xóa chủ quán.');
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa quyền nhân viên của ${member.email}?`)) return;

    try {
      await deleteDoc(doc(db, 'shops', currentShop.id, 'members', member.id));
    } catch (err: unknown) {
      console.error(err);
      alert('Không thể xóa nhân viên.');
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Quản Lý Nhân Viên & Phân Quyền
          </h2>
          <p className="text-xs text-neutral-400">
            Quản lý tài khoản thu ngân bán hàng, quản lý vận hành và phân định quyền truy cập
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => {
              setEmail('');
              setRole('cashier');
              setErrorMsg(null);
              setModalOpen(true);
            }}
            className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            Thêm nhân viên mới
          </button>
        )}
      </div>

      {/* Role explanation banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs">
          <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-4 h-4" />
            Chủ quán (Owner)
          </div>
          <p className="text-neutral-400 text-[11px]">
            Toàn quyền quản trị doanh thu, xóa sửa kho, quản lý thành viên và thiết lập ngân hàng VietQR.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs">
          <div className="font-bold text-blue-400 flex items-center gap-1.5 mb-1">
            <Shield className="w-4 h-4" />
            Quản lý (Manager)
          </div>
          <p className="text-neutral-400 text-[11px]">
            Quản lý thực đơn, nhập xuất kho, ghi nhận chi phí và duyệt hủy đơn hàng hoàn tồn.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs">
          <div className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-4 h-4" />
            Thu ngân (Cashier)
          </div>
          <p className="text-neutral-400 text-[11px]">
            Chỉ được bán hàng tại quầy POS, in hóa đơn và xem danh sách đơn hàng đã tạo.
          </p>
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải danh sách nhân viên...
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Tài khoản Email</th>
                  <th className="py-3 px-4">Vai trò (Role)</th>
                  <th className="py-3 px-4">Ngày tham gia</th>
                  {isOwner && <th className="py-3 px-4 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                {members.map((m) => {
                  const isCurrent = m.userId === user?.uid || m.email === user?.email;
                  return (
                    <tr key={m.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          {m.email}
                          {isCurrent && (
                            <span className="text-[10px] bg-red-950 text-amber-400 border border-red-800/80 px-1.5 py-0.2 rounded font-semibold">
                              Bạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {m.role === 'owner' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800/60 rounded px-2 py-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            Chủ quán
                          </span>
                        ) : m.role === 'manager' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-950/80 border border-blue-800/60 rounded px-2 py-0.5">
                            <Shield className="w-3 h-3" />
                            Quản lý
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 rounded px-2 py-0.5">
                            <ShieldAlert className="w-3 h-3" />
                            Thu ngân
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-400 tabular-nums">
                        {formatDateTime(m.joinedAt)}
                      </td>
                      {isOwner && (
                        <td className="py-3 px-4 text-right">
                          {m.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(m)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                              title="Xóa nhân viên"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-500" />
                Thêm nhân viên vào quán
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Email nhân viên <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="nhanvien@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Phân quyền vai trò <span className="text-red-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'manager' | 'cashier')}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                >
                  <option value="cashier">Thu ngân (Chỉ bán hàng quầy POS)</option>
                  <option value="manager">Quản lý (Quản lý món, kho, chi phí)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Cấp quyền nhân viên
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
