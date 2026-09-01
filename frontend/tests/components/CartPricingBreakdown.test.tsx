import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ModuleCartPage from '@/app/[property]/[slug]/cart/page';
import { useCartStore } from '@/stores/cartStore';

const mockGet = vi.fn();
const mockPost = vi.fn();

// Mocks
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ property: 'resort-main', slug: 'restaurant' }),
  usePathname: () => '/resort-main/restaurant/cart',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [
      {
        id: 'mod-restaurant-1',
        slug: 'restaurant',
        name: 'Fine Dining Restaurant',
        engine_type: 'instant_transaction',
        template_type: 'instant_transaction',
      },
    ],
    loading: false,
  }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'usr-123', email: 'guest@example.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/lib/property-id', () => ({
  getStoredPropertyId: () => 'prop-resort-1',
}));

vi.mock('@/lib/api', () => {
  const instance = {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  };
  return {
    __esModule: true,
    default: instance,
    api: instance,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/components/customer/FulfillmentModeSelector', () => ({
  FulfillmentModeSelector: () => <div data-testid="fulfillment-mode-selector" />,
}));

vi.mock('@/components/customer/DestinationRequirementsEditor', () => ({
  DestinationRequirementsEditor: () => <div data-testid="destination-requirements-editor" />,
}));

vi.mock('@/components/customer/PaymentDiscounts', () => ({
  PaymentDiscounts: () => <div data-testid="payment-discounts" />,
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('ModuleCartPage — Authoritative Server Pricing & Guarded Checkout', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue({ success: true, data: [] });

    useCartStore.getState().clearCart();
    useCartStore.getState().clearOrderDetails();

    // Populate module items
    useCartStore.getState().addItem({
      id: 'item-steak',
      name: 'Ribeye Steak',
      price: 40,
      quantity: 1,
      category: 'food',
      moduleId: 'mod-restaurant-1',
      moduleSlug: 'restaurant',
    });

    useCartStore.getState().setCustomerName('Alice Doe');
    useCartStore.getState().setCustomerPhone('+1 555 1234');
    useCartStore.getState().setFulfillmentForModule('mod-restaurant-1', {
      mode: 'on_premise',
      destinationType: 'on_premise_location',
      destinationRef: 'table-uuid-1',
    });
  });

  const mockServerPricing = {
    subtotal: 40.0,
    taxAmount: 4.0,
    taxBreakdown: [{ name: 'City Tax', rate: 10, amount: 4.0 }],
    feeBreakdown: [],
    serviceCharge: 6.0,
    deliveryFee: 0.0,
    totalDiscount: 10.0,
    discounts: [{ type: 'coupon', name: 'VIP Promo', amount: 10.0, code: 'VIP10' }],
    totalAmount: 40.0, // 40 + 4 + 6 - 10 = 40.0
    currency: 'USD',
  };

  it('renders authoritative subtotal, tax, service charge, discount, and total from server PricingResult', async () => {
    mockPost.mockImplementation(async (url: string) => {
      if (url === '/pricing/preview') {
        return {
          data: {
            success: true,
            data: mockServerPricing,
          },
        };
      }
      return { data: { success: true } };
    });

    renderWithProviders(<ModuleCartPage />);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Wait a tick for React re-render
    await new Promise(r => setTimeout(r, 100));

    // Order summary contains server lines
    expect(screen.getByText(/City Tax/i)).toBeDefined();
    expect(screen.getByText(/Service Charge/i)).toBeDefined();
    expect(screen.getByText(/VIP Promo/i)).toBeDefined();
    expect(screen.getAllByText('-$10.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Place Order • \$40\.00/)).toBeDefined();
  });

  it('disables place order button when pricing preview encounters an error', async () => {
    mockPost.mockImplementation(async (url: string) => {
      if (url === '/pricing/preview') {
        const err: any = new Error('Out of stock for Ribeye Steak');
        err.response = { data: { error: 'Out of stock for Ribeye Steak' } };
        throw err;
      }
      return { data: { success: true } };
    });

    renderWithProviders(<ModuleCartPage />);

    await waitFor(() => {
      expect(screen.getByText('Pricing update failed')).toBeDefined();
      expect(screen.getByText('Out of stock for Ribeye Steak')).toBeDefined();
      const placeOrderBtn = screen.getByRole('button', { name: /Pricing Error/i });
      expect(placeOrderBtn).toBeDefined();
      expect((placeOrderBtn as HTMLButtonElement).disabled).toBe(true);
    }, { timeout: 3000 });
  });
});
