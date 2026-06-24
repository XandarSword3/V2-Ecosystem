/**
 * Frontend Test Setup
 * 
 * Global configuration for Vitest + React Testing Library
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';

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
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => {
    const resolvedHref = typeof href === 'string'
      ? href
      : href?.pathname || '#';
    return React.createElement('a', { href: resolvedHref, ...props }, children);
  },
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: any) => {
    return React.createElement('img', { ...props, alt: props.alt || '' });
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
const originalWarn = console.warn;

const expectedLogNoisePatterns: RegExp[] = [
  /React does not recognize the .*prop on a DOM element\./i,
  /whilehover|whiletap/i,
  /node-cron/i,
  /source\s*map|sourcemap/i,
  /poolOptions/i,
  /deprecated/i,
];

function shouldSuppressExpectedNoise(args: unknown[]): boolean {
  const message = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

  const isReactMotionNoise =
    expectedLogNoisePatterns[0].test(message) && expectedLogNoisePatterns[1].test(message);
  const isNodeCronSourcemapNoise =
    expectedLogNoisePatterns[2].test(message) && expectedLogNoisePatterns[3].test(message);
  const isVitestPoolOptionsDeprecation =
    expectedLogNoisePatterns[4].test(message) && expectedLogNoisePatterns[5].test(message);

  return isReactMotionNoise || isNodeCronSourcemapNoise || isVitestPoolOptionsDeprecation;
}

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (shouldSuppressExpectedNoise(args)) {
      return;
    }

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

  console.warn = (...args: any[]) => {
    if (shouldSuppressExpectedNoise(args)) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Global mock for lucide-react icons to handle dynamic icon imports.
// Important: explicitly ignore then/catch/finally to avoid Promise-thenable proxy hangs.
vi.mock('lucide-react', () => {
  const createIconStub = (name: string) => {
    const IconComponent = (props: any) => {
      const dataProps: Record<string, string> = {};
      Object.keys(props || {}).forEach((key) => {
        if (key !== 'children' && typeof props[key] === 'string') {
          const normalizedKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
          dataProps[`data-${normalizedKey}`] = props[key];
        }
      });

      return React.createElement(
        'span',
        {
          'data-testid': `icon-${name.toLowerCase()}`,
          'data-lucide': name,
          ...dataProps,
        },
        name
      );
    };

    IconComponent.displayName = name;
    return IconComponent;
  };

  const exports: Record<string, any> = {
    __esModule: true,
  };

  return new Proxy(exports, {
    get: (target, prop: string | symbol) => {
      if (typeof prop === 'symbol') {
        return undefined;
      }

      if (prop === 'default') {
        return target;
      }

      // Prevent mock module from being treated as a thenable.
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined;
      }

      if (!(prop in target)) {
        target[prop] = createIconStub(prop);
      }

      return target[prop];
    },
  });
});
