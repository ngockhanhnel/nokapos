import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { Navbar } from '@/src/components/Navbar';
import { Sidebar } from '@/src/components/Sidebar';
import { MobileNav } from '@/src/components/MobileNav';
import { EmptyShopView } from '@/src/components/EmptyShopView';
import { performFullMemoryCleanup } from '@/src/lib/cacheManager';
import { AuthView } from '@/src/views/AuthView';
import { DashboardView } from '@/src/views/DashboardView';
import { PosView } from '@/src/views/PosView';
import { ProductsView } from '@/src/views/ProductsView';
import { InventoryView } from '@/src/views/InventoryView';
import { OrdersView } from '@/src/views/OrdersView';
import { ExpensesView } from '@/src/views/ExpensesView';
import { ReportsView } from '@/src/views/ReportsView';
import { StaffView } from '@/src/views/StaffView';
import { SettingsView } from '@/src/views/SettingsView';
import { SuppliersView } from '@/src/views/SuppliersView';
import { CustomersView } from '@/src/views/CustomersView';
import { NotificationsView } from '@/src/views/NotificationsView';
import { AutobankView } from '@/src/views/AutobankView';
import { KDSView } from '@/src/views/KDSView';
import { BranchesView } from '@/src/views/BranchesView';
import { PreOrdersView } from '@/src/views/PreOrdersView';
import {
  getUnreadNotificationCount,
  checkAndTriggerReminders,
} from '@/src/lib/notifications';
import { TelegramService } from '@/src/lib/telegramService';
import { Product, Shift, HoldOrder, Order, PreOrder } from '@/src/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Loader2 } from 'lucide-react';
import { ChatView } from '@/src/views/ChatView';
import { AdminView } from '@/src/views/AdminView';
import { AdvancedPricingEngine } from '@/src/components/pricing/AdvancedPricingEngine';
import { isSuperAdmin } from '@/src/lib/adminAuth';

