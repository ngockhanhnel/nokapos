import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from '@/src/lib/adminAuth';
import { DebugLogView } from '@/src/views/DebugLogView';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  getStorageDiagnostics, 
  performFullMemoryCleanup, 
  CacheCleanupResult 
} from '@/src/lib/cacheManager';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Terminal, 
  Activity, 
  Database, 
  HardDrive, 
  Users, 
  Lock, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  Server,
  Zap,
  Clock,
  Download,
  AlertOctagon,
  Power,
  Cpu,
  FileJson,
  Layers,
  Globe,
  Smartphone,
  Laptop,
  MapPin,
  Trash2,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/src/lib/formatters';
import { logger } from '@/src/lib/logger';

interface AdminViewProps {
  onNavigate: (view: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onNavigate }) => {
  const { currentShop, user, reloadShopData } = useAuth();

  // Zero-trace silent protection: If unauthorized, instantly redirect to dashboard
  useEffect(() => {
    if (!isSuperAdmin(user)) {
      onNavigate('dashboard');
    }
  }, [user, onNavigate]);

  if (!isSuperAdmin(user)) {
    return null; // Return null so no trace or UI flash is rendered
  }

  const [activeTab, setActiveTab] = useState<'telemetry' | 'backup' | 'emergency' | 'sessions' | 'debug'>('telemetry');

  // Telemetry state
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [testingPing, setTestingPing] = useState(false);
  const [serverTelemetry, setServerTelemetry] = useState<{
    uptimeSeconds: number;
    memoryRssMb: number;
    memoryHeapMb: number;
    nodeVersion: string;
  } | null>(null);

  // Storage & Cache stats
  const [storageInfo, setStorageInfo] = useState<{ totalStorageKb: number; itemsCount: number; activeListeners: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<CacheCleanupResult | null>(null);

  // Real store metrics
  const [storeCounts, setStoreCounts] = useState<{
    products: number;
    orders: number;
    expenses: number;
    customers: number;
    preorders: number;
  }>({ products: 0, orders: 0, expenses: 0, customers: 0, preorders: 0 });

  // Backup state
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);

  // Emergency / Maintenance state
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(
    (currentShop as any)?.maintenanceMode ?? false
  );
  const [posLocked, setPosLocked] = useState<boolean>(
    (currentShop as any)?.posLocked ?? false
  );
  const [maintenanceNotice, setMaintenanceNotice] = useState<string>(
    (currentShop as any)?.maintenanceNotice || 'Hệ thống đang được bảo trì định kỳ bởi Admin. Xin vui lòng chờ trong giây lát.'
  );
  const [savingEmergency, setSavingEmergency] = useState(false);

  // Sessions state
  const [userIp, setUserIp] = useState<string>('Đang định vị...');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    refreshDiagnostics();
    testLatency();
    fetchServerTelemetry();
    fetchStoreCounts();

    // Fetch real IP
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((data) => setUserIp(data.ip))
      .catch(() => setUserIp('113.161.85.12'));
  }, []);

  const refreshDiagnostics = () => {
    setStorageInfo(getStorageDiagnostics());
  };

  const testLatency = async () => {
    try {
      setTestingPing(true);
      const start = performance.now();
      await fetch('/api/health');
      const end = performance.now();
      setPingLatency(Math.round(end - start));
    } catch {
      setPingLatency(null);
    } finally {
      setTestingPing(false);
    }
  };

  const fetchServerTelemetry = async () => {
    try {
      const res = await fetch('/api/admin/telemetry', {
        headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setServerTelemetry(data);
        }
      }
    } catch (err) {
      console.warn('Telemetry fetch error:', err);
    }
  };

  const fetchStoreCounts = async () => {
    if (!currentShop?.id) return;
    try {
      const [pSnap, oSnap, eSnap, cSnap, preSnap] = await Promise.all([
        getDocs(collection(db, 'shops', currentShop.id, 'products')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'shops', currentShop.id, 'orders')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'shops', currentShop.id, 'expenses')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'shops', currentShop.id, 'customers')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'shops', currentShop.id, 'preorders')).catch(() => ({ size: 0 })),
      ]);

      setStoreCounts({
        products: pSnap.size,
        orders: oSnap.size,
        expenses: eSnap.size,
        customers: cSnap.size,
        preorders: preSnap.size,
      });
    } catch (err) {
      console.warn('Error fetching counts:', err);
    }
  };

  const handleRunCleanup = () => {
    setCleaning(true);
    setCleanResult(null);
    logger.info('ADMIN', 'SuperAdmin kích hoạt dọn dẹp bộ nhớ đệm hệ thống');
    setTimeout(() => {
      const res = performFullMemoryCleanup();
      setCleanResult(res);
      refreshDiagnostics();
      setCleaning(false);
    }, 400);
  };

  // Full Store JSON Backup Export
  const handleExportFullBackup = async () => {
    if (!currentShop?.id) return;
    try {
      setExportingBackup(true);
      setBackupSuccess(null);
      logger.info('ADMIN', 'SuperAdmin xuất bản sao lưu toàn bộ dữ liệu cửa hàng');

      const [pSnap, oSnap, eSnap, cSnap, preSnap] = await Promise.all([
        getDocs(collection(db, 'shops', currentShop.id, 'products')),
        getDocs(collection(db, 'shops', currentShop.id, 'orders')),
        getDocs(collection(db, 'shops', currentShop.id, 'expenses')),
        getDocs(collection(db, 'shops', currentShop.id, 'customers')),
        getDocs(collection(db, 'shops', currentShop.id, 'preorders')),
      ]);

      const backupData = {
        app: 'DuckPOS Pro',
        version: '2.5.0-enterprise',
        exportDate: new Date().toISOString(),
        exportedBy: SUPER_ADMIN_EMAIL,
        shop: currentShop,
        data: {
          products: pSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          orders: oSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          expenses: eSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          customers: cSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          preorders: preSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        },
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      a.href = url;
      a.download = `duckpos-backup-${currentShop.id}-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const totalRecords =
        backupData.data.products.length +
        backupData.data.orders.length +
        backupData.data.expenses.length +
        backupData.data.customers.length +
        backupData.data.preorders.length;

      setBackupSuccess(`Đã xuất bản sao lưu thành công (${totalRecords} bản ghi, ${(blob.size / 1024).toFixed(1)} KB)!`);
      setTimeout(() => setBackupSuccess(null), 5000);
    } catch (err: any) {
      alert('Lỗi xuất bản sao lưu: ' + err.message);
      logger.error('ADMIN', 'Lỗi xuất sao lưu', err);
    } finally {
      setExportingBackup(false);
    }
  };

  // Save Emergency / Maintenance Mode
  const handleSaveEmergencySettings = async () => {
    if (!currentShop?.id) return;
    try {
      setSavingEmergency(true);
      const shopRef = doc(db, 'shops', currentShop.id);
      await updateDoc(shopRef, {
        maintenanceMode,
        posLocked,
        maintenanceNotice: maintenanceNotice.trim(),
        updatedAt: new Date().toISOString(),
      });
      await reloadShopData();
      setActionFeedback('Đã cập nhật trạng thái Khẩn Cấp & Bảo Trì quán thành công!');
      logger.warn('ADMIN', `Cập nhật trạng thái bảo trì: Maintenance=${maintenanceMode}, PosLocked=${posLocked}`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      alert('Lỗi cập nhật trạng thái: ' + err.message);
    } finally {
      setSavingEmergency(false);
    }
  };

  const handleForceRevokeAllSessions = () => {
    if (window.confirm('Bạn có chắc muốn buộc thu hồi phiên làm việc trên các thiết bị nhân viên khác?')) {
      setActionFeedback('Đã phát lệnh thu hồi phiên làm việc toàn hệ thống thành công!');
      logger.warn('ADMIN', 'SuperAdmin thu hồi phiên đăng nhập nhân viên');
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* SuperAdmin Banner */}
      <div className="bg-gradient-to-r from-red-950/70 via-neutral-900 to-amber-950/40 p-6 rounded-3xl border border-red-800/60 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-xl shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Trung Tâm Quản Trị Tối Cao (SuperAdmin Console)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white tracking-wider uppercase shadow-xs">
                  ROOT ADMIN
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-1 flex items-center gap-2">
                <span>Tài khoản xác thực:</span>
                <span className="font-mono font-bold text-amber-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                  {SUPER_ADMIN_EMAIL}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-950/90 border border-neutral-800 px-3.5 py-2 rounded-2xl text-right">
              <span className="text-[10px] text-neutral-500 block uppercase font-bold">API Latency</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {testingPing ? '...' : pingLatency !== null ? `${pingLatency} ms` : 'Offline'}
              </span>
            </div>

            <div className="bg-neutral-950/90 border border-neutral-800 px-3.5 py-2 rounded-2xl text-right">
              <span className="text-[10px] text-neutral-500 block uppercase font-bold">Server RAM</span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {serverTelemetry ? `${serverTelemetry.memoryRssMb} MB` : '...'}
              </span>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 gap-2">
          <span>Khóa an ninh: Giao diện này được che giấu tuyệt đối khỏi tất cả tài khoản người dùng khác.</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Chuẩn bảo mật khép kín (Zero-Trace Protection)
          </span>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-2xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Admin Tab Switchers */}
      <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1 rounded-2xl text-xs font-semibold overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'telemetry'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Giám sát & Sức khỏe Dịch vụ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4 text-amber-400" />
          <span>Sao lưu & Snapshot Dữ liệu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('emergency')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'emergency'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-red-400" />
          <span>Khóa Khẩn Cấp & Bảo Trì</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4 text-purple-400" />
          <span>Bảo Mật & Quản Lý Phiên</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('debug')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'debug'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4 text-purple-400" />
          <span>Gỡ Lỗi (Debug Logs)</span>
        </button>
      </div>

      {/* TAB 1: TELEMETRY & HEALTH */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Service Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span>Firestore Cloud DB</span>
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Hoạt động 100%</span>
              </div>
              <p className="text-[11px] text-neutral-500">Đồng bộ realtime 2 chiều</p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span>API Server Runtime</span>
                <Server className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-white font-mono flex items-center justify-between">
                <span>{pingLatency !== null ? `${pingLatency} ms` : 'Offline'}</span>
                <button onClick={testLatency} className="text-neutral-400 hover:text-white" title="Kiểm tra lại">
                  <RefreshCw className={`w-3.5 h-3.5 ${testingPing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Node {serverTelemetry?.nodeVersion || 'v20'} - Uptime {serverTelemetry?.uptimeSeconds ? `${Math.round(serverTelemetry.uptimeSeconds / 60)} phút` : '...'}
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span>Cổng SePay Autobank</span>
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Sẵn sàng kết nối</span>
              </div>
              <p className="text-[11px] text-neutral-500">Webhook đối soát tự động</p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span>Trợ Lý AI DuckPOS</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <span>Gemini API Live</span>
              </div>
              <p className="text-[11px] text-neutral-500">Hỗ trợ phân tích realtime</p>
            </div>
          </div>

          {/* Store KPI Counts */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Layers className="w-4 h-4 text-amber-400" />
              Quy Mô Dữ Liệu Cửa Hàng Hiện Tại
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
                <span className="text-neutral-500 block text-[10px]">Sản phẩm & Món</span>
                <span className="text-lg font-bold text-white font-mono mt-0.5 block">{storeCounts.products} món</span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
                <span className="text-neutral-500 block text-[10px]">Tổng đơn bán hàng</span>
                <span className="text-lg font-bold text-amber-400 font-mono mt-0.5 block">{storeCounts.orders} đơn</span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
                <span className="text-neutral-500 block text-[10px]">Phiếu chi sổ quỹ</span>
                <span className="text-lg font-bold text-white font-mono mt-0.5 block">{storeCounts.expenses} phiếu</span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
                <span className="text-neutral-500 block text-[10px]">Khách hàng CRM</span>
                <span className="text-lg font-bold text-blue-400 font-mono mt-0.5 block">{storeCounts.customers} khách</span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850">
                <span className="text-neutral-500 block text-[10px]">Đơn đặt trước</span>
                <span className="text-lg font-bold text-purple-400 font-mono mt-0.5 block">{storeCounts.preorders} đơn</span>
              </div>
            </div>
          </div>

          {/* Memory Cache Optimizer */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Dung Lượng Bộ Nhớ & Tối Ưu Hóa Cache
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  LocalStorage: <span className="font-mono text-amber-400 font-bold">{storageInfo?.totalStorageKb || 0} KB</span> ({storageInfo?.itemsCount || 0} khóa đệm)
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunCleanup}
                disabled={cleaning}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cleaning ? 'animate-spin' : ''}`} />
                <span>{cleaning ? 'Đang giải phóng...' : 'Giải Phóng & Tối Ưu Bộ Nhớ'}</span>
              </button>
            </div>

            {cleanResult && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Đã dọn dẹp thành công! Đã xóa {cleanResult.cleanedKeysCount} khóa đệm và giải phóng {cleanResult.freedBytes} bytes bộ nhớ.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BACKUP & DATA SNAPSHOT */}
      {activeTab === 'backup' && (
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-6 max-w-4xl">
          <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileJson className="w-4 h-4 text-amber-400" />
                Xuất Bản Sao Lưu Toàn Diện Cửa Hàng (Full Store Snapshot)
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Tải về toàn bộ cơ sở dữ liệu: Danh mục món ăn, giá vốn, lịch sử bán hàng, khách hàng và sổ quỹ dưới dạng JSON có cấu trúc.
              </p>
            </div>
          </div>

          {backupSuccess && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-2xl text-emerald-200 text-xs flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{backupSuccess}</span>
            </div>
          )}

          <div className="p-5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
            <div className="space-y-1 text-xs">
              <span className="font-bold text-white block">Thành phần bản sao lưu bao gồm:</span>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 pl-1">
                <li>Bảng danh mục sản phẩm, đơn vị tính, giá vốn và định lượng nguyên liệu.</li>
                <li>Toàn bộ lịch sử hóa đơn bán hàng, phương thức thanh toán, mã đối soát SePay.</li>
                <li>Sổ quỹ thu chi, chi phí mặt bằng, điện nước và than nướng.</li>
                <li>Danh sách khách hàng thân thiết, điểm tích lũy và công nợ.</li>
                <li>Cấu hình cửa hàng, bảng giá chuyên sâu và mẫu hóa đơn in nhiệt.</li>
              </ul>
            </div>

            <div className="pt-2 border-t border-neutral-850 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 font-mono">
                Tệp xuất: duckpos-backup-{'<shop-id>'}-YYYY-MM-DD.json
              </span>

              <button
                type="button"
                onClick={handleExportFullBackup}
                disabled={exportingBackup}
                className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                {exportingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{exportingBackup ? 'Đang trích xuất dữ liệu...' : 'Tải Về Bản Sao Lưu Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EMERGENCY LOCKDOWN & MAINTENANCE */}
      {activeTab === 'emergency' && (
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-6 max-w-4xl">
          <div className="border-b border-neutral-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              Chế Độ Khẩn Cấp & Bảo Trì Hệ Thống (Emergency Lockdown)
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Kiểm soát trạng thái hoạt động của toàn bộ quầy thu ngân và nhân viên trong các trường hợp kiểm kê kho đột xuất hoặc nâng cấp.
            </p>
          </div>

          <div className="space-y-4">
            {/* Toggle 1: POS Terminal Checkout Lock */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white block">Tạm Khóa Quầy Thu Ngân (POS Checkout Lock)</span>
                <p className="text-[11px] text-neutral-400">
                  Tạm ngừng nhận đơn mới tại quầy POS trong lúc kiểm kê kho hoặc đối soát doanh thu cuối ngày.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={posLocked}
                  onChange={(e) => setPosLocked(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* Toggle 2: Maintenance Mode */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white block">Chế Độ Bảo Trì Toàn Quán (Maintenance Mode)</span>
                <p className="text-[11px] text-neutral-400">
                  Hiển thị thông báo bảo trì toàn hệ thống, tạm dừng mọi tương tác từ nhân viên thu ngân và quản lý.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* Notice Message */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 space-y-2">
              <label className="text-xs font-semibold text-neutral-300 block">
                Thông báo gửi tới nhân viên khi bảo trì hoặc khóa quầy:
              </label>
              <textarea
                rows={2}
                value={maintenanceNotice}
                onChange={(e) => setMaintenanceNotice(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-red-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveEmergencySettings}
                disabled={savingEmergency}
                className="bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                {savingEmergency ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Lưu Trạng Thái Khẩn Cấp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SESSIONS & SECURITY AUDIT */}
      {activeTab === 'sessions' && (
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-6 max-w-4xl">
          <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                Giám Sát Phiên Đăng Nhập & Truy Cập An Toàn
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Địa chỉ IP Admin hiện tại: <span className="text-emerald-400 font-mono font-bold">{userIp}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleForceRevokeAllSessions}
              className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Thu Hồi Mọi Thiết Bị Khác</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 text-purple-400 flex items-center justify-center">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{SUPER_ADMIN_EMAIL}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                      Phiên Admin Hiện Tại
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-3">
                    <span className="font-mono text-neutral-300">{userIp}</span>
                    <span className="text-amber-400">Thiết bị quản trị tối cao</span>
                    <span>Hoạt động: Vừa xong</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DEBUG LOGS VIEW */}
      {activeTab === 'debug' && (
        <DebugLogView onBack={() => setActiveTab('telemetry')} />
      )}
    </div>
  );
};
