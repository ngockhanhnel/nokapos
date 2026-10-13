import { Product, Shift, HoldOrder, PreOrder } from '@/src/types';

export type NotificationType = 'stock' | 'shift' | 'hold' | 'preorder' | 'system';
export type NotificationPriority = 'high' | 'medium' | 'low';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: NotificationPriority;
  linkView?: string;
}

export interface NotificationSettings {
  enableBrowserPush: boolean;
  enableSound: boolean;
  alertLowStock: boolean;
  alertShiftOvertime: boolean;
  alertLongHoldOrders: boolean;
  alertPreOrders: boolean;
  repeatMinutes: number; // 15, 30, 60
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enableBrowserPush: false,
  enableSound: true,
  alertLowStock: true,
  alertShiftOvertime: true,
  alertLongHoldOrders: true,
  alertPreOrders: true,
  repeatMinutes: 15,
};

// Local storage keys
const SETTINGS_KEY = 'duckpos_notification_settings';
const NOTIFICATIONS_KEY = 'duckpos_notifications';
const LAST_ALERT_RUN_KEY = 'duckpos_last_alert_run';

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(list: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, 50)));
    // Dispatch a custom event so other components can update badge in real time
    window.dispatchEvent(new Event('duckpos_notifications_updated'));
  } catch (e) {
    console.error(e);
  }
}

export function getUnreadNotificationCount(): number {
  const list = getStoredNotifications();
  return list.filter((n) => !n.read).length;
}

// Play notification sound using Web Audio API
export function playNotificationSound(): void {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.error('Audio playback error:', e);
  }
}

// Request Web Notification permission
export async function requestBrowserPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

// Send browser notification
export function sendBrowserPushNotification(title: string, body: string): void {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%237f1d1d'/><text x='50' y='65' font-size='50' text-anchor='middle'>🦆</text></svg>",
      });
    } catch (e) {
      console.error('Push notification error:', e);
    }
  }
}

/**
 * Background auto-scan & reminder function.
 * Checks low stock, shifts running over 8 hours, and orders held > 15 mins.
 * Auto-repeats based on user configured repeatMinutes.
 */
