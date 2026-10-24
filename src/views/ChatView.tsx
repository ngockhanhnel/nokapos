import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Trash2, 
  Loader2,
  Database,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export const ChatView: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const { currentShop } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: `Xin chào! Tôi là Trợ lý DuckPOS Pro, kết nối trực tiếp với cơ sở dữ liệu cửa hàng **${currentShop?.name || 'của bạn'}**. Tôi có thể tra cứu tồn kho, doanh thu, đơn hàng và hỗ trợ nghiệp vụ chính xác theo dữ liệu thực tế. Bạn cần tra cứu thông tin gì?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel] = useState<'gemini-3.8-flash'>('gemini-3.8-flash');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const cleanResponseText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/###\s*\**/g, '')
      .replace(/\*\*\s*###/g, '')
      .replace(/###/g, '')
      .replace(/##/g, '')
      .replace(/#/g, '')
      .trim();
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'model',
        text: `Đã làm mới dữ liệu hội thoại! Tôi đã sẵn sàng tra cứu cơ sở dữ liệu cửa hàng ${currentShop?.name || ''}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const fetchLiveDatabaseContext = async () => {
    if (!currentShop?.id) return null;
    try {
      let products: any[] = [];
      let orders: any[] = [];
      let customers: any[] = [];
      let staff: any[] = [];
      let totalRevenue = 0;

      try {
        const pSnap = await getDocs(collection(db, 'shops', currentShop.id, 'products'));
        pSnap.forEach(d => products.push({ id: d.id, ...d.data() }));
      } catch (e) { console.warn('Products read permission notice'); }

      try {
        const oSnap = await getDocs(collection(db, 'shops', currentShop.id, 'orders'));
        oSnap.forEach(d => {
          const o = d.data();
          orders.push({ id: d.id, ...o });
          if (o.status === 'completed' || o.paymentStatus === 'paid') {
            totalRevenue += Number(o.finalTotal || o.total || 0);
          }
        });
      } catch (e) { console.warn('Orders read permission notice'); }

      return {
        shopName: currentShop.name,
        totalProducts: products.length,
        lowStockItems: products.filter(p => Number(p.stock) <= Number(p.minStock || 5)).map(p => ({ name: p.name, stock: p.stock, unit: p.unit })),
        totalOrdersCount: orders.length,
        totalCalculatedRevenue: totalRevenue,
      };
    } catch (err) {
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const liveDatabaseContext = await fetchLiveDatabaseContext();

      const history = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          history,
          model: selectedModel,
          contextData: liveDatabaseContext,
          shopId: currentShop?.id,
          currentView: 'Chatbot'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: cleanResponseText(data.reply),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `Lỗi truy xuất dữ liệu: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-neutral-800 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-neutral-400" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-lg">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              Trợ lý DuckPOS Pro
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Database className="w-2.5 h-2.5" /> Live
              </span>
            </h1>
            <p className="text-[11px] text-neutral-400">Phân tích dữ liệu thời gian thực</p>
          </div>
        </div>
        <button onClick={handleClearChat} className="p-2 text-neutral-400 hover:text-primary rounded-lg hover:bg-neutral-800">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-neutral-800' : 'bg-primary'}`}>
              {msg.role === 'user' ? <span className="text-sm">👤</span> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 sm:px-5 py-3 text-xs sm:text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-bl-none'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-neutral-400 text-xs sm:text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích dữ liệu...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-6 pb-20 lg:pb-6 bg-neutral-900 border-t border-neutral-800 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 sm:gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Tra cứu doanh thu, tồn kho, đơn hàng..."
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-white focus:outline-hidden focus:border-primary transition"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-primary hover:bg-red-700 text-white flex items-center justify-center transition shadow-lg shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
