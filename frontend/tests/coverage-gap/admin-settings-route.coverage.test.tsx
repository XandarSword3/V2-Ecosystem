import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiPutMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

const siteSettingsState = vi.hoisted(() => ({
  settings: {
    propertyName: 'Iron Paradise',
    tagline: 'Premier Property Experience',
    description: 'Luxury resort and activities.',
    moduleSettings: {
      accommodation_units: {
        displayName: 'Luxury AccommodationUnits',
        checkIn: '3:00 PM',
        checkOut: '11:00 AM',
        depositPercent: 30,
      },
      pool: {
        displayName: 'Pool Club',
        adultPrice: 25,
        childPrice: 12,
        capacity: 120,
      },
    },
  },
  modules: [
    {
      id: 'mod-1',
      name: 'AccommodationUnits',
      slug: 'accommodation_units',
      template_type: 'time_exclusive_reservation',
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'mod-2',
      name: 'Pool',
      slug: 'capacity',
      template_type: 'shared_capacity_access',
      sort_order: 2,
      is_active: true,
    },
    {
      id: 'mod-3',
      name: 'MenuService',
      slug: 'menu_service',
      template_type: 'menu_service',
      sort_order: 3,
      is_active: true,
    },
  ],
  refetch: refetchMock,
  loading: false,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');

  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string | symbol) => {
        if (typeof tag !== 'string' || tag === 'then' || tag === 'catch' || tag === 'finally') {
          return undefined;
        }

        const MotionComponent = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);

        return MotionComponent;
      },
    }
  );

  return {
    motion: motionProxy,
  };
});

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    put: apiPutMock,
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteSettingsState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AdminSettingsPage from '../../src/app/[property]/admin/settings/page';

describe('Admin settings route coverage', () => {
  beforeEach(() => {
    apiPutMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    refetchMock.mockReset();

    apiPutMock.mockResolvedValue({ data: { success: true } });
    refetchMock.mockResolvedValue(undefined);
  });

  it('switches tabs and saves updated settings', async () => {
    const user = userEvent.setup();

    render(<AdminSettingsPage />);

    expect(await screen.findByText('settings')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Modules/i }));
    expect(await screen.findByText(/Configure display names and settings/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /AccommodationUnits/i }));
    expect(await screen.findByText('Check-in & Check-out')).toBeInTheDocument();
    expect(screen.getByText('Deposit Configuration')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pool$/i }));
    expect(await screen.findByText(/Adult Price \(\$\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Contact/i }));
    expect(await screen.findByText('Phone Number')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Business Hours/i }));
    expect(await screen.findByText('Reception Hours')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Legal Pages/i }));
    expect(await screen.findByText('Privacy Policy')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /General/i }));

    const propertyNameInput = screen.getByPlaceholderText('Enter your business name');
    await user.clear(propertyNameInput);
    await user.type(propertyNameInput, 'Paradise Grand Resort');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/settings', expect.any(Object));
    });

    expect(refetchMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith('Settings saved successfully!');
  });

  it('shows an error toast when saving settings fails', async () => {
    const user = userEvent.setup();

    apiPutMock.mockRejectedValueOnce(new Error('save failed'));

    render(<AdminSettingsPage />);

    await screen.findByText('settings');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to save settings. Please try again.');
    });
  });
});
