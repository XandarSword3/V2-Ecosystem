/**
 * Admin Panel Navigation Configuration (F11 — Business Administration).
 *
 * Organized around Engine A capabilities, not vertical module names.
 * The admin sidebar exposes the business capabilities a merchant
 * configures and operates, independent of how many modules they run.
 *
 * Two-tier model:
 *  - MODULES (dynamic): per-module configuration surfaces ([slug]/admin/*).
 *    Each module's children are derived from its engine_type.
 *  - BUSINESS (capability): cross-cutting engine capabilities that span
 *    modules — Products, Pricing, Fulfillment, Resources, Customers,
 *    Staff, Payments, Fiscal, Loyalty, Analytics.
 *
 * All href values are relative to the active property slug so URLs follow
 * the [tenant].localhost/[property]/admin/... pattern. Pass the property
 * slug (from useParams().property) to getStaticNavigation.
 */

import {
  LayoutDashboard,
  UtensilsCrossed,
  Home,
  Waves,
  Users,
  Settings,
  BarChart3,
  Cloud,
  Award,
  Gift,
  Ticket,
  Package,
  Wrench,
  UserCog,
  Cog,
  ShoppingBag,
  CreditCard,
  Receipt,
  ClipboardList,
  Share2,
  MessageSquare,
  TrendingUp,
  Building2,
  Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  translationKey?: string;
  children?: NavChild[];
  roles?: string[]; // Role-based filtering (backward-compat)
  /** F2: permission-based filtering. When set, the item is visible only
   *  if the user holds at least one of these permissions. This is the
   *  preferred mechanism over roles — it matches the backend's granular
   *  permission model (resource:action:scope). */
  permissions?: string[];
  badge?: string; // Optional badge (e.g., "New", "Beta")
}

export interface NavChild {
  name: string;
  href: string;
  translationKey?: string;
  roles?: string[];
  /** F2: permission-based filtering (same semantics as NavItem). */
  permissions?: string[];
}