const MainApp: React.FC = () => {
  const { user, currentShop, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Background reminder monitoring state
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [preOrderToLoadInPos, setPreOrderToLoadInPos] = useState<PreOrder | null>(null);

  // Update unread count on mount and when notifications change
  useEffect(() => {
    const updateCount = () => {
      setUnreadNotificationsCount(getUnreadNotificationCount());
    };

    updateCount();
    window.addEventListener('duckpos_notifications_updated', updateCount);
    window.addEventListener('storage', updateCount);

    return () => {
      window.removeEventListener('duckpos_notifications_updated', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, []);

  // Zero-trace silent protection: If unauthorized user tries to access 'admin', immediately redirect to dashboard
  useEffect(() => {
    if (currentView === 'admin' && !isSuperAdmin(user)) {
      setCurrentView('dashboard');
    }
  }, [currentView, user]);

  // Automated memory & listener cleanup when switching between complex views
  useEffect(() => {
    performFullMemoryCleanup(currentView);
  }, [currentView]);

  // Listen for products for inventory alert checks
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(collection(db, 'shops', currentShop.id, 'products'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Product[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Product);
        });
        setShopProducts(list);
      },
      (error) => {
        console.warn('Shop products listener notice:', error);
      }
    );
    return () => unsubscribe();
  }, [currentShop?.id]);

  // Listen for active shift for overtime shift alert checks
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(
      collection(db, 'shops', currentShop.id, 'shifts'),
      where('status', '==', 'open')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const firstDoc = snapshot.docs[0];
          setActiveShift({ id: firstDoc.id, ...firstDoc.data() } as Shift);
        } else {
          setActiveShift(null);
        }
      },
      (error) => {
        console.warn('Active shift listener notice:', error);
      }
    );
    return () => unsubscribe();
  }, [currentShop?.id]);

  // Listen for orders for periodic sales summaries
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(collection(db, 'shops', currentShop.id, 'orders'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Order);
        });
        setTodayOrders(list);
      },
      (error) => {
        console.warn('Today orders listener notice:', error);
      }
    );
    return () => unsubscribe();
  }, [currentShop?.id]);

  // Listen for pre-orders for auto reminders & POS linkage
  useEffect(() => {
    if (!currentShop?.id) return;
    const q = query(collection(db, 'shops', currentShop.id, 'preOrders'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: PreOrder[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as PreOrder);
        });
        setPreOrders(list);
      },
      (error) => {
        console.warn('Pre-orders listener notice:', error);
      }
    );
    return () => unsubscribe();
  }, [currentShop?.id]);

  // Automated background interval scanner (every 30 seconds)
  useEffect(() => {
    if (!currentShop?.id) return;

    const runCheck = () => {
      let holdOrders: HoldOrder[] = [];
      try {
        const saved = localStorage.getItem(`duckpos_hold_${currentShop.id}`);
        if (saved) holdOrders = JSON.parse(saved);
      } catch {
        holdOrders = [];
      }

      checkAndTriggerReminders({
        products: shopProducts,
        activeShift,
        holdOrders,
        preOrders,
      });

      // Dispatch scheduled / interval Telegram reminders
      TelegramService.checkAndDispatchScheduled(currentShop, {
        products: shopProducts,
        todayOrders,
        preOrders,
      });

      setUnreadNotificationsCount(getUnreadNotificationCount());
    };

    // Initial run after data arrives
    runCheck();

    const interval = setInterval(runCheck, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [currentShop, shopProducts, activeShift, todayOrders, preOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-red-900/90 border border-red-700/60 flex items-center justify-center text-4xl mb-4 shadow-xl">
          🦆
        </div>
        <h1 className="text-lg font-bold text-white mb-2">DuckPOS Pro</h1>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span>Đang kết nối hệ thống quán...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show login/register view
  if (!user) {
    return <AuthView />;
  }

  // If user has no shop yet, show professional empty shop onboarding view
  if (!currentShop) {
    return <EmptyShopView />;
  }

  // DEDICATED FULL-SCREEN POS KIOSK TERMINAL (No Mobile Bottom Nav, No generic header overlap)
  if (currentView === 'pos') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none">
        <PosView
          onExitToMenu={() => setCurrentView('dashboard')}
          onNavigateToProducts={() => setCurrentView('products')}
          onNavigateToNotifications={() => setCurrentView('notifications')}
          onNavigateToPreOrders={() => setCurrentView('preorders')}
          preOrderToLoad={preOrderToLoadInPos}
          onClearPreOrderToLoad={() => setPreOrderToLoadInPos(null)}
          unreadNotificationsCount={unreadNotificationsCount}
        />
      </div>
    );
  }

  // STANDARD MANAGEMENT & BACKOFFICE LAYOUT
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans relative">
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        unreadCount={unreadNotificationsCount}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          unreadCount={unreadNotificationsCount}
        />

        <main className="flex-1 flex flex-col overflow-y-auto pb-16 lg:pb-0">
          {currentView === 'dashboard' && <DashboardView onNavigate={setCurrentView} />}
          {currentView === 'chat' && <ChatView onNavigate={setCurrentView} />}
          {currentView === 'notifications' && (
            <NotificationsView onNavigateToView={setCurrentView} />
          )}
          {currentView === 'preorders' && (
            <PreOrdersView
              onNavigateToPos={(order) => {
                setPreOrderToLoadInPos(order || null);
                setCurrentView('pos');
              }}
            />
          )}
          {currentView === 'products' && (
            <ProductsView onNavigateToPricing={() => setCurrentView('pricing')} />
          )}
          {currentView === 'pricing' && <AdvancedPricingEngine />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'suppliers' && <SuppliersView />}
          {currentView === 'customers' && <CustomersView />}
          {currentView === 'orders' && (
            <OrdersView onNavigateToPos={() => setCurrentView('pos')} />
          )}
          {currentView === 'expenses' && <ExpensesView />}
          {currentView === 'reports' && <ReportsView />}
          {currentView === 'staff' && <StaffView />}
          {currentView === 'autobank' && (
            <AutobankView onNavigateToPos={() => setCurrentView('pos')} />
          )}
          {currentView === 'kds' && <KDSView />}
          {currentView === 'branches' && <BranchesView />}
          {currentView === 'admin' && isSuperAdmin(user) && <AdminView onNavigate={setCurrentView} />}
          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      <MobileNav
        currentView={currentView}
        onSelectView={setCurrentView}
        unreadCount={unreadNotificationsCount}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </AuthProvider>
  );
}
