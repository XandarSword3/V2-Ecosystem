import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@/lib/api', () => ({
  chaletsApi: {
    getChalets: vi.fn(),
  },
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: { currency: string }) => unknown) =>
    selector({ currency: 'USD' }),
  exchangeRates: {
    USD: 1,
    LBP: 90000,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
  },
  currencySymbols: {
    USD: '$',
    LBP: 'L.L',
    EUR: 'EUR',
    GBP: 'GBP',
    AED: 'AED',
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    settings: { depositPercent: 40 },
    modules: [{ id: 'mod-chalets', slug: 'chalets' }],
  }),
}));

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: Record<string, string | undefined>, field: 'name' | 'description') =>
      item?.[field] || item?.[`${field}_ar`] || '',
    isRTL: false,
  }),
}));

vi.mock('@/components/effects/AuroraBackground', () => ({
  AuroraSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/effects/Card3D', () => ({
  Card3D: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TiltCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FloatingCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/effects/GlowingBorder', () => ({
  SpotlightCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/effects/TextEffects', () => ({
  GradientText: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  RevealHeading: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/components/effects/AnimatedCounter', () => ({
  AnimatedCounter: ({ value, suffix }: { value: number; suffix?: string }) => (
    <span>
      {value}
      {suffix || ''}
    </span>
  ),
}));

import ChaletsPage from '../../src/app/chalets/page';

const chaletsResponse = {
  data: {
    data: [
      {
        id: 'chalet-1',
        name: 'Cedar Suite',
        description: 'Panoramic mountain view',
        capacity: 6,
        bedroom_count: 3,
        bathroom_count: 2,
        amenities: ['WiFi', 'Kitchen', 'Parking', 'AC', 'Jacuzzi'],
        images: ['https://example.com/chalet.jpg'],
        base_price: 500,
        weekend_price: 650,
        is_featured: true,
      },
      {
        id: 'chalet-2',
        name: 'Family Retreat',
        description: 'Great for long stays',
        capacity: 4,
        bedroomCount: 2,
        bathroomCount: 1,
        amenities: ['WiFi'],
        images: [],
        basePrice: 300,
        weekendPrice: 420,
      },
    ],
  },
};

describe('ChaletsPage behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it('renders loading and error states', () => {
    useQueryMock.mockReturnValueOnce({ data: null, isLoading: true, error: null });

    const { unmount } = render(<ChaletsPage />);
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();

    unmount();

    useQueryMock.mockReturnValueOnce({ data: null, isLoading: false, error: new Error('fetch failed') });
    render(<ChaletsPage />);

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('tryAgainLater')).toBeInTheDocument();
  });

  it('renders chalet cards with featured badge, amenities, pricing, and booking links', async () => {
    const user = userEvent.setup();

    useQueryMock.mockReturnValue({ data: chaletsResponse, isLoading: false, error: null });

    render(<ChaletsPage />);

    expect(screen.getByText('Cedar Suite')).toBeInTheDocument();
    expect(screen.getByText('Family Retreat')).toBeInTheDocument();
    expect(screen.getByText('featured')).toBeInTheDocument();
    expect(screen.getAllByText('WiFi').length).toBeGreaterThan(0);
    expect(screen.getByText('+1 andMore')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$650.00')).toBeInTheDocument();

    const detailsLink = screen.getAllByRole('link', { name: /viewDetailsBook/i })[0];
    expect(detailsLink).toHaveAttribute('href', '/chalets/chalet-1');

    await user.click(detailsLink);
  });

  it('shows empty-state fallback when there are no chalets', () => {
    useQueryMock.mockReturnValue({ data: { data: { data: [] } }, isLoading: false, error: null });

    render(<ChaletsPage />);

    expect(screen.getByText('noChaletsAvailable')).toBeInTheDocument();
    expect(screen.getByText('checkBackLater')).toBeInTheDocument();
  });
});
