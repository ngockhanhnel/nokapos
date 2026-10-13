import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { Mail, Lock, User, ArrowRight, Loader2, KeyRound } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'register') {
        if (!displayName.trim()) {
          throw new Error('Vui lòng nhập họ tên của bạn');
        }
        await signUpWithEmail(email, password, displayName);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setSuccessMessage('Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư của bạn.');
      }
    } catch (err: unknown) {
      console.error(err);
      let msg = 'Đã xảy ra lỗi. Vui lòng kiểm tra lại thông tin.';
      if (err instanceof Error) {
        if (err.message.includes('auth/invalid-credential') || err.message.includes('auth/wrong-password')) {
          msg = 'Email hoặc mật khẩu không chính xác.';
        } else if (err.message.includes('auth/email-already-in-use')) {
          msg = 'Email này đã được sử dụng. Vui lòng đăng nhập.';
        } else if (err.message.includes('auth/weak-password')) {
          msg = 'Mật khẩu cần ít nhất 6 ký tự.';
        } else {
          msg = err.message;
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setLoading(true);
      await signInGoogle();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Đăng nhập Google không thành công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-red-950/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand Lockup */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-red-900/90 border border-red-700/60 items-center justify-center text-3xl mb-3 shadow-md">
            🦆
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            DuckPOS Pro
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Hệ thống Quản lý Bán hàng Chuyên nghiệp cho Quán Vịt Quay
          </p>
        </div>

        {/* Tab switch */}
        {mode !== 'forgot' && (
          <div className="flex bg-neutral-950 p-1 rounded-xl mb-6 border border-neutral-800">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'login'
                  ? 'bg-neutral-800 text-amber-400 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'register'
                  ? 'bg-neutral-800 text-amber-400 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/90 border border-red-800 text-red-200 text-xs">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Họ và tên
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn Tuấn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Mật khẩu
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-[11px] text-amber-500 hover:text-amber-400"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-md mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              <>
                <span>Đăng nhập hệ thống</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : mode === 'register' ? (
              <>
                <span>Tạo tài khoản quản lý</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Gửi liên kết đặt lại mật khẩu</span>
              </>
            )}
          </button>
        </form>

        {mode === 'forgot' && (
          <div className="text-center mt-4">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className="text-xs text-neutral-400 hover:text-amber-400"
            >
              Quay lại Đăng nhập
            </button>
          </div>
        )}

        {/* Google sign-in */}
        {mode !== 'forgot' && (
          <div className="mt-6 pt-5 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 rounded-lg text-xs font-semibold text-neutral-200 flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"
                />
              </svg>
              <span>Đăng nhập với tài khoản Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
