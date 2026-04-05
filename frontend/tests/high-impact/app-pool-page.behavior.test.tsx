import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn());
const mutateSpy = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const authState = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
}));

vi.mock('@/lib/api', () => ({
  poolApi: {
    getAvailability: vi.fn(),
    getMyTickets: vi.fn(),
    purchaseTicket: vi.fn(),
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
    settings: {
      poolName: 'Blue Lagoon',
    },
    modules: [{ id: 'pool-mod', slug: 'pool' }],
  }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/socket', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: Record<string, string | undefined>, field: 'name' | 'description') =>
      item?.[field] || item?.[`${field}_ar`] || '',
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/components/effects/Card3D', () => ({
  Card3D: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

import PoolPage from '../../src/app/pool/page';

const availabilityResponse = {
  data: {
    data: [
      {
        id: 'pool-session-1',
        name: 'Morning Splash',
        startTime: '08:00',
        endTime: '10:00',
        maxCapacity: 30,
        adult_price: 40,
        child_price: 20,
        availability: { remaining: 12 },
      },
      {
        id: 'pool-session-2',
        name: 'Sunset Swim',
        startTime: '18:00',
        endTime: '20:00',
        maxCapacity: 25,
        adult_price: 45,
        child_price: 25,
        available: 0,
        isSoldOut: true,
      },
    ],
  },
};

const tickets = Array.from({ length: 7 }).map((_, index) => ({
  id: `ticket-${index + 1}`,
  ticket_number: `POOL-${100 + index}`,
  status: index % 2 === 0 ? 'valid' : 'used',
  ticket_date: '2026-07-15',
  number_of_guests: 2,
  total_amount: 80,
}));

describe('PoolPage behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    mutateSpy.mockReset();
    pushMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    authState.user = { id: 'user-1' };

    useQueryMock.mockImplementation(({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => {
      if (queryKey[0] === 'pool-availability') {
        return { data: availabilityResponse, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'my-pool-tickets') {
        if (enabled === false) {
          return { data: undefined, isLoading: false, error: null };
        }
        return { data: { data: { data: tickets } }, isLoading: false, error: null };
      }
      return { data: null, isLoading: false, error: null };
    });

    useMutationMock.mockImplementation((options: { onSuccess?: (response: any) => void }) => ({
      isPending: false,
      mutate: (payload: unknown) => {
        mutateSpy(payload);
        options.onSuccess?.({ data: { data: { id: 'ticket-321' } } });
      },
    }));
  });

  it('renders loading state for availability query', () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'pool-availability') {
        return { data: null, isLoading: true, error: null, refetch: vi.fn() };
      }
      return { data: null, isLoading: false, error: null };
    });

    render(<PoolPage />);
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();
  });

  it('renders sessions, blocks sold-out selection, and opens booking form for available sessions', async () => {
    const user = userEvent.setup();

    render(<PoolPage />);

    expect(screen.getByText('soldOut')).toBeInTheDocument();

    await user.click(screen.getByText('Sunset Swim'));
    expect(screen.getByText('selectSessionToContinue')).toBeInTheDocument();

    await user.click(screen.getByText('Morning Splash'));
    expect(screen.getByPlaceholderText('enterYourName')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('enterPhoneNumber')).toBeInTheDocument();
  });

  it('validates contact info and submits bookings with guest counts', async () => {
    const user = userEvent.setup();

    render(<PoolPage />);

    await user.click(screen.getByText('Morning Splash'));
    await user.click(screen.getByRole('button', { name: /purchaseTickets/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('fillContactInfo');
    expect(mutateSpy).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('enterYourName'), 'Maya');
    await user.type(screen.getByPlaceholderText('enterPhoneNumber'), '76112233');

    const countInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(countInputs[0], { target: { value: '2' } });
    fireEvent.change(countInputs[1], { target: { value: '1' } });

    await user.click(screen.getByRole('button', { name: /purchaseTickets/i }));

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'pool-session-1',
          customerName: 'Maya',
          customerPhone: '76112233',
          numberOfAdults: 2,
          numberOfChildren: 1,
          numberOfGuests: 3,
          paymentMethod: 'cash',
          ticketDate: expect.any(String),
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('ticketPurchased');
    expect(pushMock).toHaveBeenCalledWith('/pool/confirmation?id=ticket-321');
  });

  it('shows tickets section and empty-session fallback state', () => {
    const { rerender } = render(<PoolPage />);

    expect(screen.getByText('yourTickets')).toBeInTheDocument();
    expect(screen.getByText(/viewAllTickets/i)).toBeInTheDocument();

    useQueryMock.mockImplementation(({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => {
      if (queryKey[0] === 'pool-availability') {
        return { data: { data: { data: [] } }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'my-pool-tickets') {
        if (enabled === false) {
          return { data: undefined, isLoading: false, error: null };
        }
        return { data: { data: { data: tickets } }, isLoading: false, error: null };
      }
      return { data: null, isLoading: false, error: null };
    });

    rerender(<PoolPage />);

    expect(screen.getByText('noSessionsAvailable')).toBeInTheDocument();
    expect(screen.getByText('selectDifferentDate')).toBeInTheDocument();
  });
});
