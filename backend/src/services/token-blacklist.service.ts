/**
 * Token Blacklist Service
 * 
 * Provides individual access token revocation (P3 fix).
 * 
 * The existing token_version approach invalidates ALL sessions for a user.
 * This layer adds per-token blacklisting so a single stolen access token
 * can be revoked without logging the user out everywhere.
 * 
 * Backed by the `token_blacklist` table (migration 20260523000001).
 * Expired entries are auto-pruned by the daily cleanup job.
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

/**
 * Blacklist a JWT by its `jti` claim.
 * Call this when logging out a specific session.
 *
 * @param jti        - The unique JWT ID (`jti` claim from the access token payload)
 * @param userId     - Owner of the token (for FK reference)
 * @param expiresAt  - The token's natural expiry — we only keep the blacklist entry
 *                     until then (no point storing forever)
 */
export async function blacklistToken(
  jti: string,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('token_blacklist')
    .upsert(
      { jti, user_id: userId, expires_at: expiresAt.toISOString() },
      { onConflict: 'jti' },
    );

  if (error) {
    // Non-fatal: log but don't crash. The token_version mechanism still protects
    // against all-sessions scenarios. This is defence-in-depth only.
    logger.error('[TOKEN BLACKLIST] Failed to blacklist token', { jti, userId, error: error.message });
  } else {
    logger.info('[TOKEN BLACKLIST] Token blacklisted', { jti, userId });
  }
}

/**
 * Check whether a JWT `jti` is blacklisted.
 * Returns true if the token has been individually revoked.
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const supabase = getSupabase();
  try {
    const { data } = await supabase
      .from('token_blacklist')
      .select('jti')
      .eq('jti', jti)
      .gt('expires_at', new Date().toISOString()) // expired blacklist entries don't count
      .maybeSingle();
    return data !== null;
  } catch {
    // On error, fail open (don't block legitimate users due to DB hiccup)
    logger.warn('[TOKEN BLACKLIST] Check failed — allowing token (fail-open)', { jti });
    return false;
  }
}

/**
 * Remove expired blacklist entries.
 * Called by the daily maintenance cron job.
 */
export async function pruneExpiredBlacklistEntries(): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('token_blacklist')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('jti');

  if (error) {
    logger.error('[TOKEN BLACKLIST] Prune failed', { error: error.message });
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) logger.info(`[TOKEN BLACKLIST] Pruned ${count} expired entries`);
  return count;
}
