'use client';

/**
 * F11 — Business Capabilities Overview
 *
 * The Engine A capability surface rendered as a dashboard. Replaces the
 * removed legacy admin dashboard (which hardcoded legacy module slugs):
 * every card here is module-agnostic and permission-gated, deriving its
 * status ONLY from endpoints that exist today. A card that fails to load
 * shows a neutral "unavailable" state — never fake numbers.
 *
 * The page asks "what can this business do?" — not "what modules exist?".
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ClipboardList,
  ShoppingBag,
  Ticket,
  Wrench,
  Package,
  Users,
  UserCog,
  CreditCard,
  Receipt,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Cloud,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthorization } from '@/lib/authorization';
import { CardSkeleton } from '@/components/ui/Skeleton';

// ─── Capability card model ────────────────────────────────────────────

interface CapabilityLink {
  label: string;
  href: string;
}

interface CapabilityDef {
  id: string;
  translationKey: string;
  fallback: string;
  description: string;
  icon: React.ElementType;
  accent: string; // tailwind gradient classes
  /** Card is rendered only when the actor holds at least one permission. */
  permissions: string[];
  /** Quick links rendered on the card (filtered by the same permission gate). */
  links: CapabilityLink[];
  /** Live stat fetchers — each fails soft to null. */
  stats: Array<{
    label: string;
    fetch: () => Promise<string | number | null>;
  }>;
}

