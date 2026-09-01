import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModuleCartPage from '@/app/[property]/[slug]/cart/page';
import { useCartStore } from '@/stores/cartStore';
import { api } from '@/lib/api';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      selectFulfillmentMode: 'Select Fulfillment Method',
      fulfillmentModeOnPremise: 'On-Premise',
      fulfillmentDescOnPremise: 'Service or pickup at our physical location',
      fulfillmentModePickup: 'Pickup',
      fulfillmentDescPickup: 'Collect your order at the designated counter',
      fulfillmentModeLocalDelivery: 'Local Delivery',
      fulfillmentDescLocalDelivery: 'Delivered directly to your local address',
      fulfillmentModeDigitalDelivery: 'Digital Delivery',
      fulfillmentDescDigitalDelivery: 'Instant digital delivery to your account or email',
      fulfillmentModeShipment: 'Shipment',
      fulfillmentDescShipment: 'Shipped via courier to your destination',
      fulfillmentModeServiceExecution: 'Service Execution',
      fulfillmentDescServiceExecution: 'Executed at designated service station or chair',
      fulfillmentModeNone: 'Direct Settlement (No Fulfillment)',
      fulfillmentDescNone: 'Direct commercial transaction with no physical delivery',
      selectLocationOrTable: 'Select Table / Location',
      occupied: 'Occupied',
      selected: 'Selected',
      available: 'Available',
      pickupNotesPlaceholder: 'e.g. Will pick up in 20 minutes',
      addressPlaceholder: 'Street address, building/suite, city, postal code, special delivery directions',
      digitalAccountPlaceholder: 'e.g. user@example.com',
      serviceStationPlaceholder: 'e.g. Spa Treatment Room 3, Station B',
      fulfillmentNoneNotice: 'This transaction settles directly with no physical fulfillment required.',
      orderPlaced: 'Order placed successfully!',
      cartEmpty: 'Your cart is empty',
      enterName: 'Please enter your name',
      enterPhone: 'Please enter your phone number',
    };
    return translations[key] || '';
  },
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({ property: 'demo-resort', slug: 'restaurant' }),
  usePathname: () => '/demo-resort/restaurant/cart',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock auth-context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'usr-1', email: 'guest@example.com' },
  }),
}));

// Mock site settings
vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [
      {
        id: 'mod-restaurant',
        slug: 'restaurant',
        name: 'The Bistro',
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
      {
        id: 'mod-retail',
        slug: 'boutique',
        name: 'Resort Boutique',
      },
    ],
    loading: false,
  }),
}));

// Mock TanStack React Query useMutation
let lastMutationCallback: any = null;
vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ mutationFn, onSuccess, onError }: any) => {
    lastMutationCallback = { mutationFn, onSuccess, onError };
    return {
      mutate: async (variables: any) => {
        try {
          const res = await mutationFn(variables);
          if (onSuccess) onSuccess(res);
        } catch (err) {
          if (onError) onError(err);
        }
      },
      isPending: false,
    };
  },
}));

// Mock API
vi.mock('@/lib/api', () => {
  const instance = {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/service-locations')) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: 'loc-1', name: 'Table 1', is_active: true, is_occupied: false },
              { id: 'loc-2', name: 'Table 2', is_active: true, is_occupied: true },
            ],
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
    post: vi.fn().mockImplementation((url: string, body: any) => {
      if (url === '/pricing/preview') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              subtotal: 25.0,
              taxAmount: 2.5,
              feeBreakdown: [],
              taxBreakdown: [{ name: 'VAT', rate: 0.1, amount: 2.5 }],
              totalAmount: 27.5,
              currency: 'USD',
              preDiscountTotal: 27.5,
              lineItems: [
                {
                  itemId: 'dish-1',
                  name: 'Seafood Pasta',
                  unitPrice: 25.0,
                  quantity: 1,
                  lineTotal: 25.0,
                },
              ],
            },
          },
        });
      }
      if (url.includes('/orders')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: 'tx-ord-999',
              order_number: 'ORD-TEST1',
              amount: 27.5,
              status: 'pending',
              metadata: {
                fulfillment_mode: body.fulfillmentSelection?.mode,
                fulfillment_destination_type: body.fulfillmentSelection?.destinationType,
                fulfillment_destination_ref: body.fulfillmentSelection?.destinationRef,
                idempotency_key: body.idempotencyKey,
              },
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    }),
  };
  return {
    __esModule: true,
    default: instance,
    api: instance,
  };
});

