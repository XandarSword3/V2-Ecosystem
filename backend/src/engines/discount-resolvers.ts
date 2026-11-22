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
    dryRun = false,
    tenantId?: string,
  ): Promise<{ discountAmount: number; taxSavings: number; couponId: string } | null> {
    const supabase = getSupabase();

    // Coupon codes are unique per tenant, and apply_coupon_atomic is
    // tenant-scoped. Without a tenant a lookup could match another tenant's
    // code, so fail closed rather than applying a discount that belongs to
    // someone else.
    if (!tenantId) {
      logger.warn('[COUPON RESOLVER] Missing tenantId — refusing coupon application', { code: couponCode });
      return null;
    }

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
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (moduleError) {
          logger.warn('[COUPON RESOLVER] Failed to resolve module slug for coupon scoping', { moduleId, error: moduleError.message });
        } else if (moduleRow?.slug) {
          moduleType = moduleRow.slug;
        }
      }

      // Dry-run (price preview): validate the coupon and quote the same
      // discount the atomic RPC would apply, WITHOUT incrementing
      // usage_count or inserting a coupon_usage row. Preview must never
      // consume a limited-use coupon.
      if (dryRun) {
        const { data: c, error: readError } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', couponCode.toUpperCase())
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .maybeSingle();

        if (readError || !c) return null;

        const now = Date.now();
        if (c.valid_from && new Date(c.valid_from).getTime() > now) return null;
        if (c.valid_until && new Date(c.valid_until).getTime() <= now) return null;
        if (c.applies_to && c.applies_to !== 'all' && c.applies_to !== moduleType) return null;
        if (c.min_order_amount != null && subtotal < Number(c.min_order_amount)) return null;
        if (c.usage_limit != null && Number(c.usage_count ?? 0) >= Number(c.usage_limit)) return null;

        if (customerId && c.per_user_limit != null) {
          const { count } = await supabase
            .from('coupon_usage')
            .select('*', { count: 'exact', head: true })
            .eq('coupon_id', c.id)
            .eq('user_id', customerId);
          if ((count ?? 0) >= Number(c.per_user_limit)) return null;
        }

        let discountAmount = 0;
        if (c.discount_type === 'percentage') {
          discountAmount = subtotal * (Number(c.discount_value) / 100);
          if (c.max_discount_amount != null) {
            discountAmount = Math.min(discountAmount, Number(c.max_discount_amount));
          }
        } else if (c.discount_type === 'fixed_amount' || c.discount_type === 'fixed') {
          discountAmount = Math.min(Number(c.discount_value), subtotal);
        }
        discountAmount = Math.round(discountAmount * 100) / 100;
        if (discountAmount <= 0) return null;

        return { discountAmount, taxSavings: 0, couponId: c.id };
      }

      const { data: couponResult, error: couponError } = await supabase.rpc(
        'apply_coupon_atomic',
        {
          p_code: couponCode.toUpperCase(),
          p_user_id: customerId || null,
          p_order_total: subtotal,
          p_order_id: null, // Order ID not known yet at pricing time
          p_module_type: moduleType,
          p_tenant_id: tenantId,
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
    dryRun = false,
    tenantId?: string,
  ): Promise<{ amountDeducted: number; giftCardId: string } | null> {
    const supabase = getSupabase();

    // Gift cards are tenant-scoped and redeem_giftcard_atomic requires the
    // tenant. Without one a lookup could match another tenant's card.
    if (!tenantId) {
      logger.warn('[GIFT CARD RESOLVER] Missing tenantId — refusing gift card redemption', { code: giftCardCode });
      return null;
    }

    try {
      // Dry-run (price preview): quote the redeemable amount from the current
      // balance only. Never call the mutating RPC �?" a page refresh must not
      // debit a real gift card.
      if (dryRun) {
        const { data: card, error: readError } = await supabase
          .from('gift_cards')
          .select('id, current_balance, status, expires_at')
          .eq('code', giftCardCode.toUpperCase())
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (readError || !card) return null;
        if (card.status !== 'active') return null;
        if (card.expires_at && new Date(card.expires_at).getTime() <= Date.now()) return null;

        const balance = Number(card.current_balance) || 0;
        const amountDeducted = Math.round(Math.min(maxAmount, balance) * 100) / 100;
        if (amountDeducted <= 0) return null;

        return { amountDeducted, giftCardId: card.id };
      }
      // Previously this did a manual fetch -> update -> insert instead of
      // using the existing atomic RPC. Two real bugs from that:
      //   1. No row lock between the fetch and the update, so two concurrent
      //      redemptions of the same card could both read the same balance
      //      and both succeed — a double-spend race. redeem_giftcard_atomic
      //      (supabase/migrations/20260117180005_giftcard_func.sql) already
      //      does `FOR UPDATE` correctly and was sitting unused.
      //   2. The gift_card_transactions insert used the wrong column name
      //      (`type` instead of `transaction_type`), which made every such
      //      insert fail — silently, since the error was caught and logged
      //      as "non-blocking". The balance was still deducted correctly,
      //      but zero audit-trail rows were ever created for a pipeline-
      //      driven redemption, so gift card statements were missing every
      //      real order redemption.
      const { data: result, error: rpcError } = await supabase.rpc('redeem_giftcard_atomic', {
        p_code: giftCardCode.toUpperCase(),
        p_amount: maxAmount,
        p_order_id: null, // Order ID not known yet at pricing time — see discount-reversal.ts
        p_tenant_id: tenantId,
      });

      if (rpcError) {
        logger.warn('[GIFT CARD RESOLVER] Gift card RPC failed', { code: giftCardCode, error: rpcError.message });
        return null;
      }

      const row = result?.[0];
      if (!row?.success) {
        logger.warn('[GIFT CARD RESOLVER] Gift card invalid', { code: giftCardCode, reason: row?.error_message });
        return null;
      }

      return {
        amountDeducted: parseFloat(row.amount_redeemed) || 0,
        giftCardId: row.gift_card_id,
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
    dryRun = false,
    tenantId?: string,
  ): Promise<{ amountDeducted: number; pointsUsed: number } | null> {
    const supabase = getSupabase();

    // Loyalty balances are per-tenant. redeem_loyalty_points_atomic requires
    // the tenant, and an unscoped loyalty_members read could pick another
    // tenant's member row.
    if (!tenantId) {
      logger.warn('[LOYALTY RESOLVER] Missing tenantId — refusing loyalty redemption', { customerId });
      return null;
    }

    try {
      // Never burn more points than the discount they pay for. The previous
      // code passed the full requested point count to the RPC even when the
      // dollar value was capped by the remaining order total, so the customer
      // lost points that bought nothing.
      const maxPointsByAmount = Math.max(0, Math.floor(maxAmount * 100));
      let pointsToUse = Math.min(pointsToRedeem, maxPointsByAmount);

      if (dryRun) {
        const { data: member, error: memberError } = await supabase
          .from('loyalty_members')
          .select('available_points')
          .eq('user_id', customerId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (memberError || !member) return null;
        pointsToUse = Math.min(pointsToUse, Number(member.available_points) || 0);
        if (pointsToUse <= 0) return null;
        return {
          amountDeducted: Math.round(pointsToUse) / 100,
          pointsUsed: pointsToUse,
        };
      }

      const redeemAmount = pointsToUse / 100; // Default: 100 points = $1
      if (pointsToUse <= 0) return null;

      const { data: loyaltyResult, error: loyaltyError } = await supabase.rpc(
        'redeem_loyalty_points_atomic',
        {
          p_user_id: customerId,
          p_points: pointsToUse,
          p_order_id: null, // Can be linked later
          p_dollar_value: redeemAmount,
          p_tenant_id: tenantId,
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
    tenantId?: string,
  ): Promise<number> {
    const supabase = getSupabase();

    try {
      // Get loyalty settings (tenant-scoped: every tenant configures its own
      // earn rate, and an unscoped .limit(1) could read another tenant's).
      let settingsQuery = supabase.from('loyalty_settings').select('*');
      if (tenantId) settingsQuery = settingsQuery.eq('tenant_id', tenantId);
      const { data: settings } = await settingsQuery.limit(1).maybeSingle();

      if (!settings) {
        // N2 fix: the gate used to read `settings?.is_enabled`, but
        // loyalty_settings has NO is_enabled column (baseline schema,
        // confirmed against the deployed DB) — the optional-chained access
        // was always `undefined`, making earn permanently dead code here.
        // The intended semantic is "loyalty is off when no settings row
        // exists": the row's presence IS the enablement.
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
          p_tenant_id: tenantId ?? null,
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