function num(v: unknown, fallback: string | number = '—'): string | number {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function BusinessOverviewPage() {
  const t = useTranslations('admin');
  const params = useParams();
  const propertySlug = (params?.property as string) || '';
  const auth = useAuthorization();
  const base = `/${propertySlug}/admin`;

  const capabilities: CapabilityDef[] = useMemo(
    () => [
      {
        id: 'orders',
        translationKey: 'nav.orders',
        fallback: 'Orders',
        description: 'Cross-module transaction operations — confirm, fulfill, track.',
        icon: ClipboardList,
        accent: 'from-blue-500 to-indigo-600',
        permissions: ['order:read:all'],
        links: [{ label: t('nav.orders') || 'Orders', href: `${base}/orders` }],
        stats: [
          {
            label: 'Active modules',
            fetch: async () => {
              const res = await api.get('/admin/modules');
              const mods = res.data?.data || [];
              return mods.filter(
                (m: { engine_type?: string; template_type?: string }) =>
                  m.engine_type === 'instant_transaction' || m.template_type === 'menu_service'
              ).length;
            },
          },
        ],
      },
      {
        id: 'products',
        translationKey: 'nav.products',
        fallback: 'Products',
        description: 'Catalog, categories, and customization across all modules.',
        icon: ShoppingBag,
        accent: 'from-orange-500 to-amber-600',
        permissions: ['admin:modules:manage', 'inventory:read'],
        links: [
          { label: t('nav.allProducts') || 'All Products', href: `${base}/products` },
          { label: t('nav.customizations') || 'Customizations', href: `${base}/customizations` },
        ],
        stats: [
          {
            label: 'Active modules',
            fetch: async () => {
              const res = await api.get('/admin/modules');
              return (res.data?.data || []).filter((m: { is_active?: boolean }) => m.is_active).length;
            },
          },
        ],
      },
      {
        id: 'pricing',
        translationKey: 'nav.pricing',
        fallback: 'Pricing',
        description: 'Coupons, tax configuration, and pricing rules.',
        icon: Ticket,
        accent: 'from-violet-500 to-purple-600',
        permissions: ['coupon:manage', 'admin:settings:manage'],
        links: [
          { label: t('nav.coupons') || 'Coupons', href: `${base}/coupons` },
          { label: t('nav.taxConfiguration') || 'Tax Configuration', href: `${base}/settings/tax` },
        ],
        stats: [
          {
            label: 'Configured tax rates',
            fetch: async () => {
              const res = await api.get('/admin/settings/tax');
              return num(res.data?.data?.rates?.length, 0);
            },
          },
        ],
      },
      {
        id: 'fulfillment',
        translationKey: 'nav.fulfillment',
        fallback: 'Fulfillment',
        description: 'Operational readiness — housekeeping, capacity, handoff.',
        icon: Wrench,
        accent: 'from-teal-500 to-emerald-600',
        permissions: ['housekeeping:task:manage'],
        links: [{ label: t('nav.housekeeping') || 'Housekeeping', href: `${base}/housekeeping` }],
        stats: [],
      },
      {
        id: 'resources',
        translationKey: 'nav.resources',
        fallback: 'Resources',
        description: 'Inventory, resource consumption, and stock economics.',
        icon: Package,
        accent: 'from-sky-500 to-cyan-600',
        permissions: ['inventory:read', 'inventory:manage'],
        links: [{ label: t('nav.resources') || 'Resources', href: `${base}/inventory` }],
        stats: [],
      },
      {
        id: 'customers',
        translationKey: 'nav.customers',
        fallback: 'Customers',
        description: 'Accounts, loyalty, stored value, and reputation.',
        icon: Users,
        accent: 'from-rose-500 to-pink-600',
        permissions: ['user:read:any'],
        links: [
          { label: t('nav.allCustomers'), href: `${base}/customers` },
          { label: t('nav.customers'), href: `${base}/users/customers` },
          { label: t('nav.loyalty') || 'Loyalty Program', href: `${base}/loyalty` },
          { label: t('nav.giftCards') || 'Gift Cards', href: `${base}/giftcards` },
        ],
        stats: [
          {
            label: 'Customers',
            fetch: async () => {
              const res = await api.get('/admin/customers', { params: { limit: 1 } });
              return res.data?.data?.total ?? '—';
            },
          },
        ],
      },
      {
        id: 'staff',
        translationKey: 'nav.staff',
        fallback: 'Staff',
        description: 'Staff accounts, admins, and live sessions.',
        icon: UserCog,
        accent: 'from-slate-500 to-slate-700',
        permissions: ['user:read:any'],
        links: [
          { label: t('nav.staff'), href: `${base}/users/staff` },
          { label: t('nav.admins') || 'Admins', href: `${base}/users/admins` },
        ],
        stats: [],
      },
      {
        id: 'payments',
        translationKey: 'nav.paymentsNav',
        fallback: 'Payments',
        description: 'Gateway configuration and stored value liabilities.',
        icon: CreditCard,
        accent: 'from-emerald-500 to-green-600',
        permissions: ['admin:settings:manage', 'giftcard:manage'],
        links: [
          { label: t('nav.payments') || 'Payments', href: `${base}/settings/payments` },
          { label: t('nav.giftCards') || 'Gift Cards', href: `${base}/giftcards` },
        ],
        stats: [],
      },
      {
        id: 'fiscal',
        translationKey: 'nav.fiscal',
        fallback: 'Fiscal',
        description: 'Financial reports, tax records, and audit evidence.',
        icon: Receipt,
        accent: 'from-amber-500 to-yellow-600',
        permissions: ['admin:reports:read', 'admin:audit:read'],
        links: [
          { label: t('nav.financialReports') || 'Financial Reports', href: `${base}/financial-reports` },
          { label: t('nav.auditLogs') || 'Audit Logs', href: `${base}/audit` },
        ],
        stats: [],
      },
      {
        id: 'analytics',
        translationKey: 'nav.analytics',
        fallback: 'Analytics',
        description: 'Economics, executive cockpit, and operational alerts.',
        icon: BarChart3,
        accent: 'from-fuchsia-500 to-purple-600',
        permissions: ['admin:reports:read'],
        links: [
          { label: t('nav.economics') || 'Economics', href: `${base}/reports?tab=economics` },
          { label: t('nav.executiveCockpit') || 'Executive Cockpit', href: `${base}/cockpit` },
          { label: t('nav.alertManagement') || 'Alert Management', href: `${base}/alerts` },
        ],
        stats: [],
      },
    ],
    [t, base],
  );

  // Only capabilities the actor can see (F2: presentation hints, server remains authority)
  const visibleCapabilities = capabilities.filter((c) =>
    c.permissions.some((p) => auth.hasPermission(p)),
  );

  const loadingPerms = auth.permissionsStatus === 'loading';

  if (loadingPerms) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cloud className="w-6 h-6 text-blue-600" />
          {t('nav.business') || 'Business'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Engine A capability surface — what your business can configure and operate,
          independent of how many modules you run.
        </p>
      </div>

      {/* Capability cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleCapabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <CapabilityCard key={cap.id} cap={cap} Icon={Icon} />
          );
        })}
      </div>

      {visibleCapabilities.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            No business capabilities available for your account.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Capability card with fail-soft live stats ────────────────────────

/**
 * One stat row. Rendered as its own component so useQuery is called
 * unconditionally at the top level of a component (rules of hooks) —
 * a card with zero stats simply renders no StatRow children.
 */
function StatRow({ capabilityId, label, fetch }: { capabilityId: string; label: string; fetch: () => Promise<string | number | null> }) {
  const query = useQuery({
    queryKey: ['business-cap', capabilityId, label],
    queryFn: fetch,
    staleTime: 60_000,
    retry: false,
  });

  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">
        {query.isLoading ? '…' : query.isError ? '—' : String(query.data ?? '—')}
      </p>
    </div>
  );
}

function CapabilityCard({ cap, Icon }: { cap: CapabilityDef; Icon: React.ElementType }) {
  const t = useTranslations('admin');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Accent header */}
      <div className={`bg-gradient-to-r ${cap.accent} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">
              {t(cap.translationKey) || cap.fallback}
            </h2>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">{cap.description}</p>

        {/* Live stats */}
        {cap.stats.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {cap.stats.map((stat) => (
              <StatRow
                key={stat.label}
                capabilityId={cap.id}
                label={stat.label}
                fetch={stat.fetch}
              />
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="flex flex-wrap gap-2 pt-1">
          {cap.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {link.label}
              <ChevronRight className="w-3 h-3" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
