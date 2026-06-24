import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameState = vi.hoisted(() => ({ pathname: '/' }));
const siteState = vi.hoisted(() => ({
  settings: {
    propertyName: 'V2 Ecosystem',
    footer: undefined as
      | undefined
      | {
          logo?: string;
          socials?: Array<{ platform: string; url: string }>;
          columns?: Array<unknown>;
        },
  },
  modules: [] as Array<{
    slug: string;
    name: string;
    is_active: boolean;
    show_in_main: boolean;
    sort_order?: number;
  }>,
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
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.pathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns: string) => (key: string, values?: { year?: number }) => {
    if (ns === 'footer' && key === 'copyright') {
      return `copyright ${values?.year}`;
    }
    return key;
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteState,
}));

import Footer from '../../src/components/Footer';

describe('Footer behavior', () => {
  beforeEach(() => {
    pathnameState.pathname = '/';
    siteState.settings = {
      propertyName: 'V2 Ecosystem',
      footer: undefined,
    };
    siteState.modules = [
      { slug: 'menu_service', name: 'MenuService', is_active: true, show_in_main: true, sort_order: 1 },
      { slug: 'capacity', name: 'Pool', is_active: true, show_in_main: true, sort_order: 2 },
      { slug: 'kiosk', name: 'KioskItem', is_active: false, show_in_main: true, sort_order: 3 },
    ];
  });

  it('does not render on admin and staff routes', () => {
    pathnameState.pathname = '/admin/settings';
    const { container, rerender } = render(<Footer />);
    expect(container).toBeEmptyDOMElement();

    pathnameState.pathname = '/staff/pool';
    rerender(<Footer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders quick links from active customer modules and gift cards', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: /MenuService/i })).toHaveAttribute('href', '/menu_service');
    expect(screen.getByRole('link', { name: /pool/i })).toHaveAttribute('href', '/capacity');
    expect(screen.queryByRole('link', { name: /snackBar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /giftCards/i })).toHaveAttribute('href', '/giftcards');
  });

  it('filters out CMS socials with empty URLs', () => {
    siteState.settings.footer = {
      logo: 'Custom Resort',
      socials: [{ platform: 'facebook', url: '' }],
      columns: [],
    };

    render(<Footer />);

    const allLinks = screen.queryAllByRole('link');
    const externalSocials = allLinks.filter((link) => {
      const href = link.getAttribute('href') || '';
      return href.startsWith('https://');
    });

    expect(externalSocials).toHaveLength(0);
  });
});
