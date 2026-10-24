import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { isSuperAdmin } from '@/src/lib/adminAuth';
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Receipt,
  MoreHorizontal,
  Boxes,
  Wallet,
  BarChart3,
  Users,
  Settings,
  Bell,
  Zap,
  UserCheck,
  CalendarClock,
  X,
  MessageSquare,
  ChefHat,
  Truck,
  Building2,
  ShieldAlert,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Calculator,
} from 'lucide-react';

interface MobileNavProps {
  currentView: string;
  onSelectView: (view: string) => void;
  unreadCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  onSelectView,
  unreadCount = 0,
}) => {
  const { userRole, currentShop, userProfile, logout, user } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isOwner = userRole === 'owner';
  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  const operationalItems = [
    { id: 'products', label: 'Quản lý Món ăn', icon: UtensilsCrossed, allowed: true },
    { id: 'pricing', label: 'Cài đặt Bảng giá & Tính giá', icon: Calculator, allowed: isOwner },
    { id: 'kds', label: 'Màn hình Bếp (KDS)', icon: ChefHat, allowed: true },
    { id: 'preorders', label: 'Đặt hàng trước', icon: CalendarClock, allowed: true },
    { id: 'inventory', label: 'Kho hàng & Tồn', icon: Boxes, allowed: true },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: Truck, allowed: isManagerOrOwner },
  ];

  const financialItems = [
    { id: 'expenses', label: 'Sổ quỹ thu chi', icon: Wallet, allowed: isManagerOrOwner },
    { id: 'reports', label: 'Báo cáo doanh thu', icon: BarChart3, allowed: isManagerOrOwner },
    { id: 'customers', label: 'Khách hàng (CRM)', icon: UserCheck, allowed: true },
    { id: 'autobank', label: 'Autobank (SePay)', icon: Zap, allowed: isOwner },
  ];

  const systemItems = [
    { id: 'admin', label: 'Quản trị Admin & Logs', icon: ShieldAlert, allowed: isSuperAdmin(user) },
    { id: 'settings', label: 'Cài đặt quán & In bill', icon: Settings, allowed: isOwner },
    { id: 'notifications', label: 'Thông báo & Nhắc việc', icon: Bell, allowed: true, badge: unreadCount },
    { id: 'staff', label: 'Quản lý nhân viên', icon: Users, allowed: isManagerOrOwner },
    { id: 'branches', label: 'Quản lý Chi nhánh', icon: Building2, allowed: isOwner },
  ];

  const allMoreItems = [...operationalItems, ...financialItems, ...systemItems];

  const isMoreViewActive = allMoreItems.some(
    (item) => item.allowed && item.id === currentView
  );

  return (
    <>
      {/* Bottom Floating Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800 pb-safe shadow-2xl">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {/* 1. POS Prominent Center/Action or Tab 1 */}
          <button
            onClick={() => onSelectView('dashboard')}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors ${
              currentView === 'dashboard' ? 'text-amber-400 font-bold' : 'text-neutral-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Tổng quan</span>
          </button>

          {/* 2. Chat AI */}
          <button
            onClick={() => onSelectView('chat')}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors ${
              currentView === 'chat' ? 'text-amber-400 font-bold' : 'text-neutral-400'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Trợ lý AI</span>
          </button>

          {/* 3. Center prominent POS button */}
          <div className="flex items-center justify-center -mt-5">
            <button
              onClick={() => onSelectView('pos')}
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-xl transition-transform active:scale-95 border ${
                currentView === 'pos'
                  ? 'bg-red-700 border-amber-400 text-amber-300 ring-2 ring-red-600'
                  : 'bg-red-800 border-red-600 text-white'
              }`}
            >
              <ShoppingCart className="w-6 h-6" />
              <span className="text-[9px] font-black mt-0.5 tracking-tight">BÁN</span>
            </button>
          </div>

          {/* 4. Orders */}
          <button
            onClick={() => onSelectView('orders')}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors ${
              currentView === 'orders' ? 'text-amber-400 font-bold' : 'text-neutral-400'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span>Đơn hàng</span>
          </button>

          {/* 5. More / Expandable Drawer */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors relative ${
              isMoreViewActive ? 'text-amber-400 font-bold' : 'text-neutral-400'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>Xem thêm</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>
      </nav>

      {/* Expanded Bottom Sheet Drawer */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border-t border-neutral-800 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-900/80 border border-red-700/60 flex items-center justify-center text-amber-400 font-bold shadow-xs">
                  🦆
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight truncate max-w-[200px]">
                    {currentShop ? currentShop.name : 'DuckPOS Pro'}
                  </h3>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                    {userRole === 'owner' ? 'Chủ quán' : userRole === 'manager' ? 'Quản lý' : 'Thu ngân'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Categories List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Group 1: Vận hành quán */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-1">
                  Vận hành quán & Bếp
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {operationalItems
                    .filter((item) => item.allowed)
                    .map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectView(item.id);
                            setShowMoreMenu(false);
                          }}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-red-950/80 border-amber-500/70 text-amber-300 font-bold shadow-xs'
                              : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="text-xs truncate">{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Group 2: Tài chính & CRM */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-1">
                  Tài chính & Khách hàng
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {financialItems
                    .filter((item) => item.allowed)
                    .map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectView(item.id);
                            setShowMoreMenu(false);
                          }}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-red-950/80 border-amber-500/70 text-amber-300 font-bold shadow-xs'
                              : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-xs truncate">{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Group 3: Quản trị & Cài đặt */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-1">
                  Hệ thống & Cài đặt
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {systemItems
                    .filter((item) => item.allowed)
                    .map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectView(item.id);
                            setShowMoreMenu(false);
                          }}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-red-950/80 border-amber-500/70 text-amber-300 font-bold shadow-xs'
                              : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="text-xs truncate">{item.label}</span>
                          </div>
                          {item.badge && item.badge > 0 ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-red-600 text-white shrink-0">
                              {item.badge > 9 ? '9+' : item.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Drawer Footer: Quick Logout */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/90 flex items-center justify-between pb-8">
              <span className="text-xs text-neutral-400 truncate">
                {userProfile?.displayName || 'Tài khoản quán'}
              </span>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  logout();
                }}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer px-3 py-1.5 rounded-xl hover:bg-red-950/50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
