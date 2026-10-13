import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  doc,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { Product, InventoryMovement, MovementType, UNIT_LABELS, Supplier } from '@/src/types';
import { formatDateTime } from '@/src/lib/formatters';
import {
  Boxes,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  History,
  Loader2,
  X,
  Check,
  Truck,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { currentShop, user, userProfile, userRole } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('in');
  const [inputQty, setInputQty] = useState('');
  const [reason, setReason] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  useEffect(() => {
    if (!currentShop?.id) return;

    // 1. Subscribe to products
    const prodRef = collection(db, 'shops', currentShop.id, 'products');
    const unsubProd = onSnapshot(
      prodRef,
      (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
        setProducts(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/products`);
      }
    );

    // 2. Subscribe to inventory movements
    const movRef = collection(db, 'shops', currentShop.id, 'inventoryMovements');
    const movQuery = query(movRef, orderBy('createdAt', 'desc'));
    const unsubMov = onSnapshot(
      movQuery,
      (snap) => {
        const list: InventoryMovement[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<InventoryMovement, 'id'>) }));
        setMovements(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `shops/${currentShop.id}/inventoryMovements`);
      }
    );

    // 3. Subscribe to suppliers
    const supRef = collection(db, 'shops', currentShop.id, 'suppliers');
    const unsubSup = onSnapshot(supRef, (snap) => {
      const list: Supplier[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Supplier, 'id'>) }));
      setSuppliers(list);
    });

    return () => {
      unsubProd();
      unsubMov();
      unsubSup();
    };
  }, [currentShop?.id]);

  const openMovementModal = (pId?: string, type: MovementType = 'in') => {
    setSelectedProductId(pId || products[0]?.id || '');
    setMovementType(type);
    setInputQty('');
    setReason('');
    setSelectedSupplierId(suppliers[0]?.id || '');
    setUnitPrice('');
    setPaidAmount('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !user) return;

    const qty = parseFloat(inputQty) || 0;
    if (qty <= 0) {
      setErrorMsg('Vui lòng nhập số lượng lớn hơn 0');
      return;
    }

    const targetProduct = products.find((p) => p.id === selectedProductId);
    if (!targetProduct) {
      setErrorMsg('Vui lòng chọn sản phẩm');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const now = new Date().toISOString();
    const movId = 'mov_' + Math.random().toString(36).substring(2, 10);

    try {
      let totalAmount = 0;
      let paid = 0;
      let debtAmount = 0;
      let supplierObj: Supplier | undefined = undefined;

      if (movementType === 'in') {
        supplierObj = suppliers.find((s) => s.id === selectedSupplierId);
        const price = parseFloat(unitPrice) || 0;
        paid = parseFloat(paidAmount) || 0;
        totalAmount = qty * price;
        debtAmount = Math.max(0, totalAmount - paid);
      }

      await runTransaction(db, async (t) => {
        const pRef = doc(db, 'shops', currentShop.id, 'products', selectedProductId);
        const pDoc = await t.get(pRef);
        if (!pDoc.exists()) throw new Error('Sản phẩm không tồn tại');

        const currentStock = pDoc.data().stockQuantity || 0;
        let delta = 0;
        let newStock = currentStock;

        if (movementType === 'in') {
          delta = qty;
          newStock = currentStock + qty;
        } else if (movementType === 'out') {
          delta = -qty;
          newStock = Math.max(0, currentStock - qty);
        } else if (movementType === 'adjust') {
          delta = qty - currentStock;
          newStock = qty;
        }

        t.update(pRef, {
          stockQuantity: newStock,
          updatedAt: now,
        });

        const movDocRef = doc(db, 'shops', currentShop.id, 'inventoryMovements', movId);
        t.set(movDocRef, {
          productId: selectedProductId,
          productName: targetProduct.name,
          type: movementType,
          quantity: delta,
          reason: reason.trim() || (movementType === 'in' ? 'Nhập kho hàng từ NCC' : movementType === 'out' ? 'Xuất hao hụt/hỏng' : 'Kiểm kê định kỳ'),
          performedBy: userProfile?.displayName || user.email?.split('@')[0] || 'Quản lý',
          createdAt: now,
        });

        if (movementType === 'in' && supplierObj) {
          const supRef = doc(db, 'shops', currentShop.id, 'suppliers', supplierObj.id);
          const newDebt = (supplierObj.debt || 0) + debtAmount;
          t.update(supRef, { debt: newDebt });

          const invRef = doc(collection(db, 'shops', currentShop.id, 'purchaseInvoices'));
          t.set(invRef, {
            supplierId: supplierObj.id,
            supplierName: supplierObj.name,
            items: [
              {
                productName: targetProduct.name,
                quantity: qty,
                unit: targetProduct.unit,
                price: parseFloat(unitPrice) || 0,
              },
            ],
            totalAmount,
            paidAmount: paid,
            debtAmount,
            date: now,
            notes: reason.trim() || 'Nhập hàng từ kho',
            createdAt: now,
          });
        }
      });

      setModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Không thể ghi nhận biến động kho.');
    } finally {
      setSubmitting(false);
    }
  };

  const lowStockProducts = products.filter((p) => p.stockQuantity <= (p.minStockAlert || 5));

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            Quản lý Kho & Tồn hàng Vịt quay
          </h2>
          <p className="text-xs text-neutral-400">
            Theo dõi số lượng tồn theo con và kg, cảnh báo hàng sắp hết và nhật ký biến động
          </p>
        </div>

        {isManagerOrOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => openMovementModal(undefined, 'in')}
              className="py-2 px-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
              Nhập kho mới
            </button>
            <button
              onClick={() => openMovementModal(undefined, 'out')}
              className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4 text-red-400" />
              Xuất hao hụt / Hỏng
            </button>
          </div>
        )}
      </div>

      {/* Low stock warning banner */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-950/60 border border-red-800/80 rounded-xl p-3.5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-white mb-0.5">
              Cảnh báo: Có {lowStockProducts.length} mặt hàng sắp hết tồn kho
            </div>
            <div className="text-neutral-300 flex flex-wrap gap-2 mt-1">
              {lowStockProducts.map((p) => (
                <span
                  key={p.id}
                  className="bg-neutral-900/90 border border-red-800/60 px-2 py-0.5 rounded text-[11px]"
                >
                  {p.name}: <strong className="text-amber-400">{p.stockQuantity} {UNIT_LABELS[p.unit] || p.unit}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 max-w-xs">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'stock'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Bảng tồn kho ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'history'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          Nhật ký kho ({movements.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải dữ liệu kho...
        </div>
      ) : activeTab === 'stock' ? (
        /* STOCK TABLE */
        products.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center text-xs text-neutral-400">
            Chưa có sản phẩm nào trong quán để quản lý kho.
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Tên mặt hàng</th>
                    <th className="py-3 px-4">Danh mục</th>
                    <th className="py-3 px-4 text-center">Đơn vị</th>
                    <th className="py-3 px-4 text-center">Tồn thực tế</th>
                    <th className="py-3 px-4 text-center">Mức cảnh báo</th>
                    <th className="py-3 px-4 text-center">Tình trạng</th>
                    {isManagerOrOwner && <th className="py-3 px-4 text-right">Điều chỉnh</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {products.map((item) => {
                    const isLow = item.stockQuantity <= (item.minStockAlert || 5);
                    return (
                      <tr key={item.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                        <td className="py-3 px-4 text-neutral-400">{item.category}</td>
                        <td className="py-3 px-4 text-center text-amber-400 font-medium">
                          {UNIT_LABELS[item.unit] || item.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-sm font-extrabold tabular-nums ${
                              isLow ? 'text-red-400' : 'text-neutral-100'
                            }`}
                          >
                            {item.stockQuantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-neutral-400 tabular-nums">
                          ≤ {item.minStockAlert || 5}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isLow ? (
                            <span className="text-[11px] font-bold text-red-400 bg-red-950/80 border border-red-800/60 rounded px-2 py-0.5 inline-block">
                              Sắp hết hàng
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded px-2 py-0.5 inline-block">
                              Đủ tồn kho
                            </span>
                          )}
                        </td>
                        {isManagerOrOwner && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => openMovementModal(item.id, 'adjust')}
                              className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                            >
                              Điều chỉnh
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* HISTORY LOG TABLE */
        movements.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center text-xs text-neutral-400">
            Chưa có biến động kho nào được ghi nhận.
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Mặt hàng</th>
                    <th className="py-3 px-4 text-center">Loại biến động</th>
                    <th className="py-3 px-4 text-right">Số lượng</th>
                    <th className="py-3 px-4">Lý do</th>
                    <th className="py-3 px-4">Người thực hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 text-neutral-400 tabular-nums">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">{m.productName}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            m.type === 'in'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : m.type === 'sale'
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-800/60'
                              : m.type === 'out'
                              ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                          }`}
                        >
                          {m.type === 'in'
                            ? 'Nhập hàng'
                            : m.type === 'sale'
                            ? 'Bán quầy'
                            : m.type === 'out'
                            ? 'Hao hụt/Hỏng'
                            : 'Điều chỉnh'}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold tabular-nums ${
                          m.quantity > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="py-3 px-4 text-neutral-300">{m.reason}</td>
                      <td className="py-3 px-4 text-neutral-400">{m.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* MOVEMENT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                Ghi nhận biến động kho
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

            <form onSubmit={handleSaveMovement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Chọn mặt hàng <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Tồn hiện tại: {p.stockQuantity} {UNIT_LABELS[p.unit] || p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Loại thao tác
                </label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as MovementType)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                >
                  <option value="in">Nhập hàng thêm (+)</option>
                  <option value="out">Xuất hủy / Hao hụt (-)</option>
                  <option value="adjust">Điều chỉnh kiểm kê thực tế (=)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  {movementType === 'adjust' ? 'Số lượng thực tế mới' : 'Số lượng biến động'}{' '}
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder="Ví dụ: 10"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                />
              </div>

                            {movementType === 'in' && (
                <div className="space-y-3.5 bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                    <Truck className="w-4 h-4" /> Thông tin Nhà cung cấp & Công nợ
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Chọn nhà cung cấp <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="">-- Chọn nhà cung cấp --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Nợ cũ: {(s.debt || 0).toLocaleString('vi-VN')} ₫)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Đơn giá nhập (₫)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Đã thanh toán (₫)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-400 flex justify-between pt-1">
                    <span>Tổng tiền: <strong className="text-emerald-400">{((parseFloat(inputQty) || 0) * (parseFloat(unitPrice) || 0)).toLocaleString('vi-VN')} ₫</strong></span>
                    <span>Còn nợ NCC: <strong className="text-red-400">{Math.max(0, ((parseFloat(inputQty) || 0) * (parseFloat(unitPrice) || 0)) - (parseFloat(paidAmount) || 0)).toLocaleString('vi-VN')} ₫</strong></span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Lý do ghi nhận
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nhập lò mổ buổi sáng, Vịt quay cháy..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
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
                  Lưu biến động
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
