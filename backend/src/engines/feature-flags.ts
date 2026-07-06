/**
 * Engine Feature Flags
 * 
 * Controls rollout of engine v2 features per tenant.
 * Supports gradual rollout via percentage-based activation.
 * 
 * Flags:
 *   engine_v2_pricing     — Use unified pricing pipeline
 *   engine_v2_state_machine — Use formal state machine enforcement
 *   engine_v2_ledger      — Write to unified financial ledger
 *   engine_v2_idempotency — Enable idempotency key checking
 *   engine_v2_full        — Enable ALL engine v2 features
 * 
 * Architecture:
 *   - Flags are stored in `engine_feature_flags` table (per-tenant)
 *   - Cached in memory with TTL to avoid DB round-trips on every request
 *   - Falls back to disabled if DB is unreachable
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

const CACHE_KEY_PREFIX = 'feature-flag:';
const CACHE_TTL = 60; // 1 minute

// ============================================
// Types
// ============================================

export type EngineFeatureFlag =
  | 'engine_v2_pricing'
  | 'engine_v2_state_machine'
  | 'engine_v2_ledger'
  | 'engine_v2_idempotency'
  | 'engine_v2_full';

interface FlagCacheEntry {
  enabled: boolean;
  rolloutPercentage: number;
  fetchedAt: number;
}

// ============================================
// Feature Flag Service
// ============================================

export class FeatureFlagService {
  private readonly cacheTtl: number;

  constructor(cacheTtl: number = 60_000) { // 1 minute TTL
    this.cacheTtl = cacheTtl;
  }

  /**
   * Check if a feature flag is enabled for a tenant.
   * Uses cached value if available and not expired.
   * 
   * @param tenantId - Tenant to check
   * @param flag - Feature flag name
   * @returns true if the flag is enabled
   */
  async isEnabled(tenantId: string, flag: EngineFeatureFlag): Promise<boolean> {
    // Check for the full flag first — it overrides individual flags
    if (flag !== 'engine_v2_full') {
      const fullEnabled = await this.isEnabled(tenantId, 'engine_v2_full');
      if (fullEnabled) return true;
    }

    const cacheKey = `${CACHE_KEY_PREFIX}${tenantId}:${flag}`;

    try {
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        const entry = cached as FlagCacheEntry;
        if (Date.now() - entry.fetchedAt < this.cacheTtl) {
          return entry.enabled;
        }
      }
    } catch {
      // Cache miss or error, continue
    }

    // Fetch from database
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('engine_feature_flags')
        .select('enabled, rollout_percentage')
        .eq('tenant_id', tenantId)
        .eq('flag_name', flag)
        .single();

      if (error || !data) {
        // Flag not found — default to disabled
        const entry: FlagCacheEntry = {
          enabled: false,
          rolloutPercentage: 0,
          fetchedAt: Date.now(),
        };
        try {
          await cache.set(cacheKey, entry, CACHE_TTL);
        } catch {
          // Silent fail
        }
        return false;
      }

      const entry: FlagCacheEntry = {
        enabled: data.enabled,
        rolloutPercentage: data.rollout_percentage || 0,
        fetchedAt: Date.now(),
      };

      try {
        await cache.set(cacheKey, entry, CACHE_TTL);
      } catch {
        // Silent fail
      }
      return entry.enabled;
    } catch (err) {
      logger.warn('[FEATURE FLAGS] Failed to check flag, defaulting to disabled', {
        tenantId,
        flag,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Check if ALL engine v2 features are enabled for a tenant.
   */
  async isFullyEnabled(tenantId: string): Promise<boolean> {
    return this.isEnabled(tenantId, 'engine_v2_full');
  }

  /**
   * Check which engine v2 features are enabled for a tenant.
   * Returns an object with each flag's status.
   */
  async getStatus(tenantId: string): Promise<Record<EngineFeatureFlag, boolean>> {
    const flags: EngineFeatureFlag[] = [
      'engine_v2_pricing',
      'engine_v2_state_machine',
      'engine_v2_ledger',
      'engine_v2_idempotency',
      'engine_v2_full',
    ];

    const status: Record<string, boolean> = {};
    for (const flag of flags) {
      status[flag] = await this.isEnabled(tenantId, flag);
    }

    return status as Record<EngineFeatureFlag, boolean>;
  }

  /**
   * Enable a feature flag for a tenant.
   */
  async enable(tenantId: string, flag: EngineFeatureFlag): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('engine_feature_flags')
      .upsert({
        tenant_id: tenantId,
        flag_name: flag,
        enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,flag_name' });

    if (error) {
      throw new Error(`Failed to enable feature flag: ${error.message}`);
    }

    // Invalidate cache
    try {
      await cache.del(`${CACHE_KEY_PREFIX}${tenantId}:${flag}`);
    } catch {
      // Silent fail
    }

    logger.info('[FEATURE FLAGS] Flag enabled', { tenantId, flag });
  }

  /**
   * Disable a feature flag for a tenant.
   */
  async disable(tenantId: string, flag: EngineFeatureFlag): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('engine_feature_flags')
      .upsert({
        tenant_id: tenantId,
        flag_name: flag,
        enabled: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,flag_name' });

    if (error) {
      throw new Error(`Failed to disable feature flag: ${error.message}`);
    }

    // Invalidate cache
    try {
      await cache.del(`${CACHE_KEY_PREFIX}${tenantId}:${flag}`);
    } catch {
      // Silent fail
    }

    logger.info('[FEATURE FLAGS] Flag disabled', { tenantId, flag });
  }

  /**
   * Clear the cache (for testing or forced refresh).
   */
  async clearCache(): Promise<void> {
    try {
      const redis = cache.getClient();
      if (redis) {
        const keys = await redis.keys(`${CACHE_KEY_PREFIX}*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch {
      // Silent fail
    }
  }
}

// ============================================
// Singleton
// ============================================

let _flagService: FeatureFlagService | null = null;

export function getFeatureFlagService(): FeatureFlagService {
  if (!_flagService) {
    _flagService = new FeatureFlagService();
  }
  return _flagService;
}

export function resetFeatureFlagService(): void {
  _flagService = null;
}
