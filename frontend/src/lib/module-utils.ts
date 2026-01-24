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
  template_type: 'menu_service' | 'multi_day_booking' | 'session_access';
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
}

/**
 * Icon mapping for modules based on slug or template type
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // Default modules
  'restaurant': UtensilsCrossed,
  'snack-bar': Cookie,
  'snackbar': Cookie,
  'pool': Waves,
  'chalets': Home,
  
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
  
  // Default by template type
  'menu_service': UtensilsCrossed,
  'multi_day_booking': Home,
  'session_access': Ticket,
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
  return ICON_MAP[module.template_type] || Home;
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
  switch (module.template_type) {
    case 'menu_service':
      return `Browse our ${module.name.toLowerCase()} menu and place orders`;
    case 'multi_day_booking':
      return `Book your stay at our ${module.name.toLowerCase()}`;
    case 'session_access':
      return `Purchase tickets and passes for ${module.name.toLowerCase()}`;
    default:
      return `Explore our ${module.name.toLowerCase()} services`;
  }
}

/**
 * Generate a stat label for a module
 */
export function getModuleStatLabel(module: Module): string {
  switch (module.template_type) {
    case 'menu_service':
      return 'Menu Items';
    case 'multi_day_booking':
      return 'Units Available';
    case 'session_access':
      return 'Daily Visitors';
    default:
      return 'Available';
  }
}

/**
 * Get a placeholder stat value for a module
 * In production, this should be fetched from the actual module data
 */
export function getModuleStatPlaceholder(module: Module): number {
  switch (module.template_type) {
    case 'menu_service':
      return 50;
    case 'multi_day_booking':
      return 10;
    case 'session_access':
      return 100;
    default:
      return 25;
  }
}
