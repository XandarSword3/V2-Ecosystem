import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: Record<string, string | undefined>, field: 'name' | 'description') =>
      item?.[field] || item?.[`${field}_ar`] || '',
  }),
}));

vi.mock('@/components/effects/GlowingBorder', () => ({
  SpotlightCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/effects/Card3D', () => ({
  FloatingCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/effects/TextEffects', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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

import { BookingService } from '../../src/components/modules/BookingService';

const moduleData = {
  id: 'mod-booking',
  slug: 'chalets',
  name: 'Chalet Stays',
  description: 'Stay with us',
  settings: {
    header_color: '#ff6b6b',
    accent_color: '#ee5a6f',
    depositPercent: 40,
  },
};

const unitsResponse = {
  data: {
    data: [
      {
        id: 'unit-1',
        name: 'Luxury Suite',
        description: 'Large suite with sea view',
        images: ['https://example.com/suite.jpg'],
        base_price: 500,
        capacity: 6,
        bedroom_count: 3,
        bathroom_count: 2,
        amenities: ['WiFi', 'AC', 'Parking'],
        is_featured: true,
      },
      {
        id: 'unit-2',
        name: 'Family Room',
        description: 'Comfortable stay',
        images: [],
        basePrice: 300,
        capacity: 4,
        bedroomCount: 2,
        bathroomCount: 1,
        amenities: ['Unknown Amenity'],
        isFeatured: false,
      },
    ],
  },
};

describe('BookingService behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    pushMock.mockReset();
  });

  it('renders loading and error states', () => {
    useQueryMock.mockReturnValueOnce({ data: null, isLoading: true, error: null });

    const { unmount } = render(<BookingService module={moduleData as any} />);
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();

    unmount();

    useQueryMock.mockReturnValueOnce({ data: null, isLoading: false, error: new Error('failed') });
    render(<BookingService module={moduleData as any} />);

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('tryAgainLater')).toBeInTheDocument();
  });

  it('renders units with featured badge, stats, amenities, and placeholder image fallback', () => {
    useQueryMock.mockReturnValue({ data: unitsResponse, isLoading: false, error: null });

    render(<BookingService module={moduleData as any} />);

    expect(screen.getByText('Luxury Suite')).toBeInTheDocument();
    expect(screen.getByText('Family Room')).toBeInTheDocument();
    expect(screen.getByText('Featured')).toBeInTheDocument();
    expect(screen.getByText('6 Guests')).toBeInTheDocument();
    expect(screen.getByText('3 Beds')).toBeInTheDocument();
    expect(screen.getByText('2 Baths')).toBeInTheDocument();
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Unknown Amenity')).toBeInTheDocument();
    expect(screen.getByAltText('Luxury Suite')).toBeInTheDocument();
  });

  it('shows price/deposit details and navigates from Book Now action', async () => {
    const user = userEvent.setup();

    useQueryMock.mockReturnValue({ data: unitsResponse, isLoading: false, error: null });

    render(<BookingService module={moduleData as any} />);

    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getAllByText('/ night').length).toBeGreaterThan(0);
    expect(screen.getAllByText('40% deposit required')[0]).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /booknow/i })[0]);
    expect(pushMock).toHaveBeenCalledWith('/chalets/unit-1?module=mod-booking');
  });

  it('renders empty-state card when no units are available', () => {
    useQueryMock.mockReturnValue({ data: { data: { data: [] } }, isLoading: false, error: null });

    render(<BookingService module={moduleData as any} />);

    expect(screen.getByText('No units available')).toBeInTheDocument();
    expect(screen.getByText('Please check back later for availability.')).toBeInTheDocument();
  });
});
