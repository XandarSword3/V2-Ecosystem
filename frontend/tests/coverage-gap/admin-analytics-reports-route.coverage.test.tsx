import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const executiveSeed = {
  today: { revenue: 890, orders: 42, bookings: 9 },
  mtd: { revenue: 18300, netRevenue: 17100, orders: 550, bookings: 102, discounts: 750, refunds: 450 },
  ytd: { revenue: 160200, orders: 4810, bookings: 990 },
  growth: { orderGrowthPercent: '11.2', revenueGrowthPercent: '8.5' },
  aov: '38.6',
  activeCustomers: 275,
  systemHealth: { orderFailures24h: 0, paymentFailures24h: 0, status: 'healthy' },
};

const customerCategorySeed = {
  overview: {
    totalCustomers: 220,
    newCustomers: 70,
    returningCustomers: 150,
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AnalyticsReportsPage from '../../src/app/[property]/admin/reports/analytics/page';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let anchorClickSpy: ReturnType<typeof vi.spyOn>;

describe('Admin analytics reports route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-export'),
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    apiGetMock.mockImplementation((url: string, config?: { responseType?: string }) => {
      if (url === '/admin/reports/overview') {
        return Promise.resolve({ data: { data: executiveSeed } });
      }

      if (url === '/reports/customer-intelligence') {
        return Promise.resolve({ data: { data: customerCategorySeed } });
      }

      if (url === '/admin/reports/export') {
        if (config?.responseType === 'blob') {
          return Promise.resolve({ data: new Blob(['id,total\n1,100']) });
        }

        return Promise.resolve({ data: { data: { summary: 'json export payload' } } });
      }

      return Promise.reject(new Error(`Unexpected API URL: ${url}`));
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    anchorClickSpy.mockRestore();
  });

  it('loads executive data, fetches category details, and exports CSV plus JSON', async () => {
    const user = userEvent.setup();

    render(<AnalyticsReportsPage />);

    expect(await screen.findByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText("Today's Revenue")).toBeInTheDocument();

    await user.click(screen.getByText('Customer Intelligence'));

    expect(await screen.findByText('Total Customers')).toBeInTheDocument();
    expect(screen.getByText('Returning')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Export All/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/admin/reports/export',
        expect.objectContaining({
          params: expect.any(Object),
          responseType: 'blob',
        })
      );
    });

    await user.click(screen.getByRole('button', { name: /Export as JSON/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/admin/reports/export',
        expect.objectContaining({
          params: expect.any(Object),
          responseType: 'json',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Report exported successfully');
  });

  it('shows an error toast when category report loading fails', async () => {
    const user = userEvent.setup();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/reports/overview') {
        return Promise.resolve({ data: { data: executiveSeed } });
      }

      if (url === '/reports/customer-intelligence') {
        return Promise.reject(new Error('category failed'));
      }

      return Promise.reject(new Error(`Unexpected API URL: ${url}`));
    });

    render(<AnalyticsReportsPage />);

    await screen.findByText('Analytics Dashboard');

    await user.click(screen.getByText('Customer Intelligence'));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to load Customer Intelligence');
    });
  });
});
