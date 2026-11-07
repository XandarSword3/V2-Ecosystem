/**
 * Module Utility Functions
 * 
 * Provides helper functions for working with dynamic modules throughout the application.
 * This enables the system to work with any configured modules, not just hardcoded ones.
 */

import { 
  UtensilsCrossed, 
  Home, 
  Waves, 
  Cookie, 
  Dumbbell, 
  Sparkles, 
  Coffee, 
  Bed, 
  Calendar, 
  Users,
  Music,
  Film,
  Gamepad2,
  PartyPopper,
  ShoppingBag,
  Ticket,
  Trophy,
  Heart,
  Star,
  Gift,
  type LucideIcon
} from 'lucide-react';

export interface Module {
  id: string;
  engine_type: 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access' | 'ongoing_entitlement';
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  show_in_main?: boolean;
  settings?: {
    header_color?: string;
    accent_color?: string;
    show_in_nav?: boolean;
    icon?: string;
    [key: string]: string | number | boolean | undefined;
  };
  sort_order: number;
  metadata?: {
    item_count?: number;
    total_items?: number;
    [key: string]: unknown;
  };
  stats?: {
    count?: number;
    [key: string]: unknown;
  };
  item_count?: number;
}

/**
 * Icon mapping for modules based on slug or template type
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // Common module types
  'gym': Dumbbell,
  'gym-floor': Dumbbell,
  'fitness': Dumbbell,
  'fitness-classes': Dumbbell,
  'spa': Sparkles,
  'cafe': Coffee,
  'coffee': Coffee,
  'hotel-rooms': Bed,
  'rooms': Bed,
  'room-service': UtensilsCrossed,
  'concierge': Users,
  'membership': Trophy,
  'personal-training': Dumbbell,
  
  // Entertainment
  'bar': Coffee,
  'lounge': Music,
  'cinema': Film,
  'gaming': Gamepad2,
  'events': PartyPopper,
  'shop': ShoppingBag,
  'tickets': Ticket,
  
  // Capacity/pool/session slugs
  'capacity': Waves,
  'kiosk': Cookie,

  // Default by template type
  'instant_transaction': UtensilsCrossed,
  'time_exclusive_reservation': Home,
  'shared_capacity_access': Ticket,
  'ongoing_entitlement': Trophy,
};

/**
 * Get the appropriate icon component for a module
 */
export function getModuleIcon(module: Module): LucideIcon {
  // First check if module has a custom icon setting
  if (module.settings?.icon && ICON_MAP[module.settings.icon]) {
    return ICON_MAP[module.settings.icon];
  }
  
  // Then check by slug
  const slugLower = module.slug.toLowerCase();
  if (ICON_MAP[slugLower]) {
    return ICON_MAP[slugLower];
  }
  
  // Finally fallback to template type
  return ICON_MAP[module.engine_type] || Home;
}

/**
 * Get a default icon by name string
 */
export function getIconByName(name: string): LucideIcon {
  const normalizedName = name.toLowerCase().replace(/[_\s]/g, '-');
  return ICON_MAP[normalizedName] || Home;
}

/**
 * Get only modules that should be shown on the main page
 */
export function getMainPageModules(modules: Module[]): Module[] {
  return modules
    .filter(m => m.is_active && (m.show_in_main !== false))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

/**
 * Get modules that should appear in navigation
 */
export function getNavModules(modules: Module[]): Module[] {
  return modules
    .filter(m => m.is_active && (m.settings?.show_in_nav !== false))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

/**
 * Generate a description for a module based on its type
 * This is used when the module doesn't have a custom description
 */
export function getModuleDefaultDescription(module: Module): string {
  switch (module.engine_type) {
    case 'instant_transaction':
      return `Browse our ${module.name.toLowerCase()} menu and place orders`;
    case 'time_exclusive_reservation':
      return `Book your stay at our ${module.name.toLowerCase()}`;
    case 'shared_capacity_access':
      return `Purchase tickets and passes for ${module.name.toLowerCase()}`;
    default:
      return `Explore our ${module.name.toLowerCase()} services`;
  }
}

/**
 * Generate a stat label for a module
 */
export function getModuleStatLabel(module: Module): string {
  switch (module.engine_type) {
    case 'instant_transaction':
      return 'Menu Items';
    case 'time_exclusive_reservation':
      return 'Units Available';
    case 'shared_capacity_access':
      return 'Daily Visitors';
    default:
      return 'Available';
  }
}

/**
 * Get a real stat value for a module.
 * Reads real counts from module metadata/stats if available, otherwise returns 0 (clean empty state)
 * rather than fabricating dummy placeholder numbers.
 */
export function getModuleStatPlaceholder(module: Module): number {
  if (typeof module.item_count === 'number') {
    return module.item_count;
  }
  if (typeof module.metadata?.item_count === 'number') {
    return module.metadata.item_count;
  }
  if (typeof module.metadata?.total_items === 'number') {
    return module.metadata.total_items;
  }
  if (typeof module.stats?.count === 'number') {
    return module.stats.count;
  }
  return 0;
}
