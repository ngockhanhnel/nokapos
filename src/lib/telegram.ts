import { TelegramConfig, Order, SepayTransaction, Product, Shift } from '@/src/types';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';

export { TelegramService } from './telegramService';

/**
 * Sends a message to Telegram using backend proxy or direct bot API.
 */
export async function sendTelegramNotification(
  config: TelegramConfig | undefined,
  message: string
): Promise<boolean> {
  if (!config || !config.enabled || !config.botToken || !config.chatId) {
    return false;
  }

  try {
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: config.botToken.trim(),
        chatId: config.chatId.trim(),
        message,
        parseMode: 'HTML',
      }),
    });

    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
    return false;
  }
}

/**
 * Test telegram bot credentials.
 */
export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const testMessage = `🦆 <b>DuckPOS Pro - Kiểm tra kết nối Telegram</b>\n\n✅ Xin chào chủ quán! Hệ thống thông báo tự động của quán vịt quay đã liên kết thành công với nhóm/kênh này.\n\n⏰ Thời gian: ${formatDateTime(new Date().toISOString())}`;
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: botToken.trim(),
        chatId: chatId.trim(),
        message: testMessage,
        parseMode: 'HTML',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Không thể gửi tin nhắn Telegram.' };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Lỗi mạng khi gọi Telegram API.' };
  }
}

/**
 * Formats new order notification message
 */
export function formatOrderTelegramMessage(order: Order, shopName = 'DuckPOS Pro'): string {
  const itemsText = order.items
    .map(
      (item) =>
        ` • ${item.name}: ${item.unit === 'kg' && item.weightKg ? `${item.weightKg}kg` : item.quantity} (${formatCurrency(item.totalPrice)})`
    )
    .join('\n');

  const paymentMethodLabel = order.paymentMethod === 'transfer' ? 'Chuyển khoản (VietQR/Autobank)' : 'Tiền mặt';

  return `🎉 <b>ĐƠN HÀNG MỚI - ${shopName.toUpperCase()}</b>
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
}

/**
 * Formats SePay auto-received payment notification message
 */
export function formatSepayTelegramMessage(
  tx: SepayTransaction,
  matchedOrderCode?: string,
  shopName = 'DuckPOS Pro'
): string {
  const statusLine = matchedOrderCode
    ? `✅ <b>Khớp đơn hàng:</b> <code>${matchedOrderCode}</code> (Tự động chốt đơn!)`
    : `⚠️ <b>Chưa khớp đơn:</b> Cần đối soát thủ công nếu có`;

  return `⚡ <b>TIỀN VÀO TỰ ĐỘNG (SEPAY) - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
💵 <b>Số tiền nhận:</b> <b>+${formatCurrency(tx.transferAmount)}</b>
🏦 <b>Ngân hàng:</b> ${tx.gateway} (${tx.accountNumber})
📝 <b>Nội dung:</b> <code>${tx.content}</code>
🔍 <b>Mã GD:</b> ${tx.referenceCode}
⏰ <b>Thời gian:</b> ${tx.transactionDate}

${statusLine}
━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Formats low stock notification message
 */
export function formatLowStockTelegramMessage(lowProducts: Product[], shopName = 'DuckPOS Pro'): string {
  const list = lowProducts
    .map((p) => ` • <b>${p.name}</b>: còn <code>${p.stockQuantity} ${p.unit}</code> (Ngưỡng báo động: ${p.minStockAlert})`)
    .join('\n');

  return `⚠️ <b>CẢNH BÁO TỒN KHO THẤP - ${shopName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
Có ${lowProducts.length} sản phẩm sắp hết hàng cần chuẩn bị thêm:

${list}

⏰ Thời gian: ${formatDateTime(new Date().toISOString())}
━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Formats shift closing notification message
 */
export function formatShiftClosingTelegramMessage(shift: Shift, shopName = 'DuckPOS Pro'): string {
  return `📊 <b>BÁO CÁO CHỐT CA LÀM VIỆC - ${shopName.toUpperCase()}</b>
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
}
