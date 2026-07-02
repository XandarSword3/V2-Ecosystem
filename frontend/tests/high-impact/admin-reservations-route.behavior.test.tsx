import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn());
const useQueryClientMock = vi.hoisted(() => vi.fn());

const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const updateMutateSpy = vi.hoisted(() => vi.fn());
const assignMutateSpy = vi.hoisted(() => vi.fn());
const createMutateSpy = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: useQueryClientMock,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'menu_service' }),
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [{ id: 'rest-1', slug: 'menu_service', name: 'MenuService' }],
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import DynamicReservationsPage from '../../src/app/[property]/admin/[slug]/reservations/page';

const reservations = [
  {
    id: 'res-1',
    date: '2026-08-05',
    time: '19:00',
    party_size: 4,
    guest_name: 'Nora Guest',
    guest_email: 'nora@example.com',
    guest_phone: '71554433',
    status: 'pending',
    created_at: '2026-08-01T12:00:00Z',
  },
];

const tables = [
  {
    id: 'table-1',
    table_number: '1',
    capacity: 6,
    status: 'available',
    location: 'Terrace',
  },
];

let reservationsState: typeof reservations = [];
let tablesState: typeof tables = [];

describe('Admin reservations route behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useQueryClientMock.mockReset();

    invalidateQueriesMock.mockReset();
    updateMutateSpy.mockReset();
    assignMutateSpy.mockReset();
    createMutateSpy.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    reservationsState = reservations.map((reservation) => ({ ...reservation }));
    tablesState = tables.map((table) => ({ ...table }));

    useQueryClientMock.mockReturnValue({
      invalidateQueries: invalidateQueriesMock,
    });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'reservations') {
        return { data: reservationsState, isLoading: false };
      }
      if (queryKey[0] === 'tables') {
        return { data: tablesState, isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    let mutationIndex = 0;
    useMutationMock.mockImplementation((options: { onSuccess?: () => void }) => {
      const currentIndex = mutationIndex % 3;
      mutationIndex += 1;
      const spy = currentIndex === 0 ? updateMutateSpy : currentIndex === 1 ? assignMutateSpy : createMutateSpy;

      return {
        isPending: false,
        mutate: (payload: unknown) => {
          if (currentIndex === 0) {
            const updatePayload = payload as { id: string; status: string };
            reservationsState = reservationsState.map((reservation) =>
              reservation.id === updatePayload.id
                ? { ...reservation, status: updatePayload.status as (typeof reservation)['status'] }
                : reservation
            );
          }

          if (currentIndex === 1) {
            const assignPayload = payload as { reservationId: string; tableId: string };
            const selectedTable = tablesState.find((table) => table.id === assignPayload.tableId);
            reservationsState = reservationsState.map((reservation) =>
              reservation.id === assignPayload.reservationId
                ? { ...reservation, table_number: selectedTable?.table_number }
                : reservation
            );
          }

          if (currentIndex === 2) {
            const createPayload = payload as {
              guest_name: string;
              guest_email: string;
              guest_phone: string;
              date: string;
              time: string;
              party_size: number;
              special_requests: string;
            };

            reservationsState = [
              ...reservationsState,
              {
                id: 'res-created',
                date: createPayload.date,
                time: createPayload.time,
                party_size: createPayload.party_size,
                guest_name: createPayload.guest_name,
                guest_email: createPayload.guest_email,
                guest_phone: createPayload.guest_phone,
                status: 'pending',
                created_at: '2026-08-01T15:00:00Z',
              },
            ];
          }

          spy(payload);
          options.onSuccess?.();
        },
      };
    });
  });

  it('renders reservations, confirms entries, and assigns available tables', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DynamicReservationsPage />);

    expect(screen.getByText('MenuService Reservations')).toBeInTheDocument();
    expect(screen.getByText('Nora Guest')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(updateMutateSpy).toHaveBeenCalledWith({ id: 'res-1', status: 'confirmed' });

    rerender(<DynamicReservationsPage />);
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Seat/i }));
    expect(screen.getByText('Assign Table')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Table 1/ }));
    expect(assignMutateSpy).toHaveBeenCalledWith({ reservationId: 'res-1', tableId: 'table-1' });

    rerender(<DynamicReservationsPage />);
    expect(screen.queryByText('Assign Table')).not.toBeInTheDocument();
    expect(screen.getByText('Table 1')).toBeInTheDocument();
  });

  it('shows a validation toast when creating a reservation without required fields', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DynamicReservationsPage />);

    await user.click(screen.getByRole('button', { name: /New Reservation/i }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(toastErrorMock).toHaveBeenCalledWith('Please fill in required fields');
    expect(createMutateSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'Mila' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(createMutateSpy).toHaveBeenCalled();

    rerender(<DynamicReservationsPage />);
    expect(screen.queryByRole('heading', { name: 'New Reservation' })).not.toBeInTheDocument();
    expect(screen.getByText('Mila')).toBeInTheDocument();
  });
});
