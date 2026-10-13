import {
  TelegramConfig,
  TelegramCustomReminder,
  Order,
  SepayTransaction,
  Product,
  Shift,
  Shop,
  PreOrder,
  PRE_ORDER_TYPE_LABELS,
} from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

export interface TelegramSendResponse {
  success: boolean;
  messageId?: number;
  error?: string;
}

export interface DailySummaryData {
  date: string;
  totalRevenue: number;
  ordersCount: number;
  cashSales: number;
  transferSales: number;
  topItemNames?: string[];
}



class TelegramServiceClass {
  /**
   * Core send message via backend proxy
   */
  async send(config?: TelegramConfig, message?: string): Promise<TelegramSendResponse> {
    if (!config || !config.enabled || !config.botToken || !config.chatId) {
      return { success: false, error: 'Telegram chưa được bật hoặc chưa điền Bot Token / Chat ID.' };
    }

    if (!message || !message.trim()) {
      return { success: false, error: 'Nội dung tin nhắn không được để trống.' };
    }

    try {
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: config.botToken.trim(),
          chatId: config.chatId.trim(),
          message: message.trim(),
          parseMode: 'HTML',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Lỗi gửi tin nhắn từ Telegram API.' };
      }

      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      console.error('[TelegramService] Send error:', err);
      return { success: false, error: err.message || 'Lỗi mạng khi gọi Telegram API.' };
    }
  }

  /**
   * Tests credentials by sending a greeting message
   */
  async testConnection(botToken: string, chatId: string): Promise<TelegramSendResponse> {
    const testMessage = `🦆 <b>DuckPOS Pro - Kiểm tra kết nối Telegram Bot</b>\n\n✅ <b>Xin chào Chủ Quán!</b> Hệ thống POS đã kết nối thành công với Bot Telegram này.\n\n⏰ Thời gian: ${formatDateTime(new Date().toISOString())}\n📌 Sẵn sàng nhận thông báo đơn hàng, SePay và nhắc việc tự động.`;
    return this.send({ botToken, chatId, enabled: true, notifyNewOrder: true, notifySepayTransfer: true, notifyLowStock: true, notifyShiftClosing: true }, testMessage);
  }

  /**
   * Gửi thông báo nhanh tùy chỉnh tức thì tới Telegram
   */
  async sendQuickMessage(
    config: TelegramConfig | undefined,
    title: string,
    content: string,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    const msg = `📢 <b>THÔNG BÁO NHANH - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>${title.toUpperCase()}</b>

${content}

⏰ <i>Thời gian gửi: ${formatDateTime(new Date().toISOString())}</i>
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi thông báo đơn hàng mới
   */
  async sendOrderAlert(
    config: TelegramConfig | undefined,
    order: Order,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    if (!config?.notifyNewOrder) return { success: false, error: 'Thông báo đơn hàng mới đang tắt.' };

    const itemsText = order.items
      .map(
        (item) =>
          ` • ${item.name}: ${item.unit === 'kg' && item.weightKg ? `${item.weightKg}kg` : item.quantity} (${formatCurrency(item.totalPrice)})`
      )
      .join('\n');

    const paymentMethodLabel = order.paymentMethod === 'transfer' ? 'Chuyển khoản (VietQR/Autobank)' : 'Tiền mặt';

    const msg = `🎉 <b>ĐƠN HÀNG MỚI - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Mã đơn:</b> <code>${order.orderCode}</code>
⏰ <b>Thời gian:</b> ${formatDateTime(order.createdAt)}
👤 <b>Thu ngân:</b> ${order.cashierName}
🍽 <b>Hình thức:</b> ${order.diningOption === 'takeaway' ? 'Mang về' : 'Tại quán'}
💳 <b>Thanh toán:</b> ${paymentMethodLabel}

📋 <b>Chi tiết món:</b>
${itemsText}

💰 <b>TỔNG TIỀN:</b> <b>${formatCurrency(order.finalTotal)}</b>
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi thông báo SePay tiền vào tự động
   */
  async sendSepayAlert(
    config: TelegramConfig | undefined,
    tx: SepayTransaction,
    matchedOrderCode?: string,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    if (!config?.notifySepayTransfer) return { success: false, error: 'Thông báo SePay đang tắt.' };

    const statusLine = matchedOrderCode
      ? `✅ <b>Khớp đơn hàng:</b> <code>${matchedOrderCode}</code> (Tự động chốt đơn!)`
      : `⚠️ <b>Chưa khớp đơn:</b> Cần đối soát thủ công nếu có`;

    const msg = `⚡ <b>TIỀN VÀO TỰ ĐỘNG (SEPAY) - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
💵 <b>Số tiền nhận:</b> <b>+${formatCurrency(tx.transferAmount)}</b>
🏦 <b>Ngân hàng:</b> ${tx.gateway} (${tx.accountNumber})
📝 <b>Nội dung:</b> <code>${tx.content}</code>
🔍 <b>Mã GD:</b> ${tx.referenceCode}
⏰ <b>Thời gian:</b> ${tx.transactionDate}

${statusLine}
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi cảnh báo tồn kho thấp
   */
  async sendLowStockAlert(
    config: TelegramConfig | undefined,
    lowProducts: Product[],
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    if (!config?.notifyLowStock) return { success: false, error: 'Cảnh báo kho thấp đang tắt.' };
    if (!lowProducts || lowProducts.length === 0) return { success: false, error: 'Không có sản phẩm nào chạm ngưỡng kho.' };

    const list = lowProducts
      .map((p) => ` • <b>${p.name}</b>: còn <code>${p.stockQuantity} ${p.unit}</code> (Ngưỡng cảnh báo: ${p.minStockAlert})`)
      .join('\n');

    const msg = `⚠️ <b>CẢNH BÁO TỒN KHO THẤP - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
Có ${lowProducts.length} sản phẩm sắp hết hàng cần chuẩn bị thêm:

${list}

⏰ Thời gian: ${formatDateTime(new Date().toISOString())}
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi báo cáo chốt ca làm việc
   */
  async sendShiftClosingAlert(
    config: TelegramConfig | undefined,
    shift: Shift,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    if (!config?.notifyShiftClosing) return { success: false, error: 'Báo cáo chốt ca đang tắt.' };

    const msg = `📊 <b>BÁO CÁO CHỐT CA LÀM VIỆC - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
🔑 <b>Mã ca:</b> <code>${shift.shiftCode}</code>
👤 <b>Thu ngân:</b> ${shift.cashierName}
⏰ <b>Bắt đầu:</b> ${formatDateTime(shift.startTime)}
⏰ <b>Kết thúc:</b> ${formatDateTime(shift.endTime || new Date().toISOString())}

📈 <b>Tổng số đơn:</b> ${shift.ordersCount} đơn
💵 <b>Tiền mặt thu:</b> ${formatCurrency(shift.totalCashSales)}
💳 <b>Chuyển khoản thu:</b> ${formatCurrency(shift.totalTransferSales)}
💰 <b>TỔNG DOANH THU CA:</b> <b>${formatCurrency(shift.totalSales)}</b>

💵 <b>Tiền mặt thực tế đếm:</b> ${formatCurrency(shift.actualCashCounted || 0)}
⚖️ <b>Chênh lệch:</b> ${formatCurrency(shift.discrepancy || 0)}
${shift.note ? `📝 <b>Ghi chú:</b> ${shift.note}` : ''}
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi báo cáo định kỳ doanh thu (Periodic Revenue Summary)
   */
  async sendPeriodicRevenueSummary(
    config: TelegramConfig | undefined,
    data: DailySummaryData,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    const topItemsStr = data.topItemNames && data.topItemNames.length > 0
      ? `\n🏆 <b>Món bán chạy:</b>\n${data.topItemNames.map((n) => ` • ${n}`).join('\n')}\n`
      : '';

    const msg = `📈 <b>BÁO CÁO DOANH THU ĐỊNH KỲ - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
📅 <b>Ngày:</b> ${data.date}
⏰ <b>Cập nhật lúc:</b> ${formatDateTime(new Date().toISOString())}

💰 <b>TỔNG DOANH THU:</b> <b>${formatCurrency(data.totalRevenue)}</b>
📋 <b>Số đơn hoàn tất:</b> ${data.ordersCount} đơn
💵 <b>Tiền mặt:</b> ${formatCurrency(data.cashSales)}
💳 <b>Chuyển khoản / SePay:</b> ${formatCurrency(data.transferSales)}
${topItemsStr}━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi thông báo tùy chỉnh (Custom Reminder)
   */
  async sendCustomReminderAlert(
    config: TelegramConfig | undefined,
    reminder: TelegramCustomReminder,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    const msg = `⏰ <b>NHẮC NHỞ TỰ ĐỘNG - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
🔔 <b>${reminder.title.toUpperCase()}</b>

${reminder.message}

⏰ <i>Thời gian: ${formatDateTime(new Date().toISOString())}</i>
${reminder.scheduleType === 'interval' ? `🔄 <i>Lặp lại mỗi ${reminder.intervalMinutes} phút</i>` : `📅 <i>Lịch hàng ngày lúc ${reminder.dailyTime}</i>`}
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi thông báo tiếp nhận Đơn hàng đặt trước mới
   */
  async sendPreOrderAlert(
    config: TelegramConfig | undefined,
    preOrder: PreOrder,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    const itemsText = preOrder.items
      .map(
        (item) =>
          ` • ${item.name}: ${item.unit === 'kg' && item.weightKg ? `${item.weightKg}kg` : item.quantity} (${formatCurrency(item.totalPrice)})${item.prepNote ? ` [${item.prepNote}]` : ''}`
      )
      .join('\n');

    const typeLabel = PRE_ORDER_TYPE_LABELS[preOrder.orderType] || 'Mang về';
    const depositText = preOrder.depositAmount > 0 
      ? `\n💵 <b>Đã cọc:</b> ${formatCurrency(preOrder.depositAmount)}\n💰 <b>Còn lại cần thu:</b> <b>${formatCurrency(preOrder.remainingAmount)}</b>` 
      : `\n💰 <b>Tổng tiền cần thu:</b> <b>${formatCurrency(preOrder.totalAmount)}</b> <i>(Chưa cọc)</i>`;

    const reminderStagesText = preOrder.reminderConfig.advanceMinutes.length > 0
      ? `🔔 <b>Mốc báo trước:</b> ${preOrder.reminderConfig.advanceMinutes.map(m => m >= 60 ? `${m/60}h` : `${m}p`).join(', ')}`
      : '🔔 <b>Báo trước:</b> Không đặt mốc';

    const msg = `📅 <b>TIẾP NHẬN ĐƠN ĐẶT TRƯỚC - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Mã đơn:</b> <code>${preOrder.orderCode}</code>
⏰ <b>LỊCH HẸN GIAO:</b> <b>${preOrder.deliveryTime} ngày ${preOrder.deliveryDate}</b>
🍽 <b>Hình thức:</b> ${typeLabel}

👤 <b>Khách hàng:</b> ${preOrder.customerName}
📞 <b>Số điện thoại:</b> <code>${preOrder.customerPhone}</code>
${preOrder.customerAddress ? `📍 <b>Địa chỉ:</b> ${preOrder.customerAddress}\n` : ''}
📋 <b>Danh sách món đặt:</b>
${itemsText}
${depositText}
${preOrder.notes ? `\n📝 <b>Ghi chú:</b> ${preOrder.notes}` : ''}
${reminderStagesText}
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Gửi nhắc nhở tự động trước giờ hẹn giao đơn đặt trước
   */
  async sendPreOrderReminder(
    config: TelegramConfig | undefined,
    preOrder: PreOrder,
    reminderReason: string,
    shopName = 'DuckPOS Pro'
  ): Promise<TelegramSendResponse> {
    const itemsText = preOrder.items
      .map(
        (item) =>
          ` • ${item.name}: ${item.unit === 'kg' && item.weightKg ? `${item.weightKg}kg` : item.quantity}`
      )
      .join('\n');

    const typeLabel = PRE_ORDER_TYPE_LABELS[preOrder.orderType] || 'Mang về';

    const msg = `🚨 <b>NHẮC HẸN GIAO ĐƠN ĐẶT TRƯỚC - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
⏰ <b>CẢNH BÁO:</b> <b>${reminderReason.toUpperCase()}</b>
📄 <b>Mã đơn:</b> <code>${preOrder.orderCode}</code>
⏰ <b>Giờ hẹn:</b> <b>${preOrder.deliveryTime}</b> hôm nay (${preOrder.deliveryDate})
🍽 <b>Hình thức:</b> ${typeLabel}

👤 <b>Khách:</b> ${preOrder.customerName} - 📞 <code>${preOrder.customerPhone}</code>
${preOrder.customerAddress ? `📍 <b>Địa chỉ:</b> ${preOrder.customerAddress}\n` : ''}
🍗 <b>Món cần chuẩn bị:</b>
${itemsText}

💰 <b>Số tiền cần thu:</b> <b>${formatCurrency(preOrder.remainingAmount)}</b>
${preOrder.notes ? `📝 <b>Ghi chú:</b> ${preOrder.notes}\n` : ''}
👉 <i>Vui lòng vào màn hình Bếp / Đặt trước để hoàn tất ra món đúng giờ cho khách!</i>
━━━━━━━━━━━━━━━━━━━━`;

    return this.send(config, msg);
  }

  /**
   * Quét và gửi tự động các nhắc nhở tùy chỉnh theo thời gian / lặp lại
   * Gọi từ background interval trong App.tsx
   */
  async checkAndDispatchScheduled(
    shop: Shop | null,
    context?: {
      products?: Product[];
      todayOrders?: Order[];
      preOrders?: PreOrder[];
    }
  ): Promise<void> {
    if (!shop || !shop.telegramConfig || !shop.telegramConfig.enabled) return;
    const config = shop.telegramConfig;
    if (!config.botToken || !config.chatId) return;

    const now = Date.now();
    const nowDate = new Date();
    const currentHourMin = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
    const todayYMD = nowDate.toISOString().slice(0, 10);

    let configUpdated = false;
    const reminders = config.customReminders || [];
    const updatedReminders: TelegramCustomReminder[] = [];

    for (const rem of reminders) {
      let shouldSend = false;

      if (!rem.enabled) {
        updatedReminders.push(rem);
        continue;
      }

      if (rem.scheduleType === 'interval') {
        const intervalMs = Math.max(15, rem.intervalMinutes || 60) * 60 * 1000;
        const lastSentTime = rem.lastSentAt ? new Date(rem.lastSentAt).getTime() : 0;
        if (now - lastSentTime >= intervalMs) {
          shouldSend = true;
        }
      } else if (rem.scheduleType === 'daily_time') {
        // Gửi đúng giờ chỉ định hàng ngày
        if (rem.dailyTime && rem.dailyTime === currentHourMin) {
          const lastSentYMD = rem.lastSentAt ? rem.lastSentAt.slice(0, 10) : '';
          if (lastSentYMD !== todayYMD) {
            shouldSend = true;
          }
        }
      }

      if (shouldSend) {
        console.log(`[TelegramService] Dispatching custom reminder: "${rem.title}"`);
        await this.sendCustomReminderAlert(config, rem, shop.name);
        const updatedRem: TelegramCustomReminder = {
          ...rem,
          lastSentAt: new Date().toISOString(),
        };
        updatedReminders.push(updatedRem);
        configUpdated = true;
      } else {
        updatedReminders.push(rem);
      }
    }

    // Kiểm tra Báo cáo doanh thu định kỳ nếu được bật
    let periodicUpdated = false;
    let newLastPeriodicSent = config.lastPeriodicRevenueSentAt;

    if (config.notifyPeriodicRevenue && context?.todayOrders) {
      const intervalHours = Math.max(1, config.periodicRevenueIntervalHours || 2);
      const intervalMs = intervalHours * 3600 * 1000;
      const lastPeriodicTime = config.lastPeriodicRevenueSentAt ? new Date(config.lastPeriodicRevenueSentAt).getTime() : 0;

      if (now - lastPeriodicTime >= intervalMs) {
        const orders = context.todayOrders.filter((o) => o.status === 'completed');
        const totalRevenue = orders.reduce((sum, o) => sum + (o.finalTotal || 0), 0);
        const cashSales = orders
          .filter((o) => o.paymentMethod === 'cash')
          .reduce((sum, o) => sum + (o.finalTotal || 0), 0);
        const transferSales = orders
          .filter((o) => o.paymentMethod === 'transfer')
          .reduce((sum, o) => sum + (o.finalTotal || 0), 0);

        await this.sendPeriodicRevenueSummary(
          config,
          {
            date: formatDateTime(new Date().toISOString()).split(' ')[1] || todayYMD,
            totalRevenue,
            ordersCount: orders.length,
            cashSales,
            transferSales,
          },
          shop.name
        );

        newLastPeriodicSent = new Date().toISOString();
        periodicUpdated = true;
      }
    }

    // 3. Kiểm tra thông báo & nhắc hẹn Đơn Đặt Trước (Pre-Orders)
    if (context?.preOrders && context.preOrders.length > 0 && shop.id) {
      for (const po of context.preOrders) {
        if (po.status === 'completed' || po.status === 'cancelled') continue;
        if (!po.reminderConfig?.enabled) continue;

        const deliveryDateTimeStr = `${po.deliveryDate}T${po.deliveryTime}:00`;
        const deliveryTimestamp = new Date(deliveryDateTimeStr).getTime();
        if (isNaN(deliveryTimestamp)) continue;

        const diffMinutes = Math.round((deliveryTimestamp - now) / (60 * 1000));
        const advanceStages = (po.reminderConfig.advanceMinutes || [15, 30, 60]).sort((a, b) => b - a);
        const notifiedStages = po.reminderConfig.notifiedStages || [];
        const lastNotifiedAt = po.reminderConfig.lastNotifiedAt ? new Date(po.reminderConfig.lastNotifiedAt).getTime() : 0;
        const repeatIntervalMinutes = po.reminderConfig.repeatIntervalMinutes || 15;
        const repeatIntervalMs = repeatIntervalMinutes * 60 * 1000;

        let triggerReminder = false;
        let reminderReason = '';
        let matchedStage: number | null = null;

        // Kiểm tra các mốc báo trước (Ví dụ: 120p, 60p, 30p, 15p)
        for (const stage of advanceStages) {
          if (diffMinutes <= stage && diffMinutes > 0 && !notifiedStages.includes(stage)) {
            triggerReminder = true;
            matchedStage = stage;
            const hours = Math.floor(stage / 60);
            const mins = stage % 60;
            const timeStr = hours > 0 ? (mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`) : `${mins} phút`;
            reminderReason = `Còn ${timeStr} nữa đến giờ giao hàng (${po.deliveryTime})`;
            break;
          }
        }

        // Kiểm tra nếu đã đến giờ hẹn hoặc trễ hẹn (diffMinutes <= 0)
        if (!triggerReminder && diffMinutes <= 0 && diffMinutes >= -180) {
          if (!notifiedStages.includes(0)) {
            triggerReminder = true;
            matchedStage = 0;
            reminderReason = `ĐÃ ĐẾN GIỜ GIAO HÀNG (${po.deliveryTime})! Vui lòng kiểm tra hoàn tất đơn`;
          } else if (repeatIntervalMinutes > 0 && now - lastNotifiedAt >= repeatIntervalMs) {
            triggerReminder = true;
            reminderReason = `ĐƠN ĐÃ QUÁ GIỜ GIAO HẸN (${Math.abs(diffMinutes)} phút)! Vui lòng kiểm tra giao cho khách`;
          }
        } else if (!triggerReminder && repeatIntervalMinutes > 0 && diffMinutes <= 60 && diffMinutes > 0) {
          // Lặp lại nhắc nhở trong vòng 1 tiếng trước giờ giao nếu đã qua chu kỳ lặp lại
          if (now - lastNotifiedAt >= repeatIntervalMs) {
            triggerReminder = true;
            reminderReason = `Nhắc nhở lặp lại: Còn ${diffMinutes} phút nữa đến giờ giao (${po.deliveryTime})`;
          }
        }

        if (triggerReminder) {
          if (po.reminderConfig.notifyTelegram) {
            await this.sendPreOrderReminder(config, po, reminderReason, shop.name);
          }

          // Cập nhật lại preOrder trong Firestore
          try {
            const nextNotifiedStages = matchedStage !== null && !notifiedStages.includes(matchedStage)
              ? [...notifiedStages, matchedStage]
              : notifiedStages;

            const preOrderRef = doc(db, 'shops', shop.id, 'preOrders', po.id);
            await updateDoc(preOrderRef, {
              'reminderConfig.lastNotifiedAt': new Date().toISOString(),
              'reminderConfig.notifiedStages': nextNotifiedStages,
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {
            console.error('[TelegramService] Error updating preOrder reminder stages:', e);
          }
        }
      }
    }

    // Nếu có sự thay đổi về lastSentAt, lưu cập nhật vào Firestore
    if ((configUpdated || periodicUpdated) && shop.id) {
      try {
        const shopRef = doc(db, 'shops', shop.id);
        const updatedConfig: TelegramConfig = {
          ...config,
          customReminders: updatedReminders,
          lastPeriodicRevenueSentAt: newLastPeriodicSent,
        };
        await updateDoc(shopRef, {
          telegramConfig: updatedConfig,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[TelegramService] Error saving reminder lastSentAt:', err);
      }
    }
  }
}

export const TelegramService = new TelegramServiceClass();
