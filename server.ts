import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appInit = initializeApp(firebaseConfig);
const db = getFirestore(appInit, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'DuckPOS Pro Server', timestamp: new Date().toISOString() });
  });

  // Telegram Proxy Endpoint: Safely sends messages using Telegram Bot API
  app.post('/api/telegram/send', async (req, res) => {
    try {
      const { botToken, chatId, message, parseMode = 'HTML' } = req.body;

      if (!botToken || !chatId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu thông tin botToken, chatId hoặc nội dung tin nhắn.',
        });
      }

      const cleanToken = String(botToken).trim();
      const cleanChatId = String(chatId).trim();
      const telegramUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: message,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        return res.status(400).json({
          success: false,
          error: data.description || 'Lỗi gửi tin nhắn từ Telegram API.',
          details: data,
        });
      }

      return res.json({ success: true, messageId: data.result?.message_id });
    } catch (error: any) {
      console.error('Telegram API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Lỗi kết nối máy chủ Telegram.',
      });
    }
  });

  // SePay Webhook Endpoint
  // Supports both /api/sepay/webhook and /callback/sepay as requested
  const handleSepayWebhook = async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['api-key'] || req.headers['apikey'];
      const payload = req.body;

      console.log('[SePay Webhook Received]:', JSON.stringify({ headers: req.headers, body: payload }));

      // Extract SePay payload fields
      const {
        id: txId,
        gateway,
        transactionDate,
        accountNumber,
        content = '',
        transferType = 'in',
        transferAmount = 0,
        accumulated,
        referenceCode,
        description = '',
      } = payload;

      // Only process incoming money transactions
      if (transferType !== 'in' && transferType !== 'IN' && Number(transferAmount) <= 0) {
        return res.status(200).json({ success: true, message: 'Ignored outgoing or zero transaction' });
      }

      let receivedKey = '';
      if (typeof authHeader === 'string') {
        receivedKey = authHeader.replace(/^Apikey\s+/i, '').trim();
      }

      let matchedShopId = '';
      let matchedOrder: any = null;
      let shopData: any = null;

      try {
        const shopsRef = collection(db, 'shops');
        const shopsSnapshot = await getDocs(shopsRef);

        for (const shopDoc of shopsSnapshot.docs) {
          const data = shopDoc.data();
          if (data.sepayConfig && data.sepayConfig.apiKey && data.sepayConfig.apiKey.trim() === receivedKey) {
            matchedShopId = shopDoc.id;
            shopData = data;
            break;
          }
        }

        // If not found by API key directly, check all shops for pending orders matching content or amount
        if (!matchedShopId && shopsSnapshot.docs.length > 0) {
          for (const shopDoc of shopsSnapshot.docs) {
            const data = shopDoc.data();
            const ordersRef = collection(db, 'shops', shopDoc.id, 'orders');
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
                  matchedShopId = shopDoc.id;
                  shopData = data;
                  matchedOrder = { id: orderDoc.id, ...order };
                  break;
                }
              }
            }
            if (matchedShopId) break;
          }
        }

        if (matchedShopId && !matchedOrder) {
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
        }

        if (matchedShopId && matchedOrder) {
          const orderRef = doc(db, 'shops', matchedShopId, 'orders', matchedOrder.id);
          await updateDoc(orderRef, {
            paymentStatus: 'paid',
            paymentMethod: 'transfer',
            updatedAt: new Date().toISOString(),
          });

          console.log(`[SePay Autobank]: Successfully matched order ${matchedOrder.orderCode} for shop ${matchedShopId}`);

          if (shopData?.telegramConfig?.enabled && shopData?.telegramConfig?.notifySepayTransfer) {
            const { botToken, chatId } = shopData.telegramConfig;
            if (botToken && chatId) {
              const msg = `🔔 <b>[SEPAY AUTO-BANK] GIAO DỊCH KHỚP TỰ ĐỘNG!</b>\n` +
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
      } catch (dbErr) {
        console.error('[SePay Firestore Error]:', dbErr);
      }

      return res.status(200).json({
        success: true,
        message: matchedOrder ? 'Webhook processed and order marked as paid' : 'Webhook received, no pending order matched',
        matched: !!matchedOrder,
        orderCode: matchedOrder?.orderCode || null,
      });
    } catch (error: any) {
      console.error('[SePay Webhook Error]:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  app.post('/api/sepay/webhook', handleSepayWebhook);
  app.post('/api/callback/sepay', handleSepayWebhook);
  app.post('/callback/sepay', handleSepayWebhook);

  // In development, mount Vite dev server middlewares
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: Number(PORT) },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static assets from dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`DuckPOS Pro full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
