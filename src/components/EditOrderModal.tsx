import React, { useState } from 'react';
import { Order, OrderItem, Product, DiningOption, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatNumber, formatInputCurrency, parseInputCurrency } from '@/src/lib/formatters';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Save,
  AlertTriangle,
  RotateCcw,
  Package,
  Layers,
  ArrowRight,
  Loader2,
  Edit3,
  User,
  Phone,
  FileText,
  UtensilsCrossed,
} from 'lucide-react';

interface EditOrderModalProps {
  order: Order;
  shopId: string;
  products: Product[];
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  shopId,
  products,
  onClose,
  onSuccess,
}) => {
  const { userProfile, user } = useAuth();

  // Basic info states
  const [customerName, setCustomerName] = useState(order.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone || '');
  const [diningOption, setDiningOption] = useState<DiningOption>(order.diningOption || 'takeaway');
  const [editReason, setEditReason] = useState('Chỉnh sửa theo yêu cầu khách');

  // Items state
  const [items, setItems] = useState<OrderItem[]>(
    order.items.map((it) => ({ ...it }))
  );

  // Discount state
  const initialDiscountType = order.discount > 0 && order.subtotal > 0 && Math.round((order.discount / order.subtotal) * 100) <= 100
    ? 'vnd'
    : 'vnd';
  const [discountType, setDiscountType] = useState<'vnd' | 'percent'>('vnd');
  const [discountValue, setDiscountValue] = useState<string>(
    order.discount > 0 ? formatInputCurrency(order.discount) : ''
  );

  // Add product dropdown
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Totals calculations
  const subtotal = items.reduce((acc, it) => acc + (it.totalPrice || 0), 0);

  const parsedDiscountInput =
    discountType === 'percent'
      ? parseFloat(discountValue) || 0
      : parseInputCurrency(discountValue);

  const calculatedDiscount =
    discountType === 'percent'
      ? Math.round(subtotal * (Math.min(100, Math.max(0, parsedDiscountInput)) / 100))
      : Math.min(subtotal, Math.max(0, parsedDiscountInput));

  const finalTotal = Math.max(0, subtotal - calculatedDiscount);

  // Calculate inventory deltas (New - Old)
  const inventoryDeltas: {
    productId: string;
    productName: string;
    unit: string;
    oldQty: number;
    newQty: number;
    delta: number; // >0 means deduct more from stock, <0 means refund back to stock
  }[] = [];

  // Group old items by product
  const oldProductQtyMap: Record<string, { name: string; unit: string; qty: number }> = {};
  for (const it of order.items) {
    const qty = it.unit === 'kg' ? (it.weightKg || 1) : it.quantity;
    if (!oldProductQtyMap[it.productId]) {
      oldProductQtyMap[it.productId] = { name: it.name, unit: it.unit, qty: 0 };
    }
    oldProductQtyMap[it.productId].qty += qty;
  }

  // Group new items by product
  const newProductQtyMap: Record<string, { name: string; unit: string; qty: number }> = {};
  for (const it of items) {
    const qty = it.unit === 'kg' ? (it.weightKg || 1) : it.quantity;
    if (!newProductQtyMap[it.productId]) {
      newProductQtyMap[it.productId] = { name: it.name, unit: it.unit, qty: 0 };
    }
    newProductQtyMap[it.productId].qty += qty;
  }

  // Combine all product IDs
  const allProductIds = Array.from(
    new Set([...Object.keys(oldProductQtyMap), ...Object.keys(newProductQtyMap)])
  );

  for (const pid of allProductIds) {
    const oldInfo = oldProductQtyMap[pid] || { name: '', unit: '', qty: 0 };
    const newInfo = newProductQtyMap[pid] || { name: '', unit: '', qty: 0 };
    const pName = newInfo.name || oldInfo.name || 'Món';
    const pUnit = newInfo.unit || oldInfo.unit || '';
    const delta = Math.round((newInfo.qty - oldInfo.qty) * 1000) / 1000;

    if (delta !== 0) {
      inventoryDeltas.push({
        productId: pid,
        productName: pName,
        unit: pUnit,
        oldQty: oldInfo.qty,
        newQty: newInfo.qty,
        delta,
      });
    }
  }

  // Item handlers
  const handleUpdateQty = (index: number, change: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      if (target.unit === 'kg') {
        const cur = target.weightKg || 1;
        const next = Math.max(0.1, Math.round((cur + change * 0.1) * 10) / 10);
        target.weightKg = next;
        target.totalPrice = Math.round(next * target.unitPrice);
      } else {
        const next = Math.max(1, target.quantity + change);
        target.quantity = next;
        target.totalPrice = next * target.unitPrice;
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleUpdateUnitPrice = (index: number, newPriceStr: string) => {
    const parsed = parseInputCurrency(newPriceStr);
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.unitPrice = parsed;
      const count = target.unit === 'kg' ? (target.weightKg || 1) : target.quantity;
      target.totalPrice = Math.round(count * parsed);
      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('Hóa đơn phải có ít nhất 1 món. Nếu muốn hủy đơn hoàn toàn, vui lòng dùng chức năng Hủy đơn.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddProduct = () => {
    if (!selectedProductIdToAdd) return;
    const p = products.find((prod) => prod.id === selectedProductIdToAdd);
    if (!p) return;

    // Check if item already in order
    const existingIndex = items.findIndex((it) => it.productId === p.id && it.unit !== 'kg');
    if (existingIndex >= 0) {
      handleUpdateQty(existingIndex, 1);
      setSelectedProductIdToAdd('');
      return;
    }

    const newItem: OrderItem = {
      productId: p.id,
      name: p.name,
      unit: p.unit,
      unitPrice: p.price,
      quantity: 1,
      weightKg: p.unit === 'kg' ? 1.0 : undefined,
      totalPrice: p.price,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProductIdToAdd('');
  };

  // Submit edit with atomic transaction
  const handleSaveEdit = async () => {
    if (!editReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do chỉnh sửa hóa đơn (để ghi nhận nhật ký kiểm toán).');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Hóa đơn không được để trống món.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const now = new Date().toISOString();
      const updatedOrderData: Order = {
        ...order,
        items,
        subtotal,
        discount: calculatedDiscount,
        finalTotal,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        diningOption,
        updatedAt: now,
        editedAt: now,
        editedBy: userProfile?.displayName || user?.email || 'Chủ quán',
        editReason: editReason.trim(),
      };

      await runTransaction(db, async (t) => {
        const orderRef = doc(db, 'shops', shopId, 'orders', order.id);

        // 1. Process inventory deltas
        for (const deltaItem of inventoryDeltas) {
          const productRef = doc(db, 'shops', shopId, 'products', deltaItem.productId);
          const pDoc = await t.get(productRef);

          if (pDoc.exists()) {
            const currentStock = pDoc.data().stockQuantity || 0;
            // If delta > 0 (item qty increased), we subtract delta from stock.
            // If delta < 0 (item qty decreased), we add |delta| back to stock.
            const newStock = Math.max(0, currentStock - deltaItem.delta);

            t.update(productRef, {
              stockQuantity: newStock,
              updatedAt: now,
            });

            // Write movement log
            const movId = 'mov_' + Math.random().toString(36).substring(2, 10);
            const movRef = doc(db, 'shops', shopId, 'inventoryMovements', movId);
            t.set(movRef, {
              productId: deltaItem.productId,
              productName: deltaItem.productName,
              type: deltaItem.delta > 0 ? 'sale' : 'in',
              quantity: -deltaItem.delta,
              reason: `Điều chỉnh hóa đơn ${order.orderCode}: ${deltaItem.delta > 0 ? 'Tăng số lượng' : 'Giảm/hoàn trả số lượng'} (${editReason.trim()})`,
              performedBy: userProfile?.displayName || user?.email || 'Chủ quán',
              createdAt: now,
            });
          }
        }

        // 2. Adjust customer points & totalSpent difference if customer linked
        const totalDiff = finalTotal - order.finalTotal;
        if (order.customerId && totalDiff !== 0) {
          const custRef = doc(db, 'shops', shopId, 'customers', order.customerId);
          const custDoc = await t.get(custRef);
          if (custDoc.exists()) {
            const cData = custDoc.data();
            const curSpent = cData.totalSpent || 0;
            const curPoints = cData.loyaltyPoints || 0;
            const pointsDelta = Math.floor(finalTotal / 10000) - Math.floor(order.finalTotal / 10000);

            t.update(custRef, {
              totalSpent: Math.max(0, curSpent + totalDiff),
              loyaltyPoints: Math.max(0, curPoints + pointsDelta),
              updatedAt: now,
            });
          }
        }

        // 3. Update the order document
        t.update(orderRef, {
          items: updatedOrderData.items,
          subtotal: updatedOrderData.subtotal,
          discount: updatedOrderData.discount,
          finalTotal: updatedOrderData.finalTotal,
          customerName: updatedOrderData.customerName || null,
          customerPhone: updatedOrderData.customerPhone || null,
          diningOption: updatedOrderData.diningOption,
          updatedAt: now,
          editedAt: now,
          editedBy: userProfile?.displayName || user?.email || 'Chủ quán',
          editReason: editReason.trim(),
        });
      });

      onSuccess(updatedOrderData);
    } catch (err: any) {
      console.error('Error saving edited order:', err);
      setErrorMsg(err.message || 'Không thể lưu chỉnh sửa. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Chỉnh Sửa Hóa Đơn Chuyên Sâu
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-800 text-amber-400 font-mono font-bold">
                  {order.orderCode}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Quyền hạn Chủ quán · Tự động cân đối hoàn/trừ tồn kho theo số lượng mới
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer & Dining Option */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
            <div>
              <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                Tên khách hàng:
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Khách lẻ..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-8 pr-2.5 py-1.5 text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                Số điện thoại:
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="09..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-8 pr-2.5 py-1.5 text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                Hình thức phục vụ:
              </label>
              <select
                value={diningOption}
                onChange={(e) => setDiningOption(e.target.value as DiningOption)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-hidden focus:border-amber-500"
              >
                <option value="takeaway">Mang về</option>
                <option value="dine_in">Tại quán</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                Danh Sách Món Trong Hóa Đơn ({items.length})
              </span>

              {/* Add item dropdown */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedProductIdToAdd}
                  onChange={(e) => setSelectedProductIdToAdd(e.target.value)}
                  className="bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-hidden focus:border-amber-500 max-w-[180px]"
                >
                  <option value="">+ Thêm món mới vào đơn...</option>
                  {products
                    .filter((p) => p.isAvailable)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatCurrency(p.price)})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!selectedProductIdToAdd}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-neutral-950 font-bold rounded-lg text-[11px] transition-colors"
                >
                  Thêm
                </button>
              </div>
            </div>

            <div className="bg-neutral-950 rounded-xl border border-neutral-800 divide-y divide-neutral-800/80 overflow-hidden">
              {items.map((it, idx) => (
                <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-xs truncate">{it.name}</div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                      <span>Đơn vị: {UNIT_LABELS[it.unit] || it.unit}</span>
                      <span>·</span>
                      <div className="flex items-center gap-1">
                        <span>Đơn giá:</span>
                        <input
                          type="text"
                          value={formatNumber(it.unitPrice)}
                          onChange={(e) => handleUpdateUnitPrice(idx, e.target.value)}
                          className="w-20 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-amber-300 font-bold text-right tabular-nums focus:outline-hidden"
                        />
                        <span>₫</span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 bg-neutral-900 px-2 py-1 rounded-lg border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, -1)}
                        className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center active:scale-95 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-extrabold text-white min-w-10 text-center font-mono text-xs tabular-nums">
                        {it.unit === 'kg' ? `${it.weightKg} kg` : it.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, 1)}
                        className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center active:scale-95 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div className="font-extrabold text-amber-400 tabular-nums text-xs">
                        {formatCurrency(it.totalPrice)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Xóa món khỏi đơn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Totals */}
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-neutral-300">
              <span>Tổng tiền hàng mới:</span>
              <span className="font-bold text-white tabular-nums">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-neutral-300 pt-1 border-t border-neutral-800/80">
              <div className="flex items-center gap-1.5">
                <span>Giảm giá:</span>
                <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('vnd');
                      setDiscountValue('');
                    }}
                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                      discountType === 'vnd' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400'
                    }`}
                  >
                    ₫
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('percent');
                      setDiscountValue('');
                    }}
                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                      discountType === 'percent' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={discountValue}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (discountType === 'percent') {
                      const num = parseInt(raw.replace(/[^0-9]/g, '')) || 0;
                      setDiscountValue(num > 100 ? '100' : num ? num.toString() : '');
                    } else {
                      setDiscountValue(formatInputCurrency(raw));
                    }
                  }}
                  className="w-24 bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-right text-xs text-amber-400 tabular-nums font-bold focus:outline-hidden"
                />
                <span className="text-[10px]">{discountType === 'percent' ? '%' : '₫'}</span>
                {discountType === 'percent' && calculatedDiscount > 0 && (
                  <span className="text-[10px] text-amber-400/80">
                    (-{formatCurrency(calculatedDiscount)})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-sm font-bold text-white">
              <span>Tổng thanh toán sau chỉnh sửa:</span>
              <div className="text-right">
                <span className="text-amber-400 font-extrabold text-base tabular-nums">
                  {formatCurrency(finalTotal)}
                </span>
                {finalTotal !== order.finalTotal && (
                  <div className="text-[10px] text-neutral-400 font-normal">
                    (Ban đầu: {formatCurrency(order.finalTotal)} · Chênh lệch:{' '}
                    <span className={finalTotal > order.finalTotal ? 'text-red-400' : 'text-emerald-400'}>
                      {finalTotal > order.finalTotal ? '+' : ''}
                      {formatCurrency(finalTotal - order.finalTotal)}
                    </span>
                    )
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INVENTORY DELTA PREVIEW */}
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white text-[11px]">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              <span>Dự Kiến Điều Chỉnh Kho Tự Động ({inventoryDeltas.length} món thay đổi)</span>
            </div>

            {inventoryDeltas.length === 0 ? (
              <p className="text-[11px] text-neutral-500 italic">
                Số lượng các món không thay đổi so với hóa đơn gốc (tồn kho giữ nguyên).
              </p>
            ) : (
              <div className="space-y-1.5">
                {inventoryDeltas.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 text-[11px]"
                  >
                    <div className="font-semibold text-neutral-200">
                      {d.productName}
                      <span className="text-neutral-500 font-normal ml-1.5">
                        ({d.oldQty} → {d.newQty} {UNIT_LABELS[d.unit] || d.unit})
                      </span>
                    </div>
                    <div>
                      {d.delta > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800 font-bold">
                          Trừ thêm kho -{d.delta} {UNIT_LABELS[d.unit] || d.unit}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-bold">
                          Hoàn trả lại kho +{Math.abs(d.delta)} {UNIT_LABELS[d.unit] || d.unit}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit Reason input (Mandatory audit trail) */}
          <div>
            <label className="text-[11px] font-bold text-neutral-300 block mb-1">
              Lý do chỉnh sửa hóa đơn (Bắt buộc):
            </label>
            <div className="relative">
              <FileText className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Nhập lý do chỉnh sửa (vd: Khách đổi món, sửa số lượng theo yêu cầu...)"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="py-2 px-4 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 font-semibold transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={isSaving}
            className="py-2.5 px-5 bg-linear-to-r from-red-700 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý tồn kho & lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu Hóa Đơn & Cập Nhật Kho</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
