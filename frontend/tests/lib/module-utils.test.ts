import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) => {
    const Icon = () => null;
    Icon.displayName = name;
    return Icon;
  };

  return {
    UtensilsCrossed: makeIcon('UtensilsCrossed'),
    Home: makeIcon('Home'),
    Waves: makeIcon('Waves'),
    Cookie: makeIcon('Cookie'),
    Dumbbell: makeIcon('Dumbbell'),
    Sparkles: makeIcon('Sparkles'),
    Coffee: makeIcon('Coffee'),
    Bed: makeIcon('Bed'),
    Calendar: makeIcon('Calendar'),
    Users: makeIcon('Users'),
    Music: makeIcon('Music'),
    Film: makeIcon('Film'),
    Gamepad2: makeIcon('Gamepad2'),
    PartyPopper: makeIcon('PartyPopper'),
    ShoppingBag: makeIcon('ShoppingBag'),
    Ticket: makeIcon('Ticket'),
    Trophy: makeIcon('Trophy'),
    Heart: makeIcon('Heart'),
    Star: makeIcon('Star'),
    Gift: makeIcon('Gift'),
  };
});

import {
  getIconByName,
  getMainPageModules,
  getModuleDefaultDescription,
  getModuleIcon,
  getModuleStatLabel,
  getModuleStatPlaceholder,
  getNavModules,
  type Module,
} from '@/lib/module-utils';

function createModule(overrides: Partial<Module> = {}): Module {
  return {
    id: 'mod-1',
    template_type: 'instant_transaction',
    name: 'MenuService',
    slug: 'instant_transaction',
    is_active: true,
    sort_order: 1,
    ...overrides,
  };
}

describe('module-utils', () => {
  it('prefers custom icon from settings before slug fallback', () => {
    const withCustomIcon = createModule({ settings: { icon: 'coffee' } });
    const withSlugIcon = createModule({ slug: 'capacity' });

    expect(getModuleIcon(withCustomIcon).displayName).toBe('Coffee');
    expect(getModuleIcon(withSlugIcon).displayName).toBe('Waves');
  });

  it('falls back to template type icon when slug is unknown', () => {
    const module = createModule({ slug: 'unknown-module', template_type: 'shared_capacity_access' });

    expect(getModuleIcon(module).displayName).toBe('Ticket');
  });

  it('normalizes icon names for getIconByName', () => {
    expect(getIconByName('kiosk').displayName).toBe('Cookie');
    expect(getIconByName('hotel_rooms').displayName).toBe('Bed');
    expect(getIconByName('does-not-exist').displayName).toBe('Home');
  });

  it('returns only active main-page modules sorted by sort_order', () => {
    const modules: Module[] = [
      createModule({ id: 'a', sort_order: 3 }),
      createModule({ id: 'b', sort_order: 2, show_in_main: false }),
      createModule({ id: 'c', sort_order: 1 }),
      createModule({ id: 'd', sort_order: 4, is_active: false }),
    ];

    expect(getMainPageModules(modules).map((m) => m.id)).toEqual(['c', 'a']);
  });

  it('returns only active nav modules sorted by sort_order', () => {
    const modules: Module[] = [
      createModule({ id: 'a', sort_order: 3 }),
      createModule({ id: 'b', sort_order: 1, settings: { show_in_nav: false } }),
      createModule({ id: 'c', sort_order: 2 }),
      createModule({ id: 'd', sort_order: 4, is_active: false }),
    ];

    expect(getNavModules(modules).map((m) => m.id)).toEqual(['c', 'a']);
  });

  it('returns template-specific descriptions and stats', () => {
    const menuModule = createModule({ name: 'KioskItem Bar', template_type: 'instant_transaction' });
    const bookingModule = createModule({ name: 'AccommodationUnits', template_type: 'time_exclusive_reservation' });
    const sessionModule = createModule({ name: 'Pool', template_type: 'shared_capacity_access' });

    expect(getModuleDefaultDescription(menuModule)).toContain('menu and place orders');
    expect(getModuleDefaultDescription(bookingModule)).toContain('Book your stay');
    expect(getModuleDefaultDescription(sessionModule)).toContain('Purchase tickets and passes');

    expect(getModuleStatLabel(menuModule)).toBe('Menu Items');
    expect(getModuleStatLabel(bookingModule)).toBe('Units Available');
    expect(getModuleStatLabel(sessionModule)).toBe('Daily Visitors');

    expect(getModuleStatPlaceholder(menuModule)).toBe(50);
    expect(getModuleStatPlaceholder(bookingModule)).toBe(10);
    expect(getModuleStatPlaceholder(sessionModule)).toBe(100);
  });
});
