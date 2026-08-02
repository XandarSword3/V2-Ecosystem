/**
 * Discount Reversal & Linking
 *
 * Coupons and gift cards are consumed atomically inside PricingPipeline.calculate()
 * (via discount-resolvers.ts), which runs BEFORE the entity row (order/booking/
 * ticket/subscription) exists — the resolvers call apply_coupon_atomic /
 * redeem_giftcard_atomic with p_order_id = null because the id genuinely isn't
 * known yet.
 *
 * That leaves two gaps this module closes:
 *   1. LINKING — once the entity row is created, the orphaned coupon_usage /
 *      gift_card_transactions row (order_id IS NULL) needs to be backfilled with
 *      the real id, or there is no way to trace a specific order back to what it
 *      consumed.
 *   2. REVERSAL — if entity creation fails after pricing already consumed a
 *      discount, or the order is later cancelled/refunded, the consumed
 *      usage/balance must be given back. Nothing previously did this outside one
 *      dead, unreachable REST endpoint (coupon.controller.ts's old applyCoupon).
 *
 * Both entry points are used across all five engine creation routes in
 * dynamic-module.router.ts, plus order cancellation and payment refund.
 *
 * NOTE: loyalty-point redemption has the identical unreversed-consumption gap
 * (see SupabaseLoyaltyResolver.redeem in discount-resolvers.ts) but is out of
 * scope here — flagged, not fixed, in reverseDiscounts() below.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiscountBreakdown } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Backfill the order_id on whichever coupon_usage / gift_card_transactions
 * row was just created for this order (they were inserted with order_id NULL
 * at pricing time, before this order existed). Best-effort: matches the most
 * recent unlinked row for the same coupon/gift card (+ user, when known),
 * mirroring the same fallback matching reverse_coupon_usage() already used
 * before this fix existed. Non-fatal — a failure here only affects future
 * traceability/reversal-by-order-id, not the order itself.
 */
export async function linkDiscountsToOrder(
  supabase: SupabaseClient,
  discounts: DiscountBreakdown[],
  orderId: string,
  userId?: string,
): Promise<void> {
  for (const discount of discounts) {
    if (!discount.referenceId) continue;

    try {
      if (discount.type === 'coupon') {
        let query = supabase
          .from('coupon_usage')
          .select('id')
          .eq('coupon_id', discount.referenceId)
          .is('order_id', null)
          .order('used_at', { ascending: false })
          .limit(1);
        query = userId ? query.eq('user_id', userId) : query.is('user_id', null);
        const { data: row } = await query.maybeSingle();
        if (row?.id) {
          await supabase.from('coupon_usage').update({ order_id: orderId }).eq('id', row.id);
        }
      } else if (discount.type === 'gift_card') {
        const { data: row } = await supabase
          .from('gift_card_transactions')
          .select('id')
          .eq('gift_card_id', discount.referenceId)
          .is('order_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (row?.id) {
          await supabase.from('gift_card_transactions').update({ order_id: orderId }).eq('id', row.id);
        }
      }
    } catch (err) {
      logger.warn('[DISCOUNT LINK] Failed to backfill order_id on discount usage row (non-fatal)', {
        type: discount.type,
        referenceId: discount.referenceId,
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Reverse whichever coupon/gift-card discounts were already atomically
 * consumed by PricingPipeline.calculate(), because the entity that consumed
 * them either failed to get created, or was cancelled/refunded afterward.
 *
 * Pass orderId once the entity exists (cancel/refund case) so the RPC can
 * target the exact usage row; omit it for the creation-failure case, where
 * reverse_coupon_usage/restore_gift_card_balance fall back to "most recent
 * unlinked usage for this coupon/gift card" — safe here because nothing else
 * could have linked it in the few hundred ms since it was consumed.
 */
export async function reverseDiscounts(
  supabase: SupabaseClient,
  discounts: DiscountBreakdown[],
  opts: { userId?: string; orderId?: string } = {},
): Promise<void> {
  for (const discount of discounts) {
    if (!discount.referenceId) continue;

    try {
      if (discount.type === 'coupon') {
        const { error } = await supabase.rpc('reverse_coupon_usage', {
          p_coupon_id: discount.referenceId,
          p_user_id: opts.userId || null,
          p_order_id: opts.orderId || null,
        });
        if (error) throw error;
        logger.info('[DISCOUNT REVERSAL] Reversed coupon usage', { couponId: discount.referenceId, orderId: opts.orderId });
      } else if (discount.type === 'gift_card') {
        const { error } = await supabase.rpc('restore_gift_card_balance', {
          p_gift_card_id: discount.referenceId,
          p_amount: discount.amount,
          p_order_id: opts.orderId || null,
        });
        if (error) throw error;
        logger.info('[DISCOUNT REVERSAL] Restored gift card balance', { giftCardId: discount.referenceId, amount: discount.amount, orderId: opts.orderId });
      } else if (discount.type === 'loyalty') {
        // Same unreversed-consumption gap as coupons/gift cards
        // (SupabaseLoyaltyResolver.redeem never gets compensated). Not fixed
        // here — logged so it's visible rather than silently wrong.
        logger.warn('[DISCOUNT REVERSAL] Loyalty point redemption was consumed but reversal is not implemented', {
          customerId: discount.referenceId,
          orderId: opts.orderId,
        });
      }
    } catch (err) {
      // Non-fatal by design, same rationale as the ledger write: a reversal
      // failure must not block the caller's own error handling (order
      // creation failure response, cancellation, or refund). It IS a real
      // money leak if it happens, so it's logged at error level, not warn.
      logger.error('[DISCOUNT REVERSAL] Failed to reverse discount — usage/balance NOT restored', {
        type: discount.type,
        referenceId: discount.referenceId,
        orderId: opts.orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
