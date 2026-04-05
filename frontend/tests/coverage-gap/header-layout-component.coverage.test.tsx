import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameState = vi.hoisted(() => ({ value: '/' }));
const localeState = vi.hoisted(() => ({ value: 'en' }));
const routerRefreshMock = vi.hoisted(() => vi.fn());

const siteSettingsState = vi.hoisted(() => ({
  settings: {
    resortName: 'Summit Resort',
    navbar: {
      links: [
        { type: 'internal', label: 'Home', href: '/', icon: 'Home' },
        { type: 'module', moduleSlug: 'chalets', label: 'Units', href: '/chalets', icon: 'Home' },
      ],
      config: {
        showLanguageSwitcher: true,
        showThemeToggle: true,
        showCurrencySwitcher: true,
        showUserPreferences: true,
        showCart: true,
        sticky: true,
      },
    },
  },
  modules: [
    { id: 'm-1', slug: 'chalets', name: 'Chalets', is_active: true, show_in_main: true, sort_order: 1, template_type: 'multi_day_booking' },
  ],
}));

const authState = vi.hoisted(() => ({
  user: { fullName: 'Alex Guest' },
  isAuthenticated: true,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);
        return Component;
      },
    }
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({
    refresh: routerRefreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => localeState.value,
  useTranslations: () => (key: string) => {
    const dictionary: Record<string, string> = {
      home: 'Home',
      settings: 'Settings',
      signIn: 'Sign In',
      myProfile: 'My Profile',
      register: 'Register',
      chalets: 'Chalets',
    };
    return dictionary[key] || key;
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteSettingsState,
}));

vi.mock('@/hooks/useTerminology', () => ({
  useTerminology: () => ({ terms: { unit_plural: 'Cabins' } }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('@/stores/cartStore', () => ({
  useCartStore: (selector: (state: { getCount: () => number }) => number) =>
    selector({ getCount: () => 2 }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}));

import Header from '../../src/components/layout/Header';

describe('Header layout component coverage', () => {
  beforeEach(() => {
    pathnameState.value = '/';
    localeState.value = 'en';
    routerRefreshMock.mockReset();
    document.cookie = 'NEXT_LOCALE=en; path=/';

    authState.user = { fullName: 'Alex Guest' };
    authState.isAuthenticated = true;

    siteSettingsState.settings = {
      resortName: 'Summit Resort',
      navbar: {
        links: [
          { type: 'internal', label: 'Home', href: '/', icon: 'Home' },
          { type: 'module', moduleSlug: 'chalets', label: 'Units', href: '/chalets', icon: 'Home' },
        ],
        config: {
          showLanguageSwitcher: true,
          showThemeToggle: true,
          showCurrencySwitcher: true,
          showUserPreferences: true,
          showCart: true,
          sticky: true,
        },
      },
    };

    siteSettingsState.modules = [
      { id: 'm-1', slug: 'chalets', name: 'Chalets', is_active: true, show_in_main: true, sort_order: 1, template_type: 'multi_day_booking' },
    ];
  });

  it('renders customer header, module links, and opens preferences modal', async () => {
    const user = userEvent.setup();

    render(<Header />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Summit Resort')).toBeInTheDocument();

    expect(await screen.findByText('Cabins')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(await screen.findByRole('dialog', { name: 'User Preferences' })).toBeInTheDocument();

    const mobileToggle = screen.getByRole('button', { name: /Menu|X/i });
    await user.click(mobileToggle);

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument();
    });
  });

  it('does not render on admin routes', () => {
    pathnameState.value = '/admin/orders';

    const { container } = render(<Header />);

    expect(container.firstChild).toBeNull();
  });
});
