import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Order } from '@/src/types';
import { ChefHat, Clock, CheckCircle2, Flame, AlertCircle, RefreshCw } from 'lucide-react';

export const KDSView: React.FC = () => {
  const { currentShop } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'cooking' | 'ready'>('all');

  useEffect(() => {
    if (!currentShop?.id) return;

    const q = query(collection(db, 'shops', currentShop.id, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Order, 'id'>) });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentShop?.id]);

  // Update KDS / Order prep status in Firestore
  // We can track kdsStatus on the order object: 'pending' | 'cooking' | 'ready' | 'completed'
  const updateKdsStatus = async (orderId: string, newKdsStatus: 'pending' | 'cooking' | 'ready' | 'completed') => {
    if (!currentShop?.id) return;
    try {
      const orderRef = doc(db, 'shops', currentShop.id, 'orders', orderId);
      const updatePayload: any = { kdsStatus: newKdsStatus };
      if (newKdsStatus === 'completed') {
        updatePayload.status = 'completed';
      }
      await updateDoc(orderRef, updatePayload);
    } catch (err) {
      console.error('Error updating KDS status:', err);
    }
  };

  // Filter active prep orders (exclude fully cancelled or old completed unless filtered)
  const activeOrders = orders.filter((o) => {
    if (o.status === 'cancelled') return false;
    const kds = (o as any).kdsStatus || (o.status === 'completed' ? 'completed' : 'pending');
    if (filterStatus === 'all') return kds !== 'completed';
    return kds === filterStatus;
  });

  return (
    <div className="flex-1 bg-neutral-950 text-neutral-100 flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-amber-400 shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Màn hình Bếp / Pha chế (KDS)
              <span className="px-2 py-0.5 rounded-full bg-red-900/60 text-amber-400 text-xs font-semibold">
                Trực tiếp
              </span>
            </h1>
            <p className="text-xs text-neutral-400">
              Quản lý chế biến món ăn và đồ uống theo thời gian thực tại {currentShop?.name}
            </p>
          </div>
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === 'all'
                ? 'bg-amber-500 text-neutral-950 font-bold'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Đang xử lý ({orders.filter(o => o.status !== 'cancelled' && ((o as any).kdsStatus || 'pending') !== 'completed').length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === 'pending'
                ? 'bg-red-600 text-white font-bold'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Chờ làm
          </button>
          <button
            onClick={() => setFilterStatus('cooking')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === 'cooking'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Đang nấu
          </button>
          <button
            onClick={() => setFilterStatus('ready')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === 'ready'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Đã xong
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-neutral-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <span>Đang tải danh sách món ăn từ bếp...</span>
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-neutral-500">
            <ChefHat className="w-16 h-16 text-neutral-700 mb-3" />
            <p className="text-sm font-semibold text-neutral-300">Không có đơn hàng nào cần chế biến lúc này</p>
            <p className="text-xs text-neutral-500 mt-1">Các đơn hàng mới từ thu ngân sẽ xuất hiện ngay lập tức tại đây.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeOrders.map((order) => {
              const kds = (order as any).kdsStatus || 'pending';
              const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isDineIn = order.diningOption === 'dine_in';

              let borderColor = 'border-red-900/80 bg-red-950/20';
              let badgeColor = 'bg-red-900/60 text-red-300 border-red-700';
              let statusLabel = 'Chờ làm';

              if (kds === 'cooking') {
                borderColor = 'border-amber-700/80 bg-amber-950/20';
                badgeColor = 'bg-amber-900/60 text-amber-300 border-amber-700';
                statusLabel = 'Đang chế biến';
              } else if (kds === 'ready') {
                borderColor = 'border-emerald-700/80 bg-emerald-950/20';
                badgeColor = 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
                statusLabel = 'Sẵn sàng phục vụ';
              }

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border ${borderColor} p-4 flex flex-col justify-between shadow-xl transition-all`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <div>
                        <span className="text-sm font-black text-amber-400">
                          #{order.orderCode}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{timeStr}</span>
                          <span>•</span>
                          <span className={isDineIn ? 'text-blue-400 font-semibold' : 'text-purple-400 font-semibold'}>
                            {isDineIn ? '🍽️ Tại quán' : '🛍️ Mang về'}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Order Items List */}
                    <div className="py-3 space-y-2.5 divide-y divide-neutral-800/60">
                      {order.items.map((item, idx) => (
                        <div key={idx} className={idx > 0 ? 'pt-2.5' : ''}>
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-white leading-snug">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-xs font-semibold text-amber-400">
                              {item.unit === 'kg' ? `${item.weightKg || 1} kg` : item.unit}
                            </span>
                          </div>
                          {item.prepNote && (
                            <div className="mt-1 px-2 py-1 bg-amber-950/50 border border-amber-800/50 rounded-lg text-[11px] text-amber-300 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{item.prepNote}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-neutral-800 flex items-center gap-2">
                    {kds === 'pending' && (
                      <button
                        onClick={() => updateKdsStatus(order.id, 'cooking')}
                        className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Bắt đầu làm</span>
                      </button>
                    )}
                    {kds === 'cooking' && (
                      <button
                        onClick={() => updateKdsStatus(order.id, 'ready')}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Xong (Sẵn sàng)</span>
                      </button>
                    )}
                    {kds === 'ready' && (
                      <button
                        onClick={() => updateKdsStatus(order.id, 'completed')}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Hoàn thành / Phục vụ</span>
                      </button>
                    )}
                    {kds !== 'pending' && (
                      <button
                        onClick={() => updateKdsStatus(order.id, 'pending')}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition"
                        title="Quay lại chờ"
                      >
                        Quay lại
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
