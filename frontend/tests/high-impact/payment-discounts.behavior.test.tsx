import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

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
  formatCurrency: (value: number, _currency?: string) => `$${value.toFixed(2)}`,
  formatNumber: (value: number) => value.toLocaleString('en-US'),
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
}));

import { PaymentDiscounts } from '../../src/components/customer/PaymentDiscounts';

describe('PaymentDiscounts behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1' };

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

      return Promise.resolve({ data: { success: true, data: {} } });
    });
  });

  it('loads loyalty balance and settles the redeemed-points input', async () => {
    const user = userEvent.setup();
    const onLoyaltyPointsChange = vi.fn();

    render(
      <PaymentDiscounts loyaltyPointsToRedeem={0} onLoyaltyPointsChange={onLoyaltyPointsChange} />
    );

    // F5: balance comes from /loyalty/me and is display-only
    expect(await screen.findByText('500')).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith('/loyalty/me');

    // The component never computes totals: it only forwards the requested
    // points to the pricing layer on blur / Set Points.
    const pointsInput = screen.getByPlaceholderText('Points to redeem');
    fireEvent.change(pointsInput, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Points' }));
    await waitFor(() => {
      expect(onLoyaltyPointsChange).toHaveBeenLastCalledWith(500);
    });
  });

  it('emits coupon and gift-card instrument changes to the pricing layer', async () => {
    const onCouponChange = vi.fn();
    const onAddGiftCard = vi.fn();

    render(
      <PaymentDiscounts onCouponChange={onCouponChange} onAddGiftCard={onAddGiftCard} />
    );

    // Coupons: trimmed + upper-cased instrument codes, no client arithmetic
    const couponInput = screen.getByPlaceholderText('Enter coupon code');
    fireEvent.change(couponInput, { target: { value: 'promo10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onCouponChange).toHaveBeenCalledWith('PROMO10');

    // Gift cards: emitted through onAddGiftCard, not applied locally
    const giftCardInput = screen.getByPlaceholderText('Enter gift card code');
    fireEvent.change(giftCardInput, { target: { value: 'gc-001' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onAddGiftCard).toHaveBeenCalledWith('GC-001');
  });

  it('renders applied instruments with server-authoritative values and removes them', async () => {
    const onCouponChange = vi.fn();
    const onRemoveGiftCard = vi.fn();
    const onLoyaltyPointsChange = vi.fn();

    render(
      <PaymentDiscounts
        couponCode="SAVE10"
        giftCardCodes={['GC-1']}
        loyaltyPointsToRedeem={500}
        pricingDiscounts={[
          { type: 'coupon', name: 'Ten off', amount: 10, code: 'SAVE10' },
          { type: 'gift_card', name: 'Gift card', amount: 50, code: 'GC-1' },
          { type: 'loyalty', name: 'Loyalty', amount: 5, referenceId: 'loy-1' },
        ]}
        onCouponChange={onCouponChange}
        onRemoveGiftCard={onRemoveGiftCard}
        onLoyaltyPointsChange={onLoyaltyPointsChange}
      />
    );

    // Instrument chips render the server PricingResult amounts verbatim
    expect(screen.getByText('SAVE10')).toBeInTheDocument();
    expect(screen.getByText('-$10.00')).toBeInTheDocument();
    expect(screen.getByText('Ten off')).toBeInTheDocument();
    expect(screen.getByText('GC-1')).toBeInTheDocument();
    expect(screen.getByText('-$50.00')).toBeInTheDocument();
    expect(screen.getByText('Redeeming 500 points')).toBeInTheDocument();
    expect(screen.getByText('-$5.00')).toBeInTheDocument();

    // Removal is a pure emission: clear coupon
    fireEvent.click(screen.getByTitle('Remove coupon'));
    expect(onCouponChange).toHaveBeenCalledWith(null);

    // Remove gift card
    fireEvent.click(screen.getByTitle('Remove gift card'));
    expect(onRemoveGiftCard).toHaveBeenCalledWith('GC-1');

    // Clear points
    fireEvent.click(screen.getByTitle('Remove loyalty points'));
    expect(onLoyaltyPointsChange).toHaveBeenCalledWith(0);
  });

  it('shows pending state when pricing has not resolved yet', () => {
    render(
      <PaymentDiscounts
        couponCode="SAVE10"
        pricingDiscounts={[]}
        isPricingStale
      />
    );

    // isPricingStale renders "Calculating..." instead of an amount
    expect(screen.getByText('Calculating...')).toBeInTheDocument();
  });

  it('collapses and reopens the panel from the header control', async () => {
    const user = userEvent.setup();

    render(<PaymentDiscounts />);

    expect(screen.getByText('Promo / Coupon Code')).toBeInTheDocument();

    // Header name includes the mocked icon text — ChevronUp swaps to
    // ChevronDown after collapse, so match by the stable title text
    await user.click(screen.getByRole('button', { name: /promotions & discounts/i }));
    expect(screen.queryByText('Promo / Coupon Code')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /promotions & discounts/i }));
    expect(screen.getByText('Promo / Coupon Code')).toBeInTheDocument();
  });

  it('skips the loyalty balance fetch when unauthenticated', async () => {
    authState.isAuthenticated = false;
    authState.user = null;

    render(<PaymentDiscounts />);

    await waitFor(() => {
      expect(apiGetMock).not.toHaveBeenCalledWith('/loyalty/me');
    });

    // No balance display without an authenticated loyalty account
    expect(screen.queryByText((_, el) => el?.textContent === 'Available: 500 pts')).not.toBeInTheDocument();
  });
});
