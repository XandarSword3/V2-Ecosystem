/**
 * Admin Panel Navigation Configuration
 * 
 * Organized into logical category groups for improved UX.
 * Categories are collapsible with items organized by function.
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
  Monitor,
  CalendarCheck,
  Share2,
  Building2,
  Sliders,
  Megaphone,
  Wrench,
  UserCog,
  Cog,
  Search,
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

// Template type to icon mapping
export const moduleTypeIcons: Record<string, LucideIcon> = {
  menu_service: UtensilsCrossed,
  multi_day_booking: Home,
  session_access: Waves,
  default: Cloud,
};

// Build module children based on template type
export function getModuleChildren(slug: string, templateType: string, t: (key: string) => string): NavChild[] {
  const safeSlug = encodeURIComponent(slug);
  
  switch (templateType) {
    case 'menu_service':
      return [
        { name: t('nav.menuItems'), href: `/admin/${safeSlug}/menu`, translationKey: 'nav.menuItems' },
        { name: t('nav.categories'), href: `/admin/${safeSlug}/categories`, translationKey: 'nav.categories' },
        { name: t('nav.orders'), href: `/admin/${safeSlug}/orders`, translationKey: 'nav.orders' },
        { name: t('nav.tables'), href: `/admin/${safeSlug}/tables`, translationKey: 'nav.tables' },
        { name: t('nav.reservations') || 'Reservations', href: `/admin/${safeSlug}/reservations`, translationKey: 'nav.reservations' },
        { name: t('nav.waitlist') || 'Waitlist', href: `/admin/${safeSlug}/waitlist`, translationKey: 'nav.waitlist' },
        { name: t('nav.modifiers') || 'Modifiers', href: `/admin/${safeSlug}/modifiers`, translationKey: 'nav.modifiers' },
      ];
    case 'multi_day_booking':
      return [
        { name: t('nav.allUnits') || 'All Units', href: `/admin/${safeSlug}`, translationKey: 'nav.allUnits' },
        { name: t('nav.bookings'), href: `/admin/${safeSlug}/bookings`, translationKey: 'nav.bookings' },
        { name: t('nav.pricingRules'), href: `/admin/${safeSlug}/pricing`, translationKey: 'nav.pricingRules' },
        { name: t('nav.addons'), href: `/admin/${safeSlug}/addons`, translationKey: 'nav.addons' },
      ];
    case 'session_access':
      return [
        { name: t('nav.sessions'), href: `/admin/${safeSlug}/sessions`, translationKey: 'nav.sessions' },
        { name: t('nav.tickets'), href: `/admin/${safeSlug}/tickets`, translationKey: 'nav.tickets' },
        { name: t('nav.capacity'), href: `/admin/${safeSlug}/capacity`, translationKey: 'nav.capacity' },
      ];
    default:
      return [];
  }
}

// Static navigation categories (non-module items)
export function getStaticNavigation(t: (key: string) => string): NavCategory[] {
  return [
    // DASHBOARD - Always first, standalone
    {
      id: 'dashboard',
      name: t('nav.dashboard'),
      translationKey: 'nav.dashboard',
      items: [
        { 
          name: t('nav.dashboard'), 
          href: '/admin', 
          icon: LayoutDashboard,
          translationKey: 'nav.dashboard'
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
          href: '/admin/loyalty', 
          icon: Award,
          translationKey: 'nav.loyalty'
        },
        { 
          name: t('nav.giftCards') || 'Gift Cards', 
          href: '/admin/giftcards', 
          icon: Gift,
          translationKey: 'nav.giftCards'
        },
        { 
          name: t('nav.coupons') || 'Coupons', 
          href: '/admin/coupons', 
          icon: Ticket,
          translationKey: 'nav.coupons'
        },
        { 
          name: t('nav.reviews') || 'Reviews', 
          href: '/admin/reviews', 
          icon: Star,
          translationKey: 'nav.reviews'
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
          href: '/admin/housekeeping', 
          icon: Brush,
          translationKey: 'nav.housekeeping'
        },
        { 
          name: t('nav.inventory') || 'Inventory', 
          href: '/admin/inventory', 
          icon: Package,
          translationKey: 'nav.inventory'
        },
        { 
          name: 'Channel Manager', 
          href: '/admin/channels', 
          icon: Share2,
          translationKey: 'nav.channelManager'
        },
        { 
          name: 'Multi-Property', 
          href: '/admin/properties', 
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
          href: '/admin/users',
          icon: Users,
          translationKey: 'nav.users',
          children: [
            { name: t('nav.customers'), href: '/admin/users/customers', translationKey: 'nav.customers' },
            { name: t('nav.staff'), href: '/admin/users/staff', translationKey: 'nav.staff' },
            { name: t('nav.admins'), href: '/admin/users/admins', translationKey: 'nav.admins' },
            { name: t('nav.rolesPermissions'), href: '/admin/users/roles', translationKey: 'nav.rolesPermissions' },
            { name: t('nav.liveUsers') || 'Live Users', href: '/admin/users/live', translationKey: 'nav.liveUsers' },
          ]
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
          name: 'Kiosk Devices', 
          href: '/admin/kiosk', 
          icon: Monitor,
          translationKey: 'nav.kioskDevices'
        },
        { 
          name: t('nav.reports'), 
          href: '/admin/reports', 
          icon: BarChart3,
          translationKey: 'nav.reports'
        },
        { 
          name: t('nav.modules'), 
          href: '/admin/modules', 
          icon: Cloud,
          translationKey: 'nav.modules'
        },
        {
          name: t('nav.settings'),
          href: '/admin/settings',
          icon: Settings,
          translationKey: 'nav.settings',
          children: [
            { name: t('nav.general'), href: '/admin/settings', translationKey: 'nav.general' },
            { name: t('nav.navbar'), href: '/admin/settings/navbar', translationKey: 'nav.navbar' },
            { name: t('nav.appearance'), href: '/admin/settings/appearance', translationKey: 'nav.appearance' },
            { name: 'Customizations', href: '/admin/customizations', translationKey: 'nav.customizations' },
            { name: 'Terminology', href: '/admin/terminology', translationKey: 'nav.terminology' },
            { name: t('nav.homepage'), href: '/admin/settings/homepage', translationKey: 'nav.homepage' },
            { name: t('nav.footer'), href: '/admin/settings/footer', translationKey: 'nav.footer' },
            { name: t('nav.translations'), href: '/admin/settings/translations', translationKey: 'nav.translations' },
            { name: t('nav.payments'), href: '/admin/settings/payments', translationKey: 'nav.payments' },
            { name: 'Tax Configuration', href: '/admin/settings/tax', translationKey: 'nav.taxConfiguration' },
            { name: t('nav.notifications'), href: '/admin/settings/notifications', translationKey: 'nav.notifications' },
            { name: t('nav.databaseBackups'), href: '/admin/settings/backups', translationKey: 'nav.databaseBackups' },
            { name: 'Integrations', href: '/admin/integrations', translationKey: 'nav.integrations' },
          ]
        },
        { 
          name: t('nav.auditLogs'), 
          href: '/admin/audit', 
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
  return categories.map(category => ({
    ...category,
    items: category.items
      .filter(item => !item.roles || item.roles.some(role => userRoles.includes(role)))
      .map(item => ({
        ...item,
        children: item.children?.filter(child => !child.roles || child.roles.some(role => userRoles.includes(role)))
      }))
  })).filter(category => category.items.length > 0);
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
