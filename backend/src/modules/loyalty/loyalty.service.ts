import { getSupabase } from '../../database/connection.js';

export interface EnsureLoyaltyMemberParams {
  userId: string;
  tenantId: string | null;
  propertyId: string;
}

/**
 * Ensures a loyalty_members row exists for a user at a given property,
 * creating one (and granting the configured signup bonus) when it doesn't.
 *
 * Shared by registration (auth.service.ts, so new customers are enrolled
 * immediately) and the lazy-create fallback in loyalty.controller.ts's
 * getAccount (so a user who somehow reaches getAccount without having gone
 * through registration-time enrollment — e.g. accounts created before this
 * enrollment step existed — still gets enrolled on first fetch), so every
 * enrollment path behaves identically instead of duplicating the logic.
 *
 * Note: settings?.signup_bonus currently always evaluates to 0 — there is
 * no signup_bonus column on loyalty_settings in the live schema, only
 * points_per_dollar/points_expiry_days/birthday_bonus_points/etc. This
 * mirrors the existing (pre-refactor) behavior exactly rather than
 * introducing a new column; flagging it here since it means the "signup
 * bonus" this function grants is currently always zero regardless of what
 * loyalty.controller.ts's updateSettings believes it's persisting.
 */
export async function ensureLoyaltyMember({ userId, tenantId, propertyId }: EnsureLoyaltyMemberParams) {
  const supabase = getSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from('loyalty_members')
    .select(`*, tier:loyalty_tiers(*)`)
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data: settings } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('property_id', propertyId)
    .limit(1)
    .maybeSingle();

  const { data: defaultTier } = await supabase
    .from('loyalty_tiers')
    .select('id')
    .eq('property_id', propertyId)
    .order('min_points', { ascending: true })
    .limit(1)
    .maybeSingle();

  const signupBonus = (settings as any)?.signup_bonus || 0;

  const { data: newMember, error: createError } = await supabase
    .from('loyalty_members')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      property_id: propertyId,
      tier_id: defaultTier?.id || null,
      available_points: signupBonus,
      lifetime_points: signupBonus,
      total_points: signupBonus,
    })
    .select(`*, tier:loyalty_tiers(*)`)
    .single();

  if (createError) throw createError;

  if (signupBonus > 0) {
    await supabase.from('loyalty_transactions').insert({
      member_id: newMember.id,
      transaction_type: 'bonus',
      points: signupBonus,
      balance_after: signupBonus,
      description: 'Welcome bonus',
      tenant_id: tenantId,
      property_id: propertyId,
    });
  }

  return newMember;
}
