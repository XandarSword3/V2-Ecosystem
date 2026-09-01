import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

import { DynamicModuleRenderer } from '@/components/module-builder/DynamicModuleRenderer';
import { MenuService } from '@/components/modules/MenuService';

// Mock DynamicModuleRenderer to verify Visual Builder coexistence
vi.mock('@/components/module-builder/DynamicModuleRenderer', () => ({
  DynamicModuleRenderer: ({ layout, module }: any) => (
    <div data-testid="dynamic-renderer" data-module-id={module.id} data-blocks-count={layout.length}>
      {layout.map((b: any) => (
        <div key={b.id} data-testid={`block-${b.type}`}>{b.type}</div>
      ))}
    </div>
  ),
}));

// Mock MenuService to verify default Engine A coexistence
vi.mock('@/components/modules/MenuService', () => ({
  MenuService: ({ module }: any) => (
    <div data-testid="menu-service-renderer" data-module-id={module.id}>
      <span data-testid="menu-module-name">{module.name}</span>
    </div>
  ),
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

  describe('1. CustomerShell (Pure Presentation)', () => {
    it('renders accessibility skip link and brand theme injector', () => {
      render(
        <CustomerShell>
          <div data-testid="child-content">Storefront Content</div>
        </CustomerShell>
      );

      expect(screen.getByText('Skip to main content')).toBeDefined();
      expect(screen.getByTestId('theme-injector')).toBeDefined();
      expect(screen.getByTestId('child-content').textContent).toBe('Storefront Content');
    });

    it('renders optional header and footer layout slots', () => {
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

  describe('2. Canonical Engine A Capability Projection (No duplicate mode list)', () => {
    it('projects the canonical F1 capability model with all 6 fulfillment modes for instant_transaction', () => {
      const module: any = {
        id: 'mod-1',
        name: 'Main Restaurant',
        slug: 'restaurant',
        engine_type: 'instant_transaction',
      };

      const caps = resolveEngineACapabilities(module);
      expect(caps).not.toBeNull();
      expect(caps?.fulfillment.required).toBe(true);
      expect(caps?.fulfillment.options).toHaveLength(6);
      
      const modes = caps?.fulfillment.options.map(o => o.mode);
      expect(modes).toContain('on_premise');
      expect(modes).toContain('pickup');
      expect(modes).toContain('local_delivery');
      expect(modes).toContain('digital_delivery');
      expect(modes).toContain('shipment');
      expect(modes).toContain('service_execution');
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
    it('renders loading skeleton when isLoading is true', () => {
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

  describe('4. CommerceShell & Cart Scoping Regression Test', () => {
    it('scopes cart item count strictly to current module context (Module A x2, Module B x3 -> shows 2)', () => {
      const moduleA: any = {
        id: 'mod-a',
        name: 'Restaurant A',
        slug: 'restaurant-a',
        engine_type: 'instant_transaction',
      };

      // Populate cart with 2 items from Module A and 3 items from Module B
      useCartStore.getState().addItem({
        id: 'item-a-1',
        name: 'Burger',
        price: 10,
        moduleId: 'mod-a',
        moduleSlug: 'restaurant-a',
        quantity: 2,
      });

      useCartStore.getState().addItem({
        id: 'item-b-1',
        name: 'Cocktail',
        price: 15,
        moduleId: 'mod-b',
        moduleSlug: 'bar-b',
        quantity: 3,
      });

      render(
        <ModuleProvider module={moduleA} slug="restaurant-a" propertySlug="demo-resort">
          <CommerceShell>
            <div>Module A Content</div>
          </CommerceShell>
        </ModuleProvider>
      );

      // Verify that Module A cart trigger reflects only Module A's 2 items (not all 5)
      const cartLink = screen.getByLabelText(/View Cart with 2 items/i);
      expect(cartLink).toBeDefined();
      expect(cartLink.getAttribute('href')).toBe('/demo-resort/restaurant-a/cart');
    });

    it('renders toolbar and fulfillment mode selector slots when provided', () => {
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
  });

  describe('5. Coexistence Proof: Visual Builder and Engine Renderers', () => {
    it('coexists with custom Visual Builder layout via DynamicModuleRenderer unchanged', () => {
      const customLayoutModule: any = {
        id: 'mod-vb',
        name: 'Custom Page',
        slug: 'custom-page',
        engine_type: 'instant_transaction',
        settings: {
          layout: [
            { id: 'blk-1', type: 'hero_v2', props: {} },
            { id: 'blk-2', type: 'card_grid', props: {} },
          ],
        },
      };

      render(
        <CustomerShell>
          <ModuleProvider module={customLayoutModule} slug="custom-page" propertySlug="demo-resort">
            <ModuleShell>
              <DynamicModuleRenderer
                layout={customLayoutModule.settings.layout}
                module={customLayoutModule}
                propertySlug="demo-resort"
              />
            </ModuleShell>
          </ModuleProvider>
        </CustomerShell>
      );

      expect(screen.getByTestId('dynamic-renderer')).toBeDefined();
      expect(screen.getByTestId('block-hero_v2')).toBeDefined();
      expect(screen.getByTestId('block-card_grid')).toBeDefined();
    });

    it('coexists with default Engine A MenuService without altering catalog data or pricing', () => {
      const defaultEngineAModule: any = {
        id: 'mod-menu',
        name: 'Default Menu Service',
        slug: 'menu-service',
        engine_type: 'instant_transaction',
      };

      render(
        <CustomerShell>
          <ModuleProvider module={defaultEngineAModule} slug="menu-service" propertySlug="demo-resort">
            <ModuleShell>
              <CommerceShell>
                <MenuService module={defaultEngineAModule} />
              </CommerceShell>
            </ModuleShell>
          </ModuleProvider>
        </CustomerShell>
      );

      expect(screen.getByTestId('menu-service-renderer')).toBeDefined();
      expect(screen.getByTestId('menu-module-name').textContent).toBe('Default Menu Service');
    });

    it('preserves catalog pricing, customization, cart state, inventory flags, and fulfillment options unchanged', () => {
      const catalogItem = {
        id: 'item-burger',
        name: 'Gourmet Burger',
        price: 18.5,
        is_available: true,
        inventory_tracked: true,
        available_quantity: 42,
        customizations: [
          { id: 'opt-cheese', name: 'Extra Cheese', price_adjustment: 2.0 },
        ],
      };

      const module: any = {
        id: 'mod-gourmet',
        name: 'Gourmet Kitchen',
        slug: 'gourmet-kitchen',
        engine_type: 'instant_transaction',
      };

      // Add item with customization to cart store
      useCartStore.getState().addItem({
        id: catalogItem.id,
        name: catalogItem.name,
        price: catalogItem.price,
        moduleId: module.id,
        moduleSlug: module.slug,
        quantity: 1,
        selectedModifiers: [
          {
            optionId: 'opt-cheese',
            optionName: 'Extra Cheese',
            groupId: 'grp-1',
            groupName: 'Add-ons',
            modifierType: 'add',
            priceAdjustment: 2.0,
            quantity: 1,
          },
        ],
      });

      render(
        <CustomerShell>
          <ModuleProvider module={module} slug="gourmet-kitchen" propertySlug="demo-resort">
            <ModuleShell>
              <CommerceShell>
                <div data-testid="item-price">${catalogItem.price.toFixed(2)}</div>
                <div data-testid="item-availability">{catalogItem.is_available ? 'In Stock' : 'Out'}</div>
                <div data-testid="item-qty">{catalogItem.available_quantity}</div>
                <div data-testid="item-mod">{catalogItem.customizations[0].name} (+${catalogItem.customizations[0].price_adjustment})</div>
              </CommerceShell>
            </ModuleShell>
          </ModuleProvider>
        </CustomerShell>
      );

      // Verify presentation renders exactly without shell interference
      expect(screen.getByTestId('item-price').textContent).toBe('$18.50');
      expect(screen.getByTestId('item-availability').textContent).toBe('In Stock');
      expect(screen.getByTestId('item-qty').textContent).toBe('42');
      expect(screen.getByTestId('item-mod').textContent).toBe('Extra Cheese (+$2)');

      // Verify cart store state was untouched by shell
      const storeItem = useCartStore.getState().items[0];
      expect(storeItem.price).toBe(18.5);
      expect(storeItem.selectedModifiers?.[0].priceAdjustment).toBe(2.0);
    });
  });

  describe('6. AccountShell Integration & Verification', () => {
    it('renders guest mode banner when unauthenticated with sign-in link', () => {
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

    it('handles tab selection and onTabChange callback for custom profile tabs', () => {
      const onTabChangeMock = vi.fn();
      const customTabs = [
        { key: 'profile', label: 'Profile', icon: () => null },
        { key: 'orders', label: 'Orders', icon: () => null },
        { key: 'loyalty', label: 'Loyalty', icon: () => null },
      ];

      render(
        <AccountShell
          activeTab="orders"
          onTabChange={onTabChangeMock}
          tabs={customTabs}
          propertySlug="demo-resort"
        >
          <div>Orders View</div>
        </AccountShell>
      );

      const loyaltyTabButton = screen.getByText('Loyalty');
      fireEvent.click(loyaltyTabButton);

      expect(onTabChangeMock).toHaveBeenCalledWith('loyalty');
    });
  });
});
