import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const authState = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  isAuthenticated: true,
}));

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
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/utils', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
  formatNumber: (value: number) => value.toLocaleString('en-US'),
}));

vi.mock('../../src/components/customer/CouponInput', () => ({
  CouponInput: ({ onCouponApply, onDiscountChange }: any) => (
    <div>
      <button
        type="button"
        onClick={() => {
          onCouponApply({ code: 'SAVE10', discountAmount: 10, description: 'Ten off' });
          onDiscountChange?.(10);
        }}
      >
        Apply Coupon
      </button>
      <button
        type="button"
        onClick={() => {
          onCouponApply(null);
          onDiscountChange?.(0);
        }}
      >
        Clear Coupon
      </button>
    </div>
  ),
  AvailableCoupons: () => null,
}));

vi.mock('../../src/components/customer/LoyaltyDisplay', () => ({
  PointsPreview: () => null,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/Input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { PaymentDiscounts } from '../../src/components/customer/PaymentDiscounts';

describe('PaymentDiscounts behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    authState.isAuthenticated = true;
    authState.user = { id: 'user-1' };

    localStorage.setItem('accessToken', 'token');

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/loyalty/me') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              available_points: 500,
            },
          },
        });
      }

      if (url.startsWith('/giftcards/check/')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              balance: 50,
            },
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: {} } });
    });
  });

  it('loads loyalty account data and redeems max points', async () => {
    const user = userEvent.setup();
    const onTotalChange = vi.fn();

    render(<PaymentDiscounts orderTotal={80} onTotalChange={onTotalChange} />);

    expect(await screen.findByText(/500 pts available/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Max' }));

    expect(screen.getByPlaceholderText('Points to redeem')).toHaveValue(500);

    await waitFor(() => {
      expect(onTotalChange).toHaveBeenLastCalledWith(
        75,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'loyalty',
            amount: 5,
            pointsUsed: 500,
          }),
        ])
      );
    });
  });

  it('toggles discount panel visibility from the header control', async () => {
    const user = userEvent.setup();

    render(<PaymentDiscounts orderTotal={80} />);

    expect(screen.getByText('Coupon Code')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Discounts & Rewards/i }));
    expect(screen.queryByText('Coupon Code')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Discounts & Rewards/i }));
    expect(screen.getByText('Coupon Code')).toBeInTheDocument();
  });

  it('hides loyalty-specific UI when user is not authenticated', () => {
    authState.isAuthenticated = false;
    authState.user = null;

    render(<PaymentDiscounts orderTotal={40} />);

    expect(screen.queryByText('Loyalty Points')).not.toBeInTheDocument();
    expect(screen.queryByText(/You'll earn/i)).not.toBeInTheDocument();
  });
});
