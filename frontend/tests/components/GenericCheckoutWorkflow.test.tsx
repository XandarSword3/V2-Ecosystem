import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import GenericCheckoutWorkflow from '@/components/checkout/GenericCheckoutWorkflow';
import type { CartItem } from '@/stores/cartStore';
import type { FulfillmentOption } from '@/lib/engine-a/types';
import type { ServiceLocationItem } from '@/components/customer/DestinationRequirementsEditor';
import type { PricingResult } from '@/hooks/usePricingPreview';

// Mocks
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      return ({ children, initial, animate, exit, variants, whileHover, whileTap, whileInView, transition, ...rest }: any) => {
        const Component = (prop as string) || 'div';
        return <Component {...rest}>{children}</Component>;
      };
    },
  }),
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'guest@example.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    post: vi.fn(),
  },
  paymentsApi: {
    createPaymentIntent: vi.fn(),
    recordCashPayment: vi.fn(),
    postRoomCharge: vi.fn(),
  },
}));

vi.mock('@/components/payments/StripePayment', () => ({
  default: ({ onSuccess, onError, onCancel, amount, currency }: any) => (
    <div data-testid="stripe-payment-mock">
      <span data-testid="stripe-amount">{amount} {currency}</span>
      <button data-testid="stripe-mock-success" onClick={onSuccess}>
        Simulate Stripe Success
      </button>
      <button data-testid="stripe-mock-error" onClick={() => onError('Card declined')}>
        Simulate Stripe Error
      </button>
      <button data-testid="stripe-mock-cancel" onClick={onCancel}>
        Simulate Stripe Cancel
      </button>
    </div>
  ),
}));