export interface NavCategory {
  id: string;
  name: string;
  translationKey?: string;
  icon?: LucideIcon;
  items: NavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// System page slugs — these are editable pages managed via the Visual Builder
// but should NOT appear in the Modules nav category or module counts.
export const SYSTEM_PAGE_SLUGS = ['home-page', 'privacy-policy', 'terms-of-service'];

// Template type to icon mapping — uses canonical engine type names
export const moduleTypeIcons: Record<string, LucideIcon> = {
  instant_transaction: UtensilsCrossed,
  time_exclusive_reservation: Home,
  shared_capacity_access: Waves,
  ongoing_entitlement: Award,
  platform_entitlement: Cloud,
  default: Cloud,
};

// Build module children based on template type — uses canonical engine type names.
// propertySlug: the active property slug from the URL ([tenant].host/[property]/admin/...).
export function getModuleChildren(
  slug: string,
  templateType: string,
  t: (key: string) => string,
  propertySlug: string,
): NavChild[] {
  const safeSlug = encodeURIComponent(slug);
  const base = `/${propertySlug}/admin`;

  switch (templateType) {
    case 'instant_transaction':
      return [
        { name: t('nav.menuItems'), href: `${base}/${safeSlug}/menu`, translationKey: 'nav.menuItems' },
        { name: t('nav.categories'), href: `${base}/${safeSlug}/categories`, translationKey: 'nav.categories' },
        { name: t('nav.orders'), href: `${base}/${safeSlug}/orders`, translationKey: 'nav.orders' },
        { name: t('nav.tables'), href: `${base}/${safeSlug}/tables`, translationKey: 'nav.tables' },
        { name: t('nav.waitlist') || 'Waitlist', href: `${base}/${safeSlug}/waitlist`, translationKey: 'nav.waitlist' },
        { name: t('nav.modifiers') || 'Customizations', href: `${base}/customizations`, translationKey: 'nav.modifiers' },
      ];
    case 'time_exclusive_reservation':
      return [
        { name: t('nav.allUnits') || 'All Units', href: `${base}/${safeSlug}`, translationKey: 'nav.allUnits' },
        { name: t('nav.bookings'), href: `${base}/${safeSlug}/bookings`, translationKey: 'nav.bookings' },
        { name: t('nav.pricingRules'), href: `${base}/${safeSlug}/pricing`, translationKey: 'nav.pricingRules' },
        { name: t('nav.addons'), href: `${base}/${safeSlug}/addons`, translationKey: 'nav.addons' },
      ];
    case 'shared_capacity_access':
      return [
        { name: t('nav.sessions'), href: `${base}/${safeSlug}/sessions`, translationKey: 'nav.sessions' },
        { name: t('nav.tickets'), href: `${base}/${safeSlug}/tickets`, translationKey: 'nav.tickets' },
        { name: t('nav.capacity'), href: `${base}/${safeSlug}/capacity`, translationKey: 'nav.capacity' },
      ];
    case 'ongoing_entitlement':
      return [
        { name: t('nav.memberships') || 'Memberships', href: `${base}/${safeSlug}/memberships`, translationKey: 'nav.memberships' },
        { name: t('nav.members') || 'Members', href: `${base}/${safeSlug}/members`, translationKey: 'nav.members' },
      ];
    case 'platform_entitlement':
      return [
        { name: 'Plans', href: `${base}/${safeSlug}/plans` },
        { name: 'Tenants', href: `${base}/${safeSlug}/tenants` },
      ];
    default:
      return [];
  }
}

// Static navigation categories (non-module items).
// F11: organized around Engine A capabilities — what the business does —
// rather than legacy platform sections. The per-module surfaces remain
// under the dynamic MODULES category ([slug]/admin/*).
// propertySlug: the active property slug from the URL ([tenant].host/[property]/admin/...).
export function getStaticNavigation(t: (key: string) => string, propertySlug: string): NavCategory[] {
  const base = `/${propertySlug}/admin`;

  return [
    // DASHBOARD - Always first, standalone
    {
      id: 'dashboard',
      name: t('nav.dashboard'),
      translationKey: 'nav.dashboard',
      items: [
        {
          name: t('nav.dashboard'),
          href: base,
          icon: LayoutDashboard,
          translationKey: 'nav.dashboard',
        },
      ],
      collapsible: false,
      defaultExpanded: true,
    },

    // MODULES - Populated dynamically from database
    // Per-module configuration surfaces; children derive from engine_type.
    {
      id: 'modules',
      name: t('nav.modules') || 'Modules',
      translationKey: 'nav.modules',
      icon: Cloud,
      items: [], // Populated dynamically
      collapsible: true,
      defaultExpanded: true,
    },

    // BUSINESS — Engine A capability surface (F11). Cross-cutting
    // capabilities a merchant configures and operates, independent of
    // how many modules they run.
    {
      id: 'business',
      name: t('nav.business') || 'Business',
      translationKey: 'nav.business',
      icon: ShoppingBag,
      items: [
        // ── Overview: capability dashboard (F11 home) ───────────────
        {
          name: t('nav.overview') || 'Overview',
          href: `${base}/business`,
          icon: LayoutDashboard,
          translationKey: 'nav.overview',
        },

        // ── Orders: cross-module transaction operations surface ─────
        {
          name: t('nav.orders') || 'Orders',
          href: `${base}/orders`,
          icon: ClipboardList,
          translationKey: 'nav.orders',
          permissions: ['order:read:all'],
        },

        // ── Products: cross-module catalog (Phase 8 lifecycle) ────────
        {
          name: t('nav.products') || 'Products',
          href: `${base}/products`,
          icon: ShoppingBag,
          translationKey: 'nav.products',
          permissions: ['admin:modules:manage', 'inventory:read', 'catalog:read'],
          children: [
            { name: t('nav.customizations') || 'Customizations', href: `${base}/customizations`, translationKey: 'nav.customizations' },
          ],
        },

        // ── Pricing: seasonal/dynamic rules, coupons, tax config ──────
        {
          name: t('nav.pricing') || 'Pricing',
          href: `${base}/pricing`,
          icon: Ticket,
          translationKey: 'nav.pricing',
          permissions: ['coupon:manage', 'admin:settings:manage'],
          children: [
            { name: t('nav.pricingRules') || 'Seasonal & Dynamic Rules', href: `${base}/pricing`, translationKey: 'nav.pricingRules' },
            { name: t('nav.coupons') || 'Coupons', href: `${base}/coupons`, translationKey: 'nav.coupons' },
            { name: t('nav.taxConfiguration') || 'Tax Configuration', href: `${base}/settings/tax`, translationKey: 'nav.taxConfiguration' },
          ],
        },

        // ── Fulfillment: cross-engine work queue + operational surfaces ─
        {
          name: t('nav.fulfillment') || 'Fulfillment',
          href: `${base}/fulfillment`,
          icon: Wrench,
          translationKey: 'nav.fulfillment',
          permissions: ['order:read:all', 'housekeeping:task:manage'],
          children: [
            { name: t('nav.workQueue') || 'Work Queue', href: `${base}/fulfillment`, translationKey: 'nav.workQueue' },
            { name: t('nav.housekeeping') || 'Housekeeping', href: `${base}/housekeeping`, translationKey: 'nav.housekeeping' },
          ],
        },

        // ── Resources: inventory & resource economics ─────────────────
        {
          name: t('nav.resources') || 'Resources',
          href: `${base}/inventory`,
          icon: Package,
          translationKey: 'nav.resources',
          permissions: ['inventory:manage', 'inventory:read'],
          children: [
            { name: t('nav.inventory') || 'Inventory', href: `${base}/inventory`, translationKey: 'nav.inventory' },
            { name: t('nav.economics') || 'Product Economics', href: `${base}/economics`, translationKey: 'nav.economics' },
          ],
        },

        // ── Customers: accounts, loyalty, stored value, reputation ────
        {
          name: t('nav.customers') || 'Customers',
          href: `${base}/customers`,
          icon: Users,
          translationKey: 'nav.customers',
          permissions: ['user:read:any'],
          children: [
            { name: t('nav.allCustomers'), href: `${base}/customers`, translationKey: 'nav.allCustomers' },
            { name: t('nav.customers'), href: `${base}/users/customers`, translationKey: 'nav.customers' },
            { name: t('nav.loyalty') || 'Loyalty Program', href: `${base}/loyalty`, translationKey: 'nav.loyalty' },
            { name: t('nav.giftCards') || 'Gift Cards', href: `${base}/giftcards`, translationKey: 'nav.giftCards' },
            { name: t('nav.reviews') || 'Reviews', href: `${base}/reviews`, translationKey: 'nav.reviews' },
          ],
        },

        // ── Staff: staff accounts, admins, live sessions ──────────────
        {
          name: t('nav.staff') || 'Staff',
          href: `${base}/users/staff`,
          icon: UserCog,
          translationKey: 'nav.staff',
          permissions: ['user:read:any'],
          children: [
            { name: t('nav.staff'), href: `${base}/users/staff`, translationKey: 'nav.staff' },
            { name: t('nav.admins'), href: `${base}/users/admins`, translationKey: 'nav.admins' },
            { name: t('nav.liveUsers') || 'Live Users', href: `${base}/users/live`, translationKey: 'nav.liveUsers' },
          ],
        },

        // ── Payments: gateway config & stored value ───────────────────
        {
          name: t('nav.paymentsNav') || 'Payments',
          href: `${base}/settings/payments`,
          icon: CreditCard,
          translationKey: 'nav.paymentsNav',
          permissions: ['admin:settings:manage', 'giftcard:manage'],
          children: [
            { name: t('nav.payments'), href: `${base}/settings/payments`, translationKey: 'nav.payments' },
            { name: t('nav.giftCards') || 'Gift Cards', href: `${base}/giftcards`, translationKey: 'nav.giftCards' },
          ],
        },

        // ── Fiscal: tax, financial reports, audit evidence ────────────
        {
          name: t('nav.fiscal') || 'Fiscal',
          href: `${base}/financial-reports`,
          icon: Receipt,
          translationKey: 'nav.fiscal',
          permissions: ['admin:reports:read', 'admin:audit:read'],
          children: [
            { name: t('nav.financialReports') || 'Financial Reports', href: `${base}/financial-reports`, translationKey: 'nav.financialReports' },
            { name: t('nav.taxConfiguration') || 'Tax Configuration', href: `${base}/settings/tax`, translationKey: 'nav.taxConfiguration' },
            { name: t('nav.auditLogs'), href: `${base}/audit`, translationKey: 'nav.auditLogs', permissions: ['admin:audit:read'] },
          ],
        },

        // ── Analytics: economics, cockpit, alerts ─────────────────────
        {
          name: t('nav.analytics') || 'Analytics',
          href: `${base}/cockpit`,
          icon: BarChart3,
          translationKey: 'nav.analytics',
          permissions: ['admin:reports:read'],
          children: [
            { name: t('nav.economics') || 'Economics', href: `${base}/reports?tab=economics`, translationKey: 'nav.economics' },
            { name: t('nav.executiveCockpit') || 'Executive Cockpit', href: `${base}/cockpit`, translationKey: 'nav.executiveCockpit' },
            { name: t('nav.alertManagement') || 'Alert Management', href: `${base}/alerts`, translationKey: 'nav.alertManagement' },
          ],
        },
      ],
      collapsible: true,
      defaultExpanded: false,
    },

    // SYSTEM — platform configuration, integrations, site presentation.
    // (F11: capability pages moved to BUSINESS; this keeps only
    // platform-level configuration that isn't a business capability.)
    {
      id: 'system',
      name: t('nav.system') || 'System',
      translationKey: 'nav.system',
      icon: Cog,
      items: [
        {
          name: t('nav.modules'),
          href: `${base}/modules`,
          icon: Cloud,
          translationKey: 'nav.modules',
          permissions: ['admin:modules:manage'],
        },
        {
          name: t('nav.settings'),
          href: `${base}/settings`,
          icon: Settings,
          translationKey: 'nav.settings',
          permissions: ['admin:settings:manage'],
          children: [
            { name: t('nav.general'), href: `${base}/settings`, translationKey: 'nav.general' },
            { name: t('nav.propertySettings') || 'Property Settings', href: `${base}/settings/properties`, translationKey: 'nav.propertySettings' },
            { name: t('nav.multiProperty') || 'Multi-Property', href: `${base}/properties`, translationKey: 'nav.multiProperty', roles: ['super_admin'] },
            { name: t('nav.navbar'), href: `${base}/settings/navbar`, translationKey: 'nav.navbar' },
            { name: t('nav.appearance'), href: `${base}/settings/appearance`, translationKey: 'nav.appearance' },
            { name: t('nav.brand') || 'Brand & Identity', href: `${base}/settings/brand`, translationKey: 'nav.brand' },
            { name: t('nav.terminology') || 'Terminology', href: `${base}/terminology`, translationKey: 'nav.terminology' },
            { name: t('nav.homepage'), href: `${base}/settings/homepage`, translationKey: 'nav.homepage' },
            { name: t('nav.footer'), href: `${base}/settings/footer`, translationKey: 'nav.footer' },
            { name: t('nav.translations'), href: `${base}/settings/translations`, translationKey: 'nav.translations' },
            { name: t('nav.notifications'), href: `${base}/settings/notifications`, translationKey: 'nav.notifications' },
            { name: t('nav.databaseBackups'), href: `${base}/settings/backups`, translationKey: 'nav.databaseBackups' },
            { name: t('nav.integrations') || 'Integrations', href: `${base}/integrations`, translationKey: 'nav.integrations' },
            { name: t('nav.channelManager') || 'Channel Manager', href: `${base}/channels`, translationKey: 'nav.channelManager' },
            { name: t('nav.guestMessaging') || 'Guest Messaging', href: `${base}/messaging`, translationKey: 'nav.guestMessaging' },
            { name: t('nav.rateParity') || 'Rate Parity', href: `${base}/parity`, translationKey: 'nav.rateParity' },
          ],
        },
        {
          name: t('nav.setup') || 'Setup',
          href: `${base}/setup`,
          icon: Terminal,
          translationKey: 'nav.setup',
          permissions: ['admin:settings:manage'],
        },
      ],
      collapsible: true,
      defaultExpanded: false,
    },
  ];
}

// Flatten all navigation items for search
export function flattenNavigation(categories: NavCategory[]): Array<{ name: string; href: string; category: string }> {
  const items: Array<{ name: string; href: string; category: string }> = [];

  for (const category of categories) {
    for (const item of category.items) {
      items.push({ name: item.name, href: item.href, category: category.name });
      if (item.children) {
        for (const child of item.children) {
          items.push({ name: child.name, href: child.href, category: category.name });
        }
      }
    }
  }

  return items;
}

// F2: Check if a user's permission set satisfies a nav item's access control.
// An item is visible if:
//   1. Neither roles nor permissions are set (unconditionally visible)
//   2. roles is set and user has at least one matching role (backward-compat)
//   3. permissions is set and user has at least one matching permission
// When BOTH roles and permissions are set, EITHER match suffices (OR logic).
function navItemVisible(
  item: { roles?: string[]; permissions?: string[] },
  userRoles: string[],
  userPermissions: ReadonlySet<string>,
): boolean {
  const hasRoles = item.roles && item.roles.length > 0;
  const hasPerms = item.permissions && item.permissions.length > 0;

  // Neither set → unconditionally visible
  if (!hasRoles && !hasPerms) return true;

  // Roles check (backward-compat)
  if (hasRoles && item.roles!.some((role) => userRoles.includes(role))) return true;

  // Permission check (F2)
  if (hasPerms && item.permissions!.some((perm) => userPermissions.has(perm) || userPermissions.has('*'))) return true;

  return false;
}

// Filter navigation by user roles + permissions.
// userPermissions: the resolved permission set from useAuthorization().
// When provided, permission-based filtering is applied alongside role-based.
export function filterNavigationByRole(
  categories: NavCategory[],
  userRoles: string[],
  userPermissions?: ReadonlySet<string>,
): NavCategory[] {
  const perms = userPermissions ?? new Set<string>();
  return categories
    .map((category) => ({
      ...category,
      items: category.items
        .filter((item) => navItemVisible(item, userRoles, perms))
        .map((item) => ({
          ...item,
          children: item.children?.filter(
            (child) => navItemVisible(child, userRoles, perms),
          ),
        })),
    }))
    .filter((category) => category.items.length > 0);
}

// Local storage keys for persisting expanded state
export const SIDEBAR_EXPANDED_KEY = 'admin-sidebar-expanded';
export const SIDEBAR_CATEGORIES_KEY = 'admin-sidebar-categories';

// Get initial expanded categories from localStorage
export function getInitialExpandedCategories(): string[] {
  if (typeof window === 'undefined') return ['modules'];
  try {
    const saved = localStorage.getItem(SIDEBAR_CATEGORIES_KEY);
    return saved ? JSON.parse(saved) : ['modules'];
  } catch {
    return ['modules'];
  }
}

// Save expanded categories to localStorage
export function saveExpandedCategories(categories: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIDEBAR_CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // Ignore storage errors
  }
}
