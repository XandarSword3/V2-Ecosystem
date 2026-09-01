'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { Container } from '@/components/layout/Container';
import {
  Package,
  Clock,
  Sparkles,
  Gift,
  Star,
  LifeBuoy,
  User,
  LogIn,
} from 'lucide-react';

export type AccountTabKey =
  | 'orders'
  | 'tracking'
  | 'loyalty'
  | 'gift-cards'
  | 'reviews'
  | 'support'
  | string;

export interface AccountTabItem {
  key: AccountTabKey;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface AccountShellProps {
  children: React.ReactNode;
  activeTab?: AccountTabKey;
  onTabChange?: (tabKey: AccountTabKey) => void;
  tabs?: AccountTabItem[];
  propertySlug?: string;
  className?: string;
  headerSlot?: React.ReactNode;
}

/**
 * AccountShell — Presentation & navigation shell for customer account surfaces (Phase F3).
 *
 * Responsibilities:
 * - Provides responsive tabbed navigation across customer lifecycle views
 * - Displays guest vs authenticated presentation banner
 * - Houses child account views (`OrderHistory`, `OrderTracking`, `Loyalty`, `Profile`, etc.)
 *
 * Explicit Non-Responsibilities (F3 Law):
 * - Does NOT own order lifecycle state machines or refunds
 * - Does NOT own loyalty balance calculations or point accrual
 * - Does NOT hardcode hospitality status vocabulary
 */
export function AccountShell({
  children,
  activeTab = 'orders',
  onTabChange,
  tabs: customTabs,
  propertySlug = '',
  className = '',
  headerSlot,
}: AccountShellProps) {
  const t = useTranslations('common');
  const { isAuthenticated, user } = useAuth();

  const basePath = propertySlug ? `/${propertySlug}/account` : '/account';

  const defaultTabs: AccountTabItem[] = [
    { key: 'orders', label: t('orders') || 'Orders', href: `${basePath}/orders`, icon: Package },
    { key: 'tracking', label: t('orderTracking') || 'Live Tracking', href: `${basePath}/tracking`, icon: Clock },
    { key: 'loyalty', label: t('loyalty') || 'Loyalty & Rewards', href: `${basePath}/loyalty`, icon: Sparkles },
    { key: 'gift-cards', label: t('giftCards') || 'Gift Cards', href: `${basePath}/gift-cards`, icon: Gift },
    { key: 'reviews', label: t('reviews') || 'Reviews', href: `${basePath}/reviews`, icon: Star },
    { key: 'support', label: t('support') || 'Support & Help', href: `${basePath}/support`, icon: LifeBuoy },
  ];

  const activeTabs = customTabs && customTabs.length > 0 ? customTabs : defaultTabs;

  return (
    <div className={`account-shell min-h-screen bg-slate-50/50 dark:bg-slate-950/50 py-8 ${className}`}>
      <Container size="lg">
        {/* Guest Banner if not authenticated */}
        {!isAuthenticated && (
          <div className="mb-6 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {t('guestMode') || 'Viewing in Guest Mode'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('guestModePrompt') || 'Sign in to access your complete order history, earn rewards, and save preferences.'}
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors shrink-0"
            >
              <LogIn className="w-4 h-4" />
              {t('signIn') || 'Sign In'}
            </Link>
          </div>
        )}

        {/* Header Slot or Default Account Title */}
        {headerSlot ? (
          <div className="mb-6">{headerSlot}</div>
        ) : (
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isAuthenticated && user?.email ? `Welcome back, ${user.email}` : (t('myAccount') || 'My Account')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('manageOrdersAndRewards') || 'Track your orders, view receipts, and manage your account.'}
            </p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-border/60 mb-8 overflow-x-auto scrollbar-none">
          <nav className="flex space-x-2 sm:space-x-6 min-w-max pb-px" aria-label="Account Tabs">
            {activeTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              
              if (onTabChange) {
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={`flex items-center gap-2 py-3 px-3 sm:px-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={tab.key}
                  href={tab.href || '#'}
                  className={`flex items-center gap-2 py-3 px-3 sm:px-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Account View Content */}
        <div className="account-shell-content">
          {children}
        </div>
      </Container>
    </div>
  );
}

export default AccountShell;
