import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

/**
 * Awards loyalty_settings.birthday_bonus_points to members whose
 * date_of_birth matches today's month/day, for properties with
 * enable_birthday_bonus = true. Idempotent per member per calendar year —
 * checks for an existing "Birthday bonus" transaction this year before
 * awarding, so a re-run (or a second daily trigger) doesn't double-pay.
 */
export async function runLoyaltyBirthdayBonusJob(): Promise<{ awarded: number }> {
  const supabase = getSupabase();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const { data: candidates, error } = await supabase.rpc('get_loyalty_birthday_members', {
    p_check_date: todayStr,
  });

  if (error) {
    logger.error('[Loyalty Maintenance] Failed to look up birthday members:', error);
    return { awarded: 0 };
  }

  if (!candidates || candidates.length === 0) {
    return { awarded: 0 };
  }

  const propertyIds = [...new Set(candidates.map((c: any) => c.property_id))];
  const { data: settingsRows } = await supabase
    .from('loyalty_settings')
    .select('property_id, enable_birthday_bonus, birthday_bonus_points')
    .in('property_id', propertyIds);

  const settingsByProperty = new Map((settingsRows || []).map((s: any) => [s.property_id, s]));
  const yearStart = new Date(today.getFullYear(), 0, 1).toISOString();

  let awarded = 0;

  for (const candidate of candidates as any[]) {
    const settings = settingsByProperty.get(candidate.property_id);
    if (!settings?.enable_birthday_bonus || !settings.birthday_bonus_points) {
      continue;
    }

    const { data: alreadyAwarded } = await supabase
      .from('loyalty_transactions')
      .select('id')
      .eq('member_id', candidate.member_id)
      .eq('description', 'Birthday bonus')
      .gte('created_at', yearStart)
      .limit(1)
      .maybeSingle();

    if (alreadyAwarded) {
      continue;
    }

    const { data: result, error: adjustError } = await supabase.rpc('adjust_loyalty_points_atomic', {
      p_user_id: candidate.user_id,
      p_points: settings.birthday_bonus_points,
      p_reason: 'Birthday bonus',
    });

    if (adjustError || !result?.[0]?.success) {
      logger.warn(
        `[Loyalty Maintenance] Failed to award birthday bonus to user ${candidate.user_id}:`,
        adjustError?.message || result?.[0]?.error_message
      );
      continue;
    }

    awarded++;
  }

  return { awarded };
}

/**
 * Expires loyalty_point_batches past their expires_at, decrementing each
 * affected member's available balance by the total expiring in that batch
 * (via the existing adjust_loyalty_points_atomic RPC, which floors at 0).
 *
 * Note: balance adjustment and marking batches as expired are two separate
 * steps (no single atomic SQL function covers both). If the process dies
 * between them, a re-run could double-decrement a batch that was adjusted
 * but not yet marked expired. Low-risk for a once-daily background job,
 * but worth wrapping in a dedicated Postgres function if this needs
 * stronger guarantees later.
 */
export async function runLoyaltyPointExpiryJob(): Promise<{ expiredBatches: number; membersAffected: number }> {
  const supabase = getSupabase();

  const { data: expiredBatches, error } = await supabase
    .from('loyalty_point_batches')
    .select('id, user_id, remaining_points')
    .eq('is_expired', false)
    .gt('remaining_points', 0)
    .not('expires_at', 'is', null)
    .lte('expires_at', new Date().toISOString());

  if (error) {
    logger.error('[Loyalty Maintenance] Failed to query expired point batches:', error);
    return { expiredBatches: 0, membersAffected: 0 };
  }

  if (!expiredBatches || expiredBatches.length === 0) {
    return { expiredBatches: 0, membersAffected: 0 };
  }

  // Aggregate per user so each member gets one balance adjustment (and one
  // transaction row) instead of one per expiring batch.
  const pointsByUser = new Map<string, number>();
  for (const batch of expiredBatches) {
    pointsByUser.set(batch.user_id, (pointsByUser.get(batch.user_id) || 0) + batch.remaining_points);
  }

  let membersAffected = 0;

  for (const [userId, totalExpiring] of pointsByUser) {
    const { data: result, error: adjustError } = await supabase.rpc('adjust_loyalty_points_atomic', {
      p_user_id: userId,
      p_points: -totalExpiring,
      p_reason: 'Points expired',
    });

    if (adjustError || !result?.[0]?.success) {
      logger.warn(
        `[Loyalty Maintenance] Failed to expire points for user ${userId}:`,
        adjustError?.message || result?.[0]?.error_message
      );
      continue;
    }

    membersAffected++;
  }

  const batchIds = expiredBatches.map((b) => b.id);
  const { error: markError } = await supabase
    .from('loyalty_point_batches')
    .update({ is_expired: true, expired_at: new Date().toISOString(), remaining_points: 0 })
    .in('id', batchIds);

  if (markError) {
    logger.error('[Loyalty Maintenance] Failed to mark point batches as expired:', markError);
  }

  return { expiredBatches: expiredBatches.length, membersAffected };
}
