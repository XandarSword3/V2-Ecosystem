/**
 * Unified Pricing Pipeline
 *
 * ONE universal pricing calculation that ALL engines route through.
 * This replaces the four legacy per-module financial calculators
 * (instant-transaction.engine, time-exclusive-reservation.engine, shared-capacity-access.engine, ongoing-entitlement.engine).
 *
 * FINANCIAL INVARIANTS (DOMAIN.md F1 — violations THROW, never merely log):
 *   1. totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount
 *      (serviceCharge + deliveryFee together always equal the sum of feeBreakdown — see Step 4)
 *   2. totalAmount >= 0 (never negative)
 *   3. Tax is (subtotal - couponDiscount) * taxRate: TaxService computes tax on the
 *      POST-COUPON taxable base, so the coupon's tax saving is already inside taxAmount.
 *      The `taxSavings` field on a coupon DiscountBreakdown is therefore
 *      ATTRIBUTION-ONLY — it is never subtracted again (fixes the historical
 *      double-count where tax was reduced once inside taxAmount and a second time
 *      via totalDiscount).
 *   4. Fees (service charge, delivery fee, resort fee, custom surcharges) are entirely
 *      CMS-driven via tax_configuration fee_type rates — there are no hardcoded rates,
 *      flat amounts, or order-type conditions. See TaxService.computeFeeBreakdown().
 *   5. Discounts are applied in order: coupon → gift card → loyalty
 *   6. Each discount is capped at remaining balance (no negative intermediate totals)
 *   7. ALL arithmetic is exact bigint Money (engines/money.ts). Number is only a
 *      boundary type for JSON, TaxService and the discount resolvers — it never
 *      participates in arithmetic. Rounding uses the REAL policy (round/floor/ceil
 *      on the bigint remainder) at the currency's minor-unit precision.
 *
 * Usage:
 *   const pipeline = new PricingPipeline({ taxService });
 *   const result = await pipeline.calculate(lineItems, pricingConfig, pricingContext);
 */

import type {
  PricingLineItem,
  PricingConfig,
  PricingContext,
  PricingResult,
  DiscountBreakdown,
  TaxBreakdownItem,
  FeeBreakdownItem,
} from './types.js';
import type { TaxService } from '../services/tax.service.js';
import {
  Money,
  currencyDecimals,
  rationalFromNumber,
  validateCurrency,
  type Currency,
} from './money.js';

/** Thrown when pricing runs without an explicit currency (DOMAIN.md F2). */
export class PricingCurrencyError extends Error {
  public readonly code = 'PRICING_CURRENCY_REQUIRED';
  constructor(currency: unknown) {
    super(`Pricing requires an explicit ISO 4217 currency; got '${String(currency)}'. Resolve it via currency-resolver before calling the pipeline.`);
    this.name = 'PricingCurrencyError';
  }
}

/** Thrown when the pricing invariant does not hold EXACTLY (minor-unit equality). */
export class PricingInvariantError extends Error {
  public readonly code = 'PRICING_INVARIANT_VIOLATION';
  public readonly breakdown: Record<string, number>;
  constructor(message: string, breakdown: Record<string, number>) {
    super(message);
    this.name = 'PricingInvariantError';
    this.breakdown = breakdown;
  }
}

// ============================================
// Discount Resolver Interface
// ============================================

/**
 * Discount resolvers are injected to handle coupon/gift card/loyalty operations.
 * This decouples the pricing pipeline from specific Supabase RPCs.
 */
export interface CouponResolver {
  /**
   * Apply a coupon and return the discount amount.
   * Must call the atomic RPC and return { discountAmount, taxSavings, couponId }.
   * Returns null if coupon is invalid/expired.
   *
   * `taxSavings` is ATTRIBUTION-ONLY: tax is computed by the pipeline on the
   * post-coupon taxable base (invariant 3), so returning a non-zero taxSavings
   * here must NOT be added to the total discount — it is stored on the
   * breakdown for reporting, never subtracted again.
   */
  apply(
    couponCode: string,
    subtotal: number,
    customerId?: string,
    moduleId?: string,
  ): Promise<{ discountAmount: number; taxSavings: number; couponId: string } | null>;
}

export interface GiftCardResolver {
  /**
   * Redeem a gift card for up to `maxAmount`.
   * Must call the atomic RPC.
   * Returns actual amount deducted.
   */
  redeem(
    giftCardCode: string,
    maxAmount: number,
  ): Promise<{ amountDeducted: number; giftCardId: string } | null>;
}

