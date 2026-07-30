/**
 * Discount Resolvers
 * 
 * Bridge between the engine pricing pipeline and the existing Supabase atomic RPCs.
 * These implement the CouponResolver, GiftCardResolver, and LoyaltyResolver interfaces.
 * 
 * Each resolver wraps the existing atomic RPC call patterns from order.service.ts
 * but makes them reusable across ALL engines (not just a single engine type).
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import type { CouponResolver, GiftCardResolver, LoyaltyResolver } from './pricing-pipeline.js';

// ============================================
// Coupon Resolver
// ============================================

export class SupabaseCouponResolver implements CouponResolver {
  async apply(
    couponCode: string,
    subtotal: number,
    customerId?: string,
    moduleId?: string,
  ): Promise<{ discountAmount: number; taxSavings: number; couponId: string } | null> {
    const supabase = getSupabase();

    try {
      // apply_coupon_atomic's p_module_type is matched against the coupon's
      // `applies_to` column, which stores the module SLUG (e.g. 'delete'),
      // not the module's UUID — see coupon.controller.ts's validateCoupon,
      // which correctly forwards the slug as `orderType`. This resolver only
      // receives `moduleId` (the UUID) from the pricing pipeline, so it must
      // be resolved to the slug here before calling the RPC. Previously this
      // was hardcoded to 'all', which made every applies_to-scoped coupon
      // fail at checkout regardless of which module the order was actually
      // for, even though the same coupon validated fine on the cart page.
      let moduleType = 'all';
      if (moduleId) {
        const { data: moduleRow, error: moduleError } = await supabase
          .from('modules')
          .select('slug')
          .eq('id', moduleId)
          .maybeSingle();
        if (moduleError) {
          logger.warn('[COUPON RESOLVER] Failed to resolve module slug for coupon scoping', { moduleId, error: moduleError.message });
        } else if (moduleRow?.slug) {
          moduleType = moduleRow.slug;
        }
      }

      const { data: couponResult, error: couponError } = await supabase.rpc(
        'apply_coupon_atomic',
        {
          p_code: couponCode.toUpperCase(),
          p_user_id: customerId || null,
          p_order_total: subtotal,
          p_order_id: null, // Order ID not known yet at pricing time
          p_module_type: moduleType,
        },
      );

      if (couponError) {
        logger.warn('[COUPON RESOLVER] Coupon application failed', { code: couponCode, error: couponError.message });
        return null;
      }

      if (couponResult && couponResult[0]?.success) {
        const discountAmount = parseFloat(couponResult[0].discount_amount) || 0;
        return {
          discountAmount,
          taxSavings: 0, // Tax savings calculated by the pipeline based on pre/post-tax position
          couponId: couponResult[0].coupon_id,
        };
      }

      // NOTE: previously this passed error_message as a bare string second
      // argument to logger.warn(). The logger (utils/logger.ts) only merges
      // plain-OBJECT extra args into the printed line; a bare string extra
      // arg is silently dropped with no format.splat() configured. That's
      // why every real rejection reason ("Coupon not valid for this order
      // type", "Coupon usage limit reached", etc.) printed as a blank
      // "Coupon invalid:" with nothing after it. Wrapping it in an object
      // makes it actually show up in the logs.
      if (couponResult && couponResult[0]?.error_message) {
        logger.warn('[COUPON RESOLVER] Coupon invalid', { code: couponCode, reason: couponResult[0].error_message });
      }

      return null;
    } catch (err) {
      logger.warn('[COUPON RESOLVER] Coupon error (non-fatal)', { code: couponCode, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }
}

// ============================================
// Gift Card Resolver
// ============================================

export class SupabaseGiftCardResolver implements GiftCardResolver {
  async redeem(
    giftCardCode: string,
    maxAmount: number,
  ): Promise<{ amountDeducted: number; giftCardId: string } | null> {
    const supabase = getSupabase();

    try {
      const upperCode = giftCardCode.toUpperCase();

      // 1. Fetch gift card
      const { data: card, error: fetchErr } = await supabase
        .from('gift_cards')
        .select('id, current_balance, status, expires_at, tenant_id')
        .eq('code', upperCode)
        .maybeSingle();

      if (fetchErr || !card) {
        logger.warn('[GIFT CARD RESOLVER] Card not found', { code: upperCode });
        return null;
      }

      if (card.status !== 'active') {
        logger.warn('[GIFT CARD RESOLVER] Card not active', { status: card.status });
        return null;
      }

      if (card.expires_at && new Date(card.expires_at) < new Date()) {
        logger.warn('[GIFT CARD RESOLVER] Card expired');
        return null;
      }

      const balance = parseFloat(card.current_balance) || 0;
      if (balance <= 0) return null;

      const amountToDeduct = Math.min(maxAmount, balance);
      const newBalance = balance - amountToDeduct;

      // 2. Deduct balance
      const { error: updateErr } = await supabase
        .from('gift_cards')
        .update({
          current_balance: newBalance,
          status: newBalance <= 0 ? 'used' : 'active',
        })
        .eq('id', card.id);

      if (updateErr) {
        logger.warn('[GIFT CARD RESOLVER] Failed to update balance:', updateErr);
        return null;
      }

      // 3. Record transaction WITH tenant_id
      const { error: txErr } = await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: card.id,
          type: 'redemption',
          amount: -amountToDeduct,
          balance_after: newBalance,
          tenant_id: card.tenant_id,
        });

      if (txErr) {
        logger.warn('[GIFT CARD RESOLVER] Transaction log failed (non-blocking):', txErr);
        // Don't fail the redemption — balance was already deducted
      }

      return {
        amountDeducted: amountToDeduct,
        giftCardId: card.id,
      };
    } catch (err) {
      logger.warn('[GIFT CARD RESOLVER] Gift card error (non-fatal):', err);
      return null;
    }
  }
}

// ============================================
// Loyalty Resolver
// ============================================

export class SupabaseLoyaltyResolver implements LoyaltyResolver {
  async redeem(
    customerId: string,
    pointsToRedeem: number,
    maxAmount: number,
  ): Promise<{ amountDeducted: number; pointsUsed: number } | null> {
    const supabase = getSupabase();

    try {
      const pointsDollarValue = pointsToRedeem / 100; // Default: 100 points = $1
      const redeemAmount = Math.min(pointsDollarValue, maxAmount);

      const { data: loyaltyResult, error: loyaltyError } = await supabase.rpc(
        'redeem_loyalty_points_atomic',
        {
          p_user_id: customerId,
          p_points: pointsToRedeem,
          p_order_id: null, // Can be linked later
          p_dollar_value: redeemAmount,
        },
      );

      if (loyaltyError) {
        logger.warn('[LOYALTY RESOLVER] Loyalty redemption failed:', loyaltyError);
        return null;
      }

      if (loyaltyResult && loyaltyResult[0]?.success) {
        return {
          amountDeducted: redeemAmount,
          pointsUsed: loyaltyResult[0].points_redeemed || 0,
        };
      }

      return null;
    } catch (err) {
      logger.warn('[LOYALTY RESOLVER] Loyalty error (non-fatal):', err);
      return null;
    }
  }

  async earn(
    customerId: string,
    totalAmount: number,
    moduleId: string,
  ): Promise<number> {
    const supabase = getSupabase();

    try {
      // Get loyalty settings
      const { data: settings } = await supabase
        .from('loyalty_settings')
        .select('*')
        .limit(1)
        .single();

      if (!settings?.is_enabled) {
        return 0;
      }

      const pointsPerDollar = settings.points_per_dollar || 1;

      const { data: earnResult, error: earnError } = await supabase.rpc(
        'earn_loyalty_points_atomic',
        {
          p_user_id: customerId,
          p_order_total: totalAmount,
          p_order_id: moduleId, // Using moduleId as reference
          p_points_per_dollar: pointsPerDollar,
        },
      );

      if (earnError) {
        logger.warn('[LOYALTY RESOLVER] Loyalty earn failed:', earnError);
        return 0;
      }

      if (earnResult && earnResult[0]?.success) {
        return earnResult[0].points_earned || 0;
      }

      return 0;
    } catch (err) {
      logger.warn('[LOYALTY RESOLVER] Loyalty earn error (non-fatal):', err);
      return 0;
    }
  }
}

// ============================================
// Factory
// ============================================

/**
 * Create all discount resolvers with Supabase implementations.
 */
export function createDiscountResolvers() {
  return {
    couponResolver: new SupabaseCouponResolver(),
    giftCardResolver: new SupabaseGiftCardResolver(),
    loyaltyResolver: new SupabaseLoyaltyResolver(),
  };
}
