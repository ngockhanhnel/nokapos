import React from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { LogOut, ShieldCheck, ShieldAlert, Shield, Bell } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate?: (view: string) => void;
  unreadCount?: number;
}

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Tổng quan kinh doanh',
  pos: 'Quầy bán hàng POS',
  preorders: 'Quản lý Đặt hàng trước (Pre-Orders)',
  products: 'Quản lý sản phẩm & Giá',
  inventory: 'Quản lý tồn kho & Hao hụt',
  orders: 'Lịch sử đơn hàng',
  expenses: 'Sổ quỹ thu chi & Chi phí',
  reports: 'Báo cáo doanh thu & Lợi nhuận',
  staff: 'Quản lý nhân viên & Phân quyền',
  settings: 'Cài đặt quán & Thông tin in bill',
  notifications: 'Trung tâm thông báo & Nhắc việc',
  autobank: 'Cổng thanh toán tự động Autobank (SePay)',
  kds: 'Màn hình Bếp (KDS) Realtime',
  branches: 'Quản lý Đa Chi Nhánh',
};

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, unreadCount = 0 }) => {
  const { user, userProfile, currentShop, userRole, logout } = useAuth();

  const getRoleBadge = () => {
    switch (userRole) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Chủ quán
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400">
            <Shield className="w-3.5 h-3.5" />
            Quản lý
          </span>
        );
      case 'cashier':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            Thu ngân
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="h-16 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/90 border border-primary/60 flex items-center justify-center text-secondary font-bold shadow-sm">
            🦆
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              {currentShop ? currentShop.name : 'DuckPOS Pro'}
            </div>
            <div className="text-xs text-neutral-400">
              {VIEW_TITLES[currentView] || 'Quản lý'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification Bell Icon */}
        {onNavigate && (
          <button
            onClick={() => onNavigate('notifications')}
            className={`p-2 rounded-xl border transition-colors relative ${
              currentView === 'notifications'
                ? 'bg-secondary/20 border-secondary text-secondary'
                : 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
            }`}
            title="Trung tâm thông báo & Nhắc việc"
          >
            <Bell className="w-4 h-4 text-secondary" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}

        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-neutral-800">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-medium text-neutral-200">
              {userProfile?.displayName || user?.email?.split('@')[0] || 'Nhân viên'}
            </span>
            {getRoleBadge()}
          </div>

          <button
            onClick={() => logout()}
            title="Đăng xuất"
            className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
