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

describe('usePricingPreview Hook — Canonical Server Pricing Authority, Request Ordering & Fail-Closed Errors', () => {
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

  it('debounces and calls POST /pricing/preview WITHOUT client-derived unitPrice', async () => {
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

    // Check payload does NOT include client-calculated unitPrice
    expect(mockPost).toHaveBeenCalledWith(
      '/pricing/preview',
      {
        items: [
          {
            itemId: 'item-burger',
            name: 'Gourmet Burger',
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

  it('hardens against out-of-order responses: Request A arriving after Request B cannot overwrite state', async () => {
    let resolveRequestA: (val: any) => void;
    let resolveRequestB: (val: any) => void;

    const promiseA = new Promise((resolve) => {
      resolveRequestA = resolve;
    });
    const promiseB = new Promise((resolve) => {
      resolveRequestB = resolve;
    });

    mockPost.mockImplementationOnce(() => promiseA).mockImplementationOnce(() => promiseB);

    let hookProps = {
      items: sampleItems,
      moduleId: 'mod-123',
      couponCode: 'PROMO_A',
      debounceMs: 10,
    };

    const { result, rerender } = renderHook((props) => usePricingPreview(props), {
      initialProps: hookProps,
    });

    // Wait for Request A to be dispatched
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    // Trigger Request B by modifying coupon
    hookProps = {
      ...hookProps,
      couponCode: 'PROMO_B',
    };
    rerender(hookProps);

    // Wait for Request B to be dispatched
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    const pricingA = { ...mockServerPricing, totalAmount: 100 };
    const pricingB = { ...mockServerPricing, totalAmount: 50 };

    // Request B resolves FIRST
    act(() => {
      resolveRequestB({
        data: { success: true, data: pricingB },
      });
    });

    await waitFor(() => {
      expect(result.current.pricing?.totalAmount).toBe(50);
    });

    // Request A resolves LATER
    act(() => {
      resolveRequestA({
        data: { success: true, data: pricingA },
      });
    });

    // State MUST NOT be overwritten by older Request A
    await waitFor(() => {
      expect(result.current.pricing?.totalAmount).toBe(50);
    });
  });

  it('fails closed on pricing error and recovers on retry', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        data: {
          error: 'Item out of stock',
        },
      },
    });

    const { result } = renderHook(() =>
      usePricingPreview({
        items: sampleItems,
        moduleId: 'mod-123',
        couponCode: 'PROMO_EXPIRED',
        debounceMs: 10,
      })
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe('Item out of stock');
      expect(result.current.isStale).toBe(false);
      expect(result.current.pricing).toBeNull();
    });

    // Retry successfully
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockServerPricing,
      },
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.pricing).toEqual(mockServerPricing);
    });
  });
});
