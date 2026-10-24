import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Product, Expense, PricingConfig } from '@/src/types';
import { 
  Calculator, 
  Flame, 
  Percent, 
  TrendingUp, 
  Store, 
  Truck, 
  Clock, 
  Check, 
  Loader2, 
  DollarSign, 
  Layers, 
  AlertCircle, 
  Scale, 
  Package, 
  Sparkles,
  RefreshCw,
  ShoppingBag,
  Coins,
  Lock,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '@/src/lib/formatters';
import { logger } from '@/src/lib/logger';
import { CustomPricingItem } from '@/src/types';

export const AdvancedPricingEngine: React.FC = () => {
  const { currentShop, reloadShopData, userRole } = useAuth();
  const isOwner = userRole === 'owner';

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [applyingBatch, setApplyingBatch] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real store data loaded from Firestore
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{
    rawMaterial: number;
    utilities: number;
    packaging: number;
    salary: number;
    other: number;
    total: number;
  }>({ rawMaterial: 0, utilities: 0, packaging: 0, salary: 0, other: 0, total: 0 });

  // Custom Pricing Items (Store Owner setup) - STRICT ZERO MOCK DATA
  const [customItems, setCustomItems] = useState<CustomPricingItem[]>([]);

  // Apply Custom Item Price Modal State
  const [applyModalTarget, setApplyModalTarget] = useState<{
    item: CustomPricingItem;
    suggestedRetail: number;
    suggestedWholesale: number;
    suggestedDelivery: number;
  } | null>(null);
  const [selectedModalProdId, setSelectedModalProdId] = useState<string>('');
  const [selectedModalChannel, setSelectedModalChannel] = useState<'retail' | 'wholesale' | 'delivery'>('retail');
  const [applyingCustomItemPrice, setApplyingCustomItemPrice] = useState(false);

  // Calculation parameters (Preloaded from shop.pricingConfig or realistic roast duck defaults)
  const [freshDuckWeight, setFreshDuckWeight] = useState<number>(2.8); // kg per fresh duck
  const [freshDuckCostPerKg, setFreshDuckCostPerKg] = useState<number>(65000); // VNĐ/kg vịt sống
  const [shrinkageRatePercent, setShrinkageRatePercent] = useState<number>(
    currentShop?.pricingConfig?.shrinkageRatePercent ?? 25
  ); // 25% hao hụt khi nướng/quay
  const [marinadeCost, setMarinadeCost] = useState<number>(
    currentShop?.pricingConfig?.marinadeCostPerDuck ?? 15000
  ); // 15.000đ gia vị ướp/con
  const [gasCharcoalCost, setGasCharcoalCost] = useState<number>(
    currentShop?.pricingConfig?.gasCharcoalCostPerDuck ?? 12000
  ); // 12.000đ than/gas/con
  const [packagingCost, setPackagingCost] = useState<number>(
    currentShop?.pricingConfig?.packagingCostPerUnit ?? 5000
  ); // 5.000đ hộp + bịch + nước chấm
  const [allocatedOverhead, setAllocatedOverhead] = useState<number>(
    currentShop?.pricingConfig?.allocatedOverheadPerUnit ?? 10000
  ); // 10.000đ điện, nước, mặt bằng

  // Target Profit Margins and Channel Multipliers
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(
    currentShop?.pricingConfig?.targetMarginPercent ?? 35
  ); // 35% biên lãi mong muốn
  const [deliveryAppCommissionPercent, setDeliveryAppCommissionPercent] = useState<number>(
    currentShop?.pricingConfig?.deliveryAppCommissionPercent ?? 20
  ); // 20% phí sàn Grab/Shopee
  const [wholesaleDiscountPercent, setWholesaleDiscountPercent] = useState<number>(
    currentShop?.pricingConfig?.wholesaleDiscountPercent ?? 15
  ); // 15% giảm cho khách sỉ
  const [happyHourDiscountPercent, setHappyHourDiscountPercent] = useState<number>(
    currentShop?.pricingConfig?.happyHourDiscountPercent ?? 10
  ); // 10% giảm giờ vàng
  const [roundingRule, setRoundingRule] = useState<'1000' | '5000' | '10000' | 'none'>(
    currentShop?.pricingConfig?.roundingRule ?? '5000'
  );

  // Selected products to batch update
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRealStoreData();
  }, [currentShop?.id]);

  const loadRealStoreData = async () => {
    if (!currentShop?.id) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      // Sync custom items from saved pricingConfig
      if (currentShop.pricingConfig?.customItems) {
        setCustomItems(currentShop.pricingConfig.customItems);
      }

      // Load real products
      const pSnap = await getDocs(collection(db, 'shops', currentShop.id, 'products'));
      const prods: Product[] = [];
      pSnap.forEach((d) => prods.push({ id: d.id, ...d.data() } as Product));
      setProducts(prods);

      // Default select all products that have costPrice > 0
      const idsWithCost = prods.filter((p) => (p.costPrice || 0) > 0).map((p) => p.id);
      setSelectedProductIds(new Set(idsWithCost));

      // Load real expenses
      const eSnap = await getDocs(collection(db, 'shops', currentShop.id, 'expenses'));
      const expList: Expense[] = [];
      let rawM = 0;
      let util = 0;
      let pack = 0;
      let sal = 0;
      let oth = 0;

      eSnap.forEach((d) => {
        const e = { id: d.id, ...d.data() } as Expense;
        expList.push(e);
        const amt = Number(e.amount || 0);
        if (e.category === 'raw_material') rawM += amt;
        else if (e.category === 'utilities') util += amt;
        else if (e.category === 'packaging') pack += amt;
        else if (e.category === 'salary') sal += amt;
        else oth += amt;
      });

      setExpenses(expList);
      setExpenseBreakdown({
        rawMaterial: rawM,
        utilities: util,
        packaging: pack,
        salary: sal,
        other: oth,
        total: rawM + util + pack + sal + oth,
      });

      // If products exist, update default fresh duck cost from real products
      const duckProduct = prods.find((p) => p.name.toLowerCase().includes('vịt'));
      if (duckProduct && duckProduct.costPrice > 0) {
        setFreshDuckCostPerKg(Math.round(duckProduct.costPrice / (freshDuckWeight || 2.8)));
      }

      logger.info('PRICING_ENGINE', `Đã nạp ${prods.length} sản phẩm và ${expList.length} phiếu chi từ dữ liệu thật`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Lỗi khi tải dữ liệu thực tế từ cơ sở dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Custom Items Operations (Strictly Zero Mock Data)
  const handleAddCustomItem = () => {
    const newItem: CustomPricingItem = {
      id: `custom_${Date.now()}`,
      name: '',
      unit: 'kg',
      rawWeightKg: 1,
      rawCostPerKg: 0,
      shrinkagePercent: 20,
      marinadeCost: 0,
      fuelCost: 0,
      packagingCost: 0,
      overheadCost: 0,
      targetMarginPercent: targetMarginPercent || 35,
      createdAt: new Date().toISOString(),
    };
    setCustomItems((prev) => [...prev, newItem]);
  };

  const handleUpdateCustomItem = (id: string, field: keyof CustomPricingItem, value: any) => {
    setCustomItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveCustomItem = (id: string) => {
    setCustomItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculate COGS and suggested prices for a custom item
  const calculateCustomItemMetrics = (item: CustomPricingItem) => {
    const rawTotal = (item.rawWeightKg || 0) * (item.rawCostPerKg || 0);
    const shrinkageLoss = rawTotal * ((item.shrinkagePercent || 0) / 100);
    const totalCogs = rawTotal + shrinkageLoss + (item.marinadeCost || 0) + (item.fuelCost || 0) + (item.packagingCost || 0) + (item.overheadCost || 0);
    
    const margin = (item.targetMarginPercent || 35) / 100;
    const suggestedRetail = margin < 1 ? applyRounding(totalCogs / (1 - margin)) : totalCogs;
    const suggestedWholesale = applyRounding(suggestedRetail * (1 - wholesaleDiscountPercent / 100));
    const suggestedDelivery = applyRounding(suggestedRetail / (1 - deliveryAppCommissionPercent / 100));

    return {
      rawTotal,
      shrinkageLoss,
      totalCogs,
      suggestedRetail,
      suggestedWholesale,
      suggestedDelivery,
    };
  };

  // Apply Custom Item Price directly to a real product in Firestore
  const handleApplyCustomPriceToProduct = async () => {
    if (!currentShop?.id || !applyModalTarget || !selectedModalProdId) return;

    try {
      setApplyingCustomItemPrice(true);
      setErrorMsg(null);

      let targetPrice = applyModalTarget.suggestedRetail;
      if (selectedModalChannel === 'wholesale') targetPrice = applyModalTarget.suggestedWholesale;
      if (selectedModalChannel === 'delivery') targetPrice = applyModalTarget.suggestedDelivery;

      const pRef = doc(db, 'shops', currentShop.id, 'products', selectedModalProdId);
      const metrics = calculateCustomItemMetrics(applyModalTarget.item);

      await updateDoc(pRef, {
        price: targetPrice,
        costPrice: metrics.totalCogs > 0 ? Math.round(metrics.totalCogs) : 0,
        updatedAt: new Date().toISOString(),
      });

      await loadRealStoreData();
      const targetProd = products.find((p) => p.id === selectedModalProdId);
      setActionSuccess(
        `Đã cập nhật giá bán thành công cho món "${targetProd?.name || 'Sản phẩm'}" thành ${formatCurrency(targetPrice)}!`
      );
      setApplyModalTarget(null);
      setSelectedModalProdId('');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg('Không thể áp dụng giá vào sản phẩm: ' + err.message);
    } finally {
      setApplyingCustomItemPrice(false);
    }
  };

  // Helper function for roundings
  const applyRounding = (amount: number): number => {
    if (roundingRule === 'none') return Math.round(amount);
    const step = Number(roundingRule);
    return Math.ceil(amount / step) * step;
  };

  // 1. RAW DUCK COST
  const rawDuckTotalCost = freshDuckWeight * freshDuckCostPerKg;

  // 2. POST-ROASTING WEIGHT & COST (Accounting for Shrinkage)
  const roastedWeight = freshDuckWeight * (1 - shrinkageRatePercent / 100);
  const costPerKgRoasted = roastedWeight > 0 ? (rawDuckTotalCost / roastedWeight) : 0;

  // 3. FULL PRODUCTION COGS (Chi phí toàn phần cho 1 con vịt quay ra lò hoàn chỉnh)
  const totalProductionCostPerDuck = 
    rawDuckTotalCost + 
    marinadeCost + 
    gasCharcoalCost + 
    packagingCost + 
    allocatedOverhead;

  // 4. MULTI-CHANNEL PRICE DETERMINATION
  // Base Retail Selling Price (Bán lẻ tại quán / mang về)
  const retailBasePrice = applyRounding(totalProductionCostPerDuck / (1 - targetMarginPercent / 100));
  const retailGrossProfit = retailBasePrice - totalProductionCostPerDuck;
  const retailRealMarginPercent = retailBasePrice > 0 ? Math.round((retailGrossProfit / retailBasePrice) * 100) : 0;

  // Wholesale Price (Khách sỉ)
  const wholesalePrice = applyRounding(retailBasePrice * (1 - wholesaleDiscountPercent / 100));
  const wholesaleGrossProfit = wholesalePrice - totalProductionCostPerDuck;
  const wholesaleRealMarginPercent = wholesalePrice > 0 ? Math.round((wholesaleGrossProfit / wholesalePrice) * 100) : 0;

  // Delivery App Price (GrabFood, ShopeeFood, Be) - offsets platform commission
  const deliveryAppPrice = applyRounding(retailBasePrice / (1 - deliveryAppCommissionPercent / 100));
  const deliveryNetRevenue = deliveryAppPrice * (1 - deliveryAppCommissionPercent / 100);
  const deliveryNetProfit = deliveryNetRevenue - totalProductionCostPerDuck;

  // Happy Hour Price (Giờ vàng cuối ngày xả kho)
  const happyHourPrice = applyRounding(retailBasePrice * (1 - happyHourDiscountPercent / 100));
  const happyHourProfit = happyHourPrice - totalProductionCostPerDuck;

  // Save Config to Firestore
  const handleSaveConfig = async () => {
    if (!currentShop?.id) return;
    try {
      setSavingConfig(true);
      setActionSuccess(null);
      setErrorMsg(null);

      const pricingConfig: PricingConfig = {
        shrinkageRatePercent,
        marinadeCostPerDuck: marinadeCost,
        gasCharcoalCostPerDuck: gasCharcoalCost,
        packagingCostPerUnit: packagingCost,
        allocatedOverheadPerUnit: allocatedOverhead,
        targetMarginPercent,
        deliveryAppCommissionPercent,
        wholesaleDiscountPercent,
        happyHourDiscountPercent,
        roundingRule,
        customItems,
        updatedAt: new Date().toISOString(),
      };

      const shopRef = doc(db, 'shops', currentShop.id);
      await updateDoc(shopRef, {
        pricingConfig,
        updatedAt: new Date().toISOString(),
      });

      await reloadShopData();
      setActionSuccess('Đã lưu thiết lập công thức định giá và danh sách món tự setup thành công!');
      logger.info('PRICING_ENGINE', 'Lưu cấu hình định giá vào Firestore thành công', pricingConfig);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg('Không thể lưu cấu hình định giá: ' + err.message);
      logger.error('PRICING_ENGINE', 'Lỗi lưu cấu hình định giá', err);
    } finally {
      setSavingConfig(false);
    }
  };

  // Batch Apply Calculated Prices to Real Products in Firestore
  const handleApplyBatchPrices = async (targetChannel: 'retail' | 'wholesale' | 'delivery' | 'cost_plus') => {
    if (!currentShop?.id || selectedProductIds.size === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn áp dụng bảng giá mới cho ${selectedProductIds.size} sản phẩm trong thực đơn không?`)) {
      return;
    }

    try {
      setApplyingBatch(true);
      setActionSuccess(null);
      setErrorMsg(null);

      const batch = writeBatch(db);
      let updatedCount = 0;

      products.forEach((prod) => {
        if (selectedProductIds.has(prod.id)) {
          const cost = prod.costPrice || 0;
          let newPrice = prod.price;

          if (targetChannel === 'cost_plus') {
            // Apply cost-plus with target margin
            if (cost > 0) {
              newPrice = applyRounding(cost / (1 - targetMarginPercent / 100));
            }
          } else if (targetChannel === 'wholesale') {
            newPrice = applyRounding(prod.price * (1 - wholesaleDiscountPercent / 100));
          } else if (targetChannel === 'delivery') {
            newPrice = applyRounding(prod.price / (1 - deliveryAppCommissionPercent / 100));
          } else {
            // If whole duck item, use the full calculated retail price
            if (prod.unit === 'con' || prod.name.toLowerCase().includes('nguyên con')) {
              newPrice = retailBasePrice;
            } else if (prod.unit === 'nua_con' || prod.name.toLowerCase().includes('nửa')) {
              newPrice = applyRounding(retailBasePrice / 2 + 5000); // chặt nửa thường cộng phụ thu hộp
            } else if (cost > 0) {
              newPrice = applyRounding(cost / (1 - targetMarginPercent / 100));
            }
          }

          if (newPrice > 0 && newPrice !== prod.price) {
            const pRef = doc(db, 'shops', currentShop.id, 'products', prod.id);
            batch.update(pRef, {
              price: newPrice,
              updatedAt: new Date().toISOString(),
            });
            updatedCount++;
          }
        }
      });

      await batch.commit();
      await loadRealStoreData();
      setActionSuccess(`Đã tự động cập nhật giá mới thành công cho ${updatedCount} sản phẩm trong thực đơn quán!`);
      logger.info('PRICING_ENGINE', `Áp dụng bảng giá hàng loạt cho ${updatedCount} sản phẩm`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Lỗi khi cập nhật giá hàng loạt: ' + err.message);
      logger.error('PRICING_ENGINE', 'Lỗi cập nhật bảng giá hàng loạt', err);
    } finally {
      setApplyingBatch(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelectProduct = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  if (!isOwner) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center text-xs text-neutral-300 space-y-3 my-4">
        <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-400 mx-auto shadow-md">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-white">Quyền Truy Cập Bị Giới Hạn</h3>
        <p className="text-neutral-400 max-w-sm mx-auto leading-relaxed">
          Công cụ Cài đặt Bảng giá & Tính giá Chuyên sâu chỉ dành riêng cho tài khoản Chủ quán.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-neutral-900 rounded-2xl border border-neutral-800">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="text-xs text-neutral-400">Đang phân tích cấu trúc chi phí và sản phẩm thực tế...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-neutral-800 p-6 rounded-3xl space-y-2 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-500" />
              Công Cụ Định Giá & Tính Lãi Chuyên Sâu (Real Cost-Accounting)
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Tính toán toàn diện chi phí nhập hàng, tỷ lệ hao hụt khi quay, chi phí phụ trợ và bù phí sàn giao hàng dựa trên dữ liệu thật.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRealStoreData}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Đồng bộ dữ liệu</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION 1: REAL EXPENSES OVERVIEW */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              Tổng Hợp Chi Phí Thực Tế Từ Sổ Quỹ Quán
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Dữ liệu được trích xuất trực tiếp từ các phiếu chi thực tế trong sổ quỹ ({expenses.length} giao dịch)
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400">
            Tổng chi: {formatCurrency(expenseBreakdown.total)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
            <span className="text-neutral-500 block text-[10px]">Nguyên vật liệu</span>
            <span className="font-bold text-white font-mono mt-0.5 block">{formatCurrency(expenseBreakdown.rawMaterial)}</span>
          </div>
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
            <span className="text-neutral-500 block text-[10px]">Than, Điện, Nước</span>
            <span className="font-bold text-white font-mono mt-0.5 block">{formatCurrency(expenseBreakdown.utilities)}</span>
          </div>
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
            <span className="text-neutral-500 block text-[10px]">Hộp & Bao bì</span>
            <span className="font-bold text-white font-mono mt-0.5 block">{formatCurrency(expenseBreakdown.packaging)}</span>
          </div>
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
            <span className="text-neutral-500 block text-[10px]">Lương nhân công</span>
            <span className="font-bold text-white font-mono mt-0.5 block">{formatCurrency(expenseBreakdown.salary)}</span>
          </div>
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
            <span className="text-neutral-500 block text-[10px]">Mặt bằng & Khác</span>
            <span className="font-bold text-white font-mono mt-0.5 block">{formatCurrency(expenseBreakdown.other)}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: PRODUCTION SHRINKAGE & UNIT COST INPUTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Parameters */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Flame className="w-4 h-4 text-amber-500" />
            1. Định Mức Chi Phí Sản Xuất & Hao Hụt
          </h3>

          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Trọng lượng vịt sống (kg/con)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={freshDuckWeight}
                    onChange={(e) => setFreshDuckWeight(Number(e.target.value) || 0)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                  <span className="absolute right-3 top-2 text-neutral-500 font-mono text-[11px]">kg</span>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Giá nhập vịt tươi (đ/kg)
                </label>
                <input
                  type="number"
                  step="1000"
                  value={freshDuckCostPerKg}
                  onChange={(e) => setFreshDuckCostPerKg(Number(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            {/* Shrinkage Loss Slider */}
            <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-850 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  Tỷ lệ hao hụt khi quay/nướng:
                </span>
                <span className="text-amber-400 font-bold font-mono text-sm">{shrinkageRatePercent}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                step="1"
                value={shrinkageRatePercent}
                onChange={(e) => setShrinkageRatePercent(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>Vịt béo (~20%)</span>
                <span>Chuẩn quán vịt (~25% - 30%)</span>
                <span>Quay khô (~35%+)</span>
              </div>
            </div>

            {/* Additional Production Costs Per Duck */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-400 text-[11px] mb-1">Gia vị tẩm ướp / con</label>
                <input
                  type="number"
                  step="1000"
                  value={marinadeCost}
                  onChange={(e) => setMarinadeCost(Number(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-neutral-400 text-[11px] mb-1">Than nướng / Gas / con</label>
                <input
                  type="number"
                  step="1000"
                  value={gasCharcoalCost}
                  onChange={(e) => setGasCharcoalCost(Number(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-neutral-400 text-[11px] mb-1">Hộp, bao bì, nước chấm / phần</label>
                <input
                  type="number"
                  step="1000"
                  value={packagingCost}
                  onChange={(e) => setPackagingCost(Number(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-neutral-400 text-[11px] mb-1">Mặt bằng & Điện nước phân bổ</label>
                <input
                  type="number"
                  step="1000"
                  value={allocatedOverhead}
                  onChange={(e) => setAllocatedOverhead(Number(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Calculated True Unit Cost Summary */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Package className="w-4 h-4 text-emerald-400" />
              2. Chi Phí Giá Vốn Toàn Phần Đích Thực (True COGS)
            </h3>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Tiền mua 1 con vịt sống ({freshDuckWeight}kg):</span>
                <span className="font-mono text-white font-bold">{formatCurrency(rawDuckTotalCost)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Trọng lượng vịt chín sau hao hụt ({shrinkageRatePercent}%):</span>
                <span className="font-mono text-amber-400 font-bold">{roastedWeight.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Giá vốn thịt vịt chín theo kg:</span>
                <span className="font-mono text-neutral-300 font-bold">{formatCurrency(Math.round(costPerKgRoasted))} / kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Tổng phụ phí nướng + gia vị + bao bì + mặt bằng:</span>
                <span className="font-mono text-neutral-300 font-bold">
                  {formatCurrency(marinadeCost + gasCharcoalCost + packagingCost + allocatedOverhead)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl space-y-1">
            <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider block">
              TỔNG GIÁ VỐN 1 CON VỊT QUAY RA LÒ (COGS)
            </span>
            <div className="text-2xl font-black text-white font-mono">
              {formatCurrency(Math.round(totalProductionCostPerDuck))}
            </div>
            <span className="text-[10px] text-neutral-400">
              Bao gồm thịt tươi + hao hụt nướng + than gas + hộp + điện nước mặt bằng
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: MULTI-CHANNEL PRICE BOOK & TARGET PROFIT CALCULATOR */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              3. Thiết Lập Đa Bảng Giá & Bù Phí Sàn (Retail, Wholesale, App Delivery)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Tự động tính lãi suất thực nhận sau khi trừ chiết khấu hoặc bù phí hoa hồng của sàn Grab/Shopee
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Quy tắc làm tròn:</span>
            <select
              value={roundingRule}
              onChange={(e) => setRoundingRule(e.target.value as any)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-white font-mono focus:outline-hidden focus:border-amber-500"
            >
              <option value="1000">Làm tròn 1.000đ</option>
              <option value="5000">Làm tròn 5.000đ</option>
              <option value="10000">Làm tròn 10.000đ</option>
              <option value="none">Không làm tròn</option>
            </select>
          </div>
        </div>

        {/* Channels Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Channel 1: Bán lẻ tại quầy */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  Bán lẻ (Tại Quán)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                  Kênh chuẩn
                </span>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Biên lãi mong muốn (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="90"
                    value={targetMarginPercent}
                    onChange={(e) => setTargetMarginPercent(Number(e.target.value) || 0)}
                    className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-xs font-bold text-neutral-400">%</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-850 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase">Giá bán đề xuất</span>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {formatCurrency(retailBasePrice)}
              </div>
              <div className="text-[11px] text-emerald-400 flex justify-between font-mono">
                <span>Lãi: +{formatCurrency(retailGrossProfit)}</span>
                <span>({retailRealMarginPercent}%)</span>
              </div>
            </div>
          </div>

          {/* Channel 2: Khách sỉ / Đại lý */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  Khách sỉ / Đại lý
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">
                  Bán buôn
                </span>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Mức chiết khấu sỉ (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="40"
                    value={wholesaleDiscountPercent}
                    onChange={(e) => setWholesaleDiscountPercent(Number(e.target.value) || 0)}
                    className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-xs font-bold text-neutral-400">%</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-850 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase">Giá bán sỉ đề xuất</span>
              <div className="text-lg font-bold text-blue-400 font-mono">
                {formatCurrency(wholesalePrice)}
              </div>
              <div className="text-[11px] text-emerald-400 flex justify-between font-mono">
                <span>Lãi: +{formatCurrency(wholesaleGrossProfit)}</span>
                <span>({wholesaleRealMarginPercent}%)</span>
              </div>
            </div>
          </div>

          {/* Channel 3: App Giao Hàng GrabFood / ShopeeFood */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  App Giao Hàng (Grab/Shopee)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  Bù phí sàn
                </span>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Phí hoa hồng sàn (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="15"
                    max="35"
                    value={deliveryAppCommissionPercent}
                    onChange={(e) => setDeliveryAppCommissionPercent(Number(e.target.value) || 0)}
                    className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-xs font-bold text-neutral-400">%</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-850 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase">Giá niêm yết trên App</span>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {formatCurrency(deliveryAppPrice)}
              </div>
              <div className="text-[11px] text-neutral-400 flex justify-between font-mono">
                <span>Sau trừ sàn: {formatCurrency(Math.round(deliveryNetRevenue))}</span>
                <span className="text-emerald-400 font-bold">+{formatCurrency(Math.round(deliveryNetProfit))}</span>
              </div>
            </div>
          </div>

          {/* Channel 4: Khung Giờ Vàng / Cuối ngày */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  Giờ Vàng / Cuối Ca
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold">
                  Xả tồn
                </span>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Mức giảm giờ vàng (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="30"
                    value={happyHourDiscountPercent}
                    onChange={(e) => setHappyHourDiscountPercent(Number(e.target.value) || 0)}
                    className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-xs font-bold text-neutral-400">%</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-850 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase">Giá bán giờ vàng</span>
              <div className="text-lg font-bold text-purple-400 font-mono">
                {formatCurrency(happyHourPrice)}
              </div>
              <div className="text-[11px] text-emerald-400 flex justify-between font-mono">
                <span>Lãi: +{formatCurrency(happyHourProfit)}</span>
                <span>(Bảo toàn vốn)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button: Save Formula Config */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={savingConfig || !isOwner}
            className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer border border-neutral-700"
          >
            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-emerald-400" />}
            <span>Lưu Cấu Hình Định Giá Này</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: CÀI ĐẶT ĐỊNH GIÁ CHO MÓN / ĐỒ KHÁC (CHỦ QUÁN TỰ SETUP - ZERO MOCK DATA) */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              4. Cài Đặt Định Giá Cho Món / Đồ Khác (Chủ Quán Tự Setup)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Tự điền công thức tính giá vốn & lãi mong muốn cho các món bán kèm khác (Gà, Heo quay, Vịt phá lấu, Nước sốt...). Không có dữ liệu giả lập.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddCustomItem}
              disabled={!isOwner}
              className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Món / Đồ Khác</span>
            </button>

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig || !isOwner}
              className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
            >
              {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Lưu Thiết Lập</span>
            </button>
          </div>
        </div>

        {customItems.length === 0 ? (
          <div className="p-8 text-center bg-neutral-950/60 rounded-2xl border border-neutral-850 space-y-3">
            <Calculator className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Chưa có món tự setup nào. Nhấn nút <strong className="text-amber-400">"+ Thêm Món / Đồ Khác"</strong> ở trên để tự điền tên món, giá nhập và định mức chi phí riêng của quán bạn.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {customItems.map((item, index) => {
              const metrics = calculateCustomItemMetrics(item);

              return (
                <div
                  key={item.id}
                  className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4 relative hover:border-neutral-700 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-850 pb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-bold text-amber-500 font-mono w-6">#{index + 1}</span>
                      <input
                        type="text"
                        placeholder="Tên món / Đồ khác (Ví dụ: Gà ta luộc, Vịt phá lấu...)"
                        value={item.name}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'name', e.target.value)}
                        className="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold flex-1 focus:outline-hidden focus:border-amber-500"
                      />
                      <input
                        type="text"
                        placeholder="ĐVT (Kg, Con...)"
                        value={item.unit}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'unit', e.target.value)}
                        className="bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs text-neutral-300 w-24 font-semibold focus:outline-hidden focus:border-amber-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setApplyModalTarget({
                            item,
                            suggestedRetail: metrics.suggestedRetail,
                            suggestedWholesale: metrics.suggestedWholesale,
                            suggestedDelivery: metrics.suggestedDelivery,
                          })
                        }
                        disabled={!item.name}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Áp dụng vào Thực đơn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveCustomItem(item.id)}
                        className="p-1.5 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                        title="Xóa món này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Input Fields Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Số lượng / Trọng lượng</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.rawWeightKg}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'rawWeightKg', Number(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Giá nhập (đ/ĐVT)</label>
                      <input
                        type="number"
                        step="1000"
                        value={item.rawCostPerKg}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'rawCostPerKg', Number(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Hao hụt chế biến (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="80"
                        value={item.shrinkagePercent}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'shrinkagePercent', Number(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1 text-amber-400 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Gia vị tẩm ướp (đ)</label>
                      <input
                        type="number"
                        step="1000"
                        value={item.marinadeCost}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'marinadeCost', Number(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Nhiên liệu Than/Gas (đ)</label>
                      <input
                        type="number"
                        step="1000"
                        value={item.fuelCost}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'fuelCost', Number(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Hộp & Bao bì (đ)</label>
                      <input
                        type="number"
                        step="1000"
                        value={item.packagingCost}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'packagingCost', Number(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Biên lãi mong muốn (%)</label>
                      <input
                        type="number"
                        min="5"
                        max="90"
                        value={item.targetMarginPercent}
                        onChange={(e) => handleUpdateCustomItem(item.id, 'targetMarginPercent', Number(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-amber-800/60 rounded-xl px-2.5 py-1 text-emerald-400 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Calculated Results Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-850/80 text-xs font-mono">
                    <div className="p-2.5 bg-neutral-900/80 rounded-xl border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 block uppercase">Giá vốn thật (True COGS)</span>
                      <span className="text-sm font-bold text-white block mt-0.5">{formatCurrency(metrics.totalCogs)}</span>
                    </div>

                    <div className="p-2.5 bg-amber-950/30 rounded-xl border border-amber-800/40">
                      <span className="text-[10px] text-amber-400/80 block uppercase">Giá Bán Lẻ Tại Quán</span>
                      <span className="text-sm font-bold text-amber-400 block mt-0.5">{formatCurrency(metrics.suggestedRetail)}</span>
                    </div>

                    <div className="p-2.5 bg-blue-950/30 rounded-xl border border-blue-800/40">
                      <span className="text-[10px] text-blue-400/80 block uppercase">Giá Khách Sỉ (-{wholesaleDiscountPercent}%)</span>
                      <span className="text-sm font-bold text-blue-400 block mt-0.5">{formatCurrency(metrics.suggestedWholesale)}</span>
                    </div>

                    <div className="p-2.5 bg-emerald-950/30 rounded-xl border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400/80 block uppercase">Giá Niêm Yết App (+{deliveryAppCommissionPercent}%)</span>
                      <span className="text-sm font-bold text-emerald-400 block mt-0.5">{formatCurrency(metrics.suggestedDelivery)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* APPLY CUSTOM ITEM PRICE MODAL */}
      {applyModalTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Áp Dụng Giá Tính Toán Vào Thực Đơn
              </h3>
              <button
                type="button"
                onClick={() => setApplyModalTarget(null)}
                className="text-neutral-500 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-neutral-400">
                Món tự setup: <strong className="text-white">{applyModalTarget.item.name || 'Món mới'}</strong>
              </p>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Chọn món trong Thực đơn thực tế cần cập nhật:</label>
                <select
                  value={selectedModalProdId}
                  onChange={(e) => setSelectedModalProdId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-medium focus:outline-hidden focus:border-amber-500"
                >
                  <option value="">-- Chọn sản phẩm trong thực đơn --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) - Hiện tại: {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Chọn kênh giá muốn áp dụng:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedModalChannel('retail')}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      selectedModalChannel === 'retail'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span className="block text-[10px]">Giá Lẻ</span>
                    <span className="font-mono text-xs">{formatCurrency(applyModalTarget.suggestedRetail)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModalChannel('wholesale')}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      selectedModalChannel === 'wholesale'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span className="block text-[10px]">Giá Sỉ</span>
                    <span className="font-mono text-xs">{formatCurrency(applyModalTarget.suggestedWholesale)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModalChannel('delivery')}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      selectedModalChannel === 'delivery'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span className="block text-[10px]">Giá App</span>
                    <span className="font-mono text-xs">{formatCurrency(applyModalTarget.suggestedDelivery)}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setApplyModalTarget(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyCustomPriceToProduct}
                disabled={!selectedModalProdId || applyingCustomItemPrice}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {applyingCustomItemPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Áp Dụng Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: REAL PRODUCT MENU BATCH PRICE UPDATE TABLE */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-500" />
              5. Cập Nhật Bảng Giá Hàng Loạt Vào Thực Đơn Thực Tế ({products.length} món)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Chọn các món cần cập nhật và nhấn áp dụng để lưu giá mới trực tiếp vào hệ thống
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyBatchPrices('cost_plus')}
              disabled={applyingBatch || selectedProductIds.size === 0 || !isOwner}
              className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
            >
              {applyingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Áp dụng Giá Lãi {targetMarginPercent}%</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyBatchPrices('wholesale')}
              disabled={applyingBatch || selectedProductIds.size === 0 || !isOwner}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Áp dụng Giá Sỉ (-{wholesaleDiscountPercent}%)</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyBatchPrices('delivery')}
              disabled={applyingBatch || selectedProductIds.size === 0 || !isOwner}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Bù Phí Sàn (+{deliveryAppCommissionPercent}%)</span>
            </button>
          </div>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 bg-neutral-950/70">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="accent-amber-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4 font-bold">Mã / Tên món</th>
                <th className="py-3 px-4 font-bold">ĐVT</th>
                <th className="py-3 px-4 font-bold text-right">Giá vốn thật</th>
                <th className="py-3 px-4 font-bold text-right text-neutral-400">Giá bán hiện tại</th>
                <th className="py-3 px-4 font-bold text-right text-amber-400">Giá bán tính mới</th>
                <th className="py-3 px-4 font-bold text-right text-emerald-400">Lãi dự kiến</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    Chưa có sản phẩm nào trong thực đơn.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const cost = p.costPrice || 0;
                  const suggested = cost > 0 ? applyRounding(cost / (1 - targetMarginPercent / 100)) : p.price;
                  const profit = suggested - cost;
                  const marginPct = suggested > 0 ? Math.round((profit / suggested) * 100) : 0;
                  const isSelected = selectedProductIds.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleSelectProduct(p.id)}
                      className={`hover:bg-neutral-850/60 transition cursor-pointer ${
                        isSelected ? 'bg-amber-950/15' : ''
                      }`}
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="accent-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">{p.name}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">{p.code}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-400">{p.unit}</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-300">
                        {cost > 0 ? formatCurrency(cost) : <span className="text-neutral-600">Chưa nhập vốn</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-neutral-400">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatCurrency(suggested)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                        {cost > 0 ? `+${formatCurrency(profit)} (${marginPct}%)` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
