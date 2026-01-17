'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
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
  Settings,
  Link as LinkIcon
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCartStore } from '@/lib/stores/cartStore';
import { cn } from '@/lib/cn';
import { useSiteSettings } from '@/lib/settings-context';

export default function Header() {
    const { settings, modules } = useSiteSettings();
    const locale = useLocale(); // Track locale to force re-render on language change
    // ...existing code...
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [preferencesOpen, setPreferencesOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { user, isAuthenticated } = useAuth();
    const cartCount = useCartStore((s) => s.getCount());

    const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  // Prevent hydration mismatch by only rendering client-specific content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle scroll effect
  useEffect(() => {
    const isSticky = settings.navbar?.config?.sticky !== false;
    if (!isSticky) {
      setScrolled(false);
      return;
    }
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [settings.navbar?.config?.sticky]);

  interface ModuleIcon {
    slug: string;
    template_type: string;
  }
  const getIconForModule = (module: ModuleIcon) => {
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

  const getIconByName = (name: string) => {
    type IconComponent = typeof Home | typeof UtensilsCrossed | typeof Waves | typeof Cookie | typeof LinkIcon | typeof User | typeof ShoppingCart | typeof Settings;
    const icons: Record<string, IconComponent> = {
      Home,
      UtensilsCrossed,
      Waves,
      Cookie,
      Link: LinkIcon,
      User,
      ShoppingCart,
      Settings
    };
    return icons[name] || Home;
  };

  // Get translated name for module - dynamic lookup with fallback
  const getModuleTranslatedName = (slug: string, fallbackName: string) => {
    // Known translation keys mapping
    const knownKeys: Record<string, string> = {
      'restaurant': 'restaurant',
      'chalets': 'chalets', 
      'pool': 'pool',
      'snack-bar': 'snackBar',
      'snackbar': 'snackBar',
      'gym': 'gym',
      'spa': 'spa',
      'cafe': 'cafe',
      'chocolate-box': 'chocolateBox',
      'chocolate box': 'chocolateBox',
      'chocolatebox': 'chocolateBox',
    };
    
    const translationKey = knownKeys[slug.toLowerCase()];
    if (translationKey) {
      try {
        const translated = t(translationKey as any);
        if (translated && translated !== translationKey) {
          return translated;
        }
      } catch {
        // Ignore translation errors
      }
    }
    
    // Final fallback: use the module name from database (properly formatted)
    return fallbackName;
  };

  interface NavLink {
    type?: string;
    moduleSlug?: string;
    label: string;
    href: string;
    icon?: string;
  }

  interface NavigationItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  // Build navigation from CMS or Fallback - recalculate when locale changes
  const navigation: NavigationItem[] = useMemo(() => {
    return settings.navbar?.links?.map((link: NavLink) => {
      if (link.type === 'module') {
        // Case-insensitive module lookup
        const module = modules.find(m => m.slug.toLowerCase() === link.moduleSlug?.toLowerCase());
        if (module) {
          return {
            name: getModuleTranslatedName(module.slug, module.name),
            href: `/${module.slug}`,
            icon: getIconForModule(module)
          };
        }
        // Module not found - skip this link or show label
        // Use the stored label but don't try to translate it (it might be a bad translation key)
        const fallbackName = link.label.startsWith('nav.') 
          ? link.label.split('.').pop()?.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || link.label 
          : link.label;
        return {
          name: fallbackName,
          href: link.href,
          icon: getIconByName(link.icon || 'Home')
        };
      }
      return {
        name: link.label,
        href: link.href,
        icon: getIconByName(link.icon || 'Home')
      };
    }) || [
        { name: t('home'), href: '/', icon: Home },
        ...modules
          .filter(m => m.show_in_main)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(m => ({
            name: getModuleTranslatedName(m.slug, m.name),
            href: `/${m.slug}`,
            icon: getIconForModule(m)
          }))
      ];
  }, [settings.navbar?.links, modules, locale, t]);

  // ...existing code...

  // Don't show header on admin or staff pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/staff')) {
    return null;
  }

  const navConfig = settings.navbar?.config || {
    showLanguageSwitcher: true,
    showThemeToggle: true,
    showCurrencySwitcher: true,
    showUserPreferences: true,
    showCart: true,
    sticky: true
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        navConfig.sticky ? 'sticky top-0 z-50' : 'relative z-50',
        'transition-all duration-500',
        scrolled
          ? 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-xl shadow-slate-900/5 dark:shadow-black/20'
          : 'bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl',
        'border-b border-white/30 dark:border-slate-800/30'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -3 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-500 text-white font-bold text-xl px-3.5 py-2 rounded-xl shadow-lg shadow-primary-500/30 backdrop-blur-sm"
            >
              {settings.resortName ? settings.resortName.substring(0, 2) : 'V2'}
            </motion.div>
            <span className="font-bold text-xl text-slate-900 dark:text-white hidden sm:inline group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-300">
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
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300',
                      isActive
                        ? 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-medium backdrop-blur-sm border border-primary-200/50 dark:border-primary-700/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 hover:backdrop-blur-sm'
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
            {/* Cart Button - only show after mount to prevent hydration mismatch */}
            {mounted && navConfig.showCart && cartCount > 0 && (
              <Link href="/cart">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-slate-700/40 text-primary-600 dark:text-primary-400 shadow-lg shadow-slate-900/5"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg shadow-red-500/30"
                  >
                    {cartCount}
                  </motion.span>
                </motion.div>
              </Link>
            )}

            {navConfig.showCurrencySwitcher && <CurrencySwitcher />}
            {navConfig.showLanguageSwitcher && <LanguageSwitcher />}
            {navConfig.showThemeToggle && <ThemeToggle />}

            {/* Settings Button */}
            {navConfig.showUserPreferences && (
              <motion.button
                whileHover={{ scale: 1.05, rotate: 15 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPreferencesOpen(true)}
                className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm transition-all duration-300"
                aria-label={t('settings')}
              >
                <Settings className="h-5 w-5" />
              </motion.button>
            )}

            {/* Auth Buttons - Desktop - only render after mount to prevent hydration mismatch */}
            <div className="hidden md:flex items-center gap-2 ml-2">
              {mounted && isAuthenticated ? (
                <Link href="/profile">
                  <motion.div
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-slate-700/40 text-slate-700 dark:text-slate-300 shadow-sm"
                  >
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">{user?.fullName?.split(' ')[0] || 'Profile'}</span>
                  </motion.div>
                </Link>
              ) : mounted ? (
                <>
                  <Link href="/login">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {t('signIn')}
                    </motion.div>
                  </Link>
                  <Link href="/register">
                    <motion.div
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 hover:from-primary-600 hover:via-primary-700 hover:to-primary-800 text-white rounded-xl shadow-lg shadow-primary-500/30 transition-all duration-300"
                    >
                      {tCommon('register')}
                    </motion.div>
                  </Link>
                </>
              ) : null}
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-slate-700/40 shadow-sm"
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
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="lg:hidden overflow-hidden border-t border-white/20 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
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
                        hidden: { opacity: 0, x: -30, filter: 'blur(4px)' },
                        visible: { 
                          opacity: 1, 
                          x: 0, 
                          filter: 'blur(0px)',
                          transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
                        },
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-all duration-300 group',
                          isActive
                            ? 'bg-gradient-to-r from-primary-500/15 to-primary-600/10 dark:from-primary-500/25 dark:to-primary-600/15 text-primary-700 dark:text-primary-300 font-medium shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:shadow-sm'
                        )}
                      >
                        <div className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          isActive ? 'bg-primary-500/10' : 'group-hover:bg-slate-200/50 dark:group-hover:bg-slate-700/50'
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span>{item.name}</span>
                      </Link>
                    </motion.div>
                  );
                })}

                {/* Mobile Auth - only render after mount */}
                {mounted && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -30, filter: 'blur(4px)' },
                    visible: { 
                      opacity: 1, 
                      x: 0, 
                      filter: 'blur(0px)',
                      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
                    },
                  }}
                  className="pt-4 mt-4 mx-2 border-t border-white/20 dark:border-slate-700/30"
                >
                  {isAuthenticated ? (
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all duration-300"
                    >
                      <User className="h-5 w-5" />
                      <span>{t('myProfile')}</span>
                    </Link>
                  ) : (
                    <div className="flex gap-2 px-2">
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 py-2.5 text-center text-sm font-medium bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-slate-700/40 text-slate-700 dark:text-slate-300 rounded-xl transition-all duration-300 hover:bg-white/80 dark:hover:bg-slate-700/80"
                      >
                        {t('signIn')}
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 py-2.5 text-center text-sm font-semibold bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 text-white rounded-xl shadow-lg shadow-primary-500/30"
                      >
                        {tCommon('register')}
                      </Link>
                    </div>
                  )}
                </motion.div>
                )}
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
