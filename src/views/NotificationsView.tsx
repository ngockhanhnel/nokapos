import React, { useState, useEffect } from 'react';
import {
  AppNotification,
  NotificationSettings,
  NotificationType,
  getNotificationSettings,
  saveNotificationSettings,
  getStoredNotifications,
  saveStoredNotifications,
  requestBrowserPermission,
  sendBrowserPushNotification,
  playNotificationSound,
} from '@/src/lib/notifications';
import { formatDateTime } from '@/src/lib/formatters';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PauseCircle,
  Volume2,
  VolumeX,
  Settings2,
  Trash2,
  Check,
  Send,
  Sparkles,
  Info,
} from 'lucide-react';

interface NotificationsViewProps {
  onNavigateToView?: (view: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigateToView }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list');

  useEffect(() => {
    setNotifications(getStoredNotifications());
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const handleUpdateSettings = (newSettings: NotificationSettings) => {
    setSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const handleRequestPermission = async () => {
    const perm = await requestBrowserPermission();
    setPermissionStatus(perm);
    if (perm === 'granted') {
      handleUpdateSettings({ ...settings, enableBrowserPush: true });
      sendBrowserPushNotification(
        'DuckPOS Pro',
        'Đã kích hoạt thành công thông báo trình duyệt cho quán vịt quay!'
      );
    }
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  const handleDeleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  const handleClearAll = () => {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử thông báo?')) return;
    setNotifications([]);
    saveStoredNotifications([]);
  };

  const handleSendTestNotification = () => {
    const testItem: AppNotification = {
      id: 'notif_' + Date.now(),
      type: 'system',
      title: 'Kiểm tra hệ thống thông báo',
      message: 'Thông báo nhắc nhở tự động của DuckPOS Pro đang hoạt động chính xác.',
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'medium',
    };

    const updated = [testItem, ...notifications];
    setNotifications(updated);
    saveStoredNotifications(updated);

    if (settings.enableSound) {
      playNotificationSound();
    }
    if (settings.enableBrowserPush) {
      sendBrowserPushNotification(testItem.title, testItem.message);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !n.read;
    return n.type === filterType;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto bg-neutral-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Trung Tâm Thông Báo & Nhắc Nhở Tự Động
          </h2>
          <p className="text-xs text-neutral-400">
            Cảnh báo hàng sắp hết, nhắc chốt ca làm việc, nhắc đơn treo và cấu hình thông báo trình duyệt
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'list' ? 'settings' : 'list')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              activeTab === 'settings'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>{activeTab === 'settings' ? 'Xem thông báo' : 'Cài đặt nhắc nhở'}</span>
          </button>

          <button
            onClick={handleSendTestNotification}
            className="py-2 px-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Thử nghiệm</span>
          </button>
        </div>
      </div>

      {/* Browser Notification Permission Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              permissionStatus === 'granted'
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-400'
                : 'bg-amber-950/80 border border-amber-800 text-amber-400'
            }`}
          >
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">
              {permissionStatus === 'granted'
                ? 'Thông báo trình duyệt đang BẬT'
                : 'Thông báo trình duyệt chưa kích hoạt'}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {permissionStatus === 'granted'
                ? 'Quán sẽ nhận cảnh báo tức thời khi hàng sắp hết hoặc cần chốt ca ngay cả khi chuyển tab khác.'
                : 'Nhấn bật để trình duyệt gửi thông báo đẩy đến điện thoại và máy tính của bạn.'}
            </p>
          </div>
        </div>

        {permissionStatus !== 'granted' ? (
          <button
            onClick={handleRequestPermission}
            className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs transition-colors shadow-sm shrink-0"
          >
            Bật thông báo ngay
          </button>
        ) : (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            Đã cấp quyền
          </span>
        )}
      </div>

      {/* SETTINGS VIEW */}
      {activeTab === 'settings' ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-neutral-800">
            <Settings2 className="w-4 h-4 text-amber-500" />
            Cấu hình nhắc nhở tự động
          </h3>

          <div className="space-y-3 divide-y divide-neutral-800/60 text-xs">
            {/* Sound alert */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  {settings.enableSound ? (
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-neutral-500" />
                  )}
                  Âm thanh chuông báo
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Phát âm thanh chuông khi có thông báo nhắc việc mới
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={playNotificationSound}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[11px] font-medium"
                >
                  Nghe thử
                </button>
                <input
                  type="checkbox"
                  checked={settings.enableSound}
                  onChange={(e) =>
                    handleUpdateSettings({ ...settings, enableSound: e.target.checked })
                  }
                  className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4"
                />
              </div>
            </div>

            {/* Repeat interval */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Chu kỳ quét và nhắc lại tự động</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Tần suất hệ thống kiểm tra và nhắc nhở các cảnh báo chưa xử lý
                </div>
              </div>

              <select
                value={settings.repeatMinutes}
                onChange={(e) =>
                  handleUpdateSettings({ ...settings, repeatMinutes: parseInt(e.target.value) })
                }
                className="bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-hidden focus:border-amber-500"
              >
                <option value={15}>Mỗi 15 phút</option>
                <option value={30}>Mỗi 30 phút</option>
                <option value={60}>Mỗi 60 phút</option>
              </select>
            </div>

            {/* Low stock alert */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Cảnh báo tồn kho vịt quay thấp
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Tự động cảnh báo khi số lượng vịt hoặc nguyên liệu chạm ngưỡng tối thiểu
                </div>
              </div>

              <input
                type="checkbox"
                checked={settings.alertLowStock}
                onChange={(e) =>
                  handleUpdateSettings({ ...settings, alertLowStock: e.target.checked })
                }
                className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4"
              />
            </div>

            {/* Shift overtime alert */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Nhắc chốt ca làm việc thu ngân
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Tự động nhắc chốt ca và kiểm đếm tiền mặt khi ca mở quá 8 tiếng
                </div>
              </div>

              <input
                type="checkbox"
                checked={settings.alertShiftOvertime}
                onChange={(e) =>
                  handleUpdateSettings({ ...settings, alertShiftOvertime: e.target.checked })
                }
                className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4"
              />
            </div>

            {/* Hold order alert */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <PauseCircle className="w-4 h-4 text-blue-400" />
                  Nhắc đơn hàng đang treo quá lâu
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Cảnh báo khi có đơn hàng tạm hoãn quá 15 phút mà chưa thanh toán
                </div>
              </div>

              <input
                type="checkbox"
                checked={settings.alertLongHoldOrders}
                onChange={(e) =>
                  handleUpdateSettings({ ...settings, alertLongHoldOrders: e.target.checked })
                }
                className="rounded border-neutral-700 text-red-600 focus:ring-0 w-4 h-4"
              />
            </div>
          </div>
        </div>
      ) : (
        /* NOTIFICATIONS LIST VIEW */
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                ['all', `Tất cả (${notifications.length})`],
                ['unread', `Chưa đọc (${unreadCount})`],
                ['stock', 'Kho hàng'],
                ['shift', 'Ca trực'],
                ['hold', 'Đơn treo'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    filterType === key
                      ? 'bg-red-800 text-white'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-amber-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Đọc tất cả
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {/* List items */}
          {filteredNotifications.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center text-xs text-neutral-500 flex flex-col items-center justify-center">
              <Bell className="w-10 h-10 mb-2 opacity-30 text-amber-500" />
              <p className="font-semibold text-neutral-300">Không có thông báo nào</p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Các cảnh báo kho, nhắc chốt ca và đơn treo sẽ tự động xuất hiện tại đây
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((n) => {
                const isStock = n.type === 'stock';
                const isShift = n.type === 'shift';
                const isHold = n.type === 'hold';

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      !n.read
                        ? 'bg-neutral-900 border-neutral-700 shadow-xs'
                        : 'bg-neutral-900/60 border-neutral-800/80 opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isStock
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : isShift
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : isHold
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {isStock ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : isShift ? (
                          <Clock className="w-4 h-4" />
                        ) : isHold ? (
                          <PauseCircle className="w-4 h-4" />
                        ) : (
                          <Info className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{n.title}</h4>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="text-[10px] text-neutral-500 mt-1.5 tabular-nums">
                          {formatDateTime(n.timestamp)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!n.read && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
                          title="Đánh dấu đã đọc"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Xóa thông báo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
