'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ThemeToggle';
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
} from 'lucide-react';
import { toast } from 'sonner';

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
  const t = useTranslations('staff');
  const tAdmin = useTranslations('admin');

  const navigation: NavItem[] = [
    { 
      name: t('nav.kitchen'), 
      href: '/staff/restaurant', 
      icon: ChefHat,
      roles: ['restaurant_staff', 'restaurant_admin', 'super_admin']
    },
    { 
      name: t('nav.snackBar'), 
      href: '/staff/snack', 
      icon: Cookie,
      roles: ['snack_bar_staff', 'snack_bar_admin', 'super_admin']
    },
    { 
      name: t('nav.chalets'), 
      href: '/staff/chalets', 
      icon: Home,
      roles: ['chalet_staff', 'chalet_admin', 'super_admin']
    },
    { 
      name: t('nav.pool'), 
      href: '/staff/pool', 
      icon: Waves,
      roles: ['pool_staff', 'pool_admin', 'super_admin']
    },
    { 
      name: t('nav.bookings'), 
      href: '/staff/bookings', 
      icon: Calendar,
      roles: ['chalet_staff', 'chalet_admin', 'super_admin']
    },
    { 
      name: t('nav.ticketScanner'), 
      href: '/staff/scanner', 
      icon: QrCode,
      roles: ['pool_staff', 'pool_admin', 'super_admin']
    },
  ];
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check authentication
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/staff');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    router.push('/');
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
          <button className="relative p-2 rounded-lg hover:bg-slate-700">
            <Bell className="h-5 w-5 text-slate-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </button>
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
              className="lg:hidden fixed inset-0 z-50 bg-black/70"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-800 shadow-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <span className="font-semibold text-white">Navigation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
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
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 w-20 bg-slate-800 border-r border-slate-700 pt-16">
        <nav className="flex-1 py-4 space-y-2 px-3">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 rounded-xl transition-colors',
                    isActive
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  )}
                  title={item.name}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex flex-col items-center gap-1 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[10px] font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-20 pt-16 min-h-screen">
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
  );
}
