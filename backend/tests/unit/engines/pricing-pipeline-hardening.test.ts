/**
 * Pricing pipeline — hardening tests (points 9-12).
 *
 * Proves the pipeline runs on the exact Money model and enforces its own
 * invariants:
 *   - every monetary component is exact bigint arithmetic;
 *   - the coupon taxSavings double-count is FIXED (tax is computed on the
 *     post-coupon base, so taxSavings is attribution-only and never
 *     subtracted again);
 *   - invariant violations THROW (PricingInvariantError) instead of logging;
 *   - target precision derives from currency metadata (JPY → 0 decimals);
 *   - missing/invalid currency fails loudly.
 */
import { describe, it, expect, vi } from 'vitest';
import { PricingPipeline, PricingCurrencyError, PricingInvariantError } from '../../../src/engines/pricing-pipeline.js';
import { InvalidCurrencyError, Money } from '../../../src/engines/money.js';
import type { PricingConfig } from '../../../src/engines/types.js';

vi.mock('../../../src/services/tax.service.js', () => {
  return {
    TaxService: class MockTaxService {
      getTaxRate = vi.fn().mockResolvedValue(0.1);
      computeTaxBreakdown = vi.fn().mockImplementation(async (_items: unknown[], taxableAmount: number) => [{
        id: 'tax-vat',
        name: 'VAT',
        rate: 10,
        amount: Math.round(taxableAmount * 10) / 100,
        type: 'vat',
      }]);
      computeFeeBreakdown = vi.fn().mockResolvedValue([]);
    },
  };
});

import { TaxService } from '../../../src/services/tax.service.js';

const BASE_CONFIG: PricingConfig = {
  applyTax: true,
  applyFees: true,
  supportsCoupons: true,
  supportsGiftCards: true,
  supportsLoyaltyRedemption: true,
  earnsLoyaltyPoints: true,
  deductsInventory: false,
  rounding: 'round',
  decimalPlaces: 2,
};

function makePipeline(overrides?: { coupon?: { discountAmount: number; taxSavings: number }; giftCard?: number | null }) {
  const taxService = new TaxService();
  const couponResolver = overrides?.coupon
    ? { apply: vi.fn().mockResolvedValue({ ...overrides.coupon, couponId: 'coupon-1' }) }
    : undefined;
  const giftCardResolver = overrides?.giftCard !== undefined
    ? { redeem: vi.fn().mockResolvedValue(overrides.giftCard === null ? null : { amountDeducted: overrides.giftCard, giftCardId: 'gc-1' }) }
    : undefined;
  return new PricingPipeline({ taxService, couponResolver, giftCardResolver });
}

describe('PricingPipeline — coupon taxSavings double-count is fixed', () => {
  it('does not subtract taxSavings a second time (tax is already post-coupon)', async () => {
    // Subtotal 100, coupon 10 (taxSavings 1.10 is attribution-only), tax 10% on 90 = 9.
    const pipeline = makePipeline({ coupon: { discountAmount: 10, taxSavings: 1.1 } });
    const result = await pipeline.calculate(
      [{ itemId: 'a', name: 'Item', unitPrice: 100, quantity: 1 }],
      BASE_CONFIG,
      { currency: 'EUR', couponCode: 'TEST10' },
    );

    expect(result.subtotal).toBe(100);
    expect(result.taxAmount).toBe(9);          // computed on post-coupon 90
    expect(result.totalDiscount).toBe(10);     // amounts only — NOT 11.10
    expect(result.totalAmount).toBe(99);       // 100 + 9 − 10 — NOT 97.90
    // taxSavings survives for attribution/reporting only.
    expect(result.discounts[0].taxSavings).toBe(1.1);
    expect(result.discounts[0].amount).toBe(10);
  });

  it('gift-card redemption is capped at the true remaining balance', async () => {
    // Subtotal 100, coupon 10, tax 9 → remaining 99. The old bug would cap at 97.90.
    const giftCard = { redeem: vi.fn().mockResolvedValue({ amountDeducted: 99, giftCardId: 'gc-1' }) };
    const pipeline = new PricingPipeline({ taxService: new TaxService(), couponResolver: { apply: vi.fn().mockResolvedValue({ discountAmount: 10, taxSavings: 1.1, couponId: 'c' }) }, giftCardResolver: giftCard });
    const result = await pipeline.calculate(
      [{ itemId: 'a', name: 'Item', unitPrice: 100, quantity: 1 }],
      BASE_CONFIG,
      { currency: 'EUR', couponCode: 'TEST10', giftCardCodes: ['GC1'] },
    );

    expect(giftCard.redeem).toHaveBeenCalledWith('GC1', 99);
    expect(result.totalAmount).toBe(0);
    expect(result.totalDiscount).toBe(109);
  });
});

