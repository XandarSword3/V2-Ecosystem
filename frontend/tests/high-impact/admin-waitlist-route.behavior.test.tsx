import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn());
const useQueryClientMock = vi.hoisted(() => vi.fn());

const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const addMutateSpy = vi.hoisted(() => vi.fn());
const updateMutateSpy = vi.hoisted(() => vi.fn());
const notifyMutateSpy = vi.hoisted(() => vi.fn());
const removeMutateSpy = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: useQueryClientMock,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'restaurant' }),
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [{ id: 'rest-1', slug: 'restaurant', name: 'Restaurant' }],
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/socket', () => ({
  useWaitlistUpdates: vi.fn(),
}));

import DynamicWaitlistPage from '../../src/app/admin/[slug]/waitlist/page';

const waitlistEntries = [
  {
    id: 'w1',
    guest_name: 'Amal Guest',
    party_size: 3,
    phone: '71001122',
    status: 'waiting',
    position: 1,
    estimated_wait: 15,
    created_at: '2026-08-02T18:00:00Z',
  },
  {
    id: 'w2',
    guest_name: 'Past Guest',
    party_size: 2,
    phone: '71112233',
    status: 'seated',
    position: 0,
    estimated_wait: 0,
    created_at: '2026-08-02T16:00:00Z',
  },
];

let waitlistState: typeof waitlistEntries = [];

describe('Admin waitlist route behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useQueryClientMock.mockReset();

    invalidateQueriesMock.mockReset();
    addMutateSpy.mockReset();
    updateMutateSpy.mockReset();
    notifyMutateSpy.mockReset();
    removeMutateSpy.mockReset();

    waitlistState = waitlistEntries.map((entry) => ({ ...entry }));

    useQueryClientMock.mockReturnValue({
      invalidateQueries: invalidateQueriesMock,
    });

    useQueryMock.mockImplementation(() => ({
      data: waitlistState,
      isLoading: false,
      refetch: vi.fn(),
    }));

    let mutationIndex = 0;
    useMutationMock.mockImplementation((options: { onSuccess?: () => void }) => {
      const currentIndex = mutationIndex % 4;
      mutationIndex += 1;
      const spy =
        currentIndex === 0
          ? addMutateSpy
          : currentIndex === 1
            ? updateMutateSpy
            : currentIndex === 2
              ? notifyMutateSpy
              : removeMutateSpy;

      return {
        isPending: false,
        mutate: (payload: unknown) => {
          if (currentIndex === 0) {
            const addPayload = payload as { name: string; phone: string; partySize: number; notes: string };
            const maxPosition = waitlistState.reduce((max, entry) => Math.max(max, entry.position), 0);
            waitlistState = [
              ...waitlistState,
              {
                id: 'w-new',
                guest_name: addPayload.name,
                party_size: addPayload.partySize,
                phone: addPayload.phone,
                status: 'waiting',
                position: maxPosition + 1,
                estimated_wait: 20,
                created_at: '2026-08-02T19:00:00Z',
              },
            ];
          }

          if (currentIndex === 1) {
            const updatePayload = payload as { id: string; status: string };
            waitlistState = waitlistState.map((entry) =>
              entry.id === updatePayload.id
                ? { ...entry, status: updatePayload.status as (typeof entry)['status'] }
                : entry
            );
          }

          if (currentIndex === 2) {
            const entryId = payload as string;
            waitlistState = waitlistState.map((entry) =>
              entry.id === entryId
                ? { ...entry, status: 'notified' }
                : entry
            );
          }

          if (currentIndex === 3) {
            const entryId = payload as string;
            waitlistState = waitlistState.filter((entry) => entry.id !== entryId);
          }

          spy(payload);
          options.onSuccess?.();
        },
      };
    });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('renders active guests and triggers notify and seat status actions', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DynamicWaitlistPage />);

    expect(screen.getByText('Active Waitlist')).toBeInTheDocument();
    expect(screen.getByText('Amal Guest')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Notify/i }));
    expect(notifyMutateSpy).toHaveBeenCalledWith('w1');

    rerender(<DynamicWaitlistPage />);
    expect(screen.getByText('notified')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Seat/i }));
    expect(updateMutateSpy).toHaveBeenCalledWith({ id: 'w1', status: 'seated' });

    rerender(<DynamicWaitlistPage />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No guests waiting')).toBeInTheDocument();
    expect(screen.getByText('Amal Guest')).toBeInTheDocument();
  });

  it('opens add guest modal and submits a new waitlist entry', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DynamicWaitlistPage />);

    await user.click(screen.getByRole('button', { name: /Add Guest/i }));

    const modal = screen.getByRole('heading', { name: 'Add to Waitlist' }).parentElement;
    expect(modal).not.toBeNull();

    const textInputs = within(modal as HTMLElement).getAllByRole('textbox');
    await user.type(textInputs[0], 'Rami Guest');
    await user.type(textInputs[1], '71990011');

    await user.click(within(modal as HTMLElement).getByRole('button', { name: 'Add' }));

    expect(addMutateSpy).toHaveBeenCalledWith({
      name: 'Rami Guest',
      phone: '71990011',
      partySize: 2,
      notes: '',
    });

    rerender(<DynamicWaitlistPage />);
    expect(screen.queryByRole('heading', { name: 'Add to Waitlist' })).not.toBeInTheDocument();
    expect(screen.getByText('Rami Guest')).toBeInTheDocument();
  });
});
