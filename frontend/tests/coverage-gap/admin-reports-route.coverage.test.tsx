import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const reportOverviewSeed = {
  overview: {
    totalRevenue: 12450,
    totalOrders: 322,
    totalBookings: 44,
    totalUsers: 120,
    revenueChange: 8,
    ordersChange: -3,
  },
  revenueByService: {
    menu_service: 6000,
    snackBar: 2100,
    accommodation_units: 3100,
    pool: 1250,
  },
  revenueByMonth: [
    { month: 'Jan', revenue: 2000 },
    { month: 'Feb', revenue: 2300 },
    { month: 'Mar', revenue: 2500 },
  ],
  topItems: [
    { name: 'Seafood Platter', quantity: 35, revenue: 980 },
  ],
};

const occupancySeed = {
  units: {
    occupancyRate: 67,
    bookedNights: 84,
    totalCapacity: 126,
    activeUnits: 12,
  },
  capacity_access: {
    occupancyRate: 73,
    ticketsSold: 640,
    totalCapacity: 880,
    dailyCapacity: 110,
  },
};

const customerSeed = {
  topCustomers: [
    { id: 'cust-1', name: 'John Doe', revenue: 950, count: 5 },
  ],
  customerRetention: {
    new: 18,
    returning: 22,
    total: 40,
    newRatio: 45,
  },
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
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
  api: {
    get: apiGetMock,
  },
}));

vi.mock('@/context/PropertyContext', () => ({
  useProperty: () => ({
    activePropertyId: 'prop-1',
    activeProperty: { id: 'prop-1', name: 'Test Property' },
    properties: [],
    setActiveProperty: vi.fn(),
    loading: false,
    refreshProperties: vi.fn(),
  }),
  PropertyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AdminReportsPage from '../../src/app/admin/reports/page';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let anchorClickSpy: ReturnType<typeof vi.spyOn>;

describe('Admin reports route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-report'),
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/reports/overview') {
        return Promise.resolve({ data: { data: reportOverviewSeed } });
      }

      if (url === '/admin/reports/occupancy') {
        return Promise.resolve({ data: { data: occupancySeed } });
      }

      if (url === '/admin/reports/customers') {
        return Promise.resolve({ data: { data: customerSeed } });
      }

      if (url === '/admin/reports/export') {
        return Promise.resolve({ data: new Blob(['id,total\n1,100']) });
      }

      if (url === '/admin/modules') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ slug: 'menu_service', name: 'MenuService', is_active: true }],
          },
        });
      }

      return Promise.reject(new Error(`Unexpected API URL: ${url}`));
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    anchorClickSpy.mockRestore();
  });

  it('loads reports and exports a CSV report', async () => {
    const user = userEvent.setup();

    render(<AdminReportsPage />);

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.getByText('Seafood Platter')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Year/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/admin/reports/overview', expect.any(Object));
    });

    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByRole('button', { name: /MenuService/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/admin/reports/export',
        expect.objectContaining({
          params: expect.objectContaining({
            moduleSlug: 'menu_service',
            format: 'csv',
          }),
          responseType: 'blob',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('exported');
  });

  it('shows an error state when report data fails to load', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/reports/overview') {
        return Promise.reject(new Error('overview load failed'));
      }

      if (url === '/admin/reports/occupancy' || url === '/admin/reports/customers') {
        return Promise.resolve({ data: { data: null } });
      }

      return Promise.reject(new Error(`Unexpected API URL: ${url}`));
    });

    render(<AdminReportsPage />);

    expect(await screen.findByText('noData')).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith('errors.failedToLoad');
  });
});
