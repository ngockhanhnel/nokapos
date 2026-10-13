import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Building2, Plus, MapPin, Phone, Trash2, CheckCircle2, Store } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  manager: string;
  isMain: boolean;
  createdAt: string;
}

export const BranchesView: React.FC = () => {
  const { currentShop } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [manager, setManager] = useState('');
  const [isMain, setIsMain] = useState(false);

  useEffect(() => {
    if (!currentShop?.id) return;
    const q = collection(db, 'shops', currentShop.id, 'branches');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Branch, 'id'>) });
      });
      // If no branches created yet, add default main branch from currentShop
      if (list.length === 0) {
        list.push({
          id: 'main',
          name: currentShop.name || 'Cơ sở chính',
          address: currentShop.address || 'Địa chỉ chính',
          phone: currentShop.phone || '0900000000',
          manager: 'Quản lý chung',
          isMain: true,
          createdAt: new Date().toISOString(),
        });
      }
      setBranches(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentShop?.id, currentShop]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !name.trim()) return;

    try {
      await addDoc(collection(db, 'shops', currentShop.id, 'branches'), {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        manager: manager.trim(),
        isMain,
        createdAt: new Date().toISOString(),
      });
      setName('');
      setAddress('');
      setPhone('');
      setManager('');
      setIsMain(false);
      setShowModal(false);
    } catch (err) {
      console.error('Error creating branch:', err);
      alert('Không thể thêm chi nhánh mới. Vui lòng thử lại.');
    }
  };

  const handleDeleteBranch = async (id: string, isMainBranch: boolean) => {
    if (isMainBranch) {
      alert('Không thể xóa cơ sở chính!');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn xóa chi nhánh này?')) return;
    if (!currentShop?.id) return;

    try {
      await deleteDoc(doc(db, 'shops', currentShop.id, 'branches', id));
    } catch (err) {
      console.error('Error deleting branch:', err);
    }
  };

  return (
    <div className="flex-1 bg-neutral-950 text-neutral-100 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-16 px-6 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-amber-400 shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Quản lý Đa Chi Nhánh</h1>
            <p className="text-xs text-neutral-400">
              Hệ thống chuỗi cửa hàng & cơ sở kinh doanh của {currentShop?.name}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm cơ sở / chi nhánh</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between shadow-xl transition-all ${
                branch.isMain
                  ? 'border-amber-600/80 bg-amber-950/10'
                  : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-400">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {branch.name}
                        {branch.isMain && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/40">
                            Chính
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-neutral-400">Quản lý: {branch.manager || 'Chưa cập nhật'}</p>
                    </div>
                  </div>

                  {!branch.isMain && (
                    <button
                      onClick={() => handleDeleteBranch(branch.id, branch.isMain)}
                      className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-950/50 rounded-xl transition"
                      title="Xóa chi nhánh"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="py-4 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5 text-neutral-300">
                    <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{branch.address || 'Chưa có địa chỉ'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-300">
                    <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{branch.phone || 'Chưa có số điện thoại'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-neutral-500">Trạng thái: Hoạt động ổn định</span>
                <span className="px-2 py-1 rounded-lg bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800">
                  Online
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Add Branch */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white mb-4">Thêm cơ sở / chi nhánh mới</h2>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Tên chi nhánh *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Cơ sở 2 - Quận 1"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số 123 Nguyễn Huệ, Q.1, TP.HCM"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Số điện thoại liên hệ</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912345678"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Quản lý cơ sở</label>
                <input
                  type="text"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isMain"
                  checked={isMain}
                  onChange={(e) => setIsMain(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded bg-neutral-950 border-neutral-800"
                />
                <label htmlFor="isMain" className="text-xs text-neutral-300 font-medium cursor-pointer">
                  Đặt làm cơ sở chính / trụ sở
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg"
                >
                  Lưu chi nhánh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
