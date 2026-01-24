import { getSupabase } from "../../database/connection.js";
import { logger } from "../../utils/logger.js";

/**
 * Award loyalty points to a user after a successful payment.
 * This is called automatically from the Stripe webhook when payment succeeds.
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

    // Get or create loyalty account
    let { data: account } = await supabase
      .from('loyalty_accounts')
      .select(`*, tier:loyalty_tiers(points_multiplier)`)
      .eq('user_id', userId)
      .single();

    if (!account) {
      // Create account with default tier
      const { data: defaultTier } = await supabase
        .from('loyalty_tiers')
        .select('id')
        .order('min_points', { ascending: true })
        .limit(1)
        .single();

      const signupBonus = settings.signup_bonus || 0;

      const { data: newAccount, error: createError } = await supabase
        .from('loyalty_accounts')
        .insert({
          user_id: userId,
          tier_id: defaultTier?.id,
          available_points: signupBonus,
          total_points: signupBonus,
          lifetime_points: signupBonus,
        })
        .select(`*, tier:loyalty_tiers(points_multiplier)`)
        .single();

      if (createError) {
        logger.error('Failed to create loyalty account:', createError);
        return;
      }
      account = newAccount;

      // Log signup bonus if any
      if (signupBonus > 0) {
        await supabase.from('loyalty_transactions').insert({
          account_id: newAccount.id,
          type: 'bonus',
          points: signupBonus,
          balance_after: signupBonus,
          description: 'Welcome bonus',
        });
      }
    }

    // Apply tier multiplier
    const multiplier = (account.tier as any)?.points_multiplier || 1;
    const earnedPoints = Math.floor(basePoints * multiplier);

    const newBalance = (account.available_points || 0) + earnedPoints;
    const newLifetime = (account.lifetime_points || 0) + earnedPoints;

    // Update account balance
    const { error: updateError } = await supabase
      .from('loyalty_accounts')
      .update({
        available_points: newBalance,
        total_points: (account.total_points || 0) + earnedPoints,
        lifetime_points: newLifetime,
        last_activity: new Date().toISOString(),
      })
      .eq('id', account.id);

    if (updateError) {
      logger.error('Failed to update loyalty points:', updateError);
      return;
    }

    // Record transaction
    await supabase.from('loyalty_transactions').insert({
      account_id: account.id,
      type: 'earn',
      points: earnedPoints,
      balance_after: newBalance,
      description: `Points earned from ${referenceType.replace('_', ' ')}`,
      reference_type: referenceType,
      reference_id: referenceId,
    });

    // Check for tier upgrade
    const { data: allTiers } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .order('min_points', { ascending: false });

    if (allTiers) {
      for (const tier of allTiers) {
        if (newLifetime >= tier.min_points && tier.id !== account.tier_id) {
          await supabase
            .from('loyalty_accounts')
            .update({ tier_id: tier.id })
            .eq('id', account.id);

          logger.info(`User ${userId} upgraded to tier: ${tier.name}`);
          break;
        }
      }
    }

    logger.info(`Awarded ${earnedPoints} loyalty points to user ${userId} for ${referenceType}:${referenceId}`);
  } catch (error: any) {
    logger.error('Error awarding loyalty points:', error.message);
    // Don't throw - we don't want to fail the payment webhook for loyalty issues
  }
}
