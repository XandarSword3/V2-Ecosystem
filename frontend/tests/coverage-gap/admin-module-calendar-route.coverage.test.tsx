import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useParamsMock = vi.hoisted(() => vi.fn());

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const siteSettingsMock = vi.hoisted(() => ({
  modules: [
    {
      id: 'module-accommodation_units',
      template_type: 'multi_day_booking',
      name: 'AccommodationUnits',
      slug: 'accommodation_units',
      is_active: true,
      sort_order: 1,
    },
  ],
}));

vi.mock('next/navigation', () => ({
  useParams: useParamsMock,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteSettingsMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AdminCalendarPage from '../../src/app/admin/[slug]/calendar/page';

const bookingsSeed = [
  {
    id: 'book-1',
    booking_number: 'BK-1001',
    customer_name: 'Lina Guest',
    check_in_date: '2026-06-10',
    check_out_date: '2026-06-13',
    status: 'confirmed',
    number_of_guests: 2,
    total_amount: 450,
  },
];

const blockedDatesSeed = [
  {
    id: 'blk-1',
    unit_id: 'ch-1',
    blocked_date: '2026-06-15',
    reason: 'Maintenance',
  },
];

describe('Admin module calendar route coverage', () => {
  beforeEach(() => {
    useParamsMock.mockReturnValue({ slug: 'accommodation_units' });

    apiGetMock.mockReset();
    apiPostMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/modules/accommodation_units/units') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'ch-1',
                name: 'Pine AccommodationUnit',
                base_price: 120,
                weekend_price: 150,
              },
            ],
          },
        });
      }

      if (url === '/admin/modules/accommodation_units/units/ch-1/calendar') {
        return Promise.resolve({
          data: {
            data: {
              bookings: bookingsSeed,
              blockedDates: blockedDatesSeed,
            },
          },
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
  });

  it('renders monthly bookings and opens booking detail modal', async () => {
    const user = userEvent.setup();

    render(<AdminCalendarPage />);

    expect(await screen.findByText('Availability Calendar')).toBeInTheDocument();
    expect(await screen.findByText('Lina Guest')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lina Guest/i }));

    expect(await screen.findByText('Booking Details')).toBeInTheDocument();
    expect(screen.getByText('BK-1001')).toBeInTheDocument();
  });

  it('shows blocking error when block-dates API fails', async () => {
    const user = userEvent.setup();

    apiPostMock.mockRejectedValueOnce(new Error('block failed'));

    render(<AdminCalendarPage />);

    await screen.findByText('Availability Calendar');

    const dateButtons = screen
      .getAllByRole('button')
      .filter((button) => button.className.includes('h-20'));

    expect(dateButtons.length).toBeGreaterThan(0);

    await user.click(dateButtons[0]);
    await user.click(screen.getAllByRole('button', { name: /Block$/i })[0]);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to block dates');
    });
  });
});