describe('CustomerCommerceFlow — Phase F4 End-to-End Commerce Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.getState().clearCart();
    useCartStore.getState().clearOrderDetails();
  });

  it('partitions cart per module: restaurant checkout displays only restaurant items and clears only restaurant items', async () => {
    const { addItem } = useCartStore.getState();

    // Add 1 Restaurant item
    addItem({
      id: 'dish-1',
      name: 'Seafood Pasta',
      price: 25.0,
      quantity: 1,
      moduleId: 'mod-restaurant',
      moduleSlug: 'restaurant',
    });

    // Add 1 Boutique Retail item
    addItem({
      id: 'gift-1',
      name: 'Sun Hat',
      price: 40.0,
      quantity: 1,
      moduleId: 'mod-retail',
      moduleSlug: 'boutique',
    });

    // Total cart items = 2
    expect(useCartStore.getState().items).toHaveLength(2);

    render(<ModuleCartPage />);

    // Renders only Seafood Pasta in the restaurant cart (in main list and sidebar)
    expect(screen.getAllByText('Seafood Pasta').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Sun Hat')).toBeNull();

    // Advance to Step 2
    const continueBtn = screen.getByText(/Continue to Details/i);
    fireEvent.click(continueBtn);

    // Wait for Step 2 customer inputs
    await waitFor(() => {
      expect(screen.getByTestId('fulfillment-mode-selector')).toBeDefined();
    });

    // Verify canonical fulfillment options are rendered
    expect(screen.getByTestId('mode-option-on_premise')).toBeDefined();
    expect(screen.getByTestId('mode-option-pickup')).toBeDefined();
    expect(screen.getByTestId('mode-option-local_delivery')).toBeDefined();

    // Verify service locations are loaded
    await waitFor(() => {
      expect(screen.getByTestId('location-option-loc-1')).toBeDefined();
    });

    // Table 2 is occupied (race protection test)
    const occupiedTable = screen.getByTestId('location-option-loc-2') as HTMLButtonElement;
    expect(occupiedTable.disabled).toBe(true);

    // Select Table 1 (available)
    fireEvent.click(screen.getByTestId('location-option-loc-1'));

    // Fill customer name and phone
    const nameInput = screen.getByPlaceholderText(/Enter your full name/i);
    const phoneInput = screen.getByPlaceholderText(/Enter your phone number/i);
    fireEvent.change(nameInput, { target: { value: 'Alessandro Rossi' } });
    fireEvent.change(phoneInput, { target: { value: '+1234567890' } });

    // Advance to Step 3
    const paymentStepBtn = screen.getByText(/Continue to Payment/i);
    fireEvent.click(paymentStepBtn);

    // Click Place Order (Cash Payment)
    await waitFor(() => {
      expect(screen.getByText(/Place Order/i)).toBeDefined();
    });

    const placeOrderBtn = screen.getByText(/Place Order/i);
    fireEvent.click(placeOrderBtn);

    // Verify API called with canonical contract
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/restaurant/orders',
        expect.objectContaining({
          customerName: 'Alessandro Rossi',
          customerPhone: '+1234567890',
          paymentMethod: 'cash',
          fulfillmentSelection: {
            mode: 'on_premise',
            destinationType: 'on_premise_location',
            destinationRef: 'loc-1',
          },
          idempotencyKey: expect.stringMatching(/^chk_/),
        })
      );
    });

    // Verify router redirected to confirmation
    expect(mockPush).toHaveBeenCalledWith('/demo-resort/restaurant/confirmation?type=order&id=tx-ord-999');

    // Verify ONLY restaurant items and restaurant fulfillment state were cleared; retail item remains!
    const remainingItems = useCartStore.getState().items;
    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0].id).toBe('gift-1');
    expect(remainingItems[0].moduleId).toBe('mod-retail');
    expect(useCartStore.getState().getFulfillmentForModule('mod-restaurant')).toBeUndefined();
  });
});
