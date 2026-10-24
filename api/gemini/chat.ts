import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { message, history = [], model = 'gemini-3.8-flash', contextData, shopId } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Tin nhắn không được để trống.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ success: false, error: 'Tin nhắn vượt quá giới hạn ký tự cho phép.' });
    }

    const validModels = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    const selectedModel = validModels.includes(model) ? model : 'gemini-3.8-flash';

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `Bạn là Trợ lý AI thông minh mang tên "Trợ lý DuckPOS Pro", chuyên gia phân tích dữ liệu bán hàng, kho hàng, tài chính và vận hành quán ăn/bán lẻ của hệ thống "DuckPOS Pro". 
Bạn có quyền truy cập ngữ cảnh cơ sở dữ liệu đã xác thực của cửa hàng: ${contextData ? JSON.stringify(contextData) : 'Chưa có ngữ cảnh chi tiết'}.

QUY TẮC PHẢN HỒI BẢO MẬT & CHUYÊN NGHIỆP:
1. Bám sát tuyệt đối vào dữ liệu được xác thực từ cơ sở dữ liệu cửa hàng. Không bịa đặt số liệu.
2. Phân tích logic, rõ ràng, chia ý mạch lạc (sử dụng gạch đầu dòng, danh sách đánh số hoặc các bước thực hiện cụ thể).
3. TUYỆT ĐỐI KHÔNG sử dụng ký tự Markdown thô như "###", "### **", hoặc tiêu đề rườm rà.
4. Trình bày hoàn hảo, sạch sẽ, ngôn ngữ tiếng Việt lịch sự, chuẩn xác, hỗ trợ tối đa cho chủ quán và nhân viên.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h && typeof h.text === 'string' && (h.role === 'user' || h.role === 'model')) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text.substring(0, 2000) }]
          });
        }
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const replyText = response.text || 'Xin lỗi, tôi chưa thể trả lời lúc này.';
    return res.status(200).json({ success: true, reply: replyText });
  } catch (err: any) {
    console.error('[Vercel Serverless Gemini Chat API Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi bảo mật xử lý AI Chat.' });
  }
}
