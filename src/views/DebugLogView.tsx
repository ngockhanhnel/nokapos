import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { logger, LogEntry, LogLevel } from '@/src/lib/logger';
import { 
  Terminal, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Download, 
  Power, 
  RefreshCw, 
  AlertTriangle,
  Bug,
  Lock,
  ArrowLeft
} from 'lucide-react';

interface DebugLogViewProps {
  onBack?: () => void;
}

export const DebugLogView: React.FC<DebugLogViewProps> = ({ onBack }) => {
  const { userRole } = useAuth();
  const isOwner = userRole === 'owner';
  const isProduction = import.meta.env.PROD || process.env.NODE_ENV === 'production';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDebugEnabled, setIsDebugEnabled] = useState<boolean>(logger.isDebugEnabled);

  // Environment Guard: If production, do NOT register subscribers or log listeners
  useEffect(() => {
    if (isProduction) return;

    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, [isProduction]);

  // Security Check: Only owners / admins can view
  if (!isOwner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-950 text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Quyền truy cập bị từ chối</h3>
        <p className="text-xs text-neutral-400 max-w-md mb-6">
          Khu vực gỡ lỗi và nhật ký hệ thống chỉ dành riêng cho tài khoản Chủ quán (Owner / Admin).
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Quay lại
          </button>
        )}
      </div>
    );
  }

  // Production Auto-removal Notice: In production build, the component auto-silences
  if (isProduction) {
    return (
      <div className="flex-1 p-6 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                Giao Diện Gỡ Lỗi (Debug Logs)
              </h2>
              <p className="text-xs text-neutral-400">Trạng thái môi trường Production</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Đã ngắt hoàn toàn khi xuất bản (Production)
          </span>
        </div>

        <div className="p-6 bg-emerald-950/30 border border-emerald-800/60 rounded-2xl text-emerald-200 text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
            <ShieldCheck className="w-5 h-5" />
            Cơ chế bảo mật xuất bản kích hoạt tự động (Auto-Stripped)
          </div>
          <p className="leading-relaxed text-neutral-300">
            Hệ thống đã tự động gắt (strip) toàn bộ bộ thu thập nhật ký debug và vô hiệu hóa công cụ theo dõi trên bản Production này.
            Điều này bảo đảm:
          </p>
          <ul className="list-disc list-inside space-y-1 text-neutral-400 pl-2">
            <li>Tuyệt đối không rò rỉ dữ liệu tài chính, khách hàng hoặc API keys ra console trình duyệt.</li>
            <li>Tối ưu 100% tài nguyên CPU và bộ nhớ RAM của thiết bị bán hàng.</li>
            <li>Ngăn chặn các công cụ khai thác và dò quét mã nguồn trong môi trường thực tế.</li>
          </ul>
        </div>
      </div>
    );
  }

  // Development View
  const handleToggleDebug = () => {
    const nextState = !isDebugEnabled;
    logger.setDebugEnabled(nextState);
    setIsDebugEnabled(logger.isDebugEnabled);
    if (nextState) {
      logger.info('ADMIN_DEBUG', 'Chủ quán đã kích hoạt chế độ gỡ lỗi');
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `duckpos-debug-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopy = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.tag}] ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Distinct tags found in current logs
  const availableTags = ['ALL', ...Array.from(new Set(logs.map((l) => l.tag)))];

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (filterTag !== 'ALL' && log.tag !== filterTag) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.tag.toLowerCase().includes(q) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getBadgeColor = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-950 text-red-400 border-red-800';
      case 'WARN':
        return 'bg-amber-950 text-amber-400 border-amber-800';
      case 'INFO':
        return 'bg-blue-950 text-blue-400 border-blue-800';
      case 'DEBUG':
        return 'bg-neutral-800 text-purple-400 border-neutral-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-purple-400" />
              Bảng Theo Dõi Debug Logs (Lập Trình Viên & Admin)
            </h2>
            <p className="text-xs text-neutral-400">
              Thu thập sự kiện vận hành theo thời gian thực (Tự động gắt hoàn toàn trên bản Production)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-400 text-xs font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            Development Build
          </span>
          <button
            type="button"
            onClick={handleToggleDebug}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isDebugEnabled
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isDebugEnabled ? 'BẬT LOG' : 'TẮT LOG'}</span>
          </button>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc từ khóa hoặc mã lỗi..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-hidden focus:border-purple-500 font-mono"
            />
          </div>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-hidden focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">Mọi cấp độ ({logs.length})</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>

          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-hidden focus:border-purple-500 cursor-pointer"
          >
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                Tag: {tag}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              logger.debug('SYSTEM_SAMPLE', 'Thao tác mẫu kiểm tra logging', { memoryMb: 42, pingMs: 18 });
            }}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
            title="Thêm log mẫu"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Thử nghiệm</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            disabled={logs.length === 0}
            className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải JSON</span>
          </button>

          <button
            type="button"
            onClick={() => logger.clear()}
            disabled={logs.length === 0}
            className="bg-neutral-800 hover:bg-red-950 disabled:opacity-40 text-neutral-300 hover:text-red-300 border border-neutral-700 hover:border-red-800 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa</span>
          </button>
        </div>
      </div>

      {/* Terminal stream container */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden font-mono text-[11px] shadow-2xl">
        <div className="bg-neutral-900/90 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between text-neutral-400 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="ml-2 font-bold text-neutral-300">LIVE CONSOLE STREAM</span>
          </div>
          <span>{filteredLogs.length} sự kiện hiển thị</span>
        </div>

        <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-neutral-600">
              {logs.length === 0
                ? 'Chưa ghi nhận sự kiện nào. Hãy thao tác trên ứng dụng để xem log.'
                : 'Không có bản ghi log nào khớp với bộ lọc hiện tại.'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 hover:bg-neutral-900/70 p-2 rounded-xl transition border border-transparent hover:border-neutral-800"
              >
                <span className="text-neutral-500 shrink-0 select-none">{log.timestamp}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${getBadgeColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-amber-400 font-bold shrink-0">[{log.tag}]</span>
                <span className="text-neutral-200 break-all flex-1">{log.message}</span>
                {log.data && (
                  <span
                    className="text-neutral-500 text-[10px] truncate max-w-[220px] bg-neutral-900 px-2 py-0.5 rounded"
                    title={JSON.stringify(log.data, null, 2)}
                  >
                    {JSON.stringify(log.data)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
