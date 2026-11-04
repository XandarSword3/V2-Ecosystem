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
  Shield,
  Cloud,
  Star,
  Award,
  Gift,
  Ticket,
  Brush,
  Package,
  Wrench,
  UserCog,
  Cog,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Receipt,
  ClipboardList,
  Share2,
  Megaphone,
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
// Multi-engine platform navigation for property administration.
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

    // MARKETING & LOYALTY
    {
      id: 'marketing',
      name: t('nav.marketing') || 'Marketing & Loyalty',
      translationKey: 'nav.marketing',
      icon: Megaphone,
      items: [
        {
          name: t('nav.loyalty') || 'Loyalty Program',
          href: `${base}/loyalty`,
          icon: Award,
          translationKey: 'nav.loyalty',
          roles: ['admin', 'super_admin'],
          permissions: ['loyalty:read:any', 'loyalty:settings:manage'],
        },
        {
          name: t('nav.giftCards') || 'Gift Cards',
          href: `${base}/giftcards`,
          icon: Gift,
          translationKey: 'nav.giftCards',
          roles: ['admin', 'super_admin'],
          permissions: ['giftcard:manage'],
        },
        {
          name: t('nav.coupons') || 'Coupons',
          href: `${base}/coupons`,
          icon: Ticket,
          translationKey: 'nav.coupons',
          roles: ['admin', 'super_admin'],
          permissions: ['coupon:manage'],
        },
        {
          name: t('nav.reviews') || 'Reviews',
          href: `${base}/reviews`,
          icon: Star,
          translationKey: 'nav.reviews',
          roles: ['admin', 'super_admin'],
          permissions: ['review:moderate'],
        },
      ],
      collapsible: true,
      defaultExpanded: false,
    },

    // OPERATIONS
    {
      id: 'operations',
      name: t('nav.operations') || 'Operations',
      translationKey: 'nav.operations',
      icon: Wrench,
      items: [
        {
          name: t('nav.orders') || 'Orders',
          href: `${base}/orders`,
          icon: ShoppingCart,
          translationKey: 'nav.orders',
          roles: ['admin', 'super_admin'],
          permissions: ['order:read:all'],
        },
        {
          name: t('nav.fulfillment') || 'Fulfillment',
          href: `${base}/fulfillment`,
          icon: Wrench,
          translationKey: 'nav.fulfillment',
          roles: ['admin', 'super_admin'],
          permissions: ['order:read:all', 'housekeeping:task:manage'],
        },
        {
          name: t('nav.housekeeping') || 'Housekeeping',
          href: `${base}/housekeeping`,
          icon: Brush,
          translationKey: 'nav.housekeeping',
          roles: ['admin', 'super_admin'],
          permissions: ['housekeeping:task:manage'],
        },
        {
          name: t('nav.inventory') || 'Inventory',
          href: `${base}/inventory`,
          icon: Package,
          translationKey: 'nav.inventory',
          roles: ['admin', 'super_admin'],
          permissions: ['inventory:manage', 'inventory:read'],
        },
        {
          name: t('nav.channelManager') || 'Channel Manager',
          href: `${base}/channels`,
          icon: Share2,
          translationKey: 'nav.channelManager',
          roles: ['admin', 'super_admin'],
        },
        {
          name: t('nav.guestMessaging') || 'Guest Messaging',
          href: `${base}/messaging`,
          icon: MessageSquare,
          translationKey: 'nav.guestMessaging',
          roles: ['admin', 'super_admin'],
        },
        {
          name: t('nav.rateParity') || 'Rate Parity',
          href: `${base}/parity`,
          icon: TrendingUp,
          translationKey: 'nav.rateParity',
          roles: ['admin', 'super_admin'],
        },
        {
          name: t('nav.multiProperty') || 'Multi-Property',
          href: `${base}/properties`,
          icon: Building2,
          translationKey: 'nav.multiProperty',
          roles: ['super_admin'],
        },
      ],
      collapsible: true,
      defaultExpanded: false,
    },

    // PEOPLE
    {
      id: 'people',
      name: t('nav.people') || 'People',
      translationKey: 'nav.people',
      icon: UserCog,
      items: [
        {
          name: t('nav.users'),
          href: `${base}/users`,
          icon: Users,
          translationKey: 'nav.users',
          roles: ['admin', 'super_admin'],
          permissions: ['user:read:any'],
          children: [
            { name: t('nav.customers'), href: `${base}/users/customers`, translationKey: 'nav.customers', roles: ['admin', 'super_admin'] },
            { name: t('nav.staff'), href: `${base}/users/staff`, translationKey: 'nav.staff', roles: ['admin', 'super_admin'] },
            { name: t('nav.admins'), href: `${base}/users/admins`, translationKey: 'nav.admins', roles: ['admin', 'super_admin'] },
            { name: t('nav.liveUsers') || 'Live Users', href: `${base}/users/live`, translationKey: 'nav.liveUsers', roles: ['admin', 'super_admin'] },
          ],
        },
      ],
      collapsible: true,
      defaultExpanded: false,
    },

    // SYSTEM
    {
      id: 'system',
      name: t('nav.system') || 'System',
      translationKey: 'nav.system',
      icon: Cog,
      items: [
        {
          name: t('nav.reports') || 'Reports',
          href: `${base}/cockpit`,
          icon: BarChart3,
          translationKey: 'nav.reports',
          roles: ['admin', 'super_admin'],
          permissions: ['admin:reports:read'],
          children: [
            { name: t('nav.economics') || 'Economics', href: `${base}/reports?tab=economics`, translationKey: 'nav.economics', roles: ['admin', 'super_admin'] },
            { name: t('nav.executiveCockpit') || 'Executive Cockpit', href: `${base}/cockpit`, translationKey: 'nav.executiveCockpit', roles: ['admin', 'super_admin'] },
            { name: t('nav.financialReports') || 'Financial Reports', href: `${base}/financial-reports`, translationKey: 'nav.financialReports', roles: ['admin', 'super_admin'] },
            { name: t('nav.alertManagement') || 'Alert Management', href: `${base}/alerts`, translationKey: 'nav.alertManagement', roles: ['admin', 'super_admin'] },
          ],
        },
        {
          name: t('nav.modules'),
          href: `${base}/modules`,
          icon: Cloud,
          translationKey: 'nav.modules',
          roles: ['admin', 'super_admin'],
          permissions: ['admin:modules:manage'],
        },
        {
          name: t('nav.settings'),
          href: `${base}/settings`,
          icon: Settings,
          translationKey: 'nav.settings',
          roles: ['admin', 'super_admin'],
          permissions: ['admin:settings:manage'],
          children: [
            { name: t('nav.general'), href: `${base}/settings`, translationKey: 'nav.general', roles: ['admin', 'super_admin'] },
            { name: t('nav.propertySettings') || 'Property Settings', href: `${base}/settings/properties`, translationKey: 'nav.propertySettings', roles: ['admin', 'super_admin'] },
            { name: t('nav.navbar'), href: `${base}/settings/navbar`, translationKey: 'nav.navbar', roles: ['admin', 'super_admin'] },
            { name: t('nav.appearance'), href: `${base}/settings/appearance`, translationKey: 'nav.appearance', roles: ['admin', 'super_admin'] },
            { name: t('nav.brand') || 'Brand & Identity', href: `${base}/settings/brand`, translationKey: 'nav.brand', roles: ['admin', 'super_admin'] },
            { name: t('nav.customizations') || 'Customizations', href: `${base}/customizations`, translationKey: 'nav.customizations', roles: ['admin', 'super_admin'] },
            { name: t('nav.terminology') || 'Terminology', href: `${base}/terminology`, translationKey: 'nav.terminology', roles: ['admin', 'super_admin'] },
            { name: t('nav.homepage'), href: `${base}/settings/homepage`, translationKey: 'nav.homepage', roles: ['admin', 'super_admin'] },
            { name: t('nav.footer'), href: `${base}/settings/footer`, translationKey: 'nav.footer', roles: ['admin', 'super_admin'] },
            { name: t('nav.translations'), href: `${base}/settings/translations`, translationKey: 'nav.translations', roles: ['admin', 'super_admin'] },
            { name: t('nav.payments'), href: `${base}/settings/payments`, translationKey: 'nav.payments', roles: ['admin', 'super_admin'] },
            { name: t('nav.taxConfiguration') || 'Tax Configuration', href: `${base}/settings/tax`, translationKey: 'nav.taxConfiguration', roles: ['admin', 'super_admin'] },
            { name: t('nav.notifications'), href: `${base}/settings/notifications`, translationKey: 'nav.notifications', roles: ['admin', 'super_admin'] },
            { name: t('nav.databaseBackups'), href: `${base}/settings/backups`, translationKey: 'nav.databaseBackups', roles: ['admin', 'super_admin'] },
            { name: t('nav.integrations') || 'Integrations', href: `${base}/integrations`, translationKey: 'nav.integrations', roles: ['admin', 'super_admin'] },
          ],
        },
        {
          name: t('nav.setup') || 'Setup',
          href: `${base}/setup`,
          icon: Terminal,
          translationKey: 'nav.setup',
          roles: ['admin', 'super_admin'],
          permissions: ['admin:settings:manage'],
        },
        {
          name: t('nav.auditLogs'),
          href: `${base}/audit`,
          icon: Shield,
          translationKey: 'nav.auditLogs',
          roles: ['super_admin', 'admin'],
          permissions: ['admin:audit:read'],
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
