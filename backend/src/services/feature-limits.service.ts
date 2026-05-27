/**
 * FeatureLimitsService
 *
 * Reads the feature_limits JSONB from the resolved tenant on req.tenant
 * and enforces plan-level caps before creation operations proceed.
 *
 * Limits schema (stored in tenants.feature_limits):
 *   maxProperties          — int, -1 = unlimited
 *   maxModules             — int, -1 = unlimited
 *   maxStaffUsers          — int, -1 = unlimited
 *   analyticsRetentionDays — int
 *   customDomain           — boolean
 *   whiteLabel             — boolean
 *   apiAccess              — boolean
 *
 * Usage in a controller:
 *   import { assertModuleLimit } from '../../services/feature-limits.service.js';
 *   await assertModuleLimit(req);   // throws 402 AppError if over limit
 */

import { Request } from 'express';
import { getSupabase } from '../database/connection.js';
import { AppError } from '../utils/errors.js';
import type { TenantRecord } from '../middleware/tenantAccess.middleware.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLimit(tenant: TenantRecord, key: string): number {
  const limits = tenant.feature_limits as Record<string, unknown>;
  const val = limits?.[key];
  if (typeof val === 'number') return val;
  return -1; // treat unknown keys as unlimited
}

function isUnlimited(limit: number): boolean {
  return limit < 0;
}

// ─── Count helpers ─────────────────────────────────────────────────────────────

async function countModulesForTenant(tenant: TenantRecord): Promise<number> {
  const supabase = getSupabase();

  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('group_id', tenant.property_group_id);

  if (!properties || properties.length === 0) return 0;

  const propertyIds = properties.map((p: { id: string }) => p.id);

  const { count } = await supabase
    .from('modules')
    .select('id', { count: 'exact', head: true })
    .in('property_id', propertyIds);

  return count ?? 0;
}

async function countPropertiesForTenant(tenant: TenantRecord): Promise<number> {
  const supabase = getSupabase();

  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', tenant.property_group_id);

  return count ?? 0;
}

async function countStaffUsersForTenant(tenant: TenantRecord): Promise<number> {
  const supabase = getSupabase();

  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .not('roles', 'cs', '{"customer"}');

  return count ?? 0;
}

// ─── Public assertion functions ───────────────────────────────────────────────

/**
 * Assert the tenant has not reached their module limit.
 * No-op when no tenant is resolved (legacy single-tenant mode).
 * Throws AppError(402) if the limit is reached.
 */
export async function assertModuleLimit(req: Request): Promise<void> {
  const tenant = req.tenant;
  if (!tenant) return;

  const limit = getLimit(tenant, 'maxModules');
  if (isUnlimited(limit)) return;

  const current = await countModulesForTenant(tenant);
  if (current >= limit) {
    throw new AppError(
      `Your ${tenant.subscription_tier} plan allows up to ${limit} module${limit === 1 ? '' : 's'}. ` +
        `You currently have ${current}. Please upgrade your plan to add more modules.`,
      402,
      'MODULE_LIMIT_REACHED',
    );
  }
}

/**
 * Assert the tenant has not reached their property limit.
 */
export async function assertPropertyLimit(req: Request): Promise<void> {
  const tenant = req.tenant;
  if (!tenant) return;

  const limit = getLimit(tenant, 'maxProperties');
  if (isUnlimited(limit)) return;

  const current = await countPropertiesForTenant(tenant);
  if (current >= limit) {
    throw new AppError(
      `Your ${tenant.subscription_tier} plan allows up to ${limit} propert${limit === 1 ? 'y' : 'ies'}. ` +
        `You currently have ${current}. Please upgrade your plan to add more properties.`,
      402,
      'PROPERTY_LIMIT_REACHED',
    );
  }
}

/**
 * Assert the tenant has not reached their staff user limit.
 */
export async function assertStaffUserLimit(req: Request): Promise<void> {
  const tenant = req.tenant;
  if (!tenant) return;

  const limit = getLimit(tenant, 'maxStaffUsers');
  if (isUnlimited(limit)) return;

  const current = await countStaffUsersForTenant(tenant);
  if (current >= limit) {
    throw new AppError(
      `Your ${tenant.subscription_tier} plan allows up to ${limit} staff user${limit === 1 ? '' : 's'}. ` +
        `You currently have ${current}. Please upgrade your plan to add more staff.`,
      402,
      'STAFF_LIMIT_REACHED',
    );
  }
}

/**
 * Assert the tenant's plan includes a specific boolean feature.
 * Use for: customDomain, whiteLabel, apiAccess.
 */
export function assertFeatureEnabled(req: Request, feature: string): void {
  const tenant = req.tenant;
  if (!tenant) return;

  const limits = tenant.feature_limits as Record<string, unknown>;
  if (limits?.[feature] === false) {
    throw new AppError(
      `The "${feature}" feature is not available on your ${tenant.subscription_tier} plan. ` +
        `Please upgrade to access this feature.`,
      402,
      'FEATURE_NOT_AVAILABLE',
    );
  }
}
