'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSiteSettings } from '@/lib/settings-context';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CurrencySwitcher } from '@/components/CurrencySwitcher';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Home,
  Waves,
  Cookie,
  Users,
  Settings,
  BarChart3,
  FileText,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Palette,
  Cloud,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('admin');
  const { modules, settings } = useSiteSettings();
  
  // Dynamic branding from CMS
  const resortName = settings.resortName || 'V2 Resort';
  const logoText = resortName.substring(0, 2).toUpperCase();

  const navigation: NavItem[] = [
    { name: t('nav.dashboard'), href: '/admin', icon: LayoutDashboard },
    {
      name: t('nav.restaurant'),
      href: '/admin/restaurant',
      icon: UtensilsCrossed,
      children: [
        { name: t('nav.menuItems'), href: '/admin/restaurant/menu' },
        { name: t('nav.categories'), href: '/admin/restaurant/categories' },
        { name: t('nav.orders'), href: '/admin/restaurant/orders' },
        { name: t('nav.tables'), href: '/admin/restaurant/tables' },
      ]
    },
    {
      name: t('nav.chalets'),
      href: '/admin/chalets',
      icon: Home,
      children: [
        { name: t('nav.allChalets'), href: '/admin/chalets' },
        { name: t('nav.bookings'), href: '/admin/chalets/bookings' },
        { name: t('nav.pricingRules'), href: '/admin/chalets/pricing' },
        { name: t('nav.addons'), href: '/admin/chalets/addons' },
        { name: t('nav.settings'), href: '/admin/chalets/settings' },
      ]
    },
    {
      name: t('nav.pool'),
      href: '/admin/pool',
      icon: Waves,
      children: [
        { name: t('nav.sessions'), href: '/admin/pool/sessions' },
        { name: t('nav.tickets'), href: '/admin/pool/tickets' },
        { name: t('nav.capacity'), href: '/admin/pool/capacity' },
      ]
    },
    {
      name: t('nav.snackBar'),
      href: '/admin/snack',
      icon: Cookie,
      children: [
        { name: t('nav.menu'), href: '/admin/snack/menu' },
        { name: t('nav.categories'), href: '/admin/snack/categories' },
        { name: t('nav.orders'), href: '/admin/snack/orders' },
      ]
    },
    {
      name: t('nav.users'),
      href: '/admin/users',
      icon: Users,
      children: [
        { name: t('nav.customers'), href: '/admin/users/customers' },
        { name: t('nav.staff'), href: '/admin/users/staff' },
        { name: t('nav.admins'), href: '/admin/users/admins' },
        { name: t('nav.rolesPermissions'), href: '/admin/users/roles' },
        { name: t('nav.liveUsers') || 'Live Users', href: '/admin/users/live' },
      ]
    },
    { name: t('nav.reviews') || 'Reviews', href: '/admin/reviews', icon: Star },
    { name: t('nav.reports'), href: '/admin/reports', icon: BarChart3 },
    { name: t('nav.modules'), href: '/admin/modules', icon: Cloud },
    {
      name: t('nav.settings'),
      href: '/admin/settings',
      icon: Settings,
      children: [
        { name: t('nav.general'), href: '/admin/settings' },
        { name: t('nav.appearance'), href: '/admin/settings/appearance' },
        { name: t('nav.homepage'), href: '/admin/settings/homepage' },
        { name: t('nav.footer'), href: '/admin/settings/footer' },
        { name: t('nav.translations'), href: '/admin/settings/translations' },
        { name: t('nav.payments'), href: '/admin/settings/payments' },
        { name: t('nav.notifications'), href: '/admin/settings/notifications' },
        { name: t('nav.databaseBackups'), href: '/admin/settings/backups' },
      ]
    },
    { name: t('nav.auditLogs'), href: '/admin/audit', icon: Shield },
  ];

  // Inject dynamic modules
  if (modules && modules.length > 0) {
    const dynamicModules = modules
      .filter(m => m.is_active)
      // Filter out core modules that are already hardcoded in the navigation
      .filter(m => !['restaurant', 'chalets', 'pool', 'snack-bar', 'snack'].includes(m.slug))
      .map(module => {
        let children: { name: string; href: string }[] = [];
        let icon = Cloud;

        if (module.template_type === 'menu_service') {
          icon = UtensilsCrossed;
          children = [
            { name: t('nav.menuItems'), href: `/admin/${module.slug}/menu` },
            { name: t('nav.categories'), href: `/admin/${module.slug}/categories` },
            { name: t('nav.orders'), href: `/admin/${module.slug}/orders` },
            { name: t('nav.tables'), href: `/admin/${module.slug}/tables` },
          ];
        } else if (module.template_type === 'multi_day_booking') {
          icon = Home;
          children = [
            { name: t('nav.allChalets'), href: `/admin/${module.slug}` },
            { name: t('nav.bookings'), href: `/admin/${module.slug}/bookings` },
            { name: t('nav.pricingRules'), href: `/admin/${module.slug}/pricing` },
            { name: t('nav.addons'), href: `/admin/${module.slug}/addons` },
          ];
        } else if (module.template_type === 'session_access') {
          icon = Waves;
          children = [
            { name: t('nav.sessions'), href: `/admin/${module.slug}/sessions` },
            { name: t('nav.tickets'), href: `/admin/${module.slug}/tickets` },
            { name: t('nav.capacity'), href: `/admin/${module.slug}/capacity` },
          ];
        }

        return {
          name: module.name,
          href: `/admin/${module.slug}`,
          icon,
          children
        };
      });

    // Insert before 'Modules' link (use href since name is translated)
    const modulesIndex = navigation.findIndex(n => n.href === '/admin/modules');
    if (modulesIndex !== -1) {
      // Insert dynamic modules before the 'Modules' management link so the management page stays available
      navigation.splice(modulesIndex, 0, ...dynamicModules);
    }
  }

  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; time: string; read: boolean }>>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // Fetch real notifications from backend
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/admin/notifications');
        if (response.data?.success && response.data?.data) {
          setNotifications(response.data.data);
        }
      } catch (error) {
        // If endpoint doesn't exist yet, use empty array
        setNotifications([]);
      } finally {
        setLoadingNotifications(false);
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

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Check authentication - wait for auth to fully load
  useEffect(() => {
    if (!isLoading) {
      setAuthChecked(true);
      if (!isAuthenticated) {
        router.push('/login?redirect=/admin');
      } else if (user && !user.roles.some(role => ['admin', 'super_admin'].includes(role))) {
        toast.error(t('errors.accessDenied') || 'Access denied. Admin privileges required.');
        router.push('/');
      }
    }
  }, [isAuthenticated, isLoading, router, user, t]);

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const handleLogout = async () => {
    await logout();
    toast.success(t('messages.loggedOutSuccessfully'));
    router.push('/');
  };

  if (isLoading || !authChecked || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile Header - Premium Glassmorphism */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-700/50 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Menu className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-lg px-2.5 py-1 rounded-lg">
            {logoText}
          </div>
          <span className="font-semibold text-slate-900 dark:text-white">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <CurrencySwitcher />
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/50"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 backdrop-blur-xl bg-gradient-to-b from-white/95 via-slate-50/90 to-white/95 dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95 shadow-2xl border-r border-slate-200/30 dark:border-slate-700/30"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-transparent via-slate-100/50 dark:via-slate-800/50 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-lg px-2.5 py-1 rounded-lg">
                    {logoText}
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">Admin Panel</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
              <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
                {navigation.map((item) => (
                  <NavItemComponent
                    key={item.name}
                    item={item}
                    pathname={pathname}
                    expanded={expandedItems.includes(item.name)}
                    onToggle={() => toggleExpanded(item.name)}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-t from-white dark:from-slate-900 to-transparent">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar - Premium Glassmorphism */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-300',
          'bg-gradient-to-b from-slate-50/95 via-white/90 to-slate-50/95',
          'dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95',
          'backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50',
          'shadow-[4px_0_24px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.3)]',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-transparent via-slate-100/50 dark:via-slate-800/50 to-transparent">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-lg px-2.5 py-1 rounded-lg shrink-0">
              {logoText}
            </div>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-semibold text-slate-900 dark:text-white whitespace-nowrap overflow-hidden"
              >
                Admin Panel
              </motion.span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Menu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
          {navigation.map((item) => (
            <NavItemComponent
              key={item.name}
              item={item}
              pathname={pathname}
              expanded={expandedItems.includes(item.name)}
              onToggle={() => toggleExpanded(item.name)}
              collapsed={!sidebarOpen}
            />
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-t from-slate-100/80 dark:from-slate-800/80 to-transparent">
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {user?.fullName || 'Admin'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'admin@v2resort.com'}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors',
              !sidebarOpen && 'justify-center'
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span>{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300 pt-16 lg:pt-0',
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'
        )}
      >
        {/* Top Bar - Premium Glassmorphism */}
        <div className="hidden lg:flex items-center justify-between h-16 px-6 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {navigation.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.name || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 relative"
              >
                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No notifications</p>
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div
                            key={notification.id}
                            onClick={() => markAsRead(notification.id)}
                            className={cn(
                              "p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50",
                              !notification.read && "bg-blue-50 dark:bg-blue-900/20"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm text-slate-900 dark:text-white">{notification.title}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{notification.message}</p>
                              </div>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-blue-600 rounded-full shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{notification.time}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <Link
                      href="/admin/settings/notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="block p-3 text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      View all notifications
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        {/* Page Content */}
        <div className="p-6">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

interface NavItemComponentProps {
  item: NavItem;
  pathname: string | null;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}

function NavItemComponent({ item, pathname, expanded, onToggle, onNavigate, collapsed = false }: NavItemComponentProps) {
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
  const hasChildren = item.children && item.children.length > 0;

  if (collapsed) {
    return (
      <Link href={item.href}>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'flex items-center justify-center p-3 rounded-xl transition-all duration-200',
            isActive
              ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 hover:shadow-sm'
          )}
          title={item.name}
        >
          <Icon className="h-5 w-5" />
        </motion.div>
      </Link>
    );
  }

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group',
            isActive
              ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/15 text-blue-600 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 hover:shadow-sm'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-1.5 rounded-lg transition-colors',
              isActive ? 'bg-blue-500/10' : 'group-hover:bg-slate-200/50 dark:group-hover:bg-slate-600/30'
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{item.name}</span>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pl-8 mt-1 space-y-0.5 border-l-2 border-slate-200/60 dark:border-slate-700/60 ml-4">
                {item.children!.map((child) => (
                  <Link key={child.href} href={child.href} onClick={onNavigate}>
                    <motion.div
                      whileHover={{ x: 2 }}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm transition-all duration-200',
                        pathname === child.href
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 font-medium shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-700/40'
                      )}
                    >
                      {child.name}
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link href={item.href} onClick={onNavigate}>
      <motion.div
        whileHover={{ x: 2, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
          isActive
            ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/15 text-blue-600 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 hover:shadow-sm'
        )}
      >
        <div className={cn(
          'p-1.5 rounded-lg transition-colors',
          isActive ? 'bg-blue-500/10' : 'group-hover:bg-slate-200/50 dark:group-hover:bg-slate-600/30'
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{item.name}</span>
      </motion.div>
    </Link>
  );
}
