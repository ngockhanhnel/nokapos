import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
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
  const { userRole } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isOwner = userRole === 'owner';
  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  const moreItems = [
    {
      id: 'preorders',
      label: 'Đặt hàng trước',
      icon: CalendarClock,
      allowed: true,
    },
    {
      id: 'notifications',
      label: 'Thông báo & Nhắc việc',
      icon: Bell,
      allowed: true,
      badge: unreadCount,
    },
    { id: 'customers', label: 'Khách hàng (CRM)', icon: UserCheck, allowed: true },
    { id: 'autobank', label: 'Autobank SePay', icon: Zap, allowed: isOwner },
    { id: 'inventory', label: 'Kho hàng & Tồn', icon: Boxes, allowed: true },
    { id: 'expenses', label: 'Sổ quỹ thu chi', icon: Wallet, allowed: isManagerOrOwner },
    { id: 'reports', label: 'Báo cáo doanh thu', icon: BarChart3, allowed: isManagerOrOwner },
    { id: 'staff', label: 'Quản lý nhân viên', icon: Users, allowed: isManagerOrOwner },
    { id: 'settings', label: 'Cài đặt quán', icon: Settings, allowed: isOwner },
  ];

  return (
    <>
      {/* Bottom Floating Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur border-t border-neutral-800 pb-safe">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          <button
            onClick={() => onSelectView('dashboard')}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors ${
              currentView === 'dashboard' ? 'text-amber-400 font-bold' : 'text-neutral-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Tổng quan</span>
          </button>

          <button
            onClick={() => onSelectView('products')}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors ${
              currentView === 'products' ? 'text-amber-400 font-bold' : 'text-neutral-400'
            }`}
          >
            <UtensilsCrossed className="w-5 h-5" />
            <span>Món ăn</span>
          </button>

          {/* Center prominent POS button */}
          <div className="flex items-center justify-center -mt-5">
            <button
              onClick={() => onSelectView('pos')}
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95 border ${
                currentView === 'pos'
                  ? 'bg-red-700 border-amber-400 text-amber-300 ring-2 ring-red-600'
                  : 'bg-red-800 border-red-600 text-white'
              }`}
            >
              <ShoppingCart className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-0.5">BÁN</span>
            </button>
          </div>

          <button
            onClick={() => onSelectView('orders')}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors ${
              currentView === 'orders' ? 'text-amber-400 font-bold' : 'text-neutral-400'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span>Đơn hàng</span>
          </button>

          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center py-1 gap-1 text-[10px] font-medium transition-colors relative ${
              moreItems.some((item) => item.id === currentView)
                ? 'text-amber-400 font-bold'
                : 'text-neutral-400'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>Thêm</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-neutral-900 border-t border-neutral-800 rounded-t-2xl p-4 space-y-2 pb-10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <span className="text-sm font-bold text-white">Chức năng quản trị</span>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {moreItems
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
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                        isActive
                          ? 'bg-red-950/80 border-amber-500/60 text-amber-400'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-5 h-5 text-amber-500 shrink-0" />
                        <span className="text-xs font-semibold truncate">{item.label}</span>
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
      )}
    </>
  );
};