export function checkAndTriggerReminders(params: {
  products?: Product[];
  activeShift?: Shift | null;
  holdOrders?: HoldOrder[];
  preOrders?: PreOrder[];
}): void {
  const settings = getNotificationSettings();
  const now = Date.now();

  // Check last alert timestamp to avoid spamming
  let lastRuns: Record<string, number> = {};
  try {
    const rawRuns = localStorage.getItem(LAST_ALERT_RUN_KEY);
    if (rawRuns) lastRuns = JSON.parse(rawRuns);
  } catch {
    lastRuns = {};
  }

  const repeatMs = (settings.repeatMinutes || 15) * 60 * 1000;
  const currentNotifs = getStoredNotifications();
  const newNotifs: AppNotification[] = [];
  let shouldPlaySound = false;
  let lastPushTitle = '';
  let lastPushBody = '';

  // 1. Low stock alert
  if (settings.alertLowStock && params.products && params.products.length > 0) {
    const lowStockItems = params.products.filter(
      (p) => p.isAvailable && p.stockQuantity <= (p.minStockAlert ?? 5)
    );

    if (lowStockItems.length > 0) {
      const lastStockAlert = lastRuns['stock'] || 0;
      if (now - lastStockAlert >= repeatMs) {
        lastRuns['stock'] = now;
        const names = lowStockItems.map((p) => `${p.name} (còn ${p.stockQuantity})`).slice(0, 3).join(', ');
        const notif: AppNotification = {
          id: 'stock_' + now,
          type: 'stock',
          title: 'Cảnh báo tồn kho vịt quay thấp',
          message: `Có ${lowStockItems.length} món sắp hết hàng: ${names}. Cần chuẩn bị thêm hoặc nhập hàng.`,
          timestamp: new Date().toISOString(),
          read: false,
          priority: 'high',
          linkView: 'inventory',
        };
        newNotifs.push(notif);
        shouldPlaySound = true;
        lastPushTitle = notif.title;
        lastPushBody = notif.message;
      }
    }
  }

  // 2. Shift overtime alert (> 8 hours)
  if (settings.alertShiftOvertime && params.activeShift && params.activeShift.status === 'open') {
    const shiftStartTime = new Date(params.activeShift.startTime).getTime();
    const durationHours = (now - shiftStartTime) / (1000 * 3600);

    if (durationHours >= 8) {
      const lastShiftAlert = lastRuns['shift'] || 0;
      if (now - lastShiftAlert >= repeatMs) {
        lastRuns['shift'] = now;
        const notif: AppNotification = {
          id: 'shift_' + now,
          type: 'shift',
          title: 'Nhắc nhở chốt ca làm việc thu ngân',
          message: `Ca ${params.activeShift.shiftCode} đã mở hơn ${Math.floor(durationHours)} giờ. Vui lòng kiểm đếm tiền mặt thực tế và thực hiện bàn giao/chốt ca.`,
          timestamp: new Date().toISOString(),
          read: false,
          priority: 'medium',
          linkView: 'pos',
        };
        newNotifs.push(notif);
        shouldPlaySound = true;
        lastPushTitle = notif.title;
        lastPushBody = notif.message;
      }
    }
  }

  // 3. Long hold orders alert (> 15 minutes)
  if (settings.alertLongHoldOrders && params.holdOrders && params.holdOrders.length > 0) {
    const longHoldItems = params.holdOrders.filter((h) => {
      const holdTime = new Date(h.createdAt).getTime();
      return now - holdTime >= 15 * 60 * 1000;
    });

    if (longHoldItems.length > 0) {
      const lastHoldAlert = lastRuns['hold'] || 0;
      if (now - lastHoldAlert >= repeatMs) {
        lastRuns['hold'] = now;
        const firstHold = longHoldItems[0];
        const notif: AppNotification = {
          id: 'hold_' + now,
          type: 'hold',
          title: 'Nhắc nhở đơn hàng đang treo quá lâu',
          message: `Có ${longHoldItems.length} đơn hàng (${firstHold.label || firstHold.code || 'Đơn chờ'}) đang lưu tạm hơn 15 phút chưa hoàn tất thanh toán.`,
          timestamp: new Date().toISOString(),
          read: false,
          priority: 'medium',
          linkView: 'pos',
        };
        newNotifs.push(notif);
        shouldPlaySound = true;
        lastPushTitle = notif.title;
        lastPushBody = notif.message;
      }
    }
  }

  // 4. Pre-orders upcoming / due reminder
  if (settings.alertPreOrders && params.preOrders && params.preOrders.length > 0) {
    for (const po of params.preOrders) {
      if (po.status === 'completed' || po.status === 'cancelled') continue;
      if (!po.reminderConfig?.enabled) continue;

      const deliveryDateTimeStr = `${po.deliveryDate}T${po.deliveryTime}:00`;
      const deliveryTimeMs = new Date(deliveryDateTimeStr).getTime();
      if (isNaN(deliveryTimeMs)) continue;

      const diffMins = Math.round((deliveryTimeMs - now) / 60000);
      const advanceStages = po.reminderConfig.advanceMinutes || [15, 30, 60];
      const maxStage = Math.max(...advanceStages, 60);

      // Trigger if within advance notification stage or overdue (within 3 hours)
      if (diffMins <= maxStage && diffMins >= -180) {
        const lastPreAlert = lastRuns[`preorder_${po.id}`] || 0;
        const repeatMsCustom = (po.reminderConfig.repeatIntervalMinutes || settings.repeatMinutes || 15) * 60 * 1000;

        if (now - lastPreAlert >= repeatMsCustom) {
          lastRuns[`preorder_${po.id}`] = now;

          let urgencyLabel = `Còn ${diffMins} phút nữa đến giờ giao`;
          if (diffMins <= 0) {
            urgencyLabel = diffMins === 0 ? 'ĐÃ ĐẾN GIỜ GIAO HÀNG' : `ĐÃ QUÁ GIỜ HẸN GIAO ${Math.abs(diffMins)} PHÚT`;
          }

          const notif: AppNotification = {
            id: `pre_${po.id}_${now}`,
            type: 'preorder',
            title: `Nhắc hẹn đơn đặt trước: ${po.orderCode}`,
            message: `${urgencyLabel} (${po.deliveryTime} hôm nay) cho khách ${po.customerName} (${po.customerPhone}). Vui lòng chuẩn bị món!`,
            timestamp: new Date().toISOString(),
            read: false,
            priority: diffMins <= 15 ? 'high' : 'medium',
            linkView: 'preorders',
          };

          newNotifs.push(notif);
          if (po.reminderConfig.notifyAudio) {
            shouldPlaySound = true;
          }
          lastPushTitle = notif.title;
          lastPushBody = notif.message;
        }
      }
    }
  }

  // If there are new notifications, persist and notify user
  if (newNotifs.length > 0) {
    const merged = [...newNotifs, ...currentNotifs].slice(0, 50);
    saveStoredNotifications(merged);
    localStorage.setItem(LAST_ALERT_RUN_KEY, JSON.stringify(lastRuns));

    if (settings.enableSound && shouldPlaySound) {
      playNotificationSound();
    }

    if (settings.enableBrowserPush && lastPushTitle) {
      sendBrowserPushNotification(lastPushTitle, lastPushBody);
    }
  }
}
