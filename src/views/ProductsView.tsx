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
import { Product, ProductUnit, UNIT_LABELS, ConversionUnit, BatchItem } from '@/src/types';
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
  Barcode,
  Tag,
  Calendar,
  MapPin,
  Layers,
  Filter,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { currentShop, userRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterNearExpiry, setFilterNearExpiry] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Quick Price/Stock Update Modal State
  const [quickEditModalOpen, setQuickEditModalOpen] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickPrice, setQuickPrice] = useState('');
  const [quickStock, setQuickStock] = useState('');
  const [quickMinStock, setQuickMinStock] = useState('');
  const [quickUnit, setQuickUnit] = useState<ProductUnit | string>('Chiếc');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // Selection for batch deletion
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  // Form State (Standard + Enterprise KiotViet)
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Đồ ăn');
  const [brand, setBrand] = useState('');
  const [location, setLocation] = useState('');
  const [unit, setUnit] = useState<ProductUnit | string>('Chiếc');
  const [price, setPrice] = useState<string>('50000');
  const [costPrice, setCostPrice] = useState<string>('30000');
  const [costMethod, setCostMethod] = useState<'fixed' | 'average'>('average');
  const [stockQuantity, setStockQuantity] = useState<string>('20');
  const [minStockAlert, setMinStockAlert] = useState<string>('5');
  const [hasBatchTracking, setHasBatchTracking] = useState(false);
  const [conversionUnits, setConversionUnits] = useState<ConversionUnit[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Conversion unit sub-form inside modal
  const [newConvName, setNewConvName] = useState('');
  const [newConvRate, setNewConvRate] = useState('24');
  const [newConvPrice, setNewConvPrice] = useState('');
  const [newConvBarcode, setNewConvBarcode] = useState('');

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

  const generateEan13 = () => {
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
    const raw12 = '893' + randomDigits;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(raw12[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return raw12 + checksum;
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setCode('SP' + Math.floor(1000 + Math.random() * 9000));
    setBarcode(currentShop?.enterpriseSettings?.enableBarcode !== false ? generateEan13() : '');
    setCategory(currentShop?.enterpriseSettings?.categoriesList?.[0] || 'Đồ ăn');
    setBrand(currentShop?.enterpriseSettings?.brandsList?.[0] || '');
    setLocation(currentShop?.enterpriseSettings?.locationsList?.[0] || '');
    setUnit(currentShop?.enterpriseSettings?.unitsList?.[0] || 'Chiếc');
    setPrice('');
    setCostPrice('');
    setCostMethod(currentShop?.enterpriseSettings?.costMethod || 'average');
    setStockQuantity('10');
    setMinStockAlert('3');
    setHasBatchTracking(currentShop?.enterpriseSettings?.enableBatchTracking ?? false);
    setConversionUnits([]);
    setIsAvailable(true);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCode(p.code || '');
    setBarcode(p.barcode || '');
    setCategory(p.category || 'Đồ ăn');
    setBrand(p.brand || '');
    setLocation(p.location || '');
    setUnit(p.unit || 'Chiếc');
    setPrice(p.price.toString());
    setCostPrice(p.costPrice ? p.costPrice.toString() : '');
    setCostMethod(p.costMethod || currentShop?.enterpriseSettings?.costMethod || 'average');
    setStockQuantity(p.stockQuantity ? p.stockQuantity.toString() : '0');
    setMinStockAlert(p.minStockAlert ? p.minStockAlert.toString() : '0');
    setHasBatchTracking(p.hasBatchTracking ?? false);
    setConversionUnits(p.conversionUnits || []);
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

    const productPayload = {
      name: name.trim(),
      code: code.trim(),
      barcode: barcode.trim() || undefined,
      category: category.trim(),
      brand: brand.trim() || undefined,
      location: location.trim() || undefined,
      unit,
      price: parsedPrice,
      costPrice: parsedCost,
      costMethod,
      stockQuantity: parsedStock,
      minStockAlert: parsedMinStock,
      hasBatchTracking,
      conversionUnits,
      isAvailable,
      updatedAt: now,
    };

    try {
      if (editingProduct) {
        const docRef = doc(db, 'shops', currentShop.id, 'products', editingProduct.id);
        await updateDoc(docRef, productPayload);
      } else {
        const collRef = collection(db, 'shops', currentShop.id, 'products');
        await addDoc(collRef, {
          ...productPayload,
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

  // Conversion unit helper
  const handleAddConversionUnit = () => {
    if (!newConvName.trim() || !newConvRate || Number(newConvRate) <= 1) {
      alert('Vui lòng nhập tên đơn vị quy đổi và hệ số quy đổi lớn hơn 1 (VD: Thùng = 24 Lon)');
      return;
    }
    const newUnit: ConversionUnit = {
      id: 'conv_' + Date.now(),
      unitName: newConvName.trim(),
      name: newConvName.trim(),
      conversionRate: Number(newConvRate),
      price: newConvPrice ? Number(newConvPrice) : (parseFloat(price) || 0) * Number(newConvRate),
      barcode: newConvBarcode.trim() || undefined,
    };
    setConversionUnits((prev) => [...prev, newUnit]);
    setNewConvName('');
    setNewConvRate('24');
    setNewConvPrice('');
    setNewConvBarcode('');
  };

  const handleRemoveConversionUnit = (identifier: string) => {
    setConversionUnits((prev) => prev.filter((u) => (u.id || u.unitName) !== identifier));
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

  const nowTime = new Date();
  const thirtyDaysLater = new Date(nowTime.getTime() + 30 * 24 * 60 * 60 * 1000);

  const filtered = products.filter((p) => {
    const matchSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(search.toLowerCase()));

    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchBrand = selectedBrand === 'all' || p.brand === selectedBrand;
    const matchLowStock = !filterLowStock || p.stockQuantity <= (p.minStockAlert || 5);
    const matchNearExpiry =
      !filterNearExpiry ||
      (p.batches &&
        p.batches.some((b) => {
          const exp = new Date(b.expDate);
          return exp <= thirtyDaysLater;
        }));

    return matchSearch && matchCat && matchBrand && matchLowStock && matchNearExpiry;
  });

  const isAllSelected = filtered.length > 0 && selectedProductIds.length === filtered.length;

  // Unique categories and brands from products and settings
  const availableCategories = Array.from(
    new Set([
      ...(currentShop?.enterpriseSettings?.categoriesList || []),
      ...products.map((p) => p.category).filter(Boolean),
    ])
  );

  const availableBrands = Array.from(
    new Set([
      ...(currentShop?.enterpriseSettings?.brandsList || []),
      ...products.map((p) => p.brand).filter((b): b is string => Boolean(b)),
    ])
  );

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
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Quét mã vạch hoặc tìm theo tên món, mã hàng, nhóm, vị trí..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-hidden focus:border-amber-500"
            >
              <option value="all">Tất cả nhóm ({availableCategories.length})</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Brand Filter */}
            {availableBrands.length > 0 && (
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-hidden focus:border-amber-500"
              >
                <option value="all">Tất cả thương hiệu</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}

            {/* Low stock pill */}
            <button
              type="button"
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                filterLowStock
                  ? 'bg-red-950 border border-red-700 text-red-200'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Tồn kho thấp</span>
            </button>

            {/* Near Expiry pill */}
            <button
              type="button"
              onClick={() => setFilterNearExpiry(!filterNearExpiry)}
              className={`px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                filterNearExpiry
                  ? 'bg-amber-950 border border-amber-700 text-amber-200'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Cận hạn date</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-400 pt-1 border-t border-neutral-850">
          <div>
            Hiển thị <span className="font-bold text-amber-400 font-mono tabular-nums">{filtered.length}</span> / {products.length} mặt hàng
            {selectedProductIds.length > 0 && (
              <span className="ml-2 text-red-400 font-semibold">
                (Đã chọn {selectedProductIds.length})
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-2">
            <span className="flex items-center gap-1"><Barcode className="w-3 h-3 text-neutral-400" /> Quét mã vạch tự động</span>
          </div>
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
            Quán của bạn chưa tạo món nào. Hãy thêm các món ăn, đồ uống hoặc hàng hóa bán lẻ để bắt đầu bán hàng.
          </p>
          {isManagerOrOwner && (
            <button
              onClick={openCreateModal}
              className="py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer"
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
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="rounded border-neutral-700 text-red-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3 px-3">Tên sản phẩm & Mã</th>
                  <th className="py-3 px-3">Nhóm & Thương hiệu</th>
                  <th className="py-3 px-3">Vị trí & Lô/HSD</th>
                  <th className="py-3 px-3">Đơn vị & Quy đổi</th>
                  <th className="py-3 px-3 text-right">Giá bán</th>
                  <th className="py-3 px-3 text-right">Giá vốn</th>
                  <th className="py-3 px-3 text-center">Tồn kho</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  {isManagerOrOwner && <th className="py-3 px-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                {filtered.map((item) => {
                  const isSelected = selectedProductIds.includes(item.id);
                  const isLowStock = item.stockQuantity <= (item.minStockAlert || 5);
                  const hasConversion = item.conversionUnits && item.conversionUnits.length > 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        isSelected ? 'bg-red-950/20' : ''
                      }`}
                    >
                      {isManagerOrOwner && (
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(item.id)}
                            className="rounded border-neutral-700 text-red-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400 font-mono">
                          {item.code && <span>Mã: {item.code}</span>}
                          {item.barcode && (
                            <span className="flex items-center gap-0.5 text-amber-400/90 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-900/40">
                              <Barcode className="w-2.5 h-2.5" /> {item.barcode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-neutral-200 font-medium">{item.category}</div>
                        {item.brand && (
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                            <Tag className="w-2.5 h-2.5 text-neutral-500" />
                            {item.brand}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {item.location ? (
                          <div className="text-[11px] text-neutral-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-neutral-500" />
                            <span>{item.location}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                        {item.hasBatchTracking && (
                          <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                            <Calendar className="w-2.5 h-2.5" /> Quản lý Lô/HSD
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-amber-400 font-medium">
                          {UNIT_LABELS[item.unit] || item.unit}
                        </span>
                        {hasConversion && (
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            +{item.conversionUnits?.length} quy đổi ({item.conversionUnits?.map((u) => u.name).join(', ')})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white tabular-nums font-mono">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="py-3 px-3 text-right text-neutral-400 tabular-nums font-mono">
                        <div>{item.costPrice ? formatCurrency(item.costPrice) : 'Chưa nhập'}</div>
                        <div className="text-[9px] text-neutral-500 uppercase">
                          {item.costMethod === 'average' ? 'Giá TB' : 'Cố định'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-semibold tabular-nums font-mono px-2 py-0.5 rounded text-[11px] ${
                            isLowStock
                              ? 'text-red-300 font-bold bg-red-950/80 border border-red-800'
                              : 'text-neutral-200 bg-neutral-950 border border-neutral-800'
                          }`}
                        >
                          {item.stockQuantity} {UNIT_LABELS[item.unit] || item.unit}
                        </span>
                        {isLowStock && (
                          <div className="text-[9px] text-red-400 mt-0.5">Dưới định mức</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailable(item)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            item.isAvailable
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                          }`}
                        >
                          {item.isAvailable ? 'Mở bán' : 'Tạm ẩn'}
                        </button>
                      </td>
                      {isManagerOrOwner && (
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openQuickEditModal(item)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-lg transition-colors cursor-pointer"
                              title="Sửa nhanh giá & kho"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                              title="Chỉnh sửa chi tiết"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDeleteSingle(item.id)}
                              className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                              title="Xóa món"
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

      {/* CREATE / EDIT PRODUCT MODAL (ENTERPRISE GRADE) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                  {editingProduct ? 'Chỉnh sửa thông tin hàng hóa' : 'Thêm mới hàng hóa / Thực đơn'}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Thiết lập mã vạch, nhóm hàng, đơn vị tính quy đổi và quy tắc giá vốn
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* SECTION 1: THÔNG TIN CƠ BẢN */}
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 border-b border-neutral-850 pb-2">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Thông tin nhận diện hàng hóa</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Tên sản phẩm / Món ăn <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Vịt quay Bắc Kinh, Bia Heineken lon 330ml, Cơm chiên Dương Châu..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Mã hàng (SKU)
                    </label>
                    <input
                      type="text"
                      placeholder="SP1001"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Mã vạch (Barcode EAN-13)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="893..."
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setBarcode(generateEan13())}
                        className="px-2.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Tự động sinh mã EAN-13 chuẩn Việt Nam"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tạo mã</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Nhóm hàng
                    </label>
                    <input
                      type="text"
                      list="cat-suggestions"
                      placeholder="Chọn hoặc nhập nhóm..."
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    />
                    <datalist id="cat-suggestions">
                      {availableCategories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Thương hiệu
                    </label>
                    <input
                      type="text"
                      list="brand-suggestions"
                      placeholder="Chọn hoặc nhập nhãn..."
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    />
                    <datalist id="brand-suggestions">
                      {availableBrands.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Vị trí lưu kho
                    </label>
                    <input
                      type="text"
                      list="loc-suggestions"
                      placeholder="Kệ A1, Tủ đông 1..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    />
                    <datalist id="loc-suggestions">
                      {(currentShop?.enterpriseSettings?.locationsList || []).map((l) => (
                        <option key={l} value={l} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* SECTION 2: GIÁ & TỒN KHO */}
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 border-b border-neutral-850 pb-2">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Giá bán & Quản lý giá vốn tồn kho</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Đơn vị tính cơ bản <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      list="unit-suggestions"
                      placeholder="Chiếc, Lon, Chai, Con, Kg..."
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    />
                    <datalist id="unit-suggestions">
                      {(currentShop?.enterpriseSettings?.unitsList || ['Chiếc', 'Cái', 'Lon', 'Chai', 'Hộp', 'Kg', 'Phần', 'Đĩa']).map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Giá bán ra (VND) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      required
                      placeholder="50000"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-hidden focus:border-amber-500 font-bold"
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
                      placeholder="30000"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Phương pháp tính giá vốn
                    </label>
                    <select
                      value={costMethod}
                      onChange={(e) => setCostMethod(e.target.value as 'fixed' | 'average')}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="average">Giá vốn trung bình (Bình quân gia quyền)</option>
                      <option value="fixed">Giá vốn cố định</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Tồn kho ban đầu
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Cảnh báo hết khi ≤
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Batch Tracking checkbox */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="batchCheck"
                    checked={hasBatchTracking}
                    onChange={(e) => setHasBatchTracking(e.target.checked)}
                    className="rounded border-neutral-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="batchCheck" className="text-xs text-neutral-300 font-medium cursor-pointer flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Quản lý theo Lô và Hạn sử dụng (FEFO - Hàng cận date ưu tiên xuất trước)</span>
                  </label>
                </div>
              </div>

              {/* SECTION 3: ĐƠN VỊ TÍNH QUY ĐỔI (CONVERSION UNITS) */}
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center justify-between border-b border-neutral-850 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Đơn vị tính quy đổi bán hàng ({conversionUnits.length})</span>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-normal">
                    VD: 1 Thùng = 24 {unit || 'Lon'}
                  </span>
                </div>

                {/* Add new conversion unit row */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-neutral-900/70 p-2.5 rounded-xl border border-neutral-800">
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Tên đơn vị</label>
                    <input
                      type="text"
                      placeholder="Thùng, Lốc..."
                      value={newConvName}
                      onChange={(e) => setNewConvName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Giá trị quy đổi</label>
                    <input
                      type="number"
                      min="2"
                      placeholder="24"
                      value={newConvRate}
                      onChange={(e) => setNewConvRate(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Giá bán (VND)</label>
                    <input
                      type="number"
                      step="1000"
                      placeholder="240000"
                      value={newConvPrice}
                      onChange={(e) => setNewConvPrice(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Mã vạch riêng</label>
                    <input
                      type="text"
                      placeholder="Mã vạch thùng"
                      value={newConvBarcode}
                      onChange={(e) => setNewConvBarcode(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddConversionUnit}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm ĐV</span>
                    </button>
                  </div>
                </div>

                {/* List existing conversion units */}
                {conversionUnits.length > 0 && (
                  <div className="space-y-1.5 divide-y divide-neutral-850 pt-1">
                    {conversionUnits.map((cu) => (
                      <div key={cu.id} className="flex items-center justify-between pt-1.5 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white">{cu.name}</span>
                          <span className="text-neutral-400 font-mono">
                            = {cu.conversionRate} {unit}
                          </span>
                          <span className="text-emerald-400 font-mono font-bold">
                            {formatCurrency(cu.price)}
                          </span>
                          {cu.barcode && (
                            <span className="text-[10px] text-neutral-500 font-mono">
                              ({cu.barcode})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveConversionUnit(cu.id || cu.unitName)}
                          className="p-1 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Xóa đơn vị quy đổi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="availCheck"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="rounded border-neutral-700 text-red-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="availCheck" className="text-xs text-neutral-300 font-medium cursor-pointer">
                  Đang mở bán tại quầy thu ngân (POS)
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
                >
                  {formSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Lưu sản phẩm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl cursor-pointer"
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
