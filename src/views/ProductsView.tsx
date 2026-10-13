import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { Product, ProductUnit, UNIT_LABELS } from '@/src/types';
import { formatCurrency } from '@/src/lib/formatters';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  UtensilsCrossed,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { currentShop, userRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Quick Price/Stock Update Modal State
  const [quickEditModalOpen, setQuickEditModalOpen] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickPrice, setQuickPrice] = useState('');
  const [quickStock, setQuickStock] = useState('');
  const [quickMinStock, setQuickMinStock] = useState('');
  const [quickUnit, setQuickUnit] = useState<ProductUnit>('con');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // Selection for batch deletion
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Vịt quay');
  const [unit, setUnit] = useState<ProductUnit>('con');
  const [price, setPrice] = useState<string>('280000');
  const [costPrice, setCostPrice] = useState<string>('180000');
  const [stockQuantity, setStockQuantity] = useState<string>('20');
  const [minStockAlert, setMinStockAlert] = useState<string>('5');
  const [isAvailable, setIsAvailable] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop?.id) return;

    const ref = collection(db, 'shops', currentShop.id, 'products');
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const list: Product[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) });
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

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setCode('');
    setCategory('Vịt quay');
    setUnit('con');
    setPrice('');
    setCostPrice('');
    setStockQuantity('10');
    setMinStockAlert('3');
    setIsAvailable(true);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCode(p.code || '');
    setCategory(p.category || 'Vịt quay');
    setUnit(p.unit);
    setPrice(p.price.toString());
    setCostPrice(p.costPrice ? p.costPrice.toString() : '');
    setStockQuantity(p.stockQuantity ? p.stockQuantity.toString() : '0');
    setMinStockAlert(p.minStockAlert ? p.minStockAlert.toString() : '0');
    setIsAvailable(p.isAvailable);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openQuickEditModal = (p: Product) => {
    setQuickEditProduct(p);
    setQuickPrice(p.price.toString());
    setQuickStock(p.stockQuantity.toString());
    setQuickMinStock((p.minStockAlert || 5).toString());
    setQuickUnit(p.unit);
    setQuickEditModalOpen(true);
  };

  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !quickEditProduct) return;

    const parsedPrice = parseFloat(quickPrice) || 0;
    const parsedStock = parseFloat(quickStock) || 0;
    const parsedMinStock = parseFloat(quickMinStock) || 0;

    setQuickSubmitting(true);
    try {
      const docRef = doc(db, 'shops', currentShop.id, 'products', quickEditProduct.id);
      await updateDoc(docRef, {
        price: parsedPrice,
        stockQuantity: parsedStock,
        minStockAlert: parsedMinStock,
        unit: quickUnit,
        updatedAt: new Date().toISOString(),
      });
      setQuickEditModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Không thể cập nhật nhanh. Vui lòng thử lại.');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id) return;
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên sản phẩm');
      return;
    }

    const parsedPrice = parseFloat(price) || 0;
    const parsedCost = parseFloat(costPrice) || 0;
    const parsedStock = parseFloat(stockQuantity) || 0;
    const parsedMinStock = parseFloat(minStockAlert) || 0;

    setFormSubmitting(true);
    setErrorMsg(null);

    const now = new Date().toISOString();

    try {
      if (editingProduct) {
        const docRef = doc(db, 'shops', currentShop.id, 'products', editingProduct.id);
        await updateDoc(docRef, {
          name: name.trim(),
          code: code.trim(),
          category: category.trim(),
          unit,
          price: parsedPrice,
          costPrice: parsedCost,
          stockQuantity: parsedStock,
          minStockAlert: parsedMinStock,
          isAvailable,
          updatedAt: now,
        });
      } else {
        const collRef = collection(db, 'shops', currentShop.id, 'products');
        await addDoc(collRef, {
          name: name.trim(),
          code: code.trim(),
          category: category.trim(),
          unit,
          price: parsedPrice,
          costPrice: parsedCost,
          stockQuantity: parsedStock,
          minStockAlert: parsedMinStock,
          isAvailable,
          createdAt: now,
        });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Không thể lưu sản phẩm. Vui lòng kiểm tra quyền truy cập.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(filtered.map((p) => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter((item) => item !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  // Delete execution
  const confirmDeleteSingle = (id: string) => {
    setSingleDeleteId(id);
    setDeleteConfirmModalOpen(true);
  };

  const confirmDeleteBatch = () => {
    if (selectedProductIds.length === 0) return;
    setSingleDeleteId(null);
    setDeleteConfirmModalOpen(true);
  };

  const executeDelete = async () => {
    if (!currentShop?.id) return;
    setIsDeleting(true);

    try {
      if (singleDeleteId) {
        await deleteDoc(doc(db, 'shops', currentShop.id, 'products', singleDeleteId));
        setSingleDeleteId(null);
      } else if (selectedProductIds.length > 0) {
        const batch = writeBatch(db);
        selectedProductIds.forEach((id) => {
          const dRef = doc(db, 'shops', currentShop.id, 'products', id);
          batch.delete(dRef);
        });
        await batch.commit();
        setSelectedProductIds([]);
      }
      setDeleteConfirmModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Không thể xóa sản phẩm. Vui lòng thử lại.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAvailable = async (product: Product) => {
    if (!currentShop?.id || !isManagerOrOwner) return;
    try {
      await updateDoc(doc(db, 'shops', currentShop.id, 'products', product.id), {
        isAvailable: !product.isAvailable,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase())) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const isAllSelected = filtered.length > 0 && selectedProductIds.length === filtered.length;

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            Quản lý Sản phẩm & Thực đơn
          </h2>
          <p className="text-xs text-neutral-400">
            Cấu hình danh mục, định lượng bán, cảnh báo kho tối thiểu & cập nhật giá nhanh
          </p>
        </div>

        {isManagerOrOwner && (
          <div className="flex items-center gap-2">
            {selectedProductIds.length > 0 && (
              <button
                onClick={confirmDeleteBatch}
                className="py-2.5 px-3 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                Xóa đã chọn ({selectedProductIds.length})
              </button>
            )}
            <button
              onClick={openCreateModal}
              className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Thêm món mới
            </button>
          </div>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo tên món, mã hoặc danh mục..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="text-xs text-neutral-400">
          Tổng số: <span className="font-bold text-amber-400 tabular-nums">{products.length}</span> món
          {selectedProductIds.length > 0 && (
            <span className="ml-2 text-red-400 font-semibold">
              (Đã chọn {selectedProductIds.length})
            </span>
          )}
        </div>
      </div>

      {/* Table / Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải dữ liệu sản phẩm...
        </div>
      ) : products.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-amber-500 mb-3">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Chưa có sản phẩm nào</h3>
          <p className="text-xs text-neutral-400 max-w-sm mb-4">
            Quán của bạn chưa tạo món nào. Hãy thêm các món vịt quay, chặt góc hoặc đồ uống thực tế để bắt đầu bán hàng.
          </p>
          {isManagerOrOwner && (
            <button
              onClick={openCreateModal}
              className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Thêm món đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  {isManagerOrOwner && (
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="rounded border-neutral-700 text-red-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Tên sản phẩm</th>
                  <th className="py-3 px-4">Danh mục</th>
                  <th className="py-3 px-4">Đơn vị & Kho</th>
                  <th className="py-3 px-4 text-right">Giá bán</th>
                  <th className="py-3 px-4 text-right">Giá vốn</th>
                  <th className="py-3 px-4 text-center">Tồn kho / Cảnh báo</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  {isManagerOrOwner && <th className="py-3 px-4 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                {filtered.map((item) => {
                  const isSelected = selectedProductIds.includes(item.id);
                  const isLowStock = item.stockQuantity <= (item.minStockAlert || 5);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        isSelected ? 'bg-red-950/20' : ''
                      }`}
                    >
                      {isManagerOrOwner && (
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(item.id)}
                            className="rounded border-neutral-700 text-red-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{item.name}</div>
                        {item.code && (
                          <div className="text-[10px] text-neutral-500">Mã: {item.code}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-300">{item.category}</td>
                      <td className="py-3 px-4">
                        <span className="text-amber-400 font-medium">
                          {UNIT_LABELS[item.unit] || item.unit}
                        </span>
                        <div className="text-[10px] text-neutral-400">
                          Ngưỡng báo: ≤ {item.minStockAlert || 5}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white tabular-nums">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="py-3 px-4 text-right text-neutral-400 tabular-nums">
                        {item.costPrice ? formatCurrency(item.costPrice) : 'Chưa nhập'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-semibold tabular-nums ${
                            isLowStock ? 'text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-900/60' : 'text-neutral-300'
                          }`}
                        >
                          {item.stockQuantity} {UNIT_LABELS[item.unit] || item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleAvailable(item)}
                          disabled={!isManagerOrOwner}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            item.isAvailable
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                          }`}
                        >
                          {item.isAvailable ? 'Đang bán' : 'Tạm ngưng'}
                        </button>
                      </td>
                      {isManagerOrOwner && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openQuickEditModal(item)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
                              title="Cập nhật nhanh giá & kho"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
                              title="Sửa chi tiết"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => confirmDeleteSingle(item.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* QUICK PRICE & STOCK UPDATE MODAL */}
      {quickEditModalOpen && quickEditProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Cập nhật nhanh: {quickEditProduct.name}
              </h3>
              <button
                onClick={() => setQuickEditModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Giá bán (VND)
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  value={quickPrice}
                  onChange={(e) => setQuickPrice(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Tồn kho hiện tại
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={quickStock}
                    onChange={(e) => setQuickStock(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Ngưỡng cảnh báo kho
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={quickMinStock}
                    onChange={(e) => setQuickMinStock(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Đơn vị tính
                </label>
                <select
                  value={quickUnit}
                  onChange={(e) => setQuickUnit(e.target.value as ProductUnit)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                >
                  <option value="con">Con (Nguyên con)</option>
                  <option value="nua_con">Nửa con</option>
                  <option value="goc_tu">Góc tư (1/4 con)</option>
                  <option value="kg">Kg (Cân ký)</option>
                  <option value="phan">Phần / Suất</option>
                  <option value="chiec">Chiếc / Cái</option>
                  <option value="dia">Đĩa</option>
                  <option value="chai">Chai</option>
                  <option value="lon">Lon</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={quickSubmitting}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  {quickSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Lưu thay đổi nhanh
                </button>
                <button
                  type="button"
                  onClick={() => setQuickEditModalOpen(false)}
                  className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Xác nhận xóa sản phẩm</h3>
                <p className="text-[11px] text-neutral-400">
                  Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 mb-5">
              {singleDeleteId
                ? 'Bạn có chắc chắn muốn xóa sản phẩm này khỏi thực đơn?'
                : `Bạn có chắc chắn muốn xóa ${selectedProductIds.length} sản phẩm đã chọn khỏi thực đơn?`}
            </p>

            <div className="flex gap-2">
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Xác nhận xóa
              </button>
              <button
                onClick={() => setDeleteConfirmModalOpen(false)}
                disabled={isDeleting}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm món mới vào thực đơn'}
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

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Tên món ăn <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Vịt quay Bắc Kinh nguyên con, Vịt quay xá xíu..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Danh mục món
                  </label>
                  <input
                    type="text"
                    placeholder="Vịt quay, Đồ uống, Món kèm..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Đơn vị tính bán <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as ProductUnit)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="con">Con (Nguyên con)</option>
                    <option value="nua_con">Nửa con</option>
                    <option value="goc_tu">Góc tư (1/4 con)</option>
                    <option value="kg">Kg (Cân ký)</option>
                    <option value="phan">Phần / Suất</option>
                    <option value="chiec">Chiếc / Cái</option>
                    <option value="dia">Đĩa</option>
                    <option value="chai">Chai</option>
                    <option value="lon">Lon</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Giá bán ra (VND) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    required
                    placeholder="280000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Giá vốn nhập (VND)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    placeholder="180000"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Số lượng tồn ban đầu
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Cảnh báo sắp hết khi ≤
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white tabular-nums focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="availCheck"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="rounded border-neutral-700 text-red-600 focus:ring-0"
                />
                <label htmlFor="availCheck" className="text-xs text-neutral-300 font-medium cursor-pointer">
                  Đang mở bán tại quầy thu ngân (POS)
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  {formSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Lưu sản phẩm
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
