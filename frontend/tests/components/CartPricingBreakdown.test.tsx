import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
        capabilities: {
          fulfillment: {
            required: true,
            options: [
              { mode: 'on_premise', destinations: ['on_premise_location'] },
              { mode: 'pickup', destinations: ['pickup_location'] },
              { mode: 'local_delivery', destinations: ['address'] },
            ],
          },
        },
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

describe('ModuleCartPage — Authoritative Server Pricing Invariants & Discount Interaction Flows', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue({ success: true, data: [] });

    useCartStore.getState().clearCart();
    useCartStore.getState().clearOrderDetails();

    // Populate module items with arbitrary client price
    useCartStore.getState().addItem({
      id: 'item-burger-1',
      name: 'Signature Burger',
      price: 999.0, // Client claims item is $999
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

  it('proves server pricing authority: server says item is $16, client says $999 -> UI strictly renders $16', async () => {
    mockPost.mockImplementation(async (url: string) => {
      if (url === '/pricing/preview') {
        return {
          data: {
            success: true,
            data: {
              subtotal: 16.0,
              taxAmount: 1.6,
              taxBreakdown: [{ name: 'Tax', rate: 10, amount: 1.6 }],
              feeBreakdown: [],
              serviceCharge: 0,
              deliveryFee: 0,
              totalDiscount: 0,
              discounts: [],
              totalAmount: 17.6,
              currency: 'USD',
              preDiscountTotal: 17.6,
              lineItems: [
                {
                  itemId: 'item-burger-1',
                  name: 'Signature Burger',
                  unitPrice: 16.0,
                  quantity: 1,
                  lineTotal: 16.0,
                },
              ],
            },
          },
        };
      }
      return { data: { success: true } };
    });

    renderWithProviders(<ModuleCartPage />);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/pricing/preview',
        expect.anything(),
        expect.anything()
      );
    });

    // Authoritative $16.00 unit price and line total must be displayed
    await waitFor(() => {
      expect(screen.getByText('$16.00 each')).toBeDefined();
      expect(screen.getByText('Place Order • $17.60')).toBeDefined();
    });

    // The client's $999 price MUST NOT appear anywhere in the document
    expect(screen.queryByText(/999/)).toBeNull();
  });

  it('proves discount authority: server determines coupon amount ($12), client does not calculate locally', async () => {
    mockPost.mockImplementation(async (url: string, payload: any) => {
      if (url === '/pricing/preview') {
        const hasCoupon = payload.couponCode === 'SAVE20';
        return {
          data: {
            success: true,
            data: {
              subtotal: 50.0,
              taxAmount: 5.0,
              taxBreakdown: [{ name: 'VAT', rate: 10, amount: 5.0 }],
              feeBreakdown: [],
              serviceCharge: 0,
              deliveryFee: 0,
              totalDiscount: hasCoupon ? 12.0 : 0,
              discounts: hasCoupon
                ? [{ type: 'coupon', name: 'Promo Save', amount: 12.0, code: 'SAVE20' }]
                : [],
              totalAmount: hasCoupon ? 43.0 : 55.0,
              currency: 'USD',
              preDiscountTotal: 55.0,
              lineItems: [
                {
                  itemId: 'item-burger-1',
                  name: 'Signature Burger',
                  unitPrice: 50.0,
                  quantity: 1,
                  lineTotal: 50.0,
                },
              ],
            },
          },
        };
      }
      return { data: { success: true } };
    });

    renderWithProviders(<ModuleCartPage />);

    // Step 1: Initial preview resolves without coupon ($55.00)
    await waitFor(() => {
      expect(screen.getByText('Place Order • $55.00')).toBeDefined();
    });

    // Step 2: User applies coupon SAVE20 via cartStore
    act(() => {
      useCartStore.getState().setCouponForModule('mod-restaurant-1', 'SAVE20');
    });

    // Step 3: Preview re-runs, and server returns $12 discount and $43.00 total
    await waitFor(() => {
      expect(screen.getAllByText('-$12.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Place Order • $43.00')).toBeDefined();
    });

    // Step 4: User removes coupon
    act(() => {
      useCartStore.getState().setCouponForModule('mod-restaurant-1', null);
    });

    // Step 5: Preview re-runs, and discount disappears
    await waitFor(() => {
      expect(screen.getByText('Place Order • $55.00')).toBeDefined();
      expect(screen.queryByText('-$12.00')).toBeNull();
    });
  });

  it('handles gift card and loyalty points interactions through server-authoritative preview', async () => {
    mockPost.mockImplementation(async (url: string, payload: any) => {
      if (url === '/pricing/preview') {
        const giftCardAmount = payload.giftCardCodes?.includes('GC-100') ? 20.0 : 0;
        const loyaltyAmount = (payload.loyaltyPointsToRedeem || 0) > 0 ? 5.0 : 0;
        const totalDiscount = giftCardAmount + loyaltyAmount;

        const discounts = [];
        if (giftCardAmount > 0) {
          discounts.push({ type: 'gift_card', name: 'Gift Card', amount: giftCardAmount, code: 'GC-100' });
        }
        if (loyaltyAmount > 0) {
          discounts.push({ type: 'loyalty', name: 'Loyalty Reward', amount: loyaltyAmount });
        }

        return {
          data: {
            success: true,
            data: {
              subtotal: 50.0,
              taxAmount: 5.0,
              taxBreakdown: [],
              feeBreakdown: [],
              serviceCharge: 0,
              deliveryFee: 0,
              totalDiscount,
              discounts,
              totalAmount: 55.0 - totalDiscount,
              currency: 'USD',
              preDiscountTotal: 55.0,
              lineItems: [
                {
                  itemId: 'item-burger-1',
                  name: 'Signature Burger',
                  unitPrice: 50.0,
                  quantity: 1,
                  lineTotal: 50.0,
                },
              ],
            },
          },
        };
      }
      return { data: { success: true } };
    });

    renderWithProviders(<ModuleCartPage />);

    // Wait for initial render without discounts ($55.00)
    await waitFor(() => {
      expect(screen.getByText('Place Order • $55.00')).toBeDefined();
    });

    // Apply Gift Card
    act(() => {
      useCartStore.getState().addGiftCardForModule('mod-restaurant-1', 'GC-100');
    });

    await waitFor(() => {
      expect(screen.getAllByText('-$20.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Place Order • $35.00')).toBeDefined();
    });

    // Apply Loyalty Points
    act(() => {
      useCartStore.getState().setLoyaltyPointsForModule('mod-restaurant-1', 500);
    });

    await waitFor(() => {
      expect(screen.getAllByText('-$5.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('-$25.00').length).toBeGreaterThanOrEqual(1); // Total savings
      expect(screen.getByText('Place Order • $30.00')).toBeDefined();
    });
  });

  it('disables place order button and shows pricing unavailable when pricing preview encounters an error', async () => {
    mockPost.mockImplementation(async (url: string) => {
      if (url === '/pricing/preview') {
        const err: any = new Error('Out of stock for Signature Burger');
        err.response = { data: { error: 'Out of stock for Signature Burger' } };
        throw err;
      }
      return { data: { success: true } };
    });

    renderWithProviders(<ModuleCartPage />);

    await waitFor(() => {
      expect(screen.getByText('Pricing update failed')).toBeDefined();
      expect(screen.getByText('Out of stock for Signature Burger')).toBeDefined();
      expect(screen.getByText('Pricing unavailable')).toBeDefined();
      const placeOrderBtn = screen.getByRole('button', { name: /Pricing Error/i });
      expect(placeOrderBtn).toBeDefined();
      expect((placeOrderBtn as HTMLButtonElement).disabled).toBe(true);
    }, { timeout: 3000 });
  });
});
