import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DynamicUnitDetailPage from '@/app/[property]/[slug]/[unitId]/page';

const mockGet = vi.fn();
const mockPost = vi.fn();

// Mock usePricingPreview to return null pricing (no dates selected)
vi.mock('@/hooks/usePricingPreview', () => ({
  usePricingPreview: () => ({
    pricing: null,
    isLoading: false,
    isStale: false,
    isError: false,
    error: null,
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
  default: ({ amount }: { amount: number }) => (
    <div data-testid="stripe-payment-modal">Stripe Amount: {amount}</div>
  ),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DynamicUnitDetailPage — F5 Server Pricing Authority', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();

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
    // Static code analysis: page component must not contain calculatePricing
    const pageModule = await import('@/app/[property]/[slug]/[unitId]/page');
    const source = pageModule.default.toString();
    expect(source).not.toContain('calculatePricing');
  });

  it('uses usePricingPreview for authoritative pricing (import check)', async () => {
    // The page module should import and call usePricingPreview
    const pageModule = await import('@/app/[property]/[slug]/[unitId]/page');
    const source = pageModule.default.toString();
    expect(source).toContain('usePricingPreview');
  });
});
