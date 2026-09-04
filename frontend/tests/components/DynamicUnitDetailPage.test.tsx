import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DynamicUnitDetailPage from '@/app/[property]/[slug]/[unitId]/page';

const mockGet = vi.fn();
const mockPost = vi.fn();

let mockPricingState: {
  pricing: any;
  isLoading: boolean;
  isStale: boolean;
  isError: boolean;
  error: string | null;
} = {
  pricing: null,
  isLoading: false,
  isStale: false,
  isError: false,
  error: null,
};

vi.mock('@/hooks/usePricingPreview', () => ({
  usePricingPreview: () => ({
    ...mockPricingState,
    refetch: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ property: 'resort-main', slug: 'villas', unitId: 'unit-villa-101' }),
  useSearchParams: () => new URLSearchParams('module=mod-villas-1'),
  usePathname: () => '/resort-main/villas/unit-villa-101',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: any, field?: string) =>
      typeof item === 'object' && field ? item[field] || '' : (item || ''),
  }),
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [
      {
        id: 'mod-villas-1',
        slug: 'villas',
        name: 'Luxury Beach Villas',
        engine_type: 'time_exclusive_reservation',
        template_type: 'time_exclusive_reservation',
      },
    ],
    loading: false,
  }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'usr-guest-1', email: 'guest@example.com', fullName: 'Alice Guest' },
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
  return { __esModule: true, default: instance, api: instance };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/components/payments/StripePayment', () => ({
  default: ({ amount, currency }: { amount: number; currency: string }) => (
    <div data-testid="stripe-payment-modal">
      <span data-testid="stripe-payment-amount">{amount}</span>
      <span data-testid="stripe-payment-currency">{currency}</span>
    </div>
  ),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DynamicUnitDetailPage — F5 Server Pricing Authority & Money Integrity', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPricingState = {
      pricing: null,
      isLoading: false,
      isStale: false,
      isError: false,
      error: null,
    };

    mockGet.mockImplementation(async (url: string) => {
      if (url.includes('/units/unit-villa-101')) {
        return {
          data: {
            success: true,
            data: {
              id: 'unit-villa-101',
              name: 'Oceanfront Villa 101',
              base_price: 300.0,
              weekend_price: 350.0,
              capacity: 4,
              bedroom_count: 2,
              bathroom_count: 2,
              amenities: ['WiFi', 'AC', 'Kitchen'],
              is_active: true,
            },
          },
        };
      }
      if (url.includes('/addons')) {
        return { data: { success: true, data: [] } };
      }
      if (url.includes('/availability')) {
        return { data: { success: true, data: { blockedDates: [] } } };
      }
      return { data: { success: true, data: {} } };
    });
  });

  it('disables submit button when server pricing is unavailable (F5: no fallback)', async () => {
    renderWithProviders(<DynamicUnitDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Oceanfront Villa 101')).toBeDefined();
    });

    // Before dates are selected, pricing is null, button must be disabled
    const submitButton = screen.getByRole('button', { name: /book now|calculating|pricing/i });
    expect(submitButton).toBeDefined();
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('does NOT contain calculatePricing — F5 invariant: zero client pricing', async () => {
    const pageModule = await import('@/app/[property]/[slug]/[unitId]/page');
    const source = pageModule.default.toString();
    expect(source).not.toContain('calculatePricing');
  });

  it('does NOT contain client deposit arithmetic (* 0.3 or 30%) or hardcoded USD', async () => {
    const pageModule = await import('@/app/[property]/[slug]/[unitId]/page');
    const source = pageModule.default.toString();
    // Regression check: no client deposit math (* 0.3 or 30%)
    expect(source).not.toContain('* 0.3');
    expect(source).not.toContain('30%');
    // Regression check: no hardcoded currency="USD" in StripePayment
    expect(source).not.toContain('currency="USD"');
  });

  it('regression: client totalAmount changes do NOT manufacture a client deposit when depositAmount is undefined', async () => {
    mockPricingState.pricing = {
      subtotal: 1000.0,
      taxAmount: 100.0,
      taxBreakdown: [],
      feeBreakdown: [],
      serviceCharge: 0,
      deliveryFee: 0,
      totalDiscount: 0,
      discounts: [],
      totalAmount: 1000.0,
      currency: 'USD',
      depositAmount: undefined, // Server specifies no deposit
    };

    renderWithProviders(<DynamicUnitDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Oceanfront Villa 101')).toBeDefined();
    });

    // Select valid dates to trigger pricing summary view
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-10-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-10-05' } });

    await waitFor(() => {
      expect(screen.getByText(/Book Now •/i)).toBeDefined();
    });

    // Verify NO deposit text is manufactured
    expect(screen.queryByText(/Deposit:/i)).toBeNull();
    expect(screen.queryByText(/30%/i)).toBeNull();

    // Now change totalAmount to 2000.0 (depositAmount remains undefined)
    mockPricingState.pricing = {
      ...mockPricingState.pricing,
      totalAmount: 2000.0,
      subtotal: 2000.0,
    };

    // Trigger re-evaluation
    fireEvent.change(dateInputs[1], { target: { value: '2026-10-06' } });

    await waitFor(() => {
      expect(screen.getByText(/Book Now •/i)).toBeDefined();
    });

    // Verify still NO deposit text is manufactured despite totalAmount changing
    expect(screen.queryByText(/Deposit:/i)).toBeNull();
    expect(screen.queryByText(/30%/i)).toBeNull();
  });

  it('renders deposit ONLY when server explicitly provides depositAmount', async () => {
    mockPricingState.pricing = {
      subtotal: 1000.0,
      taxAmount: 100.0,
      taxBreakdown: [],
      feeBreakdown: [],
      serviceCharge: 0,
      deliveryFee: 0,
      totalDiscount: 0,
      discounts: [],
      totalAmount: 1100.0,
      currency: 'USD',
      depositAmount: 250.0, // Authoritative deposit from backend PricingResult
    };

    renderWithProviders(<DynamicUnitDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Oceanfront Villa 101')).toBeDefined();
    });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-10-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-10-05' } });

    await waitFor(() => {
      expect(screen.getByText(/Deposit: \$250\.00/i)).toBeDefined();
    });
    // Ensure no hardcoded percentage is shown
    expect(screen.queryByText(/30%/i)).toBeNull();
  });

  it('regression: propagates 3-decimal currency (KWD) to UI and StripePayment without USD hardcoding', async () => {
    mockPricingState.pricing = {
      subtotal: 150.25,
      taxAmount: 0,
      taxBreakdown: [],
      feeBreakdown: [],
      serviceCharge: 0,
      deliveryFee: 0,
      totalDiscount: 0,
      discounts: [],
      totalAmount: 150.25,
      currency: 'KWD', // 3-decimal currency
      depositAmount: 50.0,
    };

    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'booking-kwd-123' },
      },
    });

    renderWithProviders(<DynamicUnitDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Oceanfront Villa 101')).toBeDefined();
    });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-10-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-10-03' } });

    // Verify display currency uses KWD
    await waitFor(() => {
      expect(screen.getByText(/Book Now •/)).toBeDefined();
    });

    // Switch payment method to Card
    const cardButton = screen.getByRole('button', { name: /Pay with Card/i });
    fireEvent.click(cardButton);

    // Fill required customer details
    const phoneInput = screen.getByPlaceholderText(/Phone Number \*/i);
    fireEvent.change(phoneInput, { target: { value: '+96512345678' } });

    // Submit booking to trigger StripePayment modal
    const submitButton = screen.getByRole('button', { name: /Book Now •/i });
    fireEvent.click(submitButton);

    // Verify StripePayment receives exact server currency KWD (not hardcoded USD)
    await waitFor(() => {
      expect(screen.getByTestId('stripe-payment-modal')).toBeDefined();
      expect(screen.getByTestId('stripe-payment-currency').textContent).toBe('KWD');
      expect(screen.getByTestId('stripe-payment-amount').textContent).toBe('150.25');
    });
  });

  it('regression: propagates 3-decimal currency (BHD) to UI and StripePayment', async () => {
    mockPricingState.pricing = {
      subtotal: 75.5,
      taxAmount: 0,
      taxBreakdown: [],
      feeBreakdown: [],
      serviceCharge: 0,
      deliveryFee: 0,
      totalDiscount: 0,
      discounts: [],
      totalAmount: 75.5,
      currency: 'BHD', // 3-decimal currency
    };

    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'booking-bhd-456' },
      },
    });

    renderWithProviders(<DynamicUnitDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Oceanfront Villa 101')).toBeDefined();
    });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-10-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-10-03' } });

    const cardButton = screen.getByRole('button', { name: /Pay with Card/i });
    fireEvent.click(cardButton);

    const phoneInput = screen.getByPlaceholderText(/Phone Number \*/i);
    fireEvent.change(phoneInput, { target: { value: '+97312345678' } });

    const submitButton = screen.getByRole('button', { name: /Book Now •/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('stripe-payment-modal')).toBeDefined();
      expect(screen.getByTestId('stripe-payment-currency').textContent).toBe('BHD');
      expect(screen.getByTestId('stripe-payment-amount').textContent).toBe('75.5');
    });
  });
});
