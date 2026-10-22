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
import { Product, InventoryMovement, MovementType, UNIT_LABELS, Supplier, StockAudit, BatchItem } from '@/src/types';
import { formatDateTime, formatCurrency } from '@/src/lib/formatters';
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
  ClipboardCheck,
  Calendar,
  Scale,
  Barcode,
  Search,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { currentShop, user, userProfile, userRole } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'audit' | 'history'>('stock');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('in');
  const [inputQty, setInputQty] = useState('');
  const [reason, setReason] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [expDate, setExpDate] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stock Audit State
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [auditNote, setAuditNote] = useState('');
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState<string | null>(null);

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

        // Pre-fill audit counts
        setAuditCounts((prev) => {
          const next = { ...prev };
          list.forEach((p) => {
            if (next[p.id] === undefined) {
              next[p.id] = p.stockQuantity;
            }
          });
          return next;
        });
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

    // 4. Subscribe to stock audits
    const auditRef = collection(db, 'shops', currentShop.id, 'stockAudits');
    const auditQuery = query(auditRef, orderBy('createdAt', 'desc'));
    const unsubAudit = onSnapshot(auditQuery, (snap) => {
      const list: StockAudit[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<StockAudit, 'id'>) }));
      setAudits(list);
    });

    return () => {
      unsubProd();
      unsubMov();
      unsubSup();
      unsubAudit();
    };
  }, [currentShop?.id]);

  const openMovementModal = (pId?: string, type: MovementType = 'in') => {
    const targetProd = products.find((p) => p.id === (pId || products[0]?.id));
    setSelectedProductId(targetProd?.id || products[0]?.id || '');
    setMovementType(type);
    setInputQty('');
    setReason('');
    setSelectedSupplierId(suppliers[0]?.id || '');
    setUnitPrice(targetProd?.costPrice ? targetProd.costPrice.toString() : '');
    setPaidAmount('');
    const dStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    setBatchCode('L' + dStr + '-' + Math.floor(10 + Math.random() * 90));
    setExpDate('');
    setMfgDate(new Date().toISOString().slice(0, 10));
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
        const oldCost = pDoc.data().costPrice || 0;
        let delta = 0;
        let newStock = currentStock;
        let newCost = oldCost;

        if (movementType === 'in') {
          delta = qty;
          newStock = currentStock + qty;

          // WEIGHTED AVERAGE COST FORMULA:
          // C_new = (Q_curr * C_old + Q_in * P_in) / (Q_curr + Q_in)
          const inPrice = parseFloat(unitPrice) || 0;
          if (inPrice > 0) {
            const costMethod = pDoc.data().costMethod || currentShop?.enterpriseSettings?.costMethod || 'average';
            if (costMethod === 'average') {
              const totalStock = currentStock + qty;
              if (totalStock > 0) {
                newCost = Math.round(((Math.max(0, currentStock) * oldCost) + (qty * inPrice)) / totalStock);
              } else {
                newCost = inPrice;
              }
            }
          }
        } else if (movementType === 'out') {
          delta = -qty;
          newStock = Math.max(0, currentStock - qty);
        } else if (movementType === 'adjust') {
          delta = qty - currentStock;
          newStock = qty;
        }

        // Prepare updates for Product
        const productUpdates: Record<string, unknown> = {
          stockQuantity: newStock,
          updatedAt: now,
        };

        if (movementType === 'in' && parseFloat(unitPrice) > 0) {
          productUpdates.costPrice = newCost;
        }

        // Batch tracking update if batchCode and expDate provided
        if (movementType === 'in' && expDate) {
          const existingBatches: BatchItem[] = pDoc.data().batches || [];
          const newBatchItem: BatchItem = {
            id: 'batch_' + Date.now(),
            batchCode: batchCode.trim() || ('L' + new Date().toISOString().slice(2, 10).replace(/-/g, '')),
            mfgDate: mfgDate || undefined,
            expDate,
            quantity: qty,
            costPrice: parseFloat(unitPrice) || newCost,
            createdAt: now,
          };
          productUpdates.batches = [...existingBatches, newBatchItem];
          productUpdates.hasBatchTracking = true;
        }

        t.update(pRef, productUpdates);

        const movDocRef = doc(db, 'shops', currentShop.id, 'inventoryMovements', movId);
        t.set(movDocRef, {
          productId: selectedProductId,
          productName: targetProduct.name,
          type: movementType,
          quantity: delta,
          reason: reason.trim() || (movementType === 'in' ? 'Nhập kho hàng' : movementType === 'out' ? 'Xuất hao hụt/hỏng' : 'Kiểm kê định kỳ'),
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

  // Stock Audit balancing logic
  const handlePerformStockAudit = async () => {
    if (!currentShop?.id || !user || !isManagerOrOwner) return;

    setAuditSubmitting(true);
    setAuditFeedback(null);

    const now = new Date().toISOString();
    const auditId = 'audit_' + Date.now();
    const itemsToBalance: {
      productId: string;
      productName: string;
      systemQuantity: number;
      actualQuantity: number;
      difference: number;
      costPrice: number;
    }[] = [];

    products.forEach((p) => {
      const actual = auditCounts[p.id] !== undefined ? auditCounts[p.id] : p.stockQuantity;
      const diff = actual - p.stockQuantity;
      if (diff !== 0) {
        itemsToBalance.push({
          productId: p.id,
          productName: p.name,
          systemQuantity: p.stockQuantity,
          actualQuantity: actual,
          difference: diff,
          costPrice: p.costPrice || 0,
        });
      }
    });

    if (itemsToBalance.length === 0) {
      setAuditFeedback('Số lượng thực tế khớp 100% với tồn hệ thống, không có mục nào cần cân bằng.');
      setAuditSubmitting(false);
      setTimeout(() => setAuditFeedback(null), 4000);
      return;
    }

    try {
      await runTransaction(db, async (t) => {
        // 1. Update all products
        for (const item of itemsToBalance) {
          const pRef = doc(db, 'shops', currentShop.id, 'products', item.productId);
          t.update(pRef, {
            stockQuantity: item.actualQuantity,
            updatedAt: now,
          });

          // 2. Create inventory movement record for audit adjustment
          const movRef = doc(collection(db, 'shops', currentShop.id, 'inventoryMovements'));
          t.set(movRef, {
            productId: item.productId,
            productName: item.productName,
            type: 'adjust',
            quantity: item.difference,
            reason: `Cân bằng kiểm kho: ${item.difference > 0 ? 'Thừa' : 'Thiếu'} ${Math.abs(item.difference)}`,
            performedBy: userProfile?.displayName || user.email?.split('@')[0] || 'Quản lý',
            createdAt: now,
          });
        }

        // 3. Save StockAudit record
        const auditRef = doc(db, 'shops', currentShop.id, 'stockAudits', auditId);
        t.set(auditRef, {
          id: auditId,
          code: 'KK' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900),
          auditDate: now,
          performedBy: userProfile?.displayName || user.email?.split('@')[0] || 'Quản lý',
          status: 'balanced',
          items: itemsToBalance,
          notes: auditNote.trim() || 'Kiểm kê và cân bằng kho định kỳ',
          createdAt: now,
        });
      });

      setAuditFeedback(`Đã cân bằng kho thành công cho ${itemsToBalance.length} mặt hàng có chênh lệch!`);
      setAuditNote('');
      setTimeout(() => setAuditFeedback(null), 5000);
    } catch (err) {
      console.error(err);
      setAuditFeedback('Lỗi khi thực hiện cân bằng kiểm kho.');
    } finally {
      setAuditSubmitting(false);
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
      <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 max-w-md overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`py-1.5 px-3 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'stock'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Tồn kho ({products.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`py-1.5 px-3 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'audit'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-emerald-400" />
          <span>Kiểm kho & Cân bằng</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-1.5 px-3 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'history'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4 text-blue-400" />
          <span>Nhật ký kho ({movements.length})</span>
        </button>
      </div>

      {auditFeedback && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{auditFeedback}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải dữ liệu kho...
        </div>
      ) : activeTab === 'stock' ? (
        /* TAB 1: STOCK TABLE */
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
                    <th className="py-3 px-4">Tên mặt hàng & Mã</th>
                    <th className="py-3 px-4">Nhóm & Vị trí</th>
                    <th className="py-3 px-4 text-center">Đơn vị</th>
                    <th className="py-3 px-4 text-right">Giá vốn (TB)</th>
                    <th className="py-3 px-4 text-center">Tồn thực tế</th>
                    <th className="py-3 px-4">Lô & Hạn sử dụng (FEFO)</th>
                    <th className="py-3 px-4 text-center">Tình trạng</th>
                    {isManagerOrOwner && <th className="py-3 px-4 text-right">Điều chỉnh</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {products.map((item) => {
                    const isLow = item.stockQuantity <= (item.minStockAlert || 5);
                    const now = new Date();
                    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return (
                      <tr key={item.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{item.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400 font-mono">
                            {item.code && <span>Mã: {item.code}</span>}
                            {item.barcode && (
                              <span className="flex items-center gap-0.5 text-amber-400/90 bg-amber-950/40 px-1 py-0.2 rounded border border-amber-900/40">
                                <Barcode className="w-2.5 h-2.5" /> {item.barcode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          <div>{item.category}</div>
                          {item.location && (
                            <div className="text-[10px] text-neutral-400 mt-0.5">Vị trí: {item.location}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-amber-400 font-medium">
                          {UNIT_LABELS[item.unit] || item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-300">
                          {item.costPrice ? formatCurrency(item.costPrice) : 'Chưa có'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-sm font-extrabold tabular-nums font-mono px-2 py-0.5 rounded ${
                              isLow
                                ? 'text-red-300 bg-red-950/80 border border-red-800'
                                : 'text-neutral-100 bg-neutral-950 border border-neutral-800'
                            }`}
                          >
                            {item.stockQuantity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {item.batches && item.batches.length > 0 ? (
                            <div className="space-y-1">
                              {item.batches.slice(0, 2).map((b) => {
                                const exp = new Date(b.expDate);
                                const isExpired = exp < now;
                                const isNear = exp <= nextMonth && !isExpired;
                                return (
                                  <div
                                    key={b.id}
                                    className={`text-[10px] px-2 py-0.5 rounded border font-mono flex items-center justify-between gap-1.5 ${
                                      isExpired
                                        ? 'bg-red-950 text-red-300 border-red-800'
                                        : isNear
                                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                                        : 'bg-neutral-950 text-neutral-300 border-neutral-800'
                                    }`}
                                  >
                                    <span>{b.batchCode}: {b.expDate}</span>
                                    <span>({b.quantity})</span>
                                  </div>
                                );
                              })}
                              {item.batches.length > 2 && (
                                <div className="text-[9px] text-neutral-500">
                                  +{item.batches.length - 2} lô khác
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-600 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isLow ? (
                            <span className="text-[10px] font-bold text-red-400 bg-red-950/80 border border-red-800/60 rounded px-2 py-0.5 inline-block">
                              Sắp hết hàng
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded px-2 py-0.5 inline-block">
                              Đủ tồn kho
                            </span>
                          )}
                        </td>
                        {isManagerOrOwner && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openMovementModal(item.id, 'adjust')}
                              className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
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
      ) : activeTab === 'audit' ? (
        /* TAB 2: STOCK AUDITING & RECONCILIATION */
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  Phiếu Kiểm Kê & Cân Bằng Tồn Kho Thực Tế
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Nhập số lượng đếm thực tế tại cửa hàng; hệ thống tự tính chênh lệch và cập nhật số dư kho
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePerformStockAudit}
                  disabled={auditSubmitting}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {auditSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Cân bằng kho ngay</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Ghi chú đợt kiểm kê</label>
              <input
                type="text"
                placeholder="Ví dụ: Kiểm kê định kỳ cuối tháng, Kiểm kê đột xuất ca sáng..."
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
              />
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Sản phẩm</th>
                    <th className="py-2.5 px-3">Đơn vị</th>
                    <th className="py-2.5 px-3 text-center">Tồn hệ thống</th>
                    <th className="py-2.5 px-3 text-center w-36">Thực tế kiểm đếm</th>
                    <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                    <th className="py-2.5 px-3 text-right">Giá trị chênh (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-200">
                  {products.map((p) => {
                    const actual = auditCounts[p.id] !== undefined ? auditCounts[p.id] : p.stockQuantity;
                    const diff = actual - p.stockQuantity;
                    const diffVal = diff * (p.costPrice || 0);
                    return (
                      <tr key={p.id} className="hover:bg-neutral-850/50">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          <div>{p.name}</div>
                          {p.code && <div className="text-[10px] text-neutral-500 font-mono">{p.code}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">
                          {UNIT_LABELS[p.unit] || p.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold tabular-nums text-neutral-300">
                          {p.stockQuantity}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={actual}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setAuditCounts((prev) => ({ ...prev, [p.id]: val }));
                            }}
                            className="w-24 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-hidden focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          {diff === 0 ? (
                            <span className="text-neutral-500">Khớp</span>
                          ) : diff > 0 ? (
                            <span className="text-emerald-400">+{diff} (Thừa)</span>
                          ) : (
                            <span className="text-red-400">{diff} (Thiếu)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {diff === 0 ? (
                            <span className="text-neutral-500">0 ₫</span>
                          ) : (
                            <span className={diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {formatCurrency(diffVal)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Past Audits List */}
          {audits.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-400" />
                Lịch sử các đợt kiểm kê trước ({audits.length})
              </h4>
              <div className="space-y-2">
                {audits.map((a) => (
                  <div key={a.id} className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{a.code}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.2 rounded border border-emerald-800">
                          Đã cân bằng
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        Ngày: {formatDateTime(a.auditDate || a.createdAt)} · Thực hiện: {a.performedBy} · {a.items?.length || 0} mục điều chỉnh
                      </div>
                      {a.notes && <div className="text-[11px] text-neutral-500 mt-0.5">{a.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAB 3: HISTORY LOG TABLE */
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
                      <td className="py-3 px-4 text-neutral-400 tabular-nums font-mono">
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
                        className={`py-3 px-4 text-right font-bold tabular-nums font-mono ${
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
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                Ghi nhận biến động kho
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs">
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
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
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
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
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
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white tabular-nums font-mono focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {movementType === 'in' && (
                <div className="space-y-3 bg-neutral-950/80 p-3.5 rounded-2xl border border-neutral-800">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                    <Truck className="w-4 h-4" /> Thông tin Nhà cung cấp & Đơn giá nhập
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Nhà cung cấp
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="">-- Mua lẻ / Không có NCC --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Nợ: {(s.debt || 0).toLocaleString('vi-VN')} ₫)
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
                        step="1000"
                        placeholder="0"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Đã thanh toán (₫)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Batch Tracking fields */}
                  <div className="pt-2 border-t border-neutral-800 space-y-2">
                    <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Thông tin Lô sản xuất & Hạn sử dụng (Tùy chọn)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-0.5">Mã số lô</label>
                        <input
                          type="text"
                          placeholder="L2410-01"
                          value={batchCode}
                          onChange={(e) => setBatchCode(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-0.5">Hạn sử dụng (Exp Date)</label>
                        <input
                          type="date"
                          value={expDate}
                          onChange={(e) => setExpDate(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
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
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
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
                  className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl cursor-pointer"
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
