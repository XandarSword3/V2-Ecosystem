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
      const { data: couponResult, error: couponError } = await supabase.rpc(
        'apply_coupon_atomic',
        {
          p_code: couponCode.toUpperCase(),
          p_user_id: customerId || null,
          p_order_total: subtotal,
          p_order_id: null, // Order ID not known yet at pricing time
          p_module_type: 'all',
        },
      );

      if (couponError) {
        logger.warn('[COUPON RESOLVER] Coupon application failed:', couponError);
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

      if (couponResult && couponResult[0]?.error_message) {
        logger.warn('[COUPON RESOLVER] Coupon invalid:', couponResult[0].error_message);
      }

      return null;
    } catch (err) {
      logger.warn('[COUPON RESOLVER] Coupon error (non-fatal):', err);
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
      const { data: gcResult, error: gcError } = await supabase.rpc(
        'redeem_giftcard_atomic',
        {
          p_code: giftCardCode.toUpperCase(),
          p_amount: maxAmount,
          p_order_id: null, // Can be linked later
        },
      );

      if (gcError) {
        logger.warn('[GIFT CARD RESOLVER] Gift card redemption failed:', gcError);
        return null;
      }

      if (gcResult && gcResult[0]?.success) {
        const amountDeducted = parseFloat(gcResult[0].amount_redeemed) || 0;
        return {
          amountDeducted,
          giftCardId: gcResult[0].gift_card_id,
        };
      }

      return null;
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