describe('GenericCheckoutWorkflow — 5-Step Workflow & Authoritative Payment (F6 Invariants)', () => {
  const mockItems: CartItem[] = [
    {
      id: 'item-1',
      name: 'Artisan Burger',
      price: 15.0,
      quantity: 2,
      selectedModifiers: [
        {
          optionId: 'opt-1',
          optionName: 'Extra Cheese',
          groupId: 'grp-1',
          groupName: 'Addons',
          modifierType: 'add',
          priceAdjustment: 2.0,
          quantity: 1,
        },
      ],
      modifierTotal: 2.0,
    },
  ];

  const mockFulfillmentOptions: FulfillmentOption[] = [
    { mode: 'on_premise', destinations: ['on_premise_location'] },
    { mode: 'pickup', destinations: ['pickup_location'] },
    { mode: 'local_delivery', destinations: ['address'] },
  ];

  const mockServiceLocations: ServiceLocationItem[] = [
    { id: 'loc-1', name: 'Table 4', is_active: true, is_occupied: false },
    { id: 'loc-2', name: 'Table 9', is_active: true, is_occupied: true },
  ];

  const mockServerPricing: PricingResult = {
    subtotal: 34.0,
    preDiscountTotal: 34.0,
    totalDiscount: 0,
    taxAmount: 3.4,
    taxBreakdown: [{ name: 'VAT', rate: 10, amount: 3.4 }],
    serviceCharge: 0,
    deliveryFee: 0,
    feeBreakdown: [],
    totalAmount: 37.4,
    currency: 'USD',
    discounts: [],
    breakdown: [
      { itemId: 'item-1', name: 'Artisan Burger', unitPrice: 17.0, lineTotal: 34.0, taxCategory: 'standard' },
    ],
    lineItems: [
      { itemId: 'item-1', name: 'Artisan Burger', quantity: 2, unitPrice: 17.0, lineTotal: 34.0 },
    ],
  };

  const defaultProps = {
    items: mockItems,
    onAddItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onClearItems: vi.fn(),
    getAuthoritativeLinePrice: vi.fn().mockReturnValue({
      unitPriceText: '$17.00 each',
      lineTotalText: '$34.00',
    }),
    customer: {
      name: 'John Doe',
      phone: '+1 555 123 4567',
      email: 'john@example.com',
      notes: 'No onions please',
    },
    onChangeCustomer: vi.fn(),
    fulfillment: {
      mode: 'on_premise' as const,
      destinationType: 'on_premise_location' as const,
      destinationRef: 'loc-1',
    },
    fulfillmentOptions: mockFulfillmentOptions,
    serviceLocations: mockServiceLocations,
    onChangeFulfillmentMode: vi.fn(),
    onChangeDestination: vi.fn(),
    serverPricing: mockServerPricing,
    currency: 'USD',
    isPricingStale: false,
    isLoadingPricing: false,
    isPricingError: false,
    couponCode: null,
    giftCardCodes: [],
    loyaltyPoints: 0,
    onCouponChange: vi.fn(),
    onAddGiftCard: vi.fn(),
    onRemoveGiftCard: vi.fn(),
    onLoyaltyPointsChange: vi.fn(),
    createOrder: vi.fn().mockResolvedValue({ id: 'ord-authoritative-999' }),
    propertySlug: 'resort-grand',
    moduleSlug: 'dining-room',
    moduleName: 'The Grand Dining Room',
    moduleId: 'mod-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 (Review) initially with line items, modifiers, and authoritative line prices', () => {
    render(<GenericCheckoutWorkflow {...defaultProps} />);

    expect(screen.getByText('Review Your Cart')).toBeDefined();
    expect(screen.getByText('Artisan Burger')).toBeDefined();
    expect(screen.getByText(/\+.*Extra Cheese/i)).toBeDefined();
    expect(screen.getByText('$34.00')).toBeDefined();
    expect(screen.getByRole('button', { name: /Continue to Customer Details/i })).toBeDefined();
  });

  it('step advancement gating: cannot skip Customer or Fulfillment step by directly clicking step header', async () => {
    const { toast } = await import('sonner');
    render(
      <GenericCheckoutWorkflow
        {...defaultProps}
        customer={{ name: '', phone: '', email: '', notes: '' }} // invalid customer
      />
    );

    // Try clicking Step 4 (Payment) directly from Step 1
    const paymentStepBtn = screen.getByRole('button', { name: /Payment/i });
    fireEvent.click(paymentStepBtn);

    // Should be rejected by canAdvanceTo gate
    expect(toast.error).toHaveBeenCalledWith('Please enter your name and phone number.');
    // Active step remains Review
    expect(screen.getByText('Review Your Cart')).toBeDefined();
  });

  it('validates Customer step: cannot advance to Fulfillment if name or phone is empty', () => {
    const { rerender } = render(
      <GenericCheckoutWorkflow
        {...defaultProps}
        customer={{ name: '', phone: '', email: '', notes: '' }}
      />
    );

    // Advance to Customer step
    fireEvent.click(screen.getByRole('button', { name: /Continue to Customer Details/i }));
    expect(screen.getByText('Customer Details')).toBeDefined();

    // Continue to Fulfillment button should be disabled
    const continueBtn = screen.getByRole('button', { name: /Continue to Fulfillment/i });
    expect(continueBtn).toHaveProperty('disabled', true);

    // Update customer with name and phone
    rerender(
      <GenericCheckoutWorkflow
        {...defaultProps}
        customer={{ name: 'Jane Doe', phone: '+1 234 5678', email: '', notes: '' }}
      />
    );

    const updatedContinueBtn = screen.getByRole('button', { name: /Continue to Fulfillment/i });
    expect(updatedContinueBtn).toHaveProperty('disabled', false);
  });

  it('pricing staleness gate: changing fulfillment blocks advancing to Payment until authoritative pricing arrives', () => {
    render(
      <GenericCheckoutWorkflow
        {...defaultProps}
        isPricingStale={true} // Pricing recalculating
      />
    );

    // Advance to Customer step
    fireEvent.click(screen.getByRole('button', { name: /Continue to Customer Details/i }));

    // Advance to Fulfillment step
    fireEvent.click(screen.getByRole('button', { name: /Continue to Fulfillment/i }));
    expect(screen.getByText('Fulfillment Selection')).toBeDefined();

    // Gating check: button shows recalculating and is disabled
    const continueBtn = screen.getByRole('button', { name: /Recalculating Pricing.../i });
    expect(continueBtn).toHaveProperty('disabled', true);

    // Staleness warning alert is shown
    expect(screen.getByText(/Updating delivery pricing based on your fulfillment selection/i)).toBeDefined();
  });

  it('authoritative payment step: displays server totals and allows cash order completion', async () => {
    const onOrderConfirmed = vi.fn();
    render(
      <GenericCheckoutWorkflow
        {...defaultProps}
        onOrderConfirmed={onOrderConfirmed}
      />
    );

    // Navigate 1 -> 2 -> 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /Continue to Customer Details/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Fulfillment/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Payment/i }));

    expect(screen.getByText('Payment & Discounts')).toBeDefined();
    // Authoritative total from server is rendered
    expect(screen.getByText('$37.40')).toBeDefined();

    // Place cash order
    const placeOrderBtn = screen.getByRole('button', { name: /Place Order • \$37.40/i });
    fireEvent.click(placeOrderBtn);

    await waitFor(() => {
      expect(defaultProps.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'John Doe',
          customerPhone: '+1 555 123 4567',
          paymentMethod: 'cash',
          previewTotal: 37.4,
        })
      );
      expect(onOrderConfirmed).toHaveBeenCalledWith('ord-authoritative-999');
      // Step 5 (Confirmation) is rendered
      expect(screen.getByText('Order Confirmed!')).toBeDefined();
      expect(screen.getByText(/Reference ID: ord-authoritative-999/i)).toBeDefined();
    });
  });

  it('payment cancellation invariant: cancelling Stripe card payment does NOT confirm order and keeps order details intact', async () => {
    const { paymentsApi } = await import('@/lib/api');
    (paymentsApi.createPaymentIntent as any).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          clientSecret: 'pi_test_secret_123',
          paymentIntentId: 'pi_test_id',
        },
      },
    });

    const onOrderConfirmed = vi.fn();
    render(
      <GenericCheckoutWorkflow
        {...defaultProps}
        onOrderConfirmed={onOrderConfirmed}
      />
    );

    // Navigate to payment
    fireEvent.click(screen.getByRole('button', { name: /Continue to Customer Details/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Fulfillment/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Payment/i }));

    // Select card payment method
    const cardMethodBtn = screen.getByRole('button', { name: /Pay with Card/i });
    fireEvent.click(cardMethodBtn);

    // Submit order to launch Stripe
    const placeOrderBtn = screen.getByRole('button', { name: /Place Order • \$37.40/i });
    fireEvent.click(placeOrderBtn);

    // Wait for Stripe adapter modal to mount
    await waitFor(() => {
      expect(screen.getByTestId('stripe-payment-mock')).toBeDefined();
    });

    // Simulate user cancelling card payment
    fireEvent.click(screen.getByTestId('stripe-mock-cancel'));

    // Invariant check:
    // 1. Order confirmed is NOT called
    expect(onOrderConfirmed).not.toHaveBeenCalled();
    // 2. User is still on Payment step (NOT Confirmation step)
    expect(screen.queryByText('Order Confirmed!')).toBeNull();
    // 3. Informational cancellation notice is displayed
    expect(screen.getByText(/Payment was cancelled. Your order details are saved/i)).toBeDefined();
  });

  it('multi-currency consistency: handles non-USD currencies (e.g. KWD 3 decimals)', () => {
    const kwdPricing: PricingResult = {
      ...mockServerPricing,
      subtotal: 12.5,
      taxAmount: 0,
      totalAmount: 12.5,
      currency: 'KWD',
    };

    render(
      <GenericCheckoutWorkflow
        {...defaultProps}
        serverPricing={kwdPricing}
        currency="KWD"
      />
    );

    // Navigate to payment step
    fireEvent.click(screen.getByRole('button', { name: /Continue to Customer Details/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Fulfillment/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Payment/i }));

    // Expect KWD formatting (e.g. KWD 12.500 or KD 12.500)
    expect(screen.getByRole('button', { name: /Place Order • (KWD|KD)\s*12\.500/i })).toBeDefined();
  });
});
