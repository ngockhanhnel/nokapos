import type { Request, Response } from 'express';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let { botToken, chatId, message, parseMode = 'HTML', shopId } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nội dung tin nhắn không được để trống.',
      });
    }

    // Retrieve token securely from Firestore if shopId is provided
    if ((!botToken || !chatId) && shopId) {
      try {
        const secretSnap = await getDoc(doc(db, 'shops', shopId, 'secrets', 'config'));
        if (secretSnap.exists()) {
          const secData = secretSnap.data();
          botToken = botToken || secData.telegramBotToken;
          chatId = chatId || secData.telegramChatId;
        }

        if (!botToken || !chatId) {
          const shopSnap = await getDoc(doc(db, 'shops', shopId));
          if (shopSnap.exists()) {
            const shopData = shopSnap.data();
            botToken = botToken || shopData.telegramConfig?.botToken;
            chatId = chatId || shopData.telegramConfig?.chatId;
          }
        }
      } catch (err) {
        console.warn('[Telegram Serverless] Secret fetch warning:', err);
      }
    }

    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình Bot Token hoặc Chat ID hợp lệ cho Telegram.',
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
        text: message.trim(),
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

    return res.status(200).json({ success: true, messageId: data.result?.message_id });
  } catch (error: any) {
    console.error('[Telegram Serverless Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi kết nối máy chủ Telegram.',
    });
  }
}
