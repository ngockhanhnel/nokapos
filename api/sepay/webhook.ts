import type { Request, Response } from 'express';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'] || req.headers['api-key'] || req.headers['apikey'];
    const payload = req.body || {};

    const {
      id: txId,
      content = '',
      transferType = 'in',
      transferAmount = 0,
      description = '',
    } = payload;

    if (transferType !== 'in' && transferType !== 'IN' && Number(transferAmount) <= 0) {
      return res.status(200).json({ success: true, message: 'Ignored outgoing or zero transaction' });
    }

    let receivedKey = '';
    if (typeof authHeader === 'string') {
      receivedKey = authHeader.replace(/^Apikey\s+/i, '').trim();
    }
    if (!receivedKey && payload.apiKey) {
      receivedKey = String(payload.apiKey).trim();
    }

    let matchedShopId = '';
    let matchedOrder: any = null;
    let shopData: any = null;

    const shopsRef = collection(db, 'shops');
    const shopsSnapshot = await getDocs(shopsRef);

    for (const shopDoc of shopsSnapshot.docs) {
      let expectedApiKey = '';
      const secretSnap = await getDoc(doc(db, 'shops', shopDoc.id, 'secrets', 'config'));
      if (secretSnap.exists()) {
        expectedApiKey = secretSnap.data().sepayApiKey || '';
      }
      if (!expectedApiKey) {
        const s = shopDoc.data();
        expectedApiKey = s.sepayConfig?.apiKey || '';
      }

      if (expectedApiKey && receivedKey && expectedApiKey.trim() === receivedKey) {
        matchedShopId = shopDoc.id;
        shopData = shopDoc.data();
        break;
      }
    }

    if (!matchedShopId) {
      console.warn('[SePay Serverless Webhook]: Rejected unauthorized webhook request.');
      return res.status(401).json({
        success: false,
        error: 'Xác thực SePay không hợp lệ. API key không khớp với bất kỳ cửa hàng nào.',
      });
    }

    const ordersRef = collection(db, 'shops', matchedShopId, 'orders');
    const ordersSnap = await getDocs(ordersRef);
    const textToSearch = (content + ' ' + description).toLowerCase();

    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data();
      if (order.paymentStatus === 'pending') {
        const orderCode = (order.orderCode || '').toLowerCase();
        if (
          (orderCode && textToSearch.includes(orderCode)) ||
          Math.abs(Number(order.finalTotal) - Number(transferAmount)) < 1000
        ) {
          matchedOrder = { id: orderDoc.id, ...order };
          break;
        }
      }
    }

    if (matchedOrder) {
      const orderRef = doc(db, 'shops', matchedShopId, 'orders', matchedOrder.id);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paymentMethod: 'transfer',
        updatedAt: new Date().toISOString(),
      });

      // Send Telegram notification if configured
      if (shopData?.telegramConfig?.enabled && shopData?.telegramConfig?.notifySepayTransfer) {
        let botToken = shopData.telegramConfig.botToken;
        let chatId = shopData.telegramConfig.chatId;

        const secSnap = await getDoc(doc(db, 'shops', matchedShopId, 'secrets', 'config'));
        if (secSnap.exists()) {
          botToken = secSnap.data().telegramBotToken || botToken;
          chatId = secSnap.data().telegramChatId || chatId;
        }

        if (botToken && chatId) {
          const msg =
            `🔔 <b>[SEPAY AUTO-BANK] GIAO DỊCH KHỚP TỰ ĐỘNG!</b>\n` +
            `---------------------------------------\n` +
            `🏪 Quán: ${shopData.name || 'DuckPOS'}\n` +
            `💰 Số tiền: ${Number(transferAmount).toLocaleString('vi-VN')} đ\n` +
            `📝 Nội dung: <code>${content}</code>\n` +
            `🔢 Mã giao dịch: #${txId}\n` +
            `✅ Đơn hàng <b>#${matchedOrder.orderCode}</b> đã tự động thanh toán thành công!`;

          await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId.trim(),
              text: msg,
              parse_mode: 'HTML',
            }),
          }).catch((err) => console.error('Telegram notify error:', err));
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: matchedOrder
        ? 'Webhook authenticated and order marked as paid'
        : 'Webhook authenticated, no matching pending order',
      matched: !!matchedOrder,
      orderCode: matchedOrder?.orderCode || null,
    });
  } catch (error: any) {
    console.error('[SePay Webhook Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
