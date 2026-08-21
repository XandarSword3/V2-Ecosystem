/**
 * Unified Pricing Pipeline
 * 
 * ONE universal pricing calculation that ALL engines route through.
 * This replaces the four legacy per-module financial calculators
 * (instant-transaction.engine, time-exclusive-reservation.engine, shared-capacity-access.engine, ongoing-entitlement.engine).
 * 
 * FINANCIAL INVARIANTS:
 *   1. totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount
 *      (serviceCharge + deliveryFee together always equal the sum of feeBreakdown — see Step 4)
 *   2. totalAmount >= 0 (never negative)
 *   3. Tax is (subtotal - preBasketDiscount) * taxRate
 *   4. Fees (service charge, delivery fee, resort fee, custom surcharges) are entirely
 *      CMS-driven via tax_configuration fee_type rates — there are no hardcoded rates,
 *      flat amounts, or order-type conditions. See TaxService.computeFeeBreakdown().
 *   5. Discounts are applied in order: coupon → gift card → loyalty
 *   6. Each discount is capped at remaining balance (no negative intermediate totals)
 *   7. All monetary values are rounded to decimalPlaces at final output (not intermediate)
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
import { logger } from '../utils/logger.js';
import { roundMoney, validateCurrency } from './money.js';

/** Thrown when pricing runs without an explicit currency (DOMAIN.md F2). */
export class PricingCurrencyError extends Error {
  public readonly code = 'PRICING_CURRENCY_REQUIRED';
  constructor(currency: unknown) {
    super(`Pricing requires an explicit ISO 4217 currency; got '${String(currency)}'. Resolve it via currency-resolver before calling the pipeline.`);
    this.name = 'PricingCurrencyError';
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
   */
  async calculate(
    lineItems: PricingLineItem[],
    config: PricingConfig,
    context: PricingContext,
  ): Promise<PricingResult> {
    const pipelineStart = Date.now();
    console.log('[PricingPipeline] Starting calculation at:', new Date().toISOString());

    // ---- Step 0: Currency authority (DOMAIN.md F2) ----
    // The pipeline never invents a currency: the caller must resolve one
    // (currency-resolver) and pass it in context. Missing currency fails loudly.
    validateCurrency(context.currency);
    const currency = context.currency!;

    // ---- Step 1: Calculate subtotal ----
    const subtotalStart = Date.now();
    const processedLineItems = lineItems.map((item, idx) => {
      const unitAdj = item.unitAdjustment ?? 0;
      const lineTotal = (item.unitPrice + unitAdj) * item.quantity;
      return {
        itemId: item.itemId || `line-${idx}`,
        name: item.name,
        unitPrice: item.unitPrice,
        unitAdjustment: unitAdj,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const subtotal = processedLineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    console.log(`[PricingPipeline] Step 1 (subtotal): ${Date.now() - subtotalStart}ms, subtotal: ${subtotal}`);

    // ---- Step 2: Apply pre-tax discounts (coupons are pre-tax) ----
    const discountStart = Date.now();
    const discounts: DiscountBreakdown[] = [];
    let preBasketDiscount = 0;

    if (config.supportsCoupons && context.couponCode && this.deps.couponResolver) {
      const couponResult = await this.deps.couponResolver.apply(
        context.couponCode,
        subtotal,
        context.customerId,
        context.moduleId,
      );
      if (couponResult) {
        preBasketDiscount += couponResult.discountAmount;
        discounts.push({
          type: 'coupon',
          referenceId: couponResult.couponId,
          label: `Coupon: ${context.couponCode}`,
          amount: couponResult.discountAmount,
          taxSavings: couponResult.taxSavings,
        });
      }
    }
    console.log(`[PricingPipeline] Step 2 (coupons): ${Date.now() - discountStart}ms, discount: ${preBasketDiscount}`);

    // ---- Step 3: Calculate tax using multi-rate tax service ----
    const taxStart = Date.now();
    let taxRate = 0;
    let taxAmount = 0;
    let taxBreakdown: TaxBreakdownItem[] = [];
    const paymentMethod = (context.conditions ?? {}).paymentMethod as string | undefined;

    if (config.applyTax) {
      const taxableAmount = Math.max(0, subtotal - preBasketDiscount);
      taxBreakdown = await this.deps.taxService.computeTaxBreakdown(
        lineItems,
        taxableAmount,
        context.moduleId,
        paymentMethod,
        context.propertyId
      );
      taxAmount = taxBreakdown.reduce((sum, item) => sum + item.amount, 0);
      // Legacy taxRate for backward compatibility (use first tax rate or default)
      taxRate = taxBreakdown.length > 0 ? taxBreakdown[0].rate / 100 : await this.deps.taxService.getTaxRate(context.moduleId ?? 'default');
    }
    console.log(`[PricingPipeline] Step 3 (tax): ${Date.now() - taxStart}ms, taxAmount: ${taxAmount}`);

    // ---- Step 4: Calculate fees from CMS tax configuration ----
    const feeStart = Date.now();
    let feeBreakdown: FeeBreakdownItem[] = [];
    if (config.applyFees) {
      feeBreakdown = await this.deps.taxService.computeFeeBreakdown(
        lineItems,
        paymentMethod,
        context.moduleId,
        context.propertyId
      );
    }
    const totalFees = feeBreakdown.reduce((sum, f) => sum + f.amount, 0);
    console.log(`[PricingPipeline] Step 4 (fees): ${Date.now() - feeStart}ms, totalFees: ${totalFees}`);

    // Backward-compatible aggregate buckets for the financial ledger and reporting layer,
    // which persist service_charge/delivery_fee as separate columns: delivery_fee rates
    // roll into deliveryFee, every other fee_type (service_charge/resort_fee/custom) rolls
    // into serviceCharge. Together they always equal totalFees — no fee amount is dropped.
    const deliveryFee = feeBreakdown
      .filter(f => f.type === 'delivery_fee')
      .reduce((sum, f) => sum + f.amount, 0);
    const serviceCharge = totalFees - deliveryFee;
    // Effective blended rate, for display purposes only — meaningful when a single
    // percentage-based fee applies, best-effort when several stack.
    const serviceChargeRate = subtotal > 0 ? serviceCharge / subtotal : 0;

    // ---- Step 6: Pre-discount total ----
    const preDiscountTotal = subtotal + taxAmount + serviceCharge + deliveryFee;

    // ---- Step 7: Post-tax discounts (gift cards & loyalty, applied to total) ----
    const postDiscountStart = Date.now();
    let remainingTotal = preDiscountTotal - preBasketDiscount;
    // Subtract any tax savings from coupon
    const couponTaxSavings = discounts
      .filter(d => d.type === 'coupon')
      .reduce((sum, d) => sum + d.taxSavings, 0);
    remainingTotal -= couponTaxSavings;

    // Gift cards
    if (config.supportsGiftCards && context.giftCardCodes?.length && this.deps.giftCardResolver) {
      for (const code of context.giftCardCodes) {
        if (remainingTotal <= 0) break;
        const result = await this.deps.giftCardResolver.redeem(code, remainingTotal);
        if (result) {
          remainingTotal -= result.amountDeducted;
          discounts.push({
            type: 'gift_card',
            referenceId: result.giftCardId,
            label: `Gift Card: ${code}`,
            amount: result.amountDeducted,
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
      if (remainingTotal > 0) {
        const result = await this.deps.loyaltyResolver.redeem(
          context.customerId,
          context.loyaltyPointsToRedeem,
          remainingTotal,
        );
        if (result) {
          remainingTotal -= result.amountDeducted;
          discounts.push({
            type: 'loyalty',
            referenceId: context.customerId,
            label: `Loyalty Points: ${result.pointsUsed} points`,
            amount: result.amountDeducted,
            taxSavings: 0,
            metadata: { pointsUsed: result.pointsUsed },
          });
        }
      }
    }

    // ---- Step 8: Calculate totals ----
    const totalDiscount = discounts.reduce((sum, d) => sum + d.amount + d.taxSavings, 0);
    const totalAmount = Math.max(0, preDiscountTotal - totalDiscount);
    console.log(`[PricingPipeline] Step 7 (post-tax discounts): ${Date.now() - postDiscountStart}ms, totalDiscount: ${totalDiscount}`);

    // ---- Step 9: Calculate loyalty points earned ----
    const loyaltyPointsEarned = 0;
    // Note: loyalty earning should happen ONLY ONCE (either at order creation or payment confirmation, not both)
    // The engine definition specifies when to earn — this pipeline only calculates, doesn't trigger.
    // The caller decides when to call loyaltyResolver.earn().

    // ---- Step 10: Calculate deposit (for reservations) ----
    const depositAmount = this.calculateDeposit(totalAmount, context);

    // ---- Step 11: Round and return ----
    const round = (n: number) => this.roundAmount(n, config.decimalPlaces, config.rounding);
    const pipelineTotal = Date.now() - pipelineStart;
    console.log(`[PricingPipeline] Total pipeline time: ${pipelineTotal}ms`);

    const result: PricingResult = {
      currency,
      subtotal: round(subtotal),
      taxAmount: round(taxAmount),
      taxRate,
      taxBreakdown,
      serviceCharge: round(serviceCharge),
      serviceChargeRate,
      deliveryFee: round(deliveryFee),
      feeBreakdown,
      preDiscountTotal: round(preDiscountTotal),
      discounts: discounts.map(d => ({
        ...d,
        amount: round(d.amount),
        taxSavings: round(d.taxSavings),
      })),
      totalDiscount: round(totalDiscount),
      totalAmount: round(totalAmount),
      lineItems: processedLineItems.map(item => ({
        ...item,
        lineTotal: round(item.lineTotal),
      })),
      loyaltyPointsEarned,
      depositAmount: round(depositAmount),
      // Economics reporting fields
      staffId: context.staffId,
      propertyId: context.propertyId,
      moduleId: context.moduleId,
      promoCodeUsed: context.promoCodeUsed || context.couponCode,
      cancellationReason: context.cancellationReason,
      refundAmount: context.refundAmount,
      refundReason: context.refundReason,
    };

    // Validate invariant
    this.validateInvariant(result);

    return result;
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Calculate deposit for reservation-type engines.
   */
  private calculateDeposit(
    totalAmount: number,
    context: PricingContext,
  ): number {
    // Deposit config comes from module settings / context
    const depositConfig = (context.conditions ?? {}).depositConfig as
      | { type: 'fixed'; amount: number }
      | { type: 'percentage'; rate: number }
      | undefined;

    if (!depositConfig) return 0;

    if (depositConfig.type === 'fixed') {
      return Math.min(depositConfig.amount, totalAmount);
    }

    if (depositConfig.type === 'percentage') {
      return totalAmount * depositConfig.rate;
    }

    return 0;
  }

  /**
   * Round a monetary amount according to the configured strategy.
   */
  private roundAmount(
    amount: number,
    decimalPlaces: number,
    strategy: 'round' | 'floor' | 'ceil',
  ): number {
    // Delegate to the canonical deterministic rounding (DOMAIN.md F3).
    return roundMoney(amount, strategy, decimalPlaces);
  }

  /**
   * Validate the pricing invariant.
   * totalAmount should equal subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount
   * (within floating-point tolerance)
   */
  private validateInvariant(result: PricingResult): void {
    const expected = result.subtotal + result.taxAmount + result.serviceCharge + result.deliveryFee - result.totalDiscount;
    const clamped = Math.max(0, expected);
    const diff = Math.abs(result.totalAmount - clamped);

    if (diff > 0.02) {
      // Tolerance for floating-point + rounding
      logger.error('PRICING INVARIANT VIOLATION', {
        expected: clamped,
        actual: result.totalAmount,
        diff,
        breakdown: {
          subtotal: result.subtotal,
          taxAmount: result.taxAmount,
          serviceCharge: result.serviceCharge,
          deliveryFee: result.deliveryFee,
          totalDiscount: result.totalDiscount,
        },
      });
    }
  }
}
