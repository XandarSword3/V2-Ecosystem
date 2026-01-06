'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '../ThemeToggle';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { CurrencySwitcher } from '../CurrencySwitcher';
import { UserPreferencesModal } from '../settings/UserPreferencesModal';
import { 
  UtensilsCrossed, 
  Home, 
  Waves, 
  Cookie, 
  Menu, 
  X, 
  User,
  ShoppingCart,
  Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCartStore } from '@/lib/stores/cartStore';
import { cn } from '@/lib/cn';
import { useSiteSettings } from '@/lib/settings-context';

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { settings, modules } = useSiteSettings();
  const cartCount = useCartStore((s) => s.getCount());
  
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getIconForModule = (module: any) => {
    // Specific icons for default modules
    if (module.slug === 'restaurant') return UtensilsCrossed;
    if (module.slug === 'snack-bar') return Cookie;
    if (module.slug === 'pool') return Waves;
    if (module.slug === 'chalets') return Home;

    // Generic icons based on type
    switch (module.template_type) {
      case 'menu_service': return UtensilsCrossed;
      case 'multi_day_booking': return Home;
      case 'session_access': return Waves;
      default: return Home;
    }
  };

  const navigation = [
    { name: t('home'), href: '/', icon: Home },
    ...modules.map(m => ({
      name: m.name,
      href: `/${m.slug}`,
      icon: getIconForModule(m)
    }))
  ];

  // Fallback if modules not loaded yet (optional, but good for UX)
  if (modules.length === 0) {
    navigation.push(
      { name: t('restaurant'), href: '/restaurant', icon: UtensilsCrossed },
      { name: t('chalets'), href: '/chalets', icon: Home },
      { name: t('pool'), href: '/pool', icon: Waves },
      { name: t('snackBar'), href: '/snack-bar', icon: Cookie }
    );
  }

  // Don't show header on admin or staff pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/staff')) {
    return null;
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-lg shadow-black/5'
          : 'bg-white dark:bg-gray-900',
        'border-b border-gray-200/50 dark:border-gray-800/50'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -3 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white font-bold text-xl px-3 py-1.5 rounded-xl shadow-lg shadow-blue-500/30"
            >
              {settings.resortName ? settings.resortName.substring(0, 2) : 'V2'}
            </motion.div>
            <span className="font-bold text-xl text-gray-900 dark:text-white hidden sm:inline group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {settings.resortName ? settings.resortName.substring(2) : 'Resort'}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{item.name}</span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Cart Button */}
            {cartCount > 0 && (
              <Link href="/cart">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
                  >
                    {cartCount}
                  </motion.span>
                </motion.div>
              </Link>
            )}

            <CurrencySwitcher />
            <LanguageSwitcher />
            <ThemeToggle />
            
            {/* Settings Button */}
            <motion.button
              whileHover={{ scale: 1.05, rotate: 15 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPreferencesOpen(true)}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label={t('settings')}
            >
              <Settings className="h-5 w-5" />
            </motion.button>
            
            {/* Auth Buttons - Desktop */}
            <div className="hidden md:flex items-center gap-2 ml-2">
              {isAuthenticated ? (
                <Link href="/profile">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">{user?.fullName?.split(' ')[0] || 'Profile'}</span>
                  </motion.div>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {t('signIn')}
                    </motion.div>
                  </Link>
                  <Link href="/register">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg shadow-blue-500/25 transition-all"
                    >
                      {tCommon('register')}
                    </motion.div>
                  </Link>
                </>
              )}
            </div>
            
            {/* Mobile Menu Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <AnimatePresence mode="wait">
                {mobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-6 w-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="lg:hidden overflow-hidden border-t border-gray-200 dark:border-gray-800"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.05 },
                  },
                }}
                className="py-4 space-y-1"
              >
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <motion.div
                      key={item.href}
                      variants={{
                        hidden: { opacity: 0, x: -20 },
                        visible: { opacity: 1, x: 0 },
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                          isActive
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </motion.div>
                  );
                })}

                {/* Mobile Auth */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800"
                >
                  {isAuthenticated ? (
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <User className="h-5 w-5" />
                      <span>{t('myProfile')}</span>
                    </Link>
                  ) : (
                    <div className="flex gap-2 px-4">
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 py-2.5 text-center text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl"
                      >
                        {t('signIn')}
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 py-2.5 text-center text-sm font-medium bg-blue-600 text-white rounded-xl"
                      >
                        {tCommon('register')}
                      </Link>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
      
      {/* User Preferences Modal */}
      <UserPreferencesModal 
        isOpen={preferencesOpen} 
        onClose={() => setPreferencesOpen(false)} 
      />
    </motion.header>
  );
}

export { Header };
