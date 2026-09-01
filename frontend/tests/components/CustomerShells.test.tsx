import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerShell } from '@/components/shells/CustomerShell';
import { ModuleProvider, useModuleContext, resolveEngineACapabilities } from '@/components/shells/ModuleContext';
import { ModuleShell } from '@/components/shells/ModuleShell';
import { CommerceShell } from '@/components/shells/CommerceShell';
import { AccountShell } from '@/components/shells/AccountShell';
import { useCartStore } from '@/stores/cartStore';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, any>) => {
    if (params?.name) return `${key}: ${params.name}`;
    return key;
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({ property: 'demo-resort', slug: 'restaurant' }),
  usePathname: () => '/demo-resort/restaurant',
}));

// Mock auth-context
const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock ThemeInjector
vi.mock('@/components/ThemeInjector', () => ({
  ThemeInjector: () => <div data-testid="theme-injector" />,
}));

describe('F3: Customer Application Shell Modernization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.getState().clearCart();
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });
  });

  describe('1. CustomerShell', () => {
    it('renders skip to main content link and brand theme injector', () => {
      render(
        <CustomerShell>
          <div data-testid="child-content">Storefront Content</div>
        </CustomerShell>
      );

      expect(screen.getByText('Skip to main content')).toBeDefined();
      expect(screen.getByTestId('theme-injector')).toBeDefined();
      expect(screen.getByTestId('child-content').textContent).toBe('Storefront Content');
    });

    it('renders optional header and footer slots', () => {
      render(
        <CustomerShell
          headerSlot={<div data-testid="custom-header">Header Slot</div>}
          footerSlot={<div data-testid="custom-footer">Footer Slot</div>}
        >
          <div>Main Body</div>
        </CustomerShell>
      );

      expect(screen.getByTestId('custom-header').textContent).toBe('Header Slot');
      expect(screen.getByTestId('custom-footer').textContent).toBe('Footer Slot');
    });
  });

  describe('2. ModuleContext & Capabilities Projection', () => {
    it('projects canonical fulfillment capabilities for instant_transaction', () => {
      const module: any = {
        id: 'mod-1',
        name: 'Main Restaurant',
        slug: 'restaurant',
        engine_type: 'instant_transaction',
      };

      const caps = resolveEngineACapabilities(module);
      expect(caps).not.toBeNull();
      expect(caps?.fulfillment.required).toBe(true);
      expect(caps?.fulfillment.options).toHaveLength(4);
      expect(caps?.fulfillment.options.map(o => o.mode)).toContain('on_premise');
      expect(caps?.fulfillment.options.map(o => o.mode)).toContain('pickup');
    });

    it('returns null capability projection for non-instant_transaction engines', () => {
      const module: any = {
        id: 'mod-2',
        name: 'Main Chalets',
        slug: 'chalets',
        engine_type: 'time_exclusive_reservation',
      };

      const caps = resolveEngineACapabilities(module);
      expect(caps).toBeNull();
    });

    it('provides module context to child consumers', () => {
      function Consumer() {
        const { module, propertySlug, slug, capabilities } = useModuleContext();
        return (
          <div>
            <span data-testid="mod-name">{module?.name}</span>
            <span data-testid="prop-slug">{propertySlug}</span>
            <span data-testid="mod-slug">{slug}</span>
            <span data-testid="has-caps">{capabilities ? 'yes' : 'no'}</span>
          </div>
        );
      }

      const module: any = {
        id: 'mod-1',
        name: 'Boutique Store',
        slug: 'store',
        engine_type: 'instant_transaction',
      };

      render(
        <ModuleProvider module={module} slug="store" propertySlug="demo-resort">
          <Consumer />
        </ModuleProvider>
      );

      expect(screen.getByTestId('mod-name').textContent).toBe('Boutique Store');
      expect(screen.getByTestId('prop-slug').textContent).toBe('demo-resort');
      expect(screen.getByTestId('mod-slug').textContent).toBe('store');
      expect(screen.getByTestId('has-caps').textContent).toBe('yes');
    });
  });

  describe('3. ModuleShell Lifecycle States', () => {
    it('renders loading state when isLoading is true', () => {
      render(
        <ModuleProvider module={null} slug="restaurant" propertySlug="demo-resort" isLoading={true}>
          <ModuleShell>
            <div>Active Content</div>
          </ModuleShell>
        </ModuleProvider>
      );

      expect(screen.queryByText('Active Content')).toBeNull();
      expect(screen.getByText('loading')).toBeDefined();
    });

    it('renders disabled alert when isDisabled is true', () => {
      const module: any = {
        id: 'mod-1',
        name: 'Closed Service',
        slug: 'closed',
        is_active: false,
      };

      render(
        <ModuleProvider module={module} slug="closed" propertySlug="demo-resort" isDisabled={true}>
          <ModuleShell>
            <div>Active Content</div>
          </ModuleShell>
        </ModuleProvider>
      );

      expect(screen.queryByText('Active Content')).toBeNull();
      expect(screen.getByText('featureUnavailable')).toBeDefined();
      expect(screen.getByText('returnHome')).toBeDefined();
    });

    it('renders 404 state when isNotFound is true', () => {
      render(
        <ModuleProvider module={null} slug="missing" propertySlug="demo-resort" isNotFound={true}>
          <ModuleShell>
            <div>Active Content</div>
          </ModuleShell>
        </ModuleProvider>
      );

      expect(screen.queryByText('Active Content')).toBeNull();
      expect(screen.getByText('404')).toBeDefined();
      expect(screen.getByText('pageNotFound')).toBeDefined();
    });

    it('renders active module content, breadcrumbs, and header slots when active', () => {
      const module: any = {
        id: 'mod-1',
        name: 'Active Catalog',
        slug: 'catalog',
        is_active: true,
        engine_type: 'instant_transaction',
      };

      render(
        <ModuleProvider module={module} slug="catalog" propertySlug="demo-resort">
          <ModuleShell
            breadcrumbsSlot={<span data-testid="crumb">Home &gt; Catalog</span>}
            headerSlot={<h1 data-testid="hdr">Catalog Title</h1>}
          >
            <div data-testid="active-body">Active Storefront</div>
          </ModuleShell>
        </ModuleProvider>
      );

      expect(screen.getByTestId('crumb').textContent).toBe('Home > Catalog');
      expect(screen.getByTestId('hdr').textContent).toBe('Catalog Title');
      expect(screen.getByTestId('active-body').textContent).toBe('Active Storefront');
    });
  });

  describe('4. CommerceShell & Coexistence', () => {
    it('renders commerce body and slots without altering catalog data', () => {
      const module: any = {
        id: 'mod-1',
        name: 'Snack Bar',
        slug: 'snack-bar',
        engine_type: 'instant_transaction',
      };

      render(
        <ModuleProvider module={module} slug="snack-bar" propertySlug="demo-resort">
          <CommerceShell
            toolbarSlot={<div data-testid="search-bar">Search Input</div>}
            fulfillmentSelectorSlot={<div data-testid="mode-bar">On-Premise | Pickup</div>}
          >
            <div data-testid="menu-service-content">Existing MenuService items</div>
          </CommerceShell>
        </ModuleProvider>
      );

      expect(screen.getByTestId('search-bar').textContent).toBe('Search Input');
      expect(screen.getByTestId('mode-bar').textContent).toBe('On-Premise | Pickup');
      expect(screen.getByTestId('menu-service-content').textContent).toBe('Existing MenuService items');
    });

    it('shows floating cart affordance when items are added to cart', () => {
      const module: any = {
        id: 'mod-1',
        name: 'Snack Bar',
        slug: 'snack-bar',
        engine_type: 'instant_transaction',
      };

      const { rerender } = render(
        <ModuleProvider module={module} slug="snack-bar" propertySlug="demo-resort">
          <CommerceShell>
            <div>Storefront</div>
          </CommerceShell>
        </ModuleProvider>
      );

      expect(screen.queryByLabelText(/View Cart/)).toBeNull();

      // Add item to cart store
      useCartStore.getState().addItem({
        id: 'item-1',
        name: 'Burger',
        price: 10,
        moduleId: 'mod-1',
        quantity: 2,
      });

      rerender(
        <ModuleProvider module={module} slug="snack-bar" propertySlug="demo-resort">
          <CommerceShell>
            <div>Storefront</div>
          </CommerceShell>
        </ModuleProvider>
      );

      const cartLink = screen.getByLabelText(/View Cart with 2 items/i);
      expect(cartLink).toBeDefined();
      expect(cartLink.getAttribute('href')).toBe('/demo-resort/snack-bar/cart');
    });
  });

  describe('5. AccountShell', () => {
    it('renders guest mode banner when unauthenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
      });

      render(
        <AccountShell propertySlug="demo-resort">
          <div data-testid="account-child">Account Content</div>
        </AccountShell>
      );

      expect(screen.getByText('guestMode')).toBeDefined();
      expect(screen.getByText('signIn')).toBeDefined();
      expect(screen.getByTestId('account-child').textContent).toBe('Account Content');
    });

    it('renders user welcome banner when authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'u-1', email: 'customer@example.com' },
      });

      render(
        <AccountShell propertySlug="demo-resort">
          <div data-testid="account-child">Account Content</div>
        </AccountShell>
      );

      expect(screen.queryByText('guestMode')).toBeNull();
      expect(screen.getByText(/Welcome back, customer@example.com/)).toBeDefined();
    });

    it('renders canonical account navigation tabs', () => {
      render(
        <AccountShell activeTab="tracking" propertySlug="demo-resort">
          <div>Tracking Content</div>
        </AccountShell>
      );

      expect(screen.getByText('orders')).toBeDefined();
      expect(screen.getByText('orderTracking')).toBeDefined();
      expect(screen.getByText('loyalty')).toBeDefined();
      expect(screen.getByText('giftCards')).toBeDefined();
      expect(screen.getByText('reviews')).toBeDefined();
      expect(screen.getByText('support')).toBeDefined();
    });
  });
});
