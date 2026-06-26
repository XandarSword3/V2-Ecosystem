/**
 * Admin Panel Navigation Configuration
 *
 * Organized into logical category groups for improved UX.
 * Categories are collapsible with items organized by function.
 *
 * All href values are constructed relative to the active property slug so that
 * URLs follow the [tenant].localhost/[property]/admin/... pattern introduced in
 * Item 13. Pass the current property slug (from useParams().property) to both
 * getStaticNavigation and getModuleChildren.
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
  CalendarCheck,
  Share2,
  Building2,
  Sliders,
  Megaphone,
  Wrench,
  UserCog,
  Cog,
  Search,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  translationKey?: string;
  children?: NavChild[];
  roles?: string[]; // Role-based filtering
  badge?: string; // Optional badge (e.g., "New", "Beta")
}

export interface NavChild {
  name: string;
  href: string;
  translationKey?: string;
  roles?: string[];
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
        { name: t('nav.reservations') || 'Reservations', href: `${base}/${safeSlug}/reservations`, translationKey: 'nav.reservations' },
        { name: t('nav.waitlist') || 'Waitlist', href: `${base}/${safeSlug}/waitlist`, translationKey: 'nav.waitlist' },
        { name: t('nav.modifiers') || 'Modifiers', href: `${base}/${safeSlug}/modifiers`, translationKey: 'nav.modifiers' },
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
    // This placeholder will be replaced with actual modules
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
        },
        {
          name: t('nav.giftCards') || 'Gift Cards',
          href: `${base}/giftcards`,
          icon: Gift,
          translationKey: 'nav.giftCards',
        },
        {
          name: t('nav.coupons') || 'Coupons',
          href: `${base}/coupons`,
          icon: Ticket,
          translationKey: 'nav.coupons',
        },
        {
          name: t('nav.reviews') || 'Reviews',
          href: `${base}/reviews`,
          icon: Star,
          translationKey: 'nav.reviews',
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
          name: t('nav.housekeeping') || 'Housekeeping',
          href: `${base}/housekeeping`,
          icon: Brush,
          translationKey: 'nav.housekeeping',
        },
        {
          name: t('nav.inventory') || 'Inventory',
          href: `${base}/inventory`,
          icon: Package,
          translationKey: 'nav.inventory',
        },
        {
          name: 'Channel Manager',
          href: `${base}/channels`,
          icon: Share2,
          translationKey: 'nav.channelManager',
        },
        {
          name: 'Guest Messaging',
          href: `${base}/messaging`,
          icon: MessageSquare,
          translationKey: 'nav.guestMessaging',
        },
        {
          name: 'Rate Parity',
          href: `${base}/parity`,
          icon: TrendingUp,
          translationKey: 'nav.rateParity',
        },
        {
          name: 'Multi-Property',
          href: `${base}/properties`,
          icon: Building2,
          translationKey: 'nav.multiProperty',
          roles: ['super_admin'], // Only super admins see this
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
          children: [
            { name: t('nav.customers'), href: `${base}/users/customers`, translationKey: 'nav.customers' },
            { name: t('nav.staff'), href: `${base}/users/staff`, translationKey: 'nav.staff' },
            { name: t('nav.admins'), href: `${base}/users/admins`, translationKey: 'nav.admins' },
            { name: t('nav.rolesPermissions'), href: `${base}/users/roles`, translationKey: 'nav.rolesPermissions' },
            { name: t('nav.liveUsers') || 'Live Users', href: `${base}/users/live`, translationKey: 'nav.liveUsers' },
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
          children: [
            { name: 'Economics', href: `${base}/reports?tab=economics`, translationKey: 'nav.economics' },
            { name: 'Executive Cockpit', href: `${base}/cockpit`, translationKey: 'nav.executiveCockpit' },
            { name: 'Financial Reports', href: `${base}/financial-reports`, translationKey: 'nav.financialReports' },
            { name: 'Alert Management', href: `${base}/alerts`, translationKey: 'nav.alertManagement' },
          ],
        },
        {
          name: t('nav.modules'),
          href: `${base}/modules`,
          icon: Cloud,
          translationKey: 'nav.modules',
        },
        {
          name: t('nav.settings'),
          href: `${base}/settings`,
          icon: Settings,
          translationKey: 'nav.settings',
          children: [
            { name: t('nav.general'), href: `${base}/settings`, translationKey: 'nav.general' },
            { name: t('nav.propertySettings') || 'Property Settings', href: `${base}/settings/properties`, translationKey: 'nav.propertySettings' },
            { name: t('nav.navbar'), href: `${base}/settings/navbar`, translationKey: 'nav.navbar' },
            { name: t('nav.appearance'), href: `${base}/settings/appearance`, translationKey: 'nav.appearance' },
            { name: 'Brand & Identity', href: `${base}/settings/brand`, translationKey: 'nav.brand' },
            { name: 'Customizations', href: `${base}/customizations`, translationKey: 'nav.customizations' },
            { name: 'Terminology', href: `${base}/terminology`, translationKey: 'nav.terminology' },
            { name: t('nav.homepage'), href: `${base}/settings/homepage`, translationKey: 'nav.homepage' },
            { name: t('nav.footer'), href: `${base}/settings/footer`, translationKey: 'nav.footer' },
            { name: t('nav.translations'), href: `${base}/settings/translations`, translationKey: 'nav.translations' },
            { name: t('nav.payments'), href: `${base}/settings/payments`, translationKey: 'nav.payments' },
            { name: 'Tax Configuration', href: `${base}/settings/tax`, translationKey: 'nav.taxConfiguration' },
            { name: t('nav.notifications'), href: `${base}/settings/notifications`, translationKey: 'nav.notifications' },
            { name: t('nav.databaseBackups'), href: `${base}/settings/backups`, translationKey: 'nav.databaseBackups' },
            { name: 'Integrations', href: `${base}/integrations`, translationKey: 'nav.integrations' },
          ],
        },
        {
          name: t('nav.auditLogs'),
          href: `${base}/audit`,
          icon: Shield,
          translationKey: 'nav.auditLogs',
          roles: ['super_admin', 'admin'],
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

// Filter navigation by user roles
export function filterNavigationByRole(categories: NavCategory[], userRoles: string[]): NavCategory[] {
  return categories
    .map((category) => ({
      ...category,
      items: category.items
        .filter((item) => !item.roles || item.roles.some((role) => userRoles.includes(role)))
        .map((item) => ({
          ...item,
          children: item.children?.filter(
            (child) => !child.roles || child.roles.some((role) => userRoles.includes(role)),
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
