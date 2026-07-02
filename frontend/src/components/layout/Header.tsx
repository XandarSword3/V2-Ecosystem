'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
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
import { useCartStore } from '@/stores/cartStore';
import { cn } from '@/lib/cn';
import { useTerminology } from '@/hooks/useTerminology';
import { useSiteSettings } from '@/lib/settings-context';
import { Container } from './Container';

// Magnetic Nav Item Component
interface NavItemProps {
  item: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  pathname: string | null;
}

function NavItem({ item, pathname }: NavItemProps) {
  const Icon = item.icon;
  const isActive = pathname === item.href;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
      <motion.div
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'relative flex items-center gap-2 px-4 py-2 rounded-xl transition-colors duration-300',
          isActive
            ? 'text-primary-700 dark:text-primary-300 font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        )}
      >
        {/* Animated background glow */}
        <AnimatePresence>
          {(isHovered || isActive) && (
            <motion.div
              layoutId="navGlow"
              className="absolute inset-0 rounded-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
                border: isActive
                  ? '1px solid rgba(99,102,241,0.2)'
                  : '1px solid rgba(255,255,255,0.3)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Icon with animation */}
        <motion.div
          animate={{ 
            scale: isHovered ? 1.1 : 1,
            rotate: isHovered ? -5 : 0,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="relative z-10"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </motion.div>

        {/* Label */}
        <span className="relative z-10 text-sm font-medium">{item.name}</span>

        {/* Active indicator dot */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}

        {/* Hover underline */}
        <motion.div
          className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-primary-500/50 rounded-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isHovered && !isActive ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>
    </Link>
  );
}

// ... inside Header component
export default function Header() {
  const { settings, modules } = useSiteSettings();
  const { terms } = useTerminology();
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  // Property slug from current URL (present when inside a [property] segment)
  // Used to prefix module links so they resolve to /{property}/{slug}
  const propertySlug = (params?.property as string) || settings.propertySlug;
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
    template_type?: string;
    settings?: { icon?: string };
  }
  const getIconForModule = (module: ModuleIcon) => {
    // Q156 — Check per-module custom icon setting first (set via the icon dropdown in ModuleForm)
    if (module.settings?.icon) {
      const customIcon = getIconByName(module.settings.icon);
      if (customIcon) return customIcon;
    }
    // Fallback: icon based on canonical engine/template type
    switch (module.template_type) {
      case 'instant_transaction': return UtensilsCrossed;
      case 'time_exclusive_reservation': return Home;
      case 'shared_capacity_access': return Waves;
      case 'ongoing_entitlement': return Cookie;
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
    // Known translation keys mapping (generic slugs only — no hardcoded business types)
    const knownKeys: Record<string, string> = {
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
  // IMPORTANT: Only show modules that are ACTIVE and have show_in_main enabled
  const navigation = useMemo((): NavigationItem[] => {
    // Get list of active modules that should be shown in customer nav
    const activeModules = modules.filter(m => m.is_active && m.show_in_main);
    
    if (settings.navbar?.links && settings.navbar.links.length > 0) {
      // CMS mode: filter links to only include valid, active modules
      const mappedItems = settings.navbar.links
        .map((link: NavLink): NavigationItem | null => {
          if (link.type === 'module') {
            // Case-insensitive module lookup - ONLY show if module is active AND show_in_main
            const module = activeModules.find(m => m.slug.toLowerCase() === link.moduleSlug?.toLowerCase());
            if (module) {
              return {
                name: getModuleTranslatedName(module.slug, module.name),
                href: propertySlug ? `/${propertySlug}/${module.slug}` : `/${module.slug}`,
                icon: getIconForModule(module)
              };
            }
            // Module not found or inactive - SKIP this link entirely
            return null;
          }
          // Non-module links (internal/external) - keep external as-is;
          // prepend property slug to internal relative paths so /profile → /myresort/profile.
          return {
            name: link.label,
            href: link.type !== 'external' && link.href?.startsWith('/') && propertySlug
              ? `/${propertySlug}${link.href}`
              : link.href,
            icon: getIconByName(link.icon || 'Home')
          };
        });
      return mappedItems.filter((item): item is NavigationItem => item !== null);
    }
    
    // Fallback: Auto-generate from active modules
    return [
      { name: t('home'), href: propertySlug ? `/${propertySlug}` : '/', icon: Home },
      ...activeModules
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(m => ({
      name: getModuleTranslatedName(m.slug, m.name),
      href: propertySlug ? `/${propertySlug}/${m.slug}` : `/${m.slug}`,
      icon: getIconForModule(m)
      }))
    ];
  }, [settings.navbar?.links, modules, locale, t, propertySlug]);

  // ...existing code...

  // Don't show header on admin or staff pages (now nested at /{property}/admin, /{property}/staff)
  if (pathname && /\/(?:admin|staff)(\/?$|\/)/.test(pathname)) {
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
      role="banner"
    >
      <Container as="div">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group" aria-label={`${settings.siteName || t('home')} Home`}>
            {(settings as any).logoUrl ? (
              <>
                {/* Light mode logo (always shown unless dark logo overrides) */}
                <img
                  src={(settings as any).logoUrl}
                  alt={settings.siteName || 'Logo'}
                  className={`object-contain h-10 ${
                    (settings as any).logoDarkUrl ? 'dark:hidden' : ''
                  }`}
                  style={{ maxWidth: `${(settings as any).logoMaxWidth || 160}px` }}
                />
                {/* Dark mode logo — only rendered if explicitly set */}
                {(settings as any).logoDarkUrl && (
                  <img
                    src={(settings as any).logoDarkUrl}
                    alt={settings.siteName || 'Logo'}
                    className="object-contain h-10 hidden dark:block"
                    style={{ maxWidth: `${(settings as any).logoMaxWidth || 160}px` }}
                  />
                )}
              </>
            ) : (
              <>
                {/* Fallback: generated initials badge */}
                <motion.div
                  whileHover={{ scale: 1.05, rotate: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-500 text-white font-bold text-xl px-3.5 py-2 rounded-xl shadow-lg shadow-primary-500/30 backdrop-blur-sm"
                  aria-hidden="true"
                >
                  {settings.siteName
                    ? settings.siteName.split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase()
                    : 'V2'}
                </motion.div>
                <span className="font-bold text-xl text-slate-900 dark:text-white hidden sm:inline group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-300">
                  {settings.siteName || 'Property'}
                </span>
              </>
            )}
          </Link>

          {/* Desktop Navigation - Enhanced with magnetic hover */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {navigation.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Cart Button - only show after mount to prevent hydration mismatch */}
            {mounted && navConfig.showCart && cartCount > 0 && (
              <Link href={propertySlug ? `/${propertySlug}/cart` : '/cart'}>
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

            <div className="hidden sm:flex items-center gap-2">
              {navConfig.showCurrencySwitcher && <CurrencySwitcher />}
              {navConfig.showLanguageSwitcher && <LanguageSwitcher />}
              {navConfig.showThemeToggle && <ThemeToggle />}
            </div>

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
                <Link href={propertySlug ? `/${propertySlug}/profile` : '/profile'}>
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
                        href={propertySlug ? `/${propertySlug}/profile` : '/profile'}
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
      </Container>

      {/* User Preferences Modal */}
      <UserPreferencesModal
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
    </motion.header>
  );
}

export { Header };
