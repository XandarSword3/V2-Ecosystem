import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePricingPreview } from '@/hooks/usePricingPreview';
import api from '@/lib/api';
import type { CartItem } from '@/stores/cartStore';

const mockPost = vi.fn();

vi.mock('@/lib/api', () => {
  const instance = {
    post: (...args: any[]) => mockPost(...args),
    get: vi.fn(),
  };
  return {
    __esModule: true,
    default: instance,
    api: instance,
  };
});

describe('usePricingPreview Hook — Canonical Server Pricing Authority & Stale Invalidation', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleItems: CartItem[] = [
    {
      id: 'item-burger',
      name: 'Gourmet Burger',
      price: 15,
      quantity: 2,
      category: 'food',
      moduleId: 'mod-123',
      selectedModifiers: [
        {
          optionId: 'opt-cheese',
          optionName: 'Extra Cheese',
          groupId: 'grp-cheese',
          groupName: 'Cheese',
          modifierType: 'add',
          priceAdjustment: 2,
          quantity: 1,
        },
      ],
      modifierTotal: 2,
    },
  ];

  const mockServerPricing = {
    subtotal: 34,
    taxAmount: 3.4,
    taxBreakdown: [{ name: 'VAT', rate: 10, amount: 3.4 }],
    feeBreakdown: [{ name: 'Eco Fee', amount: 1.5 }],
    serviceCharge: 2.0,
    deliveryFee: 5.0,
    totalDiscount: 5.0,
    discounts: [{ type: 'coupon', name: 'Summer Promo', amount: 5.0, code: 'SUMMER5' }],
    totalAmount: 40.9,
    currency: 'USD',
  };

  it('debounces and calls POST /pricing/preview with formatted items and parameters', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockServerPricing,
      },
    });

    const { result } = renderHook(() =>
      usePricingPreview({
        items: sampleItems,
        moduleId: 'mod-123',
        fulfillmentMode: 'on_premise',
        paymentMethod: 'card',
        couponCode: 'SUMMER5',
        giftCardCodes: ['GC-100'],
        loyaltyPointsToRedeem: 100,
        propertyId: 'prop-456',
        debounceMs: 20,
      })
    );

    // Immediately marks stale on mount when items are present
    expect(result.current.isStale).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStale).toBe(false);
      expect(result.current.pricing).toEqual(mockServerPricing);
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/pricing/preview',
      {
        items: [
          {
            itemId: 'item-burger',
            name: 'Gourmet Burger',
            unitPrice: 17, // 15 + 2
            quantity: 2,
            taxCategory: 'food',
            moduleId: 'mod-123',
            metadata: {
              selectedModifiers: sampleItems[0].selectedModifiers,
            },
          },
        ],
        moduleId: 'mod-123',
        conditions: {
          fulfillmentMode: 'on_premise',
          paymentMethod: 'card',
        },
        couponCode: 'SUMMER5',
        giftCardCodes: ['GC-100'],
        loyaltyPointsToRedeem: 100,
        customerId: undefined,
        propertyId: 'prop-456',
      },
      expect.anything()
    );
  });

  it('marks state as isStale immediately when line items or coupon changes', async () => {
    mockPost.mockResolvedValue({
      data: {
        success: true,
        data: mockServerPricing,
      },
    });

    let hookProps = {
      items: sampleItems,
      moduleId: 'mod-123',
      couponCode: 'PROMO1',
      debounceMs: 20,
    };

    const { result, rerender } = renderHook((props) => usePricingPreview(props), {
      initialProps: hookProps,
    });

    await waitFor(() => {
      expect(result.current.isStale).toBe(false);
      expect(result.current.pricing).toBeDefined();
    });

    // Mutate coupon code
    hookProps = {
      ...hookProps,
      couponCode: 'PROMO2',
    };

    rerender(hookProps);

    // Must transition to isStale: true immediately
    expect(result.current.isStale).toBe(true);

    await waitFor(() => {
      expect(result.current.isStale).toBe(false);
    });
  });

  it('handles server pricing error and exposes isError and error message', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        data: {
          error: 'Coupon code PROMO_EXPIRED has expired',
        },
      },
    });

    const { result } = renderHook(() =>
      usePricingPreview({
        items: sampleItems,
        moduleId: 'mod-123',
        couponCode: 'PROMO_EXPIRED',
        debounceMs: 20,
      })
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe('Coupon code PROMO_EXPIRED has expired');
      expect(result.current.isStale).toBe(false);
      expect(result.current.pricing).toBeNull();
    });
  });
});
