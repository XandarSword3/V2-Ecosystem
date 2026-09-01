import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PaymentDiscounts } from '@/components/customer/PaymentDiscounts';

// Mocks
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'guest@example.com' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: { available_points: 500 },
      },
    }),
  },
}));

describe('PaymentDiscounts Component — Pure Presentation & Input Component (F5 Single Authority)', () => {
  const onCouponChange = vi.fn();
  const onAddGiftCard = vi.fn();
  const onRemoveGiftCard = vi.fn();
  const onLoyaltyPointsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collects coupon input and emits onCouponChange without calculating discount values', () => {
    render(
      <PaymentDiscounts
        couponCode={null}
        onCouponChange={onCouponChange}
        onAddGiftCard={onAddGiftCard}
        onRemoveGiftCard={onRemoveGiftCard}
        onLoyaltyPointsChange={onLoyaltyPointsChange}
      />
    );

    const input = screen.getByPlaceholderText(/Enter coupon code/i);
    fireEvent.change(input, { target: { value: 'summer50' } });

    const applyBtn = screen.getByRole('button', { name: /^Apply$/i });
    fireEvent.click(applyBtn);

    expect(onCouponChange).toHaveBeenCalledWith('SUMMER50');
  });

  it('renders server-authoritative coupon discount and handles removal', () => {
    render(
      <PaymentDiscounts
        couponCode="SUMMER50"
        pricingDiscounts={[
          { type: 'coupon', name: 'Summer 50% Off', amount: 15.5, code: 'SUMMER50' },
        ]}
        onCouponChange={onCouponChange}
        currency="USD"
      />
    );

    expect(screen.getByText('SUMMER50')).toBeDefined();
    expect(screen.getByText('Summer 50% Off')).toBeDefined();
    expect(screen.getByText('-$15.50')).toBeDefined();

    const removeBtn = screen.getByTitle(/Remove coupon/i);
    fireEvent.click(removeBtn);

    expect(onCouponChange).toHaveBeenCalledWith(null);
  });

  it('collects gift card input, emits onAddGiftCard, and renders server gift card discount amount', () => {
    render(
      <PaymentDiscounts
        giftCardCodes={['GC-VIP-999']}
        pricingDiscounts={[
          { type: 'gift_card', name: 'VIP Gift Card', amount: 25.0, code: 'GC-VIP-999' },
        ]}
        onAddGiftCard={onAddGiftCard}
        onRemoveGiftCard={onRemoveGiftCard}
        currency="USD"
      />
    );

    // Displays code and server-authoritative amount
    expect(screen.getByText('GC-VIP-999')).toBeDefined();
    expect(screen.getByText('-$25.00')).toBeDefined();

    // Adding another gift card
    const input = screen.getByPlaceholderText(/Enter gift card code/i);
    fireEvent.change(input, { target: { value: 'gc-new-123' } });

    const addBtn = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addBtn);

    expect(onAddGiftCard).toHaveBeenCalledWith('GC-NEW-123');

    // Removing existing card
    const removeBtn = screen.getByTitle(/Remove gift card/i);
    fireEvent.click(removeBtn);

    expect(onRemoveGiftCard).toHaveBeenCalledWith('GC-VIP-999');
  });

  it('collects loyalty points requested, emits onLoyaltyPointsChange, and renders server loyalty discount', () => {
    render(
      <PaymentDiscounts
        loyaltyPointsToRedeem={200}
        pricingDiscounts={[
          { type: 'loyalty', name: 'Loyalty Reward', amount: 2.0 },
        ]}
        onLoyaltyPointsChange={onLoyaltyPointsChange}
        currency="USD"
      />
    );

    // Displays redeeming points and server-authoritative dollar discount
    expect(screen.getByText(/Redeeming 200 points/i)).toBeDefined();
    expect(screen.getByText('-$2.00')).toBeDefined();

    // Changing points input
    const input = screen.getByPlaceholderText(/Points to redeem/i);
    fireEvent.change(input, { target: { value: '400' } });
    fireEvent.blur(input);

    expect(onLoyaltyPointsChange).toHaveBeenCalledWith(400);

    // Removing loyalty redemption
    const removeBtn = screen.getByTitle(/Remove loyalty points/i);
    fireEvent.click(removeBtn);

    expect(onLoyaltyPointsChange).toHaveBeenCalledWith(0);
  });
});
