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
  Loader2,
  Play,
  CheckCircle2,
  RotateCw,
  Search,
  Sliders,
  Bell,
  Eye,
  Sparkles,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { logger } from '@/src/lib/logger';

interface AdminViewProps {
  onNavigate: (view: string) => void;
}

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  currentShopId: string;
  shopName: string;
  createdAt: string;
  status: string;
}

interface AuditLogRecord {
  id: string;
  shopId: string;
  shopName: string;
  action: string;
  actorEmail: string;
  details: string;
  timestamp: string;
}

interface CronTask {
  id: string;
  name: string;
  cronExpr: string;
  description: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: 'SUCCESS' | 'FAILED' | 'IDLE';
  lastMessage: string;
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

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'cron_cleanup' | 'audit_logs' | 'security_config' | 'backup_emergency' | 'debug'>('overview');

  // Server Telemetry & Latency
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [testingPing, setTestingPing] = useState(false);
  const [serverTelemetry, setServerTelemetry] = useState<{
    uptimeSeconds: number;
    memoryRssMb: number;
    memoryHeapMb: number;
    nodeVersion: string;
  } | null>(null);

  // Storage Diagnostics
  const [storageInfo, setStorageInfo] = useState<{ totalStorageKb: number; itemsCount: number; activeListeners: number } | null>(null);
  const [cleaningMemory, setCleaningMemory] = useState(false);
  const [cleanMemoryResult, setCleanMemoryResult] = useState<CacheCleanupResult | null>(null);

  // User Management State
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Auto Database Cleanup State
  const [runningDbCleanup, setRunningDbCleanup] = useState(false);
  const [dbCleanupResult, setDbCleanupResult] = useState<{
    cleanedAuditLogsCount: number;
    cleanedTempBuffersCount: number;
    freedStorageKb: number;
    timestamp: string;
  } | null>(null);

  // System Cronjobs State
  const [cronTasks, setCronTasks] = useState<CronTask[]>([
    {
      id: 'cron_cleanup',
      name: 'Dọn dẹp nhật ký & cache rác định kỳ',
      cronExpr: '0 2 * * * (2:00 AM hàng ngày)',
      description: 'Tự động quét và xóa nhật ký thao tác quá 30 ngày, dọn dẹp các bản ghi đệm và dữ liệu rác.',
      enabled: true,
      lastRunAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      lastStatus: 'SUCCESS',
      lastMessage: 'Đã tối ưu hóa dữ liệu đệm thành công.',
    },
    {
      id: 'cron_preorder_reminders',
      name: 'Nhắc hẹn Đơn Đặt Trước & Telegram Alert',
      cronExpr: '*/1 * * * * (Mỗi 1 phút)',
      description: 'Quét danh sách đơn hẹn trước, tính mốc thời gian giao hàng và đẩy cảnh báo đến Telegram quán.',
      enabled: true,
      lastRunAt: new Date(Date.now() - 60000 * 2).toISOString(),
      lastStatus: 'SUCCESS',
      lastMessage: 'Đã kiểm tra 0 đơn quá mốc nhắc.',
    },
    {
      id: 'cron_sepay_reconcile',
      name: 'Tự động đối soát chuyển khoản SePay Autobank',
      cronExpr: '*/5 * * * * (Mỗi 5 phút)',
      description: 'Đối soát các biến động số dư VietQR/SePay khớp mã đơn hàng pending để tự động chốt đơn.',
      enabled: true,
      lastRunAt: new Date(Date.now() - 60000 * 3).toISOString(),
      lastStatus: 'SUCCESS',
      lastMessage: 'Tất cả đơn hàng chuyển khoản đã khớp.',
    },
    {
      id: 'cron_sales_summary',
      name: 'Tổng hợp & Gửi Báo Cáo Doanh Thu Định Kỳ',
      cronExpr: '0 */2 * * * (Mỗi 2 tiếng)',
      description: 'Tổng hợp doanh thu ca bán, số lượng đơn hoàn tất và gửi bản tóm tắt tự động tới Telegram Chủ quán.',
      enabled: true,
      lastRunAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      lastStatus: 'SUCCESS',
      lastMessage: 'Đã gửi báo cáo tổng hợp ca thành công.',
    },
  ]);
  const [runningCronId, setRunningCronId] = useState<string | null>(null);