export interface LoyaltyResolver {
  /**
   * Redeem loyalty points for up to `maxAmount`.
   * Must call the atomic RPC.
   * Returns actual amount deducted and points used.
   */
  redeem(
    customerId: string,
    pointsToRedeem: number,
    maxAmount: number,
  ): Promise<{ amountDeducted: number; pointsUsed: number } | null>;

  /**
   * Calculate and award loyalty points for a completed transaction.
   * Returns points earned.
   */
  earn(
    customerId: string,
    totalAmount: number,
    moduleId: string,
  ): Promise<number>;
}

// ============================================
// Pricing Pipeline
// ============================================

export interface PricingPipelineDeps {
  taxService: TaxService;
  couponResolver?: CouponResolver;
  giftCardResolver?: GiftCardResolver;
  loyaltyResolver?: LoyaltyResolver;
}

export class PricingPipeline {
  private readonly deps: PricingPipelineDeps;

  constructor(deps: PricingPipelineDeps) {
    this.deps = deps;
  }

  /**
   * Calculate the complete pricing for a set of line items.
   *
   * This is the SINGLE entry point for ALL financial calculations in the system.
   * Every monetary value is an exact bigint Money; Number is used only at the
   * JSON / TaxService / resolver boundaries.
   */
  async calculate(
    lineItems: PricingLineItem[],
    config: PricingConfig,
    context: PricingContext,
  ): Promise<PricingResult> {
    // ---- Step 0: Currency authority (DOMAIN.md F2) ----
    // The pipeline never invents a currency: the caller must resolve one
    // (currency-resolver) and pass it in context. Missing/invalid currency
    // fails loudly — there is no implicit default.
    if (!context.currency) {
      throw new PricingCurrencyError(context.currency);
    }
    validateCurrency(context.currency);
    const currency = context.currency as Currency;
    const decimals = currencyDecimals(currency);
    // Output precision derives from the CURRENCY's ISO 4217 metadata; the
    // engine's configured decimalPlaces may only REDUCE it (display rounding).
    const precision = Math.min(config.decimalPlaces, decimals);
    const round = (m: Money): Money => m.withDecimals(precision, config.rounding);

    // ---- Step 1: Calculate subtotal (exact per-line bigint) ----
    const processedLineItems = lineItems.map((item, idx) => {
      const unitPrice = Money.fromDecimal(item.unitPrice ?? 0, currency);
      const unitAdj = item.unitAdjustment
        ? Money.fromDecimal(item.unitAdjustment, currency)
        : Money.zero(currency);
      // Quantity is an exact rational (supports fractional quantities).
      const quantity = rationalFromNumber(item.quantity);
      const lineTotal = unitPrice.add(unitAdj).multiplyBy(quantity);
      return {
        itemId: item.itemId || `line-${idx}`,
        name: item.name,
        unitPrice: item.unitPrice,
        unitAdjustment: item.unitAdjustment ?? 0,
        quantity: item.quantity,
        lineTotalMoney: lineTotal,
        lineTotal: lineTotal.amount(),
      };
    });

    let subtotal = Money.zero(currency);
    for (const item of processedLineItems) subtotal = subtotal.add(item.lineTotalMoney);

    // ---- Step 2: Apply pre-tax discounts (coupons are pre-tax) ----
    const discounts: DiscountBreakdown[] = [];
    let preBasketDiscount = Money.zero(currency);

    if (config.supportsCoupons && context.couponCode && this.deps.couponResolver) {
      const couponResult = await this.deps.couponResolver.apply(
        context.couponCode,
        subtotal.amount(),
        context.customerId,
        context.moduleId,
      );
      if (couponResult) {
        // RPC amounts are boundary numbers — converted to exact Money here.
        const discount = Money.fromDecimal(couponResult.discountAmount, currency);
        const taxSavings = Money.fromDecimal(couponResult.taxSavings ?? 0, currency);
        preBasketDiscount = preBasketDiscount.add(discount);
        discounts.push({
          type: 'coupon',
          referenceId: couponResult.couponId,
          label: `Coupon: ${context.couponCode}`,
          amount: discount.amount(),
          // Attribution-only — never subtracted again (see invariant 3).
          taxSavings: taxSavings.amount(),
        });
      }
    }

    // ---- Step 3: Calculate tax using multi-rate tax service ----
    let taxRate = 0;
    let taxAmount = Money.zero(currency);
    let taxBreakdown: TaxBreakdownItem[] = [];
    const paymentMethod = (context.conditions ?? {}).paymentMethod as string | undefined;

    if (config.applyTax) {
      const taxable = subtotal.subtract(preBasketDiscount);
      const taxableAmount = taxable.isNegative() ? Money.zero(currency) : taxable;
      taxBreakdown = await this.deps.taxService.computeTaxBreakdown(
        lineItems,
        taxableAmount.amount(),
        context.moduleId,
        paymentMethod,
        context.propertyId
      );
      for (const item of taxBreakdown) {
        taxAmount = taxAmount.add(Money.fromDecimal(item.amount, currency));
      }
      // Legacy taxRate for backward compatibility (use first tax rate or default)
      taxRate = taxBreakdown.length > 0 ? taxBreakdown[0].rate / 100 : await this.deps.taxService.getTaxRate(context.moduleId ?? 'default');
    }

    // ---- Step 4: Calculate fees from CMS tax configuration ----
    let feeBreakdown: FeeBreakdownItem[] = [];
    if (config.applyFees) {
      feeBreakdown = await this.deps.taxService.computeFeeBreakdown(
        lineItems,
        paymentMethod,
        context.moduleId,
        context.propertyId
      );
    }
    let totalFees = Money.zero(currency);
    for (const f of feeBreakdown) totalFees = totalFees.add(Money.fromDecimal(f.amount, currency));

    // Backward-compatible aggregate buckets for the financial ledger and reporting layer,
    // which persist service_charge/delivery_fee as separate columns: delivery_fee rates
    // roll into deliveryFee, every other fee_type (service_charge/resort_fee/custom) rolls
    // into serviceCharge. Together they always equal totalFees — no fee amount is dropped.
    let deliveryFee = Money.zero(currency);
    for (const f of feeBreakdown) {
      if (f.type === 'delivery_fee') deliveryFee = deliveryFee.add(Money.fromDecimal(f.amount, currency));
    }
    const serviceCharge = totalFees.subtract(deliveryFee);
    // Effective blended rate, for display purposes only — meaningful when a single
    // percentage-based fee applies, best-effort when several stack.
    const serviceChargeRate = subtotal.isZero() ? 0 : Number(serviceCharge.minorUnits) / Number(subtotal.minorUnits);

    // ---- Step 6: Pre-discount total ----
    const preDiscountTotal = subtotal.add(taxAmount).add(serviceCharge).add(deliveryFee);

    // ---- Step 7: Post-tax discounts (gift cards & loyalty, applied to total) ----
    let remainingTotal = preDiscountTotal.subtract(preBasketDiscount);

    // Gift cards
    if (config.supportsGiftCards && context.giftCardCodes?.length && this.deps.giftCardResolver) {
      for (const code of context.giftCardCodes) {
        if (remainingTotal.isNegative() || remainingTotal.isZero()) break;
        const result = await this.deps.giftCardResolver.redeem(code, remainingTotal.amount());
        if (result) {
          const deducted = Money.fromDecimal(result.amountDeducted, currency);
          remainingTotal = remainingTotal.subtract(deducted);
          discounts.push({
            type: 'gift_card',
            referenceId: result.giftCardId,
            label: `Gift Card: ${code}`,
            amount: deducted.amount(),
            taxSavings: 0,
          });
        }
      }
    }

    // Loyalty points
    if (
      config.supportsLoyaltyRedemption &&
      context.loyaltyPointsToRedeem &&
      context.customerId &&
      this.deps.loyaltyResolver
    ) {
      if (remainingTotal.isPositive()) {
        const result = await this.deps.loyaltyResolver.redeem(
          context.customerId,
          context.loyaltyPointsToRedeem,
          remainingTotal.amount(),
        );
        if (result) {
          const deducted = Money.fromDecimal(result.amountDeducted, currency);
          remainingTotal = remainingTotal.subtract(deducted);
          discounts.push({
            type: 'loyalty',
            referenceId: context.customerId,
            label: `Loyalty Points: ${result.pointsUsed} points`,
            amount: deducted.amount(),
            taxSavings: 0,
            metadata: { pointsUsed: result.pointsUsed },
          });
        }
      }
    }

    // ---- Step 8: Calculate totals ----
    // totalDiscount = sum of discount AMOUNTS only. Coupon taxSavings is not
    // included: taxAmount was already computed on the post-coupon base (invariant 3).
    let totalDiscount = Money.zero(currency);
    for (const d of discounts) totalDiscount = totalDiscount.add(Money.fromDecimal(d.amount, currency));

    // ---- Step 9: Loyalty points earned ----
    // Note: loyalty earning should happen ONLY ONCE (either at order creation or payment confirmation, not both)
    // The engine definition specifies when to earn — this pipeline only calculates, doesn't trigger.
    // The caller decides when to call loyaltyResolver.earn().
    const loyaltyPointsEarned = 0;

    // ---- Step 10: Deposit (for reservations) ----
    const depositAmount = this.calculateDeposit(
      preDiscountTotal.subtract(totalDiscount),
      context,
      currency,
    );

    // ---- Step 11: Round to output precision, then derive total from the ROUNDED
    // components so the displayed invariant holds EXACTLY (sum of displayed parts). ----
    const roundedSubtotal = round(subtotal);
    const roundedTax = round(taxAmount);
    const roundedService = round(serviceCharge);
    const roundedDelivery = round(deliveryFee);
    const roundedDiscount = round(totalDiscount);

    let totalAmount = roundedSubtotal
      .add(roundedTax)
      .add(roundedService)
      .add(roundedDelivery)
      .subtract(roundedDiscount);
    if (totalAmount.isNegative()) {
      totalAmount = Money.zero(currency, precision);
    }

    // Validate the invariant EXACTLY (minor-unit equality) — throws on violation.
    this.assertInvariant(currency, precision, {
      subtotal: roundedSubtotal,
      taxAmount: roundedTax,
      serviceCharge: roundedService,
      deliveryFee: roundedDelivery,
      totalDiscount: roundedDiscount,
      totalAmount,
    });

    const result: PricingResult = {
      currency,
      subtotal: roundedSubtotal.amount(),
      taxAmount: roundedTax.amount(),
      taxRate,
      taxBreakdown,
      serviceCharge: roundedService.amount(),
      serviceChargeRate,
      deliveryFee: roundedDelivery.amount(),
      feeBreakdown,
      preDiscountTotal: round(preDiscountTotal).amount(),
      discounts: discounts.map(d => ({
        ...d,
        amount: round(Money.fromDecimal(d.amount, currency)).amount(),
        taxSavings: round(Money.fromDecimal(d.taxSavings, currency)).amount(),
      })),
      totalDiscount: roundedDiscount.amount(),
      totalAmount: totalAmount.amount(),
      lineItems: processedLineItems.map(({ lineTotalMoney, ...item }) => ({
        ...item,
        lineTotal: round(lineTotalMoney).amount(),
      })),
      loyaltyPointsEarned,
      depositAmount: round(depositAmount).amount(),
      // Economics reporting fields
      staffId: context.staffId,
      propertyId: context.propertyId,
      moduleId: context.moduleId,
      promoCodeUsed: context.promoCodeUsed || context.couponCode,
      cancellationReason: context.cancellationReason,
      refundAmount: context.refundAmount,
      refundReason: context.refundReason,
    };

    return result;
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Calculate deposit for reservation-type engines (exact Money).
   */
  private calculateDeposit(
    totalAmount: Money,
    context: PricingContext,
    currency: Currency,
  ): Money {
    // Deposit config comes from module settings / context
    const depositConfig = (context.conditions ?? {}).depositConfig as
      | { type: 'fixed'; amount: number }
      | { type: 'percentage'; rate: number }
      | undefined;

    if (!depositConfig) return Money.zero(currency);

    if (depositConfig.type === 'fixed') {
      const fixed = Money.fromDecimal(depositConfig.amount, currency);
      return fixed.compare(totalAmount) > 0 ? totalAmount : fixed;
    }

    if (depositConfig.type === 'percentage') {
      return totalAmount.multiplyBy(rationalFromNumber(depositConfig.rate));
    }

    return Money.zero(currency);
  }

  /**
   * Enforce the pricing invariant EXACTLY.
   *
   *   totalAmount == subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount
   *
   * computed on the ROUNDED components (minor-unit equality). Any mismatch —
   * including a currency inconsistency surfacing as a Money mismatch — THROWS
   * instead of logging. A pricing result that violates the invariant must never
   * reach the ledger, a fiscal document, or a customer.
   */
  private assertInvariant(
    currency: Currency,
    precision: number,
    parts: {
      subtotal: Money;
      taxAmount: Money;
      serviceCharge: Money;
      deliveryFee: Money;
      totalDiscount: Money;
      totalAmount: Money;
    },
  ): void {
    const expected = parts.subtotal
      .add(parts.taxAmount)
      .add(parts.serviceCharge)
      .add(parts.deliveryFee)
      .subtract(parts.totalDiscount);
    const clamped = expected.isNegative() ? Money.zero(currency, precision) : expected;

    if (!clamped.equals(parts.totalAmount)) {
      const breakdown = {
        subtotal: parts.subtotal.amount(),
        taxAmount: parts.taxAmount.amount(),
        serviceCharge: parts.serviceCharge.amount(),
        deliveryFee: parts.deliveryFee.amount(),
        totalDiscount: parts.totalDiscount.amount(),
        expected: clamped.amount(),
        actual: parts.totalAmount.amount(),
      };
      throw new PricingInvariantError(
        `Pricing invariant violation: expected ${clamped.toString()}, got ${parts.totalAmount.toString()} (${currency})`,
        breakdown,
      );
    }
  }
}
