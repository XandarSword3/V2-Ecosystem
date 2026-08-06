'use client';

import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CurrencySwitcher } from '@/components/CurrencySwitcher';
import {
  ChefHat,
  UtensilsCrossed,
  Home,
  Waves,
  Cookie,
  Calendar,
  QrCode,
  Users,
  LogOut,
  Menu,
  X,
  Bell,
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
  Search,
  Truck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PropertyProvider } from '@/context/PropertyContext';

interface StaffLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

export default function StaffLayout({ children }: StaffLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const propertySlug = (params?.property as string) || '';
  const t = useTranslations('staff');
  const tAdmin = useTranslations('admin');
  interface ModuleData {
    id: string;
    name: string;
    slug: string;
    is_active?: boolean;
    isActive?: boolean;
    template_type?: string;
    engine_type?: string;
  }
  const [modules, setModules] = useState<ModuleData[]>([]);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await api.get('/admin/modules');
        if (response.data.success) {
          // Normalise backend flag names: some APIs return `is_active`, others `isActive`
          setModules(response.data.data.filter((m: ModuleData) => (m.is_active ?? m.isActive)));
        }
      } catch (error) {
        console.error('Failed to fetch modules:', error);
      }
    };
    fetchModules();
  }, []);

// Dynamic modules only to avoid duplicates
  const navigation: NavItem[] = [
    // Manager Dashboard - for managers only
    {
      name: 'Manager Dashboard',
      href: `/${propertySlug}/staff/manager`,
      icon: Shield,
      roles: ['super_admin', 'admin', 'manager']
    },
    // Customer Lookup - available to all staff
    {
      name: 'Customer Lookup',
      href: `/${propertySlug}/staff/customers`,
      icon: Search,
      roles: ['super_admin', 'admin', 'manager', 'staff']
    },
    // Dynamic modules - roles based on module slug pattern
    ...modules.flatMap(module => {
      const items: NavItem[] = [
        {
          name: module.name,
          href: `/${propertySlug}/staff/modules/${module.slug}`,
          icon: ChefHat, // Default icon
          roles: ['super_admin', 'admin', 'manager', 'staff', `${module.slug}_staff`, `${module.slug}_admin`]
        },
      ];
      // Dispatch is Engine A-only (instant_transaction) — see the guard on
      // DispatchPage/getModuleOrders for why. Nothing to route to for the
      // other engine types.
      if (module.engine_type === 'instant_transaction') {
        items.push({
          name: `${module.name} Dispatch`,
          href: `/${propertySlug}/staff/modules/${module.slug}/dispatch`,
          icon: Truck,
          roles: ['super_admin', 'admin', 'manager', 'staff', `${module.slug}_staff`, `${module.slug}_admin`]
        });
      }
      return items;
    }),
    // Static utilities
    { 
      name: t('nav.ticketScanner'), 
      href: `/${propertySlug}/staff/scanner`,
      icon: QrCode,
      roles: ['super_admin', 'admin', 'manager', 'staff'] // Available to all staff for unified scanning
    },
  ];
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; time: string; read: boolean; is_read?: boolean; created_at?: string }>>([]);

  // Fetch notifications for staff
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/admin/notifications');
        if (response.data?.success && response.data?.data) {
          // Transform notification data
          const transformedNotifications = response.data.data.map((n: { id: string; title: string; message: string; created_at?: string; is_read?: boolean }) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            time: n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now',
            read: n.is_read || false
          }));
          setNotifications(transformedNotifications);
        }
      } catch (error) {
        // If endpoint doesn't work, use empty array
        setNotifications([]);
      }
    };

    if (isAuthenticated) {
      fetchNotifications();
      // Refresh notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/admin/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      // Update locally even if API fails
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/admin/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      // Update locally even if API fails
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check authentication AND staff roles
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push(`/login?redirect=/${propertySlug}/staff`);
      } else if (user) {
        // Verify user has at least one staff role (generic RBAC)
        const staffRoles = ['super_admin', 'admin', 'manager', 'staff'];
        const hasStaffRole = user.roles?.some(role => 
          staffRoles.includes(role) || role.endsWith('_staff') || role.endsWith('_admin')
        );
        if (!hasStaffRole) {
          toast.error('Access denied. Staff privileges required.');
          router.push(`/${propertySlug}`);
        }
      }
    }
  }, [isAuthenticated, isLoading, router, user]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    router.push(`/${propertySlug}`);
  };

  // Filter navigation based on user roles
  const userRoles = user?.roles || [];
  const filteredNavigation = navigation.filter(
    (item) => !item.roles || item.roles.some((role) => userRoles.includes(role) || userRoles.includes('super_admin'))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <PropertyProvider>
      <div className="min-h-screen bg-slate-900">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-700"
          >
            <Menu className="h-5 w-5 text-slate-400" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold text-lg px-2.5 py-1 rounded-lg">
              V2
            </div>
            <span className="font-semibold text-white">{t('portal')}</span>
          </div>
        </div>

        {/* Center - Status Indicators */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">{tAdmin('systemOnline')}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-mono">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Notifications Dropdown */}
          <div className="relative z-[110]">
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-lg hover:bg-slate-700"
              aria-label="Notifications"
              data-testid="notifications-bell"
            >
              <Bell className="h-5 w-5 text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* Notifications Panel */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-xl shadow-lg border border-slate-700 z-[120] overflow-hidden"
                >
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div
                          key={notification.id}
                          onClick={() => markAsRead(notification.id)}
                          className={cn(
                            "p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700/50",
                            !notification.read && "bg-green-900/20"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm text-white">{notification.title}</p>
                              <p className="text-sm text-slate-400">{notification.message}</p>
                            </div>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-green-500 rounded-full shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{notification.time}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <CurrencySwitcher />
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
              {user?.fullName?.charAt(0) || 'S'}
            </div>
            <span className="text-sm text-slate-300">{user?.fullName?.split(' ')[0] || 'Staff'}</span>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true" // FIX Iter-22: decorative backdrop
              className="lg:hidden fixed inset-0 z-50 bg-black/70"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              role="dialog" // FIX Iter-22: mobile nav a11y
              aria-modal="true"
              aria-label="Staff navigation" // FIX Iter-22: labeled dialog
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); }} // FIX Iter-22: Escape to close
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-800 shadow-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <span className="font-semibold text-white">Navigation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation" // FIX Iter-22: close button a11y
                  className="p-2 rounded-lg hover:bg-slate-700"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {filteredNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                        isActive
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 pt-16 bg-slate-800 border-r border-slate-700 transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-end px-3 py-2 border-b border-slate-700">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-700"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                    !sidebarOpen && 'justify-center',
                    isActive
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  )}
                  title={item.name}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && (
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors',
              !sidebarOpen && 'justify-center'
            )}
            title="Logout"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn('pt-16 min-h-screen transition-all duration-300', sidebarOpen ? 'lg:pl-64' : 'lg:pl-20')}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 lg:p-6"
        >
          {children}
        </motion.div>
      </main>
    </div>
    </PropertyProvider>
  );
}
