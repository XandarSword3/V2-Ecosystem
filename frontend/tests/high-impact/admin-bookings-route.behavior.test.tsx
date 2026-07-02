import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);
        return Component;
      },
    }
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'accommodation_units' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [{ id: 'mod-1', slug: 'accommodation_units', name: 'AccommodationUnits' }],
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    patch: apiPatchMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import DynamicBookingsPage from '../../src/app/[property]/admin/[slug]/bookings/page';

const bookingsPayload = [
  {
    id: 'b1',
    booking_number: 'BK-001',
    status: 'pending',
    check_in_date: '2026-07-01',
    check_out_date: '2026-07-03',
    total_amount: 520,
    number_of_guests: 2,
    customer_name: 'Alice Guest',
    customer_email: 'alice@example.com',
    customer_phone: '70112233',
    accommodation_units: { name: 'Palm AccommodationUnit', capacity: 4 },
    created_at: '2026-06-20T12:00:00Z',
  },
];

describe('Admin bookings route behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue({ data: { data: bookingsPayload } });
    apiPatchMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads module bookings, supports search, opens details, and updates booking status', async () => {
    const user = userEvent.setup();

    render(<DynamicBookingsPage />);

    expect(await screen.findByText('BK-001')).toBeInTheDocument();
    expect(screen.getByText('Palm AccommodationUnit')).toBeInTheDocument();
    expect(screen.getByText('Alice Guest')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'bk-001');
    expect(screen.getByText('BK-001')).toBeInTheDocument();

    const bookingRow = screen.getByText('BK-001').closest('tr');
    expect(bookingRow).not.toBeNull();

    const rowScope = within(bookingRow as HTMLTableRowElement);
    const confirmButton = rowScope.getByTestId('icon-checkcircle2').closest('button');
    expect(confirmButton).not.toBeNull();

    await user.click(confirmButton as HTMLButtonElement);

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith('/accommodation_units/staff/bookings/b1/status', {
        status: 'confirmed',
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('success.updated');
    });

    const updatedRow = screen.getByText('BK-001').closest('tr');
    expect(updatedRow).not.toBeNull();

    const detailsButton = within(updatedRow as HTMLTableRowElement).getByTestId('icon-eye').closest('button');
    expect(detailsButton).not.toBeNull();

    await user.click(detailsButton as HTMLButtonElement);

    const modalHeading = screen.getByRole('heading', { level: 3, name: /booking/i });
    expect(modalHeading).toBeInTheDocument();

    const modalCard = modalHeading.closest('div')?.parentElement;
    expect(modalCard).not.toBeNull();
    expect(within(modalCard as HTMLElement).getByText('alice@example.com')).toBeInTheDocument();
    expect(within(modalCard as HTMLElement).getByText('Palm AccommodationUnit')).toBeInTheDocument();

    expect(toastSuccessMock).toHaveBeenCalledWith('success.updated');
  });

  it('shows an error toast when initial bookings fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('network down'));

    render(<DynamicBookingsPage />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('errors.failedToLoad');
    });
  });
});
