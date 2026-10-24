import React, { useState, useEffect } from 'react';
import { logger, LogEntry, LogLevel } from '@/src/lib/logger';
import { Terminal, ShieldAlert, ShieldCheck, Trash2, Copy, Check, Search, Filter, AlertTriangle, Bug, RefreshCw, Power } from 'lucide-react';

export const DebugLogSettings: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDebugEnabled, setIsDebugEnabled] = useState<boolean>(logger.isDebugEnabled);

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleDebug = () => {
    const nextState = !isDebugEnabled;
    logger.setDebugEnabled(nextState);
    setIsDebugEnabled(logger.isDebugEnabled);
    if (nextState) {
      logger.info('DEBUG_SYSTEM', 'Lập trình viên đã bật chế độ Debug Log');
    }
  };

  const handleClearLogs = () => {
    logger.clear();
  };

  const handleCopyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.tag}] ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            Nhật Ký Gỡ Lỗi Lập Trình (Developer Debug Log)
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Giao diện theo dõi log vận hành trong lập trình code. Khi xuất bản (Publish/Production), hệ thống tự động ngắt hoàn toàn.
          </p>
        </div>

        {/* Production Protection Status Pill */}
        <div className="flex items-center gap-2">
          {logger.isProduction ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Tự động ngắt khi Publish (Production Mode)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-400 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
              Chế độ Lập trình (Development Mode)
            </span>
          )}
        </div>
      </div>

      {/* Production Notice Banner */}
      {logger.isProduction ? (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 text-xs space-y-1">
          <div className="font-bold flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="w-4 h-4" />
            Cơ chế bảo vệ Production đang kích hoạt
          </div>
          <p className="text-neutral-300">
            Mọi nhật ký gỡ lỗi (Debug Logs) và luồng theo dõi bảng điều khiển đã tự động bị ngắt hoàn toàn trên môi trường xuất bản nhằm bảo mật 100% dữ liệu tài chính, khách hàng và tối ưu dung lượng RAM máy chủ.
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/60 text-purple-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-bold text-white flex items-center gap-2">
              <Bug className="w-4 h-4 text-purple-400" />
              Công tắc gỡ lỗi lập trình (Local Dev Toggle)
            </div>
            <p className="text-neutral-400 text-[11px]">
              {isDebugEnabled
                ? 'Đang bật theo dõi log chi tiết: Sự kiện POS, đơn hàng, SePay webhook, AI chat.'
                : 'Đã tạm tắt log chi tiết.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleDebug}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              isDebugEnabled
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isDebugEnabled ? 'Đang Bật Log' : 'Đang Tắt Log'}</span>
          </button>
        </div>
      )}

      {/* Controls Bar: Search, Filter, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tag hoặc thông điệp log..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-hidden focus:border-purple-500 font-mono"
            />
          </div>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-hidden focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">Tất cả ({logs.length})</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Test log trigger button for developers */}
          {!logger.isProduction && (
            <button
              type="button"
              onClick={() => {
                logger.info('TEST_EVENT', 'Gửi log thử nghiệm từ Trang Quản trị', { time: new Date().toISOString() });
              }}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              title="Phát sinh log mẫu"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Phát log mẫu</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép log'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="bg-neutral-800 hover:bg-red-950 disabled:opacity-40 text-neutral-300 hover:text-red-300 border border-neutral-700 hover:border-red-800 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa log</span>
          </button>
        </div>
      </div>

      {/* Console Viewer */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden font-mono text-[11px] shadow-inner">
        <div className="bg-neutral-900/80 px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-neutral-400 text-[10px]">
          <span>TERMINAL BUFFER ({filteredLogs.length} dòng hiển thị)</span>
          <span className="text-neutral-500">Tự động giới hạn 100 dòng mới nhất</span>
        </div>

        <div className="p-3 max-h-72 overflow-y-auto space-y-1.5">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-neutral-600">
              {logs.length === 0 ? 'Chưa có bản ghi log nào được phát sinh.' : 'Không tìm thấy log khớp bộ lọc.'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 hover:bg-neutral-900/60 p-1.5 rounded-lg transition-colors border border-transparent hover:border-neutral-850"
              >
                <span className="text-neutral-500 shrink-0 select-none">{log.timestamp}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${getBadgeColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-amber-400/90 font-bold shrink-0">[{log.tag}]</span>
                <span className="text-neutral-200 break-all flex-1">{log.message}</span>
                {log.data && (
                  <span className="text-neutral-500 text-[10px] truncate max-w-[200px]" title={JSON.stringify(log.data, null, 2)}>
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