describe('PricingPipeline — exact Money arithmetic', () => {
  it('fractional quantities round on the exact remainder', async () => {
    const pipeline = makePipeline();
    const result = await pipeline.calculate(
      [{ itemId: 'a', name: 'Third of an item', unitPrice: 10, quantity: 1 / 3 }],
      BASE_CONFIG,
      { currency: 'EUR' },
    );
    expect(result.lineItems[0].lineTotal).toBe(3.33);
    expect(result.subtotal).toBe(3.33);
    expect(result.taxAmount).toBe(0.33);       // 10% of 3.33, rounded
    expect(result.totalAmount).toBe(3.66);
  });

  it('half-quantity lines are exact', async () => {
    const pipeline = makePipeline();
    const result = await pipeline.calculate(
      [{ itemId: 'a', name: 'Half', unitPrice: 10, quantity: 0.5 }],
      BASE_CONFIG,
      { currency: 'EUR' },
    );
    expect(result.subtotal).toBe(5);
    expect(result.taxAmount).toBe(0.5);
    expect(result.totalAmount).toBe(5.5);
  });

  it('derives output precision from currency metadata (JPY → integer totals)', async () => {
    const pipeline = makePipeline();
    const result = await pipeline.calculate(
      [{ itemId: 'a', name: 'Item', unitPrice: 1000, quantity: 1 }],
      BASE_CONFIG, // decimalPlaces 2 — but JPY has 0 minor units
      { currency: 'JPY' },
    );
    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(100);
    expect(result.totalAmount).toBe(1100);
  });

  it('caps a fixed deposit at the total', async () => {
    const pipeline = makePipeline();
    const result = await pipeline.calculate(
      [{ itemId: 'a', name: 'Item', unitPrice: 10, quantity: 1 }],
      BASE_CONFIG,
      { currency: 'EUR', conditions: { depositConfig: { type: 'fixed', amount: 1000 } } },
    );
    expect(result.depositAmount).toBe(11); // capped at total: 10 + 1 tax = 11
  });

  it('handles unit adjustments exactly', async () => {
    const pipeline = makePipeline();
    const result = await pipeline.calculate(
      [{ itemId: 'a', name: 'Item', unitPrice: 10, unitAdjustment: -1.5, quantity: 3 }],
      BASE_CONFIG,
      { currency: 'EUR' },
    );
    expect(result.subtotal).toBe(25.5); // (10 − 1.5) * 3
    expect(result.taxAmount).toBe(2.55);
    expect(result.totalAmount).toBe(28.05);
  });
});

describe('PricingPipeline — invariant violations THROW', () => {
  it('throws PricingCurrencyError when no currency is provided (no implicit default)', async () => {
    const pipeline = makePipeline();
    await expect(
      pipeline.calculate([{ itemId: 'a', name: 'x', unitPrice: 1, quantity: 1 }], BASE_CONFIG, {}),
    ).rejects.toThrow(PricingCurrencyError);
  });

  it('throws InvalidCurrencyError for a semantically invalid currency', async () => {
    const pipeline = makePipeline();
    await expect(
      pipeline.calculate([{ itemId: 'a', name: 'x', unitPrice: 1, quantity: 1 }], BASE_CONFIG, { currency: 'ZZZ' }),
    ).rejects.toThrow(InvalidCurrencyError);
  });

  it('assertInvariant throws on any minor-unit mismatch (never logs-and-continues)', () => {
    const pipeline = makePipeline();
    const assert = (pipeline as unknown as {
      assertInvariant: (c: string, p: number, parts: Record<string, Money>) => void;
    }).assertInvariant;
    expect(() =>
      assert('EUR', 2, {
        subtotal: Money.fromDecimal('10.00', 'EUR'),
        taxAmount: Money.fromDecimal('1.00', 'EUR'),
        serviceCharge: Money.zero('EUR'),
        deliveryFee: Money.zero('EUR'),
        totalDiscount: Money.zero('EUR'),
        totalAmount: Money.fromDecimal('10.50', 'EUR'), // wrong by 0.50
      }),
    ).toThrow(PricingInvariantError);

    // A correct invariant does not throw.
    expect(() =>
      assert('EUR', 2, {
        subtotal: Money.fromDecimal('10.00', 'EUR'),
        taxAmount: Money.fromDecimal('1.00', 'EUR'),
        serviceCharge: Money.zero('EUR'),
        deliveryFee: Money.zero('EUR'),
        totalDiscount: Money.fromDecimal('0.50', 'EUR'),
        totalAmount: Money.fromDecimal('10.50', 'EUR'),
      }),
    ).not.toThrow();
  });
});
