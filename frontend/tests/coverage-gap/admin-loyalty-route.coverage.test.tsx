import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/context/PropertyContext', () => ({
  useProperty: () => ({
    activePropertyId: 'prop-1',
    activeProperty: { id: 'prop-1', name: 'Test Property', type: 'property' },
    properties: [],
    setActiveProperty: vi.fn(),
    loading: false,
    refreshProperties: vi.fn(),
  }),
  PropertyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import LoyaltyAdminPage from '../../src/app/[property]/admin/loyalty/page';

const tiersSeed = [
  {
    id: 'tier-bronze',
    name: 'Bronze',
    min_points: 0,
    points_multiplier: 1,
    color: '#CD7F32',
    benefits: {},
    is_active: true,
  },
  {
    id: 'tier-gold',
    name: 'Gold',
    min_points: 500,
    points_multiplier: 1.5,
    color: '#f59e0b',
    benefits: {},
    is_active: true,
  },
];

const statsSeed = {
  summary: {
    total_members: 24,
    total_lifetime_points: 8100,
    total_outstanding_points: 2900,
    active_members_30_days: 12,
  },
  tierDistribution: [
    { tier_name: 'Bronze', tier_color: '#CD7F32', count: 15 },
    { tier_name: 'Gold', tier_color: '#f59e0b', count: 9 },
  ],
};

const settingsSeed = {
  points_per_dollar: 2,
  redemption_value: 0.01,
  min_redemption_points: 100,
  points_expiry_days: 365,
};

const accountsSeed = [
  {
    id: 'account-1',
    user_id: 'user-1',
    user_name: 'Lina Guest',
    user_email: 'lina@example.com',
    tier_name: 'Gold',
    tier_color: '#f59e0b',
    available_points: 620,
    total_points: 620,
    lifetime_points: 1230,
    created_at: '2026-05-01T10:00:00.000Z',
  },
];

describe('Admin loyalty route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/loyalty/tiers') {
        return Promise.resolve({ data: { success: true, data: tiersSeed } });
      }
      if (url === '/loyalty/stats') {
        return Promise.resolve({ data: { success: true, data: statsSeed } });
      }
      if (url === '/loyalty/settings') {
        return Promise.resolve({ data: { success: true, data: settingsSeed } });
      }
      if (url === '/loyalty/accounts') {
        return Promise.resolve({ data: { success: true, data: accountsSeed } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('loads member data and submits a points adjustment', async () => {
    const user = userEvent.setup();

    render(<LoyaltyAdminPage />);

    expect(await screen.findByText('Loyalty Program')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Members' }));
    expect(await screen.findByText('Lina Guest')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Adjust/i }));

    await user.type(screen.getByPlaceholderText('Enter positive or negative amount'), '50');
    await user.type(screen.getByPlaceholderText('Reason for adjustment'), 'Service recovery');
    await user.click(screen.getByRole('button', { name: /^Adjust Points$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/loyalty/accounts/account-1/adjust',
        expect.objectContaining({
          points: expect.any(Number),
          reason: expect.any(String),
        }),
        expect.any(Object)
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Points adjusted');
  });

  it('shows an error toast when saving settings fails', async () => {
    const user = userEvent.setup();

    apiPutMock.mockRejectedValueOnce(new Error('settings save failed'));

    render(<LoyaltyAdminPage />);

    await screen.findByText('Loyalty Program');

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /^Save Settings$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to update settings');
    });
  });
});
