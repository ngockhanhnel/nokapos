import express from 'express';
import { GoogleGenAI } from '@google/genai';

export const geminiChatRouter = express.Router();

geminiChatRouter.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const { message, history = [], model = 'gemini-3.8-flash', contextData, shopId, currentView } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Tin nhắn không được để trống.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ success: false, error: 'Tin nhắn vượt quá giới hạn ký tự cho phép.' });
    }

    if (shopId && typeof shopId === 'string' && !shopId.trim()) {
      return res.status(400).json({ success: false, error: 'Mã cửa hàng không hợp lệ.' });
    }

    const validModels = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    const selectedModel = validModels.includes(model) ? model : 'gemini-3.8-flash';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const metrics = contextData || {};
    const totalSales = metrics.totalCalculatedRevenue !== undefined ? Number(metrics.totalCalculatedRevenue).toLocaleString('vi-VN') + ' đ' : 'Chưa có số liệu';
    const lowStockCount = Array.isArray(metrics.lowStockItems) ? metrics.lowStockItems.length : 0;
    const lowStockDetails = Array.isArray(metrics.lowStockItems) && metrics.lowStockItems.length > 0 
      ? metrics.lowStockItems.map((i: any) => `- ${i.name} (Tồn: ${i.stock} ${i.unit || ''})`).join('\n')
      : 'Không có sản phẩm nào sắp hết hàng.';

    const systemInstruction = `Bạn là Trợ lý AI thông minh mang tên "Trợ lý DuckPOS Pro", chuyên gia cao cấp tư vấn quản lý vận hành, bán hàng, kiểm soát kho nguyên liệu và tài chính cho chuỗi cửa hàng & quán vịt quay chuyên nghiệp ("DuckPOS Pro"). 
Bạn am hiểu sâu sắc nghiệp vụ đặc thù của quán vịt quay: bán theo con, nửa con, theo kg, chặt miếng/đóng hộp, quản lý lô vịt sống/vịt quay, gia vị tẩm ướp, quản lý màn hình nhà bếp (KDS), đối soát chuyển khoản tự động SePay, chốt ca và kiểm kho định kỳ.
Người dùng hiện đang thao tác tại màn hình: **${currentView || 'Chưa xác định'}**. Hãy ưu tiên tư vấn các nghiệp vụ liên quan đến màn hình này.

THÔNG TIN & SỐ LIỆU CỬA HÀNG VỊT QUAY THEO THỜI GIAN THỰC (REAL-TIME METRICS):
- Tổng doanh thu tính đến hiện tại: ${totalSales}
- Danh mục sản phẩm hiện có: ${metrics.totalProducts || 0} món (vịt quay tiêu chuẩn, vịt quay bắc kinh, nước chấm, bánh bao...)
- Số lượng mặt hàng nguyên liệu/sản phẩm sắp hết kho (Low-stock): ${lowStockCount}
Chi tiết cảnh báo tồn kho:
${lowStockDetails}
- Tổng số đơn hàng đã ghi nhận: ${metrics.totalOrdersCount || 0}

QUY TẮC PHẢN HỒI CHUYÊN NGHIỆP & THỰC TẾ:
1. Bám sát tuyệt đối vào số liệu thực tế được cung cấp từ cơ sở dữ liệu của quán vịt quay. Không bịa đặt số liệu.
2. Tư vấn giải pháp quản lý thực tế, súc tích, phân tích logic rõ ràng (chia theo các bước, gạch đầu dòng gọn gàng).
3. TUYỆT ĐỐI KHÔNG sử dụng ký tự Markdown thô như "###", "### **", hoặc tiêu đề rườm rà. Trả về định dạng chuỗi văn bản sạch, dễ đọc.
4. Luôn giữ thái độ chuyên nghiệp, thân thiện, đồng hành cùng chủ quán và nhân viên tối ưu hóa doanh thu và giảm thất thoát nguyên liệu vịt quay.`;

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

    let replyText = response.text || 'Xin lỗi, tôi chưa thể trả lời lúc này.';
    replyText = replyText
      .replace(/###\s*\**/g, '')
      .replace(/\*\*\s*###/g, '')
      .replace(/###/g, '')
      .replace(/##/g, '')
      .replace(/#/g, '')
      .trim();

    return res.json({ success: true, reply: replyText });
  } catch (err: any) {
    console.error('[src/api/gemini/chat Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi bảo mật xử lý AI Chat.' });
  }
});