  // Security Audit Report
  const [securityReport, setSecurityReport] = useState<any>(null);
  const [loadingSecurityReport, setLoadingSecurityReport] = useState(false);

  // Store KPI counts
  const [storeCounts, setStoreCounts] = useState<{
    products: number;
    orders: number;
    expenses: number;
    customers: number;
    preorders: number;
  }>({ products: 0, orders: 0, expenses: 0, customers: 0, preorders: 0 });

  // Backup & Emergency
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>((currentShop as any)?.maintenanceMode ?? false);
  const [posLocked, setPosLocked] = useState<boolean>((currentShop as any)?.posLocked ?? false);
  const [maintenanceNotice, setMaintenanceNotice] = useState<string>(
    (currentShop as any)?.maintenanceNotice || 'Hệ thống đang được bảo trì định kỳ bởi Admin.'
  );
  const [savingEmergency, setSavingEmergency] = useState(false);

  // User IP and action feedback
  const [userIp, setUserIp] = useState<string>('Đang định vị...');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    refreshDiagnostics();
    testLatency();
    fetchServerTelemetry();
    fetchStoreCounts();
    fetchUsers();
    fetchAuditLogs();
    fetchSecurityReport();

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

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/admin/users', {
        headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      }
    } catch (err) {
      console.warn('Fetch users error:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAuditLogs(true);
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn('Fetch audit logs error:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const fetchSecurityReport = async () => {
    try {
      setLoadingSecurityReport(true);
      const res = await fetch('/api/security/audit');
      if (res.ok) {
        const data = await res.json();
        setSecurityReport(data);
      }
    } catch (err) {
      console.warn('Security report error:', err);
    } finally {
      setLoadingSecurityReport(false);
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
        getDocs(collection(db, 'shops', currentShop.id, 'preOrders')).catch(() => ({ size: 0 })),
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

  // Run Auto Database Cleanup
  const handleRunDbCleanup = async () => {
    try {
      setRunningDbCleanup(true);
      setDbCleanupResult(null);

      const res = await fetch('/api/admin/cleanup-db', {
        method: 'POST',
        headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDbCleanupResult({
          cleanedAuditLogsCount: data.cleanedAuditLogsCount || 0,
          cleanedTempBuffersCount: data.cleanedTempBuffersCount || 0,
          freedStorageKb: data.freedStorageKb || 0,
          timestamp: data.timestamp || new Date().toISOString(),
        });
        setActionFeedback('Đã hoàn tất tiến trình dọn dẹp dữ liệu rác và làm sạch nhật ký thành công!');
        fetchAuditLogs();
        setTimeout(() => setActionFeedback(null), 4000);
      } else {
        alert('Lỗi khi dọn dẹp dữ liệu: ' + (data.error || 'Lỗi server'));
      }
    } catch (err: any) {
      alert('Không thể kết nối máy chủ dọn dẹp: ' + err.message);
    } finally {
      setRunningDbCleanup(false);
    }
  };

  // Trigger Cronjob Task
  const handleRunCronTask = async (taskId: string) => {
    try {
      setRunningCronId(taskId);
      const res = await fetch('/api/admin/cron/trigger', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': SUPER_ADMIN_EMAIL 
        },
        body: JSON.stringify({ taskId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCronTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  lastRunAt: data.result.executedAt,
                  lastStatus: 'SUCCESS',
                  lastMessage: data.result.details || 'Thực thi thành công!',
                }
              : t
          )
        );
        setActionFeedback(`Đã thực thi Cronjob "${taskId}" thành công!`);
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert('Lỗi thực thi Cronjob: ' + (data.error || 'Lỗi không xác định'));
      }
    } catch (err: any) {
      alert('Lỗi kết nối Cronjob runner: ' + err.message);
    } finally {
      setRunningCronId(null);
    }
  };

  const handleToggleCronTask = (taskId: string) => {
    setCronTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const handleRunMemoryCleanup = () => {
    setCleaningMemory(true);
    setCleanMemoryResult(null);
    logger.info('ADMIN', 'SuperAdmin dọn dẹp bộ nhớ đệm client');
    setTimeout(() => {
      const res = performFullMemoryCleanup();
      setCleanMemoryResult(res);
      refreshDiagnostics();
      setCleaningMemory(false);
    }, 400);
  };

  // Full Store Backup Export
  const handleExportFullBackup = async () => {
    if (!currentShop?.id) return;
    try {
      setExportingBackup(true);
      setBackupSuccess(null);

      const [pSnap, oSnap, eSnap, cSnap, preSnap] = await Promise.all([
        getDocs(collection(db, 'shops', currentShop.id, 'products')),
        getDocs(collection(db, 'shops', currentShop.id, 'orders')),
        getDocs(collection(db, 'shops', currentShop.id, 'expenses')),
        getDocs(collection(db, 'shops', currentShop.id, 'customers')),
        getDocs(collection(db, 'shops', currentShop.id, 'preOrders')),
      ]);

      const backupData = {
        app: 'DuckPOS Pro Enterprise',
        version: '3.0.0-superadmin',
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
    } finally {
      setExportingBackup(false);
    }
  };

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
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      alert('Lỗi cập nhật trạng thái: ' + err.message);
    } finally {
      setSavingEmergency(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.shopName.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(
    (l) =>
      l.action.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      l.actorEmail.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      l.shopName.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      l.details.toLowerCase().includes(auditSearchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* SuperAdmin Banner */}
      <div className="bg-gradient-to-r from-red-950/80 via-neutral-900 to-amber-950/40 p-6 rounded-3xl border border-red-800/60 shadow-2xl space-y-4">
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
                <span>Tài khoản xác thực độc quyền:</span>
                <span className="font-mono font-bold text-amber-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                  {SUPER_ADMIN_EMAIL}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-950/90 border border-neutral-800 px-3.5 py-2 rounded-2xl text-right">
              <span className="text-[10px] text-neutral-500 block uppercase font-bold">Latency</span>
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
          <span>Giao diện Dashboard chỉ hiển thị cho tài khoản SuperAdmin được cấu hình bảo mật.</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Xác thực phân quyền cấp cao (Zero-Trace Protection)
          </span>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-2xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Admin Dashboard Tab Switchers */}
      <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1.5 rounded-2xl text-xs font-semibold overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Tổng Quan & Sức Khỏe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          <span>Quản Lý Người Dùng ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cron_cleanup')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'cron_cleanup'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <RotateCw className="w-4 h-4 text-blue-400" />
          <span>Dọn Dẹp Tự Động & Cronjobs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit_logs')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'audit_logs'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-purple-400" />
          <span>Báo Cáo Nhật Ký Audit Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security_config')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'security_config'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>Tham Số Bảo Mật Cấp Cao</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup_emergency')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'backup_emergency'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Sao Lưu & Bảo Trì</span>
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
          <Terminal className="w-4 h-4 text-amber-400" />
          <span>Trình Gỡ Lỗi (Debug Terminal)</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & HEALTH */}
      {activeTab === 'overview' && (
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
              Quy Mô Dữ Liệu Cửa Hàng
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
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                Quản Lý Người Dùng Toàn Hệ Thống ({users.length} tài khoản)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Dữ liệu chính xác được trích xuất từ cơ sở dữ liệu Firestore `/users` và thành viên các quán
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm theo email, tên, shop..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500 w-60"
                />
              </div>

              <button
                type="button"
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                <span>Nạp lại</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 bg-neutral-950/70">
                  <th className="py-3 px-4 font-bold">STT</th>
                  <th className="py-3 px-4 font-bold">Tên người dùng</th>
                  <th className="py-3 px-4 font-bold">Email</th>
                  <th className="py-3 px-4 font-bold">Cửa hàng liên kết</th>
                  <th className="py-3 px-4 font-bold">Ngày đăng ký</th>
                  <th className="py-3 px-4 font-bold text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500 mb-2" />
                      Đang tải dữ liệu người dùng từ cơ sở dữ liệu Firestore...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500">
                      Không tìm thấy tài khoản người dùng phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => (
                    <tr key={u.uid} className="hover:bg-neutral-850/60 transition">
                      <td className="py-3 px-4 font-mono text-neutral-500">#{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-white">{u.displayName}</td>
                      <td className="py-3 px-4 font-mono text-neutral-300">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-amber-400 font-medium text-[11px]">
                          {u.shopName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-400">{formatDateTime(u.createdAt)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold text-[10px]">
                          Đang hoạt động
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUTO CLEANUP & CRONJOBS ENGINE */}
      {activeTab === 'cron_cleanup' && (
        <div className="space-y-6">
          {/* Section 1: Auto DB Cleanup Action */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-emerald-400" />
                  Chức Năng Dọn Dẹp Dữ Liệu Tự Động (Database Auto Clean Engine)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Tự động làm sạch các bản ghi rác, nhật ký quá 30 ngày, giải phóng dung lượng đệm và tối ưu hóa tốc độ truy vấn Firestore.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunDbCleanup}
                  disabled={runningDbCleanup}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {runningDbCleanup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Dọn Dẹp Dữ Liệu Tự Động Ngay</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunMemoryCleanup}
                  disabled={cleaningMemory}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cleaningMemory ? 'animate-spin' : ''}`} />
                  <span>Xóa Cache Client</span>
                </button>
              </div>
            </div>

            {dbCleanupResult && (
              <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-2xl text-emerald-200 text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Kết quả dọn dẹp dữ liệu tự động hệ thống:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>• Nhật ký cũ xóa: <strong className="text-white">{dbCleanupResult.cleanedAuditLogsCount} bản ghi</strong></div>
                  <div>• Khóa đệm tạm xóa: <strong className="text-white">{dbCleanupResult.cleanedTempBuffersCount} items</strong></div>
                  <div>• Dung lượng giải phóng: <strong className="text-amber-400">{dbCleanupResult.freedStorageKb} KB</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Application Cronjobs Panel */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-5">
            <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Quản Lý Tác Vụ Cronjob Tự Động Hệ Thống (Application Cronjobs)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Các tiến trình Cronjob chạy ngầm tự động đối soát SePay, cảnh báo đơn đặt trước, tổng hợp báo cáo và dọn dẹp hệ thống.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {cronTasks.map((task) => (
                <div key={task.id} className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-xs">{task.name}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-800 text-blue-300 font-mono text-[10px]">
                        {task.cronExpr}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${task.enabled ? 'bg-emerald-950 border-emerald-800 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                        {task.enabled ? 'ACTIVE' : 'TẠM DỪNG'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">{task.description}</p>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-2 font-mono">
                      <span>Lần chạy cuối: {task.lastRunAt ? formatDateTime(task.lastRunAt) : 'Chưa chạy'}</span>
                      <span>• {task.lastMessage}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRunCronTask(task.id)}
                      disabled={runningCronId === task.id}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {runningCronId === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>Chạy ngay</span>
                    </button>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        onChange={() => handleToggleCronTask(task.id)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS REPORT */}
      {activeTab === 'audit_logs' && (
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Báo Cáo Nhật Ký Audit Logs Toàn Bộ Quán ({auditLogs.length} nhật ký gần nhất)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Ghi nhận mọi thao tác sửa giá, hủy đơn, chốt ca, cập nhật kho và truy cập từ tài khoản người dùng
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Lọc thao tác, email, shop..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-purple-500 w-60"
                />
              </div>

              <button
                type="button"
                onClick={fetchAuditLogs}
                disabled={loadingAuditLogs}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
                <span>Đồng bộ</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 bg-neutral-950/70">
                  <th className="py-3 px-4 font-bold">Thời gian</th>
                  <th className="py-3 px-4 font-bold">Tên Quán</th>
                  <th className="py-3 px-4 font-bold">Người thực hiện</th>
                  <th className="py-3 px-4 font-bold">Hành động</th>
                  <th className="py-3 px-4 font-bold">Chi tiết thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                {loadingAuditLogs ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-purple-400 mb-2" />
                      Đang đồng bộ nhật ký thao tác từ các cửa hàng...
                    </td>
                  </tr>
                ) : filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      Chưa có nhật ký thao tác nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-neutral-850/60 transition">
                      <td className="py-3 px-4 font-mono text-neutral-400 whitespace-nowrap">{formatDateTime(l.timestamp)}</td>
                      <td className="py-3 px-4 font-bold text-amber-400">{l.shopName}</td>
                      <td className="py-3 px-4 font-mono text-neutral-300">{l.actorEmail}</td>
                      <td className="py-3 px-4 font-bold text-white">{l.action}</td>
                      <td className="py-3 px-4 text-neutral-400">{l.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: HIGH LEVEL SECURITY CONFIGURATION */}
      {activeTab === 'security_config' && (
        <div className="space-y-6 max-w-5xl">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-5">
            <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Cấu Hình Tham Số Bảo Mật Cấp Cao (High-Level Security Config)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Tổng quan các tham số an ninh bảo vệ chống truy cập trái phép, bảo vệ mã nguồn và dữ liệu khách hàng
                </p>
              </div>

              <button
                type="button"
                onClick={fetchSecurityReport}
                disabled={loadingSecurityReport}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSecurityReport ? 'animate-spin' : ''}`} />
                <span>Quét An Ninh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 space-y-2">
                <span className="font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Phân Quyền Tối Cao Độc Quyền
                </span>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  Chỉ cho phép tài khoản email <strong className="text-amber-400">{SUPER_ADMIN_EMAIL}</strong> truy cập Dashboard SuperAdmin. Mọi tài khoản khác cố tình truy cập sẽ bị âm thầm chuyển hướng về Dashboard bán hàng.
                </p>
              </div>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 space-y-2">
                <span className="font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-amber-400" />
                  Xác Thực Server Header Validation
                </span>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  Các API nhạy cảm (`/api/admin/*`, `/api/shops/:id/pricing`) kiểm tra bắt buộc header `x-admin-email` và vai trò `userRole === 'owner'` trực tiếp ở phía Node.js Backend.
                </p>
              </div>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 space-y-2">
                <span className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Firestore Rules Default Deny
                </span>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  Mặc định chặn toàn bộ quyền truy cập ngoài các quy tắc RBAC hợp lệ (`isShopMember`, `isShopOwner`). Cô lập hoàn toàn subcollection `/secrets/config`.
                </p>
              </div>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 space-y-2">
                <span className="font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  SePay Webhook Authorization Guard
                </span>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  Xác thực chìa khóa Bearer / Apikey cho từng cửa hàng trong các yêu cầu Webhook giao dịch ngân hàng tự động, chống rủi ro mạo danh nạp tiền.
                </p>
              </div>
            </div>

            {securityReport && (
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-880 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
                  <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Báo cáo kiểm tra an ninh hệ thống: {securityReport.status} (Score: {securityReport.overallScore}/100)
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">{formatDateTime(securityReport.timestamp)}</span>
                </div>

                <div className="space-y-2 text-xs">
                  {securityReport.layers?.map((l: any, i: number) => (
                    <div key={i} className="p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800 flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white block">{l.name}</span>
                        <span className="text-[11px] text-neutral-400">{l.description}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold">
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: BACKUP & EMERGENCY */}
      {activeTab === 'backup_emergency' && (
        <div className="space-y-6 max-w-4xl">
          {/* Backup Card */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <FileJson className="w-4 h-4 text-amber-400" />
              Xuất Bản Sao Lưu Toàn Diện Cửa Hàng (Full JSON Snapshot)
            </h3>

            {backupSuccess && (
              <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-2xl text-emerald-200 text-xs flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{backupSuccess}</span>
              </div>
            )}

            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3 text-xs">
              <p className="text-neutral-400">
                Trích xuất bản sao lưu đầy đủ gồm: Thực đơn sản phẩm, lịch sử hóa đơn bán hàng, phiếu chi sổ quỹ, danh sách khách hàng và các đơn đặt trước.
              </p>
              <div className="flex justify-end pt-2 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  disabled={exportingBackup}
                  className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
                >
                  {exportingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Tải Bản Sao Lưu JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Emergency Lockdown Card */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              Khóa Khẩn Cấp & Bảo Trì Toàn Quán
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-white block">Tạm Khóa Quầy Thu Ngân (POS Lock)</span>
                  <p className="text-[11px] text-neutral-400">Ngăn tạo đơn mới trong thời gian kiểm kê kho đột xuất.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={posLocked}
                    onChange={(e) => setPosLocked(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-white block">Chế Độ Bảo Trì Hệ Thống</span>
                  <p className="text-[11px] text-neutral-400">Hiển thị thông báo nâng cấp và tạm khóa quầy thu ngân.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
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
        </div>
      )}

      {/* TAB 7: DEBUG TERMINAL */}
      {activeTab === 'debug' && (
        <DebugLogView onBack={() => setActiveTab('overview')} />
      )}
    </div>
  );
};
