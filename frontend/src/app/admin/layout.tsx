'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSiteSettings } from '@/lib/settings-context';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CurrencySwitcher } from '@/components/CurrencySwitcher';
import { PropertySwitcher } from '@/components/PropertySwitcher';
import { PropertyProvider } from '@/context/PropertyContext';
import { api } from '@/lib/api';
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Bell,
  LogOut,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type NavCategory,
  type NavItem,
  getStaticNavigation,
  getModuleChildren,
  moduleTypeIcons,
  filterNavigationByRole,
  flattenNavigation,
  getInitialExpandedCategories,
  saveExpandedCategories,
  SIDEBAR_EXPANDED_KEY,
} from '@/config/admin-navigation';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('admin');
  const { modules, settings } = useSiteSettings();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  
  // Dynamic branding from CMS
  const resortName = settings.resortName || 'Your Business';
  const logoText = resortName.substring(0, 2).toUpperCase();

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['modules']);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  
  // Notifications state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; time: string; read: boolean }>>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // Load persisted sidebar state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSidebar = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
      if (savedSidebar !== null) {
        setSidebarOpen(savedSidebar === 'true');
      }
      setExpandedCategories(getInitialExpandedCategories());
    }
  }, []);

  // Build navigation with categories
  const navigation = useMemo((): NavCategory[] => {
    const categories = getStaticNavigation(t);
    
    // Populate modules category with actual modules from database
    const modulesCategory = categories.find(c => c.id === 'modules');
    if (modulesCategory && modules && modules.length > 0) {
      const activeModules = modules
        .filter(m => m.is_active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      modulesCategory.items = activeModules.map(module => {
        const icon = moduleTypeIcons[module.template_type] || moduleTypeIcons.default;
        const children = getModuleChildren(module.slug, module.template_type, t);
        
        return {
          name: module.name,
          href: `/admin/${encodeURIComponent(module.slug)}`,
          icon,
          children: children.length > 0 ? children : undefined,
        };
      });
    }
    
    // Filter by user roles
    const userRoles = user?.roles || [];
    return filterNavigationByRole(categories, userRoles.length > 0 ? userRoles : ['admin']);
  }, [modules, t, user?.roles]);

  // Flatten for search
  const searchableItems = useMemo(() => flattenNavigation(navigation), [navigation]);

  // Filtered items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return searchableItems.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.category.toLowerCase().includes(query)
    );
  }, [searchQuery, searchableItems]);

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId];
      saveExpandedCategories(next);
      return next;
    });
  }, []);

  // Toggle item expansion (for items with children)
  const toggleItem = useCallback((itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(n => n !== itemName)
        : [...prev, itemName]
    );
  }, []);

  // Persist sidebar state
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(next));
      }
      return next;
    });
  }, []);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/admin/notifications');
        if (response.data?.success && response.data?.data) {
          setNotifications(response.data.data);
        }
      } catch {
        setNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
    };

    if (isAuthenticated) {
      fetchNotifications();
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

  // Check authentication
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

  const handleLogout = async () => {
    await logout();
    toast.success(t('messages.loggedOutSuccessfully'));
    router.push('/');
  };

  if (isLoading || !authChecked || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 rounded-full border-primary-600 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <PropertyProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-[200] backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-700/50 px-4 h-16 flex items-center justify-between shadow-sm">
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
          <PropertySwitcher />
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
              className="lg:hidden fixed inset-0 z-[200] bg-black/50"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-[200] w-72 backdrop-blur-xl bg-gradient-to-b from-white/95 via-slate-50/90 to-white/95 dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95 shadow-2xl border-r border-slate-200/30 dark:border-slate-700/30"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50">
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
              
              {/* Mobile Search */}
              <div className="p-3 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
                {filteredItems ? (
                  // Search results
                  <div className="space-y-1">
                    <p className="px-3 py-1 text-xs font-medium text-slate-500 uppercase">
                      {filteredItems.length} results
                    </p>
                    {filteredItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setSearchQuery('');
                        }}
                        className={cn(
                          'block px-3 py-2 rounded-lg text-sm',
                          pathname === item.href
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        )}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-slate-400 ml-2">in {item.category}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  // Normal navigation
                  navigation.map((category) => (
                    <CategorySection
                      key={category.id}
                      category={category}
                      pathname={pathname}
                      expanded={expandedCategories.includes(category.id)}
                      onToggleCategory={() => toggleCategory(category.id)}
                      expandedItems={expandedItems}
                      onToggleItem={toggleItem}
                      onNavigate={() => setMobileMenuOpen(false)}
                      collapsed={false}
                    />
                  ))
                )}
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

      {/* Desktop Sidebar */}
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
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/50 dark:border-slate-700/50">
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
            onClick={handleSidebarToggle}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Menu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Search */}
        {sidebarOpen && (
          <div className="p-3 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
          {filteredItems ? (
            // Search results
            <div className="space-y-1">
              {sidebarOpen && (
                <p className="px-3 py-1 text-xs font-medium text-slate-500 uppercase">
                  {filteredItems.length} results
                </p>
              )}
              {filteredItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSearchQuery('')}
                  className={cn(
                    'block px-3 py-2 rounded-lg text-sm',
                    pathname === item.href
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  {sidebarOpen ? (
                    <>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-slate-400 ml-2">in {item.category}</span>
                    </>
                  ) : (
                    <span className="font-medium">{item.name.substring(0, 2)}</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            // Normal navigation with categories
            navigation.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                pathname={pathname}
                expanded={expandedCategories.includes(category.id)}
                onToggleCategory={() => toggleCategory(category.id)}
                expandedItems={expandedItems}
                onToggleItem={toggleItem}
                collapsed={!sidebarOpen}
              />
            ))
          )}
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
                  {user?.email || 'admin@ironparadisegym.com'}
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
      <div
        className={cn(
          'min-h-screen transition-all duration-300 pt-16 lg:pt-0',
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'
        )}
      >
        {/* Top Bar */}
        <div className="hidden lg:flex items-center justify-between h-16 px-6 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm sticky top-0 z-[100]">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {getCurrentPageTitle(navigation, pathname)}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <PropertySwitcher />
            {/* Notifications */}
            <div className="relative z-[110]">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 relative"
              >
                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-[120] overflow-hidden"
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
      </div>
    </div>
    </PropertyProvider>
  );
}

// Helper to get current page title
function getCurrentPageTitle(navigation: NavCategory[], pathname: string | null): string {
  if (!pathname) return 'Dashboard';
  
  for (const category of navigation) {
    for (const item of category.items) {
      if (pathname === item.href) return item.name;
      if (pathname.startsWith(item.href + '/')) return item.name;
      if (item.children) {
        for (const child of item.children) {
          if (pathname === child.href) return child.name;
        }
      }
    }
  }
  
  return 'Dashboard';
}

// Category Section Component
interface CategorySectionProps {
  category: NavCategory;
  pathname: string | null;
  expanded: boolean;
  onToggleCategory: () => void;
  expandedItems: string[];
  onToggleItem: (name: string) => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}

function CategorySection({
  category,
  pathname,
  expanded,
  onToggleCategory,
  expandedItems,
  onToggleItem,
  onNavigate,
  collapsed = false,
}: CategorySectionProps) {
  // Dashboard category - no header, just show items
  if (category.id === 'dashboard') {
    return (
      <div className="space-y-1">
        {category.items.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            pathname={pathname}
            expanded={expandedItems.includes(item.name)}
            onToggle={() => onToggleItem(item.name)}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ))}
      </div>
    );
  }

  // Skip empty categories
  if (category.items.length === 0) return null;

  // Collapsed sidebar - just show items without headers
  if (collapsed) {
    return (
      <div className="space-y-1">
        {category.items.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            pathname={pathname}
            expanded={expandedItems.includes(item.name)}
            onToggle={() => onToggleItem(item.name)}
            onNavigate={onNavigate}
            collapsed={true}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Category Header */}
      <button
        onClick={onToggleCategory}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <span>{category.name}</span>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.div>
      </button>

      {/* Category Items */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-0.5"
          >
            {category.items.map((item) => (
              <NavItemComponent
                key={item.href}
                item={item}
                pathname={pathname}
                expanded={expandedItems.includes(item.name)}
                onToggle={() => onToggleItem(item.name)}
                onNavigate={onNavigate}
                collapsed={false}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Nav Item Component
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
      <Link href={item.href} onClick={onNavigate}>
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
        {item.badge && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
            {item.badge}
          </span>
        )}
      </motion.div>
    </Link>
  );
}
