import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Supplier, PurchaseInvoice, Product, UNIT_LABELS } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import {
  Truck,
  Plus,
  Search,
  Phone,
  MapPin,
  User,
  Trash2,
  Edit,
  DollarSign,
  FileText,
  AlertCircle,
  Boxes,
  X,
  Check,
  CreditCard,
  Copy,
  Receipt,
  TrendingDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const { currentShop, user, userProfile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'suppliers' | 'invoices'>('suppliers');

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    address: '',
    debt: 0,
    notes: '',
  });

  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: '',
    productId: '',
    productName: '',
    quantity: 1,
    unit: 'kg',
    price: 0,
    paidAmount: 0,
    notes: '',
  });

  // Settle Debt Modal
  const [settleDebtSupplier, setSettleDebtSupplier] = useState<Supplier | null>(null);
  const [settleDebtAmount, setSettleDebtAmount] = useState('');
  const [settleDebtNote, setSettleDebtNote] = useState('');
  const [settlingDebt, setSettlingDebt] = useState(false);

  // Detail Modal
  const [selectedSupplierForDetail, setSelectedSupplierForDetail] = useState<Supplier | null>(null);

  // Copy feedback
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch suppliers
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(collection(db, 'shops', currentShop.id, 'suppliers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Supplier[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      setSuppliers(list);
    });
    return () => unsub();
  }, [currentShop?.id]);

  // Fetch invoices
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(collection(db, 'shops', currentShop.id, 'purchaseInvoices'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: PurchaseInvoice[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PurchaseInvoice);
      });
      setInvoices(list);
    });
    return () => unsub();
  }, [currentShop?.id]);

  // Fetch products for stock extraction & selection
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(collection(db, 'shops', currentShop.id, 'products'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
      setProducts(list);
    });
    return () => unsub();
  }, [currentShop?.id]);

  const handleSelectProduct = (pId: string) => {
    const p = products.find((item) => item.id === pId);
    if (p) {
      setInvoiceForm({
        ...invoiceForm,
        productId: p.id,
        productName: p.name,
        unit: p.unit,
        price: p.costPrice || p.price || 0,
      });
    } else {
      setInvoiceForm({
        ...invoiceForm,
        productId: '',
        productName: '',
        unit: 'kg',
        price: 0,
      });
    }
  };

  const handleCopyPhone = (e: React.MouseEvent, phone: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !supplierForm.name.trim()) {
      alert('Vui lòng nhập tên nhà cung cấp');
      return;
    }

    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'shops', currentShop.id, 'suppliers', editingSupplier.id), {
          name: supplierForm.name.trim(),
          contactPerson: supplierForm.contactPerson.trim(),
          phone: supplierForm.phone.trim(),
          address: supplierForm.address.trim(),
          debt: Number(supplierForm.debt) || 0,
          notes: supplierForm.notes.trim(),
        });
        if (selectedSupplierForDetail?.id === editingSupplier.id) {
          setSelectedSupplierForDetail({
            ...selectedSupplierForDetail,
            name: supplierForm.name.trim(),
            contactPerson: supplierForm.contactPerson.trim(),
            phone: supplierForm.phone.trim(),
            address: supplierForm.address.trim(),
            debt: Number(supplierForm.debt) || 0,
            notes: supplierForm.notes.trim(),
          });
        }
      } else {
        await addDoc(collection(db, 'shops', currentShop.id, 'suppliers'), {
          name: supplierForm.name.trim(),
          contactPerson: supplierForm.contactPerson.trim(),
          phone: supplierForm.phone.trim(),
          address: supplierForm.address.trim(),
          debt: Number(supplierForm.debt) || 0,
          notes: supplierForm.notes.trim(),
          createdAt: new Date().toISOString(),
        });
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', contactPerson: '', phone: '', address: '', debt: 0, notes: '' });
    } catch (err) {
      console.error(err);
      alert('Lỗi lưu nhà cung cấp');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!currentShop?.id) return;
    try {
      await deleteDoc(doc(db, 'shops', currentShop.id, 'suppliers', id));
      setDeleteConfirmId(null);
      if (selectedSupplierForDetail?.id === id) {
        setSelectedSupplierForDetail(null);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi xóa nhà cung cấp');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !invoiceForm.supplierId) {
      alert('Vui lòng chọn nhà cung cấp');
      return;
    }

    const supplier = suppliers.find((s) => s.id === invoiceForm.supplierId);
    if (!supplier) return;

    const qty = Number(invoiceForm.quantity) || 1;
    const prc = Number(invoiceForm.price) || 0;
    const totalAmount = qty * prc;
    const paidAmount = Number(invoiceForm.paidAmount) || 0;
    const debtAmount = Math.max(0, totalAmount - paidAmount);
    const now = new Date().toISOString();

    try {
      await runTransaction(db, async (t) => {
        // 1. Add purchase invoice
        const invRef = doc(collection(db, 'shops', currentShop.id, 'purchaseInvoices'));
        t.set(invRef, {
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: [
            {
              productName: invoiceForm.productName || 'Nguyên liệu nhập',
              quantity: qty,
              unit: invoiceForm.unit,
              price: prc,
            },
          ],
          totalAmount,
          paidAmount,
          debtAmount,
          date: now,
          notes: invoiceForm.notes,
          createdAt: now,
        });

        // 2. Update supplier debt
        const newDebt = (supplier.debt || 0) + debtAmount;
        const supRef = doc(db, 'shops', currentShop.id, 'suppliers', supplier.id);
        t.update(supRef, { debt: newDebt });

        // 3. If product selected, auto-update inventory stock & movement
        if (invoiceForm.productId) {
          const prodRef = doc(db, 'shops', currentShop.id, 'products', invoiceForm.productId);
          const prodDoc = await t.get(prodRef);
          if (prodDoc.exists()) {
            const currentStock = prodDoc.data().stockQuantity || 0;
            t.update(prodRef, {
              stockQuantity: currentStock + qty,
              costPrice: prc > 0 ? prc : prodDoc.data().costPrice,
              updatedAt: now,
            });

            const movRef = doc(collection(db, 'shops', currentShop.id, 'inventoryMovements'));
            t.set(movRef, {
              productId: invoiceForm.productId,
              productName: invoiceForm.productName,
              type: 'in',
              quantity: qty,
              reason: `Nhập từ NCC ${supplier.name}: ${invoiceForm.notes || 'Hóa đơn nhập kho'}`,
              performedBy: userProfile?.displayName || user?.email?.split('@')[0] || 'Quản lý',
              createdAt: now,
            });
          }
        }
      });

      setShowInvoiceModal(false);
      setInvoiceForm({
        supplierId: '',
        productId: '',
        productName: '',
        quantity: 1,
        unit: 'kg',
        price: 0,
        paidAmount: 0,
        notes: '',
      });
    } catch (err) {
      console.error(err);
      alert('Lỗi tạo hóa đơn nhập hàng');
    }
  };

  const handleSettleSupplierDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop?.id || !settleDebtSupplier) return;

    const amount = parseFloat(settleDebtAmount) || 0;
    if (amount <= 0) {
      alert('Vui lòng nhập số tiền thanh toán nợ hợp lệ');
      return;
    }

    try {
      setSettlingDebt(true);
      const currentDebt = settleDebtSupplier.debt || 0;
      const newDebt = Math.max(0, currentDebt - amount);

      await updateDoc(doc(db, 'shops', currentShop.id, 'suppliers', settleDebtSupplier.id), {
        debt: newDebt,
      });

      if (selectedSupplierForDetail?.id === settleDebtSupplier.id) {
        setSelectedSupplierForDetail({
          ...selectedSupplierForDetail,
          debt: newDebt,
        });
      }

      setSettleDebtSupplier(null);
      setSettleDebtAmount('');
      setSettleDebtNote('');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi ghi nhận trả nợ nhà cung cấp');
    } finally {
      setSettlingDebt(false);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm) ||
      s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebt = suppliers.reduce((sum, s) => sum + (s.debt || 0), 0);
  const totalPurchaseSum = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  // Invoices for currently selected supplier
  const supplierInvoices = selectedSupplierForDetail
    ? invoices.filter((inv) => inv.supplierId === selectedSupplierForDetail.id)
    : [];

  return (
    <div className="p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 p-4 sm:p-6 rounded-2xl border border-neutral-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-950 border border-amber-800/60 text-amber-400 shadow-inner shrink-0">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                Quản lý Nhà cung cấp & Công nợ
              </h1>
              <p className="text-[11px] sm:text-xs text-neutral-400">
                Đối tác nguyên vật liệu, theo dõi lịch sử nhập hàng và quản lý công nợ phải trả
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingSupplier(null);
              setSupplierForm({ name: '', contactPerson: '', phone: '', address: '', debt: 0, notes: '' });
              setShowSupplierModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhà cung cấp</span>
          </button>
          <button
            onClick={() => {
              if (suppliers.length === 0) {
                alert('Vui lòng thêm ít nhất một nhà cung cấp trước khi tạo hóa đơn nhập hàng.');
                return;
              }
              setInvoiceForm({
                supplierId: suppliers[0]?.id || '',
                productId: '',
                productName: '',
                quantity: 1,
                unit: 'kg',
                price: 0,
                paidAmount: 0,
                notes: '',
              });
              setShowInvoiceModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all border border-red-600/50 active:scale-95"
          >
            <FileText className="w-4 h-4 text-amber-300" />
            <span>Nhập hàng mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Responsive 3-grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-neutral-400">Tổng nhà cung cấp</p>
            <h3 className="text-lg sm:text-2xl font-black text-white">{suppliers.length} đối tác</h3>
            <p className="text-[10px] sm:text-[11px] text-amber-400 font-semibold truncate">
              Đang hợp tác
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-neutral-400">Công nợ phải trả</p>
            <h3 className="text-sm sm:text-xl font-black text-red-400 truncate">
              {formatCurrency(totalDebt)}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Chưa thanh toán</p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-red-950/40 text-red-400 border border-red-800/50 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-neutral-400">Hóa đơn nhập kho</p>
            <h3 className="text-lg sm:text-2xl font-black text-emerald-400">
              {invoices.length} phiếu
            </h3>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Tổng {formatCurrency(totalPurchaseSum)}
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'suppliers'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Danh sách Nhà cung cấp ({suppliers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Lịch sử Nhập hàng ({invoices.length})</span>
        </button>
      </div>

      {/* TAB 1: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm theo tên nhà cung cấp, số điện thoại, người liên hệ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Supplier List: Mobile Touch Cards + Desktop Table */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            {filteredSuppliers.length === 0 ? (
              <div className="p-10 sm:p-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <Truck className="w-7 h-7" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">Chưa có nhà cung cấp nào</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Hãy thêm nhà cung cấp thịt vịt, than nướng, hộp xốp, gia vị... để quản lý chi phí và công nợ.
                </p>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" /> Thêm nhà cung cấp ngay
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Card View (< md) */}
                <div className="block md:hidden divide-y divide-neutral-800/80">
                  {filteredSuppliers.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 space-y-3 hover:bg-neutral-800/30 transition-colors active:bg-neutral-800/50"
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={() => setSelectedSupplierForDetail(s)}
                          className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                        >
                          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 shadow">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-white text-xs sm:text-sm truncate">
                              {s.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                              {s.contactPerson && (
                                <span className="flex items-center gap-1 text-neutral-300">
                                  <User className="w-3 h-3 text-neutral-500" />
                                  {s.contactPerson}
                                </span>
                              )}
                              {s.phone && (
                                <span className="font-mono text-amber-400">{s.phone}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Direct Call & Copy buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {s.phone && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => handleCopyPhone(e, s.phone, s.id)}
                                className="w-7 h-7 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center"
                                title="Chép SĐT"
                              >
                                {copiedPhoneId === s.id ? (
                                  <span className="text-[9px] text-emerald-400 font-bold">✓</span>
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <a
                                href={`tel:${s.phone}`}
                                className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center active:scale-95 transition-transform"
                                title="Gọi điện"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Financial info */}
                      <div
                        onClick={() => setSelectedSupplierForDetail(s)}
                        className="grid grid-cols-2 gap-2 bg-neutral-950/80 border border-neutral-800/80 rounded-xl p-2.5 text-center cursor-pointer"
                      >
                        <div>
                          <span className="text-[10px] text-neutral-400 block">Công nợ phải trả</span>
                          <span
                            className={`text-xs font-bold block ${
                              (s.debt || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {formatCurrency(s.debt || 0)}
                          </span>
                        </div>
                        <div className="border-l border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block">Đơn nhập hàng</span>
                          <span className="text-xs font-bold text-amber-400 block">
                            {invoices.filter((inv) => inv.supplierId === s.id).length} phiếu
                          </span>
                        </div>
                      </div>

                      {/* Footer actions */}
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-neutral-400 truncate max-w-[170px]">
                          <MapPin className="w-3 h-3 inline mr-1 text-neutral-500" />
                          {s.address || s.notes || 'Chưa cập nhật địa chỉ'}
                        </p>

                        <div className="flex items-center gap-1.5">
                          {(s.debt || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSettleDebtSupplier(s);
                                setSettleDebtAmount(String(s.debt));
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/20 active:scale-95"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Trả nợ</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedSupplierForDetail(s)}
                            className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-semibold flex items-center gap-1"
                          >
                            <span>Xem</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSupplier(s);
                              setSupplierForm({
                                name: s.name,
                                contactPerson: s.contactPerson,
                                phone: s.phone,
                                address: s.address,
                                debt: s.debt || 0,
                                notes: s.notes || '',
                              });
                              setShowSupplierModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
                            title="Sửa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(s.id)}
                            className="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:text-white border border-red-900/60"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase bg-neutral-950/60">
                        <th className="py-3.5 px-5">Nhà cung cấp</th>
                        <th className="py-3.5 px-4">Người liên hệ</th>
                        <th className="py-3.5 px-4">Số điện thoại</th>
                        <th className="py-3.5 px-4">Địa chỉ</th>
                        <th className="py-3.5 px-4 text-right">Công nợ hiện tại</th>
                        <th className="py-3.5 px-5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-xs">
                      {filteredSuppliers.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedSupplierForDetail(s)}
                          className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-white group-hover:text-amber-400 transition-colors">
                                  {s.name}
                                </div>
                                {s.notes && (
                                  <div className="text-[11px] text-neutral-500 truncate max-w-xs">
                                    {s.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-300">
                            {s.contactPerson ? (
                              <span className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-neutral-500" />
                                {s.contactPerson}
                              </span>
                            ) : (
                              '---'
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-neutral-300">
                            {s.phone ? (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${s.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-amber-400 hover:underline flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" />
                                  {s.phone}
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyPhone(e, s.phone, s.id)}
                                  className="text-neutral-500 hover:text-white"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              '---'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-400 max-w-xs truncate">
                            {s.address ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                {s.address}
                              </span>
                            ) : (
                              '---'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold tabular-nums">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs ${
                                (s.debt || 0) > 0 ? 'bg-red-950/60 text-red-400 border border-red-900/60' : 'text-emerald-400'
                              }`}
                            >
                              {formatCurrency(s.debt || 0)}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {(s.debt || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettleDebtSupplier(s);
                                    setSettleDebtAmount(String(s.debt));
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold hover:bg-amber-500/20"
                                >
                                  Trả nợ
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupplier(s);
                                  setSupplierForm({
                                    name: s.name,
                                    contactPerson: s.contactPerson,
                                    phone: s.phone,
                                    address: s.address,
                                    debt: s.debt || 0,
                                    notes: s.notes || '',
                                  });
                                  setShowSupplierModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700"
                                title="Sửa"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(s.id)}
                                className="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:text-white border border-red-900/60"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE INVOICES */}
      {activeTab === 'invoices' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          {invoices.length === 0 ? (
            <div className="p-10 sm:p-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <Receipt className="w-7 h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">Chưa có hóa đơn nhập hàng nào</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Khi thực hiện nhập hàng từ nhà cung cấp, thông tin đơn giá, số lượng và công nợ sẽ được lưu lại tại đây.
              </p>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow"
              >
                <FileText className="w-4 h-4" /> Tạo phiếu nhập hàng
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase bg-neutral-950/60">
                    <th className="py-3.5 px-5">Thời gian</th>
                    <th className="py-3.5 px-4">Nhà cung cấp</th>
                    <th className="py-3.5 px-4">Mặt hàng nhập</th>
                    <th className="py-3.5 px-4 text-right">Tổng tiền</th>
                    <th className="py-3.5 px-4 text-right">Đã thanh toán</th>
                    <th className="py-3.5 px-4 text-right">Còn nợ lại</th>
                    <th className="py-3.5 px-4">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-xs">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-5 text-neutral-400 tabular-nums font-mono text-[11px]">
                        {formatDateTime(inv.createdAt || inv.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {inv.supplierName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {inv.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-neutral-200">
                              <span className="font-semibold text-amber-400">
                                {item.quantity} {UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS] || item.unit}
                              </span>
                              <span>{item.productName}</span>
                              <span className="text-[10px] text-neutral-500">
                                (@ {formatCurrency(item.price)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white tabular-nums">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 tabular-nums">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span className={inv.debtAmount > 0 ? 'text-red-400' : 'text-neutral-500'}>
                          {inv.debtAmount > 0 ? formatCurrency(inv.debtAmount) : '0 ₫'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-400 text-[11px]">
                        {inv.notes || '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800 bg-neutral-950 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>{editingSupplier ? 'Sửa thông tin nhà cung cấp' : 'Thêm nhà cung cấp mới'}</span>
              </h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Tên nhà cung cấp (*)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Trang trại Vịt Vân Đình, Lò than hoa Bến Tre..."
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Người liên hệ
                  </label>
                  <input
                    type="text"
                    placeholder="Anh Nam, Chị Hương..."
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="0987654321"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  placeholder="Xã/Huyện/Tỉnh hoặc địa chỉ cơ sở..."
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Công nợ ban đầu (₫)
                </label>
                <input
                  type="number"
                  min="0"
                  value={supplierForm.debt}
                  onChange={(e) => setSupplierForm({ ...supplierForm, debt: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Ghi chú
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú điều khoản thanh toán, lịch giao hàng..."
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingSupplier ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Purchase Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800 bg-neutral-950 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Tạo hóa đơn nhập hàng từ Nhà cung cấp</span>
              </h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Chọn nhà cung cấp (*)
                </label>
                <select
                  required
                  value={invoiceForm.supplierId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, supplierId: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Nợ hiện tại: {formatCurrency(s.debt || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Select Product from Shop Products */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5" /> Chọn nhanh mặt hàng trong kho
                  </span>
                  <span className="text-[10px] text-neutral-500">Tự động tăng tồn kho</span>
                </div>
                <select
                  value={invoiceForm.productId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Hoặc nhập tay tên nguyên liệu bên dưới --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Tồn: {p.stockQuantity} {UNIT_LABELS[p.unit] || p.unit} - Vốn: {formatCurrency(p.costPrice || p.price)})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-400 block mb-0.5">
                      Tên mặt hàng / Nguyên liệu (*)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Vịt sống loại 1"
                      value={invoiceForm.productName}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, productName: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-400 block mb-0.5">
                      Đơn vị tính
                    </label>
                    <input
                      type="text"
                      placeholder="kg, con, bao, hộp..."
                      value={invoiceForm.unit}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, unit: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Số lượng nhập (*)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={invoiceForm.quantity}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, quantity: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Đơn giá nhập (₫) (*)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={invoiceForm.price}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, price: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Số tiền thanh toán ngay (₫)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={invoiceForm.paidAmount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Financial summary */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Tổng tiền đơn nhập:</span>
                  <strong className="text-emerald-400">
                    {formatCurrency(Number(invoiceForm.quantity) * Number(invoiceForm.price))}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Đã thanh toán:</span>
                  <strong className="text-white">
                    {formatCurrency(Number(invoiceForm.paidAmount) || 0)}
                  </strong>
                </div>
                <div className="flex justify-between border-t border-neutral-800/80 pt-1">
                  <span className="text-neutral-400">Ghi nhận vào công nợ NCC:</span>
                  <strong className="text-red-400">
                    {formatCurrency(
                      Math.max(
                        0,
                        Number(invoiceForm.quantity) * Number(invoiceForm.price) - (Number(invoiceForm.paidAmount) || 0)
                      )
                    )}
                  </strong>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Ghi chú hóa đơn
                </label>
                <input
                  type="text"
                  placeholder="Giao hàng đợt 1, thanh toán sau..."
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Xác nhận nhập kho</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Detail & Invoices History Modal */}
      {selectedSupplierForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-800 bg-neutral-950 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-base shrink-0 shadow">
                  {selectedSupplierForDetail.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {selectedSupplierForDetail.name}
                  </h3>
                  {selectedSupplierForDetail.phone && (
                    <a
                      href={`tel:${selectedSupplierForDetail.phone}`}
                      className="text-xs text-amber-400 font-mono hover:underline inline-flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedSupplierForDetail.phone}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedSupplierForDetail.phone && (
                  <a
                    href={`tel:${selectedSupplierForDetail.phone}`}
                    className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 hover:text-white"
                    title="Gọi điện"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setSelectedSupplierForDetail(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-neutral-400 block">Công nợ hiện tại</span>
                  <span
                    className={`text-xs sm:text-sm font-bold block mt-0.5 ${
                      (selectedSupplierForDetail.debt || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(selectedSupplierForDetail.debt || 0)}
                  </span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-neutral-400 block">Đơn nhập hàng</span>
                  <span className="text-xs sm:text-sm font-bold text-amber-400 block mt-0.5">
                    {supplierInvoices.length} đơn
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-neutral-400 block">Tổng tiền đã nhập</span>
                  <span className="text-xs sm:text-sm font-bold text-white block mt-0.5">
                    {formatCurrency(supplierInvoices.reduce((s, it) => s + (it.totalAmount || 0), 0))}
                  </span>
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-1.5 text-xs">
                {selectedSupplierForDetail.contactPerson && (
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="text-neutral-300">
                      Người liên hệ: <strong>{selectedSupplierForDetail.contactPerson}</strong>
                    </span>
                  </div>
                )}
                {selectedSupplierForDetail.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <span className="text-neutral-300">{selectedSupplierForDetail.address}</span>
                  </div>
                )}
                {selectedSupplierForDetail.notes && (
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 text-neutral-300 text-[11px] italic">
                    * {selectedSupplierForDetail.notes}
                  </div>
                )}
              </div>

              {/* Action buttons inside detail */}
              <div className="flex items-center gap-2">
                {(selectedSupplierForDetail.debt || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettleDebtSupplier(selectedSupplierForDetail);
                      setSettleDebtAmount(String(selectedSupplierForDetail.debt));
                    }}
                    className="flex-1 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Thanh toán trả nợ NCC</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const s = selectedSupplierForDetail;
                    setSelectedSupplierForDetail(null);
                    setInvoiceForm({
                      supplierId: s.id,
                      productId: '',
                      productName: '',
                      quantity: 1,
                      unit: 'kg',
                      price: 0,
                      paidAmount: 0,
                      notes: '',
                    });
                    setShowInvoiceModal(true);
                  }}
                  className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tạo đơn nhập hàng</span>
                </button>
              </div>

              {/* Invoices list */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span>Lịch sử các lần nhập hàng ({supplierInvoices.length})</span>
                </h4>

                {supplierInvoices.length === 0 ? (
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 text-center text-xs text-neutral-500">
                    Chưa có lịch sử nhập hàng nào từ nhà cung cấp này.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {supplierInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {inv.items?.map((it) => `${it.quantity} ${it.unit} ${it.productName}`).join(', ')}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {formatDateTime(inv.createdAt || inv.date)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-emerald-400 block">
                            {formatCurrency(inv.totalAmount)}
                          </span>
                          <span className="text-[10px] text-red-400 block">
                            {inv.debtAmount > 0 ? `Nợ: ${formatCurrency(inv.debtAmount)}` : 'Đã thanh toán'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedSupplierForDetail(null)}
                className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {settleDebtSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Thanh toán công nợ NCC</h3>
              </div>
              <button
                onClick={() => setSettleDebtSupplier(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl text-xs space-y-1">
              <div className="text-neutral-400">Nhà cung cấp: <strong className="text-white">{settleDebtSupplier.name}</strong></div>
              <div className="text-neutral-400">Công nợ hiện tại: <strong className="text-red-400">{formatCurrency(settleDebtSupplier.debt || 0)}</strong></div>
            </div>

            <form onSubmit={handleSettleSupplierDebt} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Số tiền thanh toán cho NCC (₫) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ví dụ: 1000000"
                  value={settleDebtAmount}
                  onChange={(e) => setSettleDebtAmount(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Thanh toán tiền mặt / Chuyển khoản ngân hàng..."
                  value={settleDebtNote}
                  onChange={(e) => setSettleDebtNote(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setSettleDebtSupplier(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={settlingDebt}
                  className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Xác nhận trả nợ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-xl bg-red-950/80 border border-red-800 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Xác nhận xóa nhà cung cấp</h3>
                <p className="text-xs text-neutral-400">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300">
              Bạn có chắc chắn muốn xóa nhà cung cấp này khỏi cơ sở dữ liệu?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSupplier(deleteConfirmId)}
                className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
