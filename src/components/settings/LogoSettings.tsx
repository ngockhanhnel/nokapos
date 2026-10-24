import React, { useState, useRef } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Upload, Image as ImageIcon, Trash2, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { logger } from '@/src/lib/logger';

export const LogoSettings: React.FC = () => {
  const { currentShop, reloadShopData, userRole } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string>(currentShop?.brandConfig?.logoUrl || '');
  const [previewUrl, setPreviewUrl] = useState<string>(currentShop?.brandConfig?.logoUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = userRole === 'owner';

  // Client-side image resize & compression to compact WebP/JPEG Data URL
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, SVG, WebP).'));
        return;
      }

      // Max size limit check (5MB)
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Kích thước ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 5MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 400; // 400x400 is ideal for POS and header badges
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Không thể xử lý ảnh trên trình duyệt.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Compress to webp or jpeg with 0.85 quality
          const compressedDataUrl = canvas.toDataURL('image/webp', 0.85);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Lỗi khi tải tệp ảnh.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setStatusMsg(null);
      const dataUrl = await processImageFile(file);
      setPreviewUrl(dataUrl);
      setLogoUrl(dataUrl);
      logger.info('LOGO', `Đã chọn tệp logo mới: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Lỗi xử lý tệp ảnh.' });
      logger.error('LOGO', 'Lỗi xử lý tệp logo', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveLogo = async () => {
    if (!currentShop?.id) return;
    try {
      setIsSaving(true);
      setStatusMsg(null);

      const shopRef = doc(db, 'shops', currentShop.id);
      const currentBrand = currentShop.brandConfig || {
        primaryColor: '#B91C1C',
        secondaryColor: '#F59E0B',
        logoUrl: '',
        fontFamily: 'Plus Jakarta Sans',
      };

      await updateDoc(shopRef, {
        brandConfig: {
          ...currentBrand,
          logoUrl: logoUrl.trim(),
        },
        updatedAt: new Date().toISOString(),
      });

      await reloadShopData();
      setStatusMsg({ type: 'success', text: 'Đã cập nhật logo quán thành công! Thanh tiêu đề đã được cập nhật.' });
      logger.info('LOGO', 'Cập nhật logo thành công vào Firestore');
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Lỗi khi lưu logo vào hệ thống: ' + (err.message || 'Không có quyền') });
      logger.error('LOGO', 'Lỗi lưu logo Firestore', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentShop?.id) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa logo tùy chỉnh và quay lại biểu tượng mặc định không?')) return;

    try {
      setIsSaving(true);
      setStatusMsg(null);

      const shopRef = doc(db, 'shops', currentShop.id);
      const currentBrand = currentShop.brandConfig || {
        primaryColor: '#B91C1C',
        secondaryColor: '#F59E0B',
        logoUrl: '',
        fontFamily: 'Plus Jakarta Sans',
      };

      await updateDoc(shopRef, {
        brandConfig: {
          ...currentBrand,
          logoUrl: '',
        },
        updatedAt: new Date().toISOString(),
      });

      setLogoUrl('');
      setPreviewUrl('');
      await reloadShopData();
      setStatusMsg({ type: 'success', text: 'Đã xóa logo tùy chỉnh. Hệ thống đã khôi phục biểu tượng mặc định.' });
      logger.info('LOGO', 'Đã xóa logo tùy chỉnh về mặc định');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Lỗi khi xóa logo: ' + err.message });
      logger.error('LOGO', 'Lỗi xóa logo', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
      <div className="border-b border-neutral-800 pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-500" />
            Tải Lên Logo Quán (Logo Branding)
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Logo sẽ tự động hiển thị trên thanh Header, Sidebar, Màn hình POS và Hóa đơn in nhiệt
          </p>
        </div>
        {previewUrl && (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Logo tùy chỉnh đang hoạt động
          </span>
        )}
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'
              : 'bg-red-950/80 border border-red-800 text-red-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left: Preview Box */}
        <div className="flex flex-col items-center justify-center p-6 bg-neutral-950 border border-neutral-800 rounded-2xl text-center space-y-3">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-900 flex items-center justify-center overflow-hidden shadow-inner relative group">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Logo preview"
                className="w-full h-full object-contain p-1 rounded-xl"
              />
            ) : (
              <div className="flex flex-col items-center text-neutral-500 gap-1">
                <span className="text-3xl">🦆</span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400">Mặc định</span>
              </div>
            )}
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block">Xem trước hiển thị</span>
            <span className="text-[10px] text-neutral-500">Khuyên dùng tỷ lệ vuông 1:1</span>
          </div>
        </div>

        {/* Right: Upload controls */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Chọn tệp logo từ máy tính / điện thoại
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
                id="shop-logo-upload"
              />
              <label
                htmlFor="shop-logo-upload"
                className={`px-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-xs ${
                  isUploading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <Upload className="w-4 h-4 text-amber-400" />
                )}
                <span>{previewUrl ? 'Thay đổi ảnh logo' : 'Tải lên logo từ thiết bị'}</span>
              </label>

              {previewUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isSaving}
                  className="px-3.5 py-2.5 rounded-xl border border-red-900/60 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa về mặc định</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">
              Hỗ trợ PNG trong suốt, JPG, WebP hoặc SVG. Tự động tối ưu dung lượng siêu nhẹ để tải nhanh.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Hoặc nhập đường dẫn ảnh trực tiếp (URL)
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => {
                setLogoUrl(e.target.value);
                setPreviewUrl(e.target.value);
              }}
              placeholder="https://example.com/logo.png"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-amber-500 transition font-mono"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSaveLogo}
              disabled={isSaving || isUploading || !isOwner}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-neutral-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Lưu Logo Quán</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
