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

import { Request, Response, NextFunction } from 'express';
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
 *
 * Fail-closed only when the flag is explicitly `false`; an absent key keeps
 * legacy/unlimited behavior. Unknown/absent tenant is a no-op so single-tenant
 * installs keep working.
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

/**
 * Resolve the calling tenant for routes that do not run the tenant gate
 * (most /api/v1 routers). Uses, in order: an already-resolved req.tenant, the
 * JWT tenant, the X-Tenant-ID header, or the property's owning tenant.
 */
async function resolveRequestTenant(req: Request): Promise<TenantRecord | null> {
  if (req.tenant) return req.tenant;

  const supabase = getSupabase();
  const tenantId =
    req.user?.tenantId ||
    (typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'] : undefined);

  if (tenantId) {
    const { data } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
    return (data as TenantRecord | null) ?? null;
  }

  const propertyId =
    (req as any).property?.id ||
    (typeof req.headers['x-property-id'] === 'string' ? req.headers['x-property-id'] : undefined);
  if (!propertyId) return null;

  const { data: property } = await supabase
    .from('properties')
    .select('group_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (!property?.group_id) return null;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('property_group_id', property.group_id)
    .maybeSingle();

  return (tenant as TenantRecord | null) ?? null;
}

/**
 * Express middleware form of assertFeatureEnabled. Mount on white-label /
 * branding / API-management routes so a Starter plan cannot use paid
 * entitlements.
 */
export function requireFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenant = await resolveRequestTenant(req);
      if (!tenant) return next();
      req.tenant = tenant;
      assertFeatureEnabled(req, feature);
      next();
    } catch (err) {
      next(err);
    }
  };
}
