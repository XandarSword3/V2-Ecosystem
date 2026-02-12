/**
 * Frontend Test Setup
 * 
 * Global configuration for Vitest + React Testing Library
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: any) => {
    // Return a mock element without JSX
    return {
      type: 'img',
      props: { ...props, alt: props.alt || '' },
    };
  },
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({
    number: (n: number) => n.toString(),
    dateTime: (d: Date) => d.toISOString(),
    relativeTime: (d: Date) => 'just now',
  }),
  useNow: () => new Date(),
  useTimeZone: () => 'UTC',
}));

// Mock zustand stores
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserver;

// Mock IntersectionObserver
class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = () => [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor() {}
}
global.IntersectionObserver = IntersectionObserver as any;

// Suppress console errors during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Filter out known React warnings in tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
        args[0].includes('Warning: An update to'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global mock for lucide-react icons to handle dynamic icon imports
// This creates a handler that returns a stub component for any icon name
vi.mock('lucide-react', async () => {
  // Create a proxy that returns a stub component for any property access
  const createIconStub = (name: string) => {
    const IconComponent = (props: any) => {
      // Return a simple span element with the icon name
      const element = document.createElement('span');
      element.setAttribute('data-testid', `icon-${name.toLowerCase()}`);
      element.setAttribute('data-lucide', name);
      element.textContent = name;
      Object.keys(props || {}).forEach(key => {
        if (key !== 'children' && typeof props[key] === 'string') {
          element.setAttribute(`data-${key}`, props[key]);
        }
      });
      return element;
    };
    IconComponent.displayName = name;
    return IconComponent;
  };
  
  // Common icons that are frequently used
  const commonIcons = [
    'UtensilsCrossed', 'List', 'ShoppingCart', 'LayoutGrid', 'Calendar', 'Tags',
    'Settings', 'Ticket', 'Users', 'Plus', 'Edit', 'Trash2', 'Save', 'X', 'Check',
    'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight', 'Search', 'Filter',
    'Menu', 'Home', 'User', 'LogOut', 'LogIn', 'Eye', 'EyeOff', 'Lock', 'Unlock',
    'Mail', 'Phone', 'MapPin', 'Clock', 'AlertCircle', 'AlertTriangle', 'Info',
    'CheckCircle', 'XCircle', 'Loader2', 'RefreshCw', 'Download', 'Upload',
    'Star', 'Heart', 'Share', 'Copy', 'Link', 'ExternalLink', 'Printer', 'QrCode',
    'CreditCard', 'DollarSign', 'Percent', 'Tag', 'Package', 'Box', 'Archive',
    'Folder', 'File', 'FileText', 'Image', 'Video', 'Music', 'Camera', 'Mic',
    'Bell', 'BellOff', 'Volume2', 'VolumeX', 'Sun', 'Moon', 'Cloud', 'CloudRain',
    'Thermometer', 'Droplets', 'Wind', 'Waves', 'Mountain', 'Tree', 'Flower',
    'Coffee', 'Utensils', 'Wine', 'Beer', 'Pizza', 'Cake', 'IceCream',
    'ShoppingBag', 'Gift', 'Award', 'Trophy', 'Medal', 'Crown', 'Gem',
    'Palette', 'Brush', 'Pencil', 'Scissors', 'Ruler', 'Compass', 'Crosshair',
    'Target', 'Zap', 'Flame', 'Sparkles', 'PartyPopper', 'Confetti',
    'MessageCircle', 'MessageSquare', 'Send', 'Inbox', 'Archive', 'Trash',
    'MoreHorizontal', 'MoreVertical', 'Grip', 'Move', 'Maximize', 'Minimize',
    'Undo', 'Redo', 'RotateCw', 'RotateCcw', 'ZoomIn', 'ZoomOut', 'Expand',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUpRight',
    'Building', 'Store', 'Warehouse', 'Factory', 'Hotel', 'Home',
    'Car', 'Bike', 'Bus', 'Train', 'Plane', 'Ship', 'Anchor',
    'Globe', 'Map', 'Navigation', 'Compass', 'Flag', 'Bookmark',
    'Hash', 'AtSign', 'Wifi', 'WifiOff', 'Bluetooth', 'Battery', 'Power',
    'Monitor', 'Laptop', 'Tablet', 'Smartphone', 'Watch', 'Tv', 'Speaker',
    'Headphones', 'Radio', 'Gamepad', 'Joystick', 'Mouse', 'Keyboard',
    'BarChart', 'BarChart2', 'BarChart3', 'LineChart', 'PieChart', 'Activity',
    'TrendingUp', 'TrendingDown', 'Gauge', 'Thermometer', 'Timer', 'Hourglass',
    'Shield', 'ShieldCheck', 'ShieldAlert', 'ShieldOff', 'Key', 'Fingerprint',
    'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'Users', 'UsersRound',
    'Building2', 'Landmark', 'Church', 'GraduationCap', 'Library', 'Book',
    'BookOpen', 'Notebook', 'Journal', 'Newspaper', 'Receipt', 'Clipboard',
    'ClipboardList', 'ClipboardCheck', 'ClipboardCopy', 'ClipboardPaste',
    'Calendar', 'CalendarDays', 'CalendarRange', 'CalendarClock', 'CalendarCheck',
    'ToggleLeft', 'ToggleRight', 'Layers', 'LayoutList', 'LayoutDashboard',
    'Boxes', 'BoxSelect', 'Kanban', 'Table', 'Grid', 'Columns', 'Rows',
    'Sliders', 'SlidersHorizontal', 'Equalizer', 'Wrench', 'Hammer', 'Screwdriver',
    'FileCode', 'FileCog', 'FileJson', 'FileLock', 'FileKey', 'FileSearch',
    'FolderOpen', 'FolderPlus', 'FolderMinus', 'FolderCheck', 'FolderCog'
  ];
  
  const icons: Record<string, any> = {};
  commonIcons.forEach(name => {
    icons[name] = createIconStub(name);
  });
  
  // Return a proxy that handles any icon access 
  return new Proxy(icons, {
    get: (target, prop: string) => {
      if (prop in target) {
        return target[prop];
      }
      // For any icon not in our list, create a stub on-demand
      target[prop] = createIconStub(prop);
      return target[prop];
    },
  });
});
