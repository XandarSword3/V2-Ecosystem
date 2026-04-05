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

import CouponsAdminPage from '../../src/app/admin/coupons/page';

const couponSeed = [
  {
    id: 'coupon-1',
    code: 'SUMMER20',
    name: 'Summer 20% Off',
    description: 'Seasonal promotion',
    discount_type: 'percentage',
    discount_value: 20,
    min_order_amount: 0,
    applies_to: 'all',
    usage_count: 3,
    per_user_limit: 1,
    is_active: true,
    created_at: '2026-06-01T09:00:00.000Z',
  },
];

const statsSeed = {
  total_coupons: 1,
  active_coupons: 1,
  total_uses: 3,
  totalDiscountGiven: 48,
};

describe('Admin coupons route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/coupons') {
        return Promise.resolve({ data: { success: true, data: couponSeed } });
      }
      if (url === '/coupons/stats') {
        return Promise.resolve({ data: { success: true, data: { summary: statsSeed } } });
      }
      if (url === '/coupons/generate-code') {
        return Promise.resolve({ data: { success: true, data: { code: 'AUTO2026' } } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(),
      },
      configurable: true,
    });
  });

  it('loads coupons and toggles active state for an existing coupon', async () => {
    const user = userEvent.setup();

    render(<CouponsAdminPage />);

    expect(await screen.findByText('Coupons')).toBeInTheDocument();
    expect(screen.getByText('SUMMER20')).toBeInTheDocument();

    await user.click(screen.getByTitle('Deactivate'));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/coupons/coupon-1', { isActive: false });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Coupon deactivated');
  });

  it('shows validation error when trying to save coupon without required fields', async () => {
    const user = userEvent.setup();

    render(<CouponsAdminPage />);

    await screen.findByText('Coupons');

    await user.click(screen.getByRole('button', { name: /Create Coupon/i }));
    expect(await screen.findByRole('heading', { name: 'Create Coupon' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Create Coupon$/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('Please fill in required fields');
  });
});
