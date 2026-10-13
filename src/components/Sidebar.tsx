import React from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Boxes,
  Receipt,
  Wallet,
  BarChart3,
  Users,
  Settings,
  Bell,
  Zap,
  ChefHat,
  Building2,
  Truck,
  UserCheck,
  CalendarClock,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView, unreadCount = 0 }) => {
  const { userRole, currentShop } = useAuth();

  const isOwner = userRole === 'owner';
  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, allowed: true },
    { id: 'pos', label: 'Bán hàng (POS)', icon: ShoppingCart, allowed: true },
    { id: 'preorders', label: 'Đặt hàng trước', icon: CalendarClock, allowed: true },
    { id: 'kds', label: 'Màn hình Bếp (KDS)', icon: ChefHat, allowed: true },
    { id: 'customers', label: 'Khách hàng (CRM)', icon: UserCheck, allowed: true },
    { id: 'autobank', label: 'Autobank (SePay)', icon: Zap, allowed: isOwner },
    { id: 'branches', label: 'Quản lý Chi nhánh', icon: Building2, allowed: isOwner },
    { id: 'notifications', label: 'Thông báo & Nhắc việc', icon: Bell, allowed: true, badge: unreadCount },
    { id: 'products', label: 'Sản phẩm', icon: UtensilsCrossed, allowed: true },
    { id: 'inventory', label: 'Kho hàng', icon: Boxes, allowed: true },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: Truck, allowed: isManagerOrOwner },
    { id: 'orders', label: 'Đơn hàng', icon: Receipt, allowed: true },
    { id: 'expenses', label: 'Sổ quỹ & Chi phí', icon: Wallet, allowed: isManagerOrOwner },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3, allowed: isManagerOrOwner },
    { id: 'staff', label: 'Nhân viên', icon: Users, allowed: isManagerOrOwner },
    { id: 'settings', label: 'Cài đặt quán', icon: Settings, allowed: isOwner },
  ];

  return (
    <aside className="hidden lg:flex w-64 bg-neutral-950 border-r border-neutral-800 flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-neutral-800">
        <div className="w-8 h-8 rounded-lg bg-red-900 flex items-center justify-center text-amber-400 font-bold text-lg">
          🦆
        </div>
        <div className="overflow-hidden">
          <h1 className="text-sm font-bold text-white tracking-wide truncate">
            {currentShop ? currentShop.name : 'DuckPOS Pro'}
          </h1>
          <p className="text-[11px] text-amber-500 font-medium">POS Quán Vịt Quay</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => item.allowed)
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-red-950/80 text-amber-400 border border-red-800/80 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-red-600 text-white shrink-0">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
      </nav>

      {/* Quick Info Box */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-900/40">
        <div className="text-[11px] text-neutral-400">
          <div className="flex justify-between py-0.5">
            <span>Tiền tệ:</span>
            <span className="font-semibold text-neutral-200">VND (₫)</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>In bill:</span>
            <span className="font-semibold text-neutral-200">80mm / 58mm</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
