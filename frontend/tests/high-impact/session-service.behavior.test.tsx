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

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
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
  FloatingCard: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
}));

vi.mock('@/components/effects/TextEffects', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  RevealHeading: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/components/effects/AnimatedCounter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

import { SessionService } from '../../src/components/modules/SessionService';

const moduleData = {
  id: 'mod-pool',
  slug: 'pool',
  name: 'Pool Sessions',
  description: 'Daily sessions',
  settings: {
    header_color: '#0891b2',
    accent_color: '#1d4ed8',
  },
};

const availabilityResponse = {
  data: {
    data: [
      {
        id: 'session-1',
        name: 'Morning Swim',
        start_time: '08:00',
        end_time: '10:00',
        adult_price: 50,
        child_price: 25,
        available: 12,
        capacity: 20,
        gender: 'mixed',
      },
      {
        id: 'session-2',
        name: 'Evening Women Session',
        start_time: '18:00',
        end_time: '20:00',
        adult_price: 60,
        child_price: 30,
        available: 0,
        capacity: 20,
        gender: 'female',
        isSoldOut: true,
      },
    ],
  },
};

const ticketRows = Array.from({ length: 7 }).map((_, index) => ({
  id: `ticket-${index + 1}`,
  ticket_number: `PK-${1000 + index}`,
  status: index % 2 === 0 ? 'valid' : 'used',
  ticket_date: '2026-07-12',
  number_of_guests: 2,
  total_amount: 100,
}));

describe('SessionService behavior', () => {
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
        return { data: availabilityResponse, isLoading: false, error: null };
      }
      if (queryKey[0] === 'my-pool-tickets') {
        if (enabled === false) {
          return { data: undefined, isLoading: false, error: null };
        }
        return { data: { data: { data: ticketRows } }, isLoading: false, error: null };
      }
      return { data: null, isLoading: false, error: null };
    });

    useMutationMock.mockImplementation((options: { onSuccess?: (response: any) => void }) => ({
      isPending: false,
      mutate: (payload: unknown) => {
        mutateSpy(payload);
        options.onSuccess?.({ data: { data: { id: 'ticket-123' } } });
      },
    }));
  });

  it('renders loading and error states for availability query', () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'pool-availability') {
        return { data: null, isLoading: true, error: null };
      }
      return { data: null, isLoading: false, error: null };
    });

    const { unmount } = render(<SessionService module={moduleData as any} />);
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();

    unmount();

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'pool-availability') {
        return { data: null, isLoading: false, error: new Error('availability failed') };
      }
      return { data: null, isLoading: false, error: null };
    });

    render(<SessionService module={moduleData as any} />);
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('prevents selecting sold-out sessions and shows booking form for available sessions', async () => {
    const user = userEvent.setup();

    render(<SessionService module={moduleData as any} />);

    expect(screen.getByText('soldOut')).toBeInTheDocument();
    expect(screen.getByText('gender.female')).toBeInTheDocument();

    await user.click(screen.getByText('Evening Women Session'));
    expect(screen.getByText('selectSessionToContinue')).toBeInTheDocument();

    await user.click(screen.getByText('Morning Swim'));
    expect(screen.getByPlaceholderText('enterName')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('enterPhone')).toBeInTheDocument();
    expect(screen.getAllByText('Morning Swim').length).toBeGreaterThan(0);
  });

  it('validates contact fields before purchasing tickets', async () => {
    const user = userEvent.setup();

    render(<SessionService module={moduleData as any} />);

    await user.click(screen.getByText('Morning Swim'));
    await user.click(screen.getByRole('button', { name: /purchasetickets/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('fillContactInfo');
    expect(mutateSpy).not.toHaveBeenCalled();
  });

  it('submits ticket purchase, calls mutation with counts, and redirects on success', async () => {
    const user = userEvent.setup();

    render(<SessionService module={moduleData as any} />);

    await user.click(screen.getByText('Morning Swim'));

    await user.type(screen.getByPlaceholderText('enterName'), 'Alex Tester');
    await user.type(screen.getByPlaceholderText('enterPhone'), '70123456');

    const countInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(countInputs[0], { target: { value: '2' } });
    fireEvent.change(countInputs[1], { target: { value: '1' } });

    await user.click(screen.getByRole('button', { name: /purchasetickets/i }));

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          customerName: 'Alex Tester',
          customerPhone: '70123456',
          numberOfAdults: 2,
          numberOfChildren: 1,
          numberOfGuests: 3,
          paymentMethod: 'cash',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('ticketPurchased');
    expect(pushMock).toHaveBeenCalledWith('/pool/confirmation?id=ticket-123');
  });

  it('renders user tickets section with view-all link when tickets exceed six', () => {
    render(<SessionService module={moduleData as any} />);

    expect(screen.getByText('yourTickets')).toBeInTheDocument();
    expect(screen.getByText(/viewAllTickets/i)).toBeInTheDocument();
  });
});
