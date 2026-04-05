import { getSupabase } from "../../database/connection.js";
import { logger } from "../../utils/logger.js";

/**
 * Award loyalty points to a user after a successful payment.
 * This is called automatically from the Stripe webhook when payment succeeds.
 *
 * FIX: Issue 17 — Uses atomic RPC (earn_loyalty_points_atomic) instead of
 * SELECT→UPDATE sequence to prevent race conditions from concurrent webhooks.
 */
export async function awardLoyaltyPointsForPayment(
  referenceType: string,
  referenceId: string,
  amountDollars: number
): Promise<void> {
  const supabase = getSupabase();

  try {
    // Get loyalty settings to check if loyalty is enabled and get points_per_dollar
    const { data: settings } = await supabase
      .from('loyalty_settings')
      .select('*')
      .limit(1)
      .single();

    if (!settings?.is_enabled) {
      logger.info('Loyalty system is disabled, skipping points award');
      return;
    }

    const pointsPerDollar = settings.points_per_dollar || 1;

    // Find the user ID based on the reference type and ID
    let userId: string | null = null;

    switch (referenceType) {
      case 'restaurant_order': {
        const { data: order } = await supabase
          .from('restaurant_orders')
          .select('user_id')
          .eq('id', referenceId)
          .single();
        userId = order?.user_id;
        break;
      }
      case 'snack_order': {
        const { data: order } = await supabase
          .from('snack_orders')
          .select('user_id')
          .eq('id', referenceId)
          .single();
        userId = order?.user_id;
        break;
      }
      case 'chalet_booking': {
        const { data: booking } = await supabase
          .from('chalet_bookings')
          .select('user_id')
          .eq('id', referenceId)
          .single();
        userId = booking?.user_id;
        break;
      }
      case 'pool_ticket': {
        const { data: ticket } = await supabase
          .from('pool_tickets')
          .select('user_id')
          .eq('id', referenceId)
          .single();
        userId = ticket?.user_id;
        break;
      }
    }

    if (!userId) {
      logger.info(`No user found for ${referenceType}:${referenceId}, skipping loyalty points`);
      return;
    }

    // Calculate base points
    const basePoints = Math.floor(amountDollars * pointsPerDollar);
    if (basePoints <= 0) {
      logger.info('Payment amount too small for points, skipping');
      return;
    }

    // FIX: Issue 17 — Use atomic RPC instead of SELECT→UPDATE to prevent
    // lost-update race conditions when concurrent webhooks fire
    const { data: result, error: rpcError } = await supabase.rpc(
      'earn_loyalty_points_atomic',
      {
        p_user_id: userId,
        p_order_total: amountDollars,
        p_order_id: referenceId,
        p_points_per_dollar: pointsPerDollar,
      }
    );

    if (rpcError) {
      logger.error('Atomic loyalty points RPC failed:', rpcError);
      return;
    }

    const row = result?.[0];
    if (!row?.success) {
      logger.warn(`Loyalty points award failed for ${referenceType}:${referenceId}: ${row?.error_message}`);
      return;
    }

    logger.info(`Awarded ${row.points_earned} loyalty points (${row.tier_multiplier}x multiplier) to user ${userId} for ${referenceType}:${referenceId}`);
  } catch (error: any) {
    logger.error('Error awarding loyalty points:', error.message);
    // Don't throw - we don't want to fail the payment webhook for loyalty issues
  }
}
