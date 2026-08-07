/**
 * Property Resolution Middleware
 *
 * Resolves the calling PROPERTY for public/unauthenticated traffic and
 * attaches it to req.property. This is the request-derived counterpart to
 * tenantAccess.middleware.ts's resolveTenant — same priority-order pattern,
 * one layer deeper in the hierarchy.
 *
 * Critically, this middleware does NOT blindly trust a client-sent x-property-id
 * header — it validates any supplied UUID against the database before accepting
 * it (Priority 0 below). That header is intended for authenticated admin/staff
 * multi-property switching; for public traffic, property identity normally
 * comes from the slug header or single-property fallback (see priorities below).
 *
 *   1. X-Property-Slug header  — set by frontend/src/middleware.ts from the
 *                                 Host header's sub-subdomain segment
 *                                 ({property}.{tenant}.v2platform.com),
 *                                 scoped to lookup within req.tenant's group.
 *   2. Single-property fallback — the common case. Starter-tier tenants
 *                                  (maxProperties: 1) have nothing to
 *                                  disambiguate: if the resolved tenant's
 *                                  group has exactly one property, use it,
 *                                  regardless of any header.
 *   3. Legacy single-tenant mode — if no tenant was resolved at all (no
 *                                  multi-tenant layer in play) and the whole
 *                                  deployment has exactly one property, use
 *                                  it. Mirrors the same "nothing to
 *                                  disambiguate" rule one level up.
 *
 * Must run AFTER tenantGate (needs req.tenant.property_group_id when
 * present). Does not gate/block — a request with no resolvable property
 * simply proceeds with req.property unset, and downstream code falls back
 * to global/system-tier settings exactly as it does today when no property
 * context exists.
 *
 * See CONTEXT.md, "Public/Admin Property Context Contamination" (session
 * 7-9) for the full investigation and decision record behind this design.
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

// ============================================
// Types
// ============================================

export interface PropertyRecord {
  id: string;
  name: string;
  group_id: string | null;
  property_code: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      property?: PropertyRecord;
    }
  }
}

// ============================================
// Redis cache
// ============================================

const CACHE_TTL = 300; // 5 minutes - match tenant cache TTL to reduce DB hits
const CACHE_KEY_PREFIX = 'property:';

async function getCached(key: string): Promise<PropertyRecord | null | undefined> {
  try {
    // Same fix as tenantAccess.middleware.ts: cache.get() returns null for
    // both "miss" and "Redis unavailable", which is indistinguishable from a
    // legitimately-cached negative lookup. Wrap the value so a genuine miss
    // resolves to undefined ("go check the DB") instead of false-negative null.
    const cached = await cache.get<{ property: PropertyRecord | null }>(`${CACHE_KEY_PREFIX}${key}`);
    if (cached === null) return undefined;
    return cached.property;
  } catch {
    return undefined;
  }
}

async function setCached(key: string, property: PropertyRecord | null): Promise<void> {
  try {
    await cache.set(`${CACHE_KEY_PREFIX}${key}`, { property }, CACHE_TTL);
  } catch {
    // Silent fail - cache is best-effort
  }
}

/** Invalidate cached property lookups (call after a property is created/renamed/re-slugged). */
export async function invalidatePropertyCache(groupId?: string | null, code?: string | null): Promise<void> {
  try {
    if (groupId && code) await cache.del(`${CACHE_KEY_PREFIX}slug:${groupId}:${code}`);
    if (groupId) await cache.del(`${CACHE_KEY_PREFIX}single:${groupId}`);
    await cache.del(`${CACHE_KEY_PREFIX}single:__global__`);
  } catch {
    // Silent fail
  }
}

// ============================================
// Lookups
// ============================================

async function lookupBySlug(tenantId: string | null, groupId: string | null, slug: string): Promise<PropertyRecord | null> {
  const cacheKey = `slug:${tenantId ?? 'null'}:${groupId ?? 'null'}:${slug}`;
  const cached = await getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('properties')
      .select('id, name, group_id, property_code, public_slug');

    if (groupId) {
      query = query.or(`group_id.eq.${groupId},group_id.is.null`);
    }
    if (tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    if (isUuid) {
      query = query.eq('id', slug);
    } else {
      query = query.or(`public_slug.eq.${slug},public_slug.eq.${slug}-property,property_code.eq.${slug}`);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.warn('[PROPERTY] Slug lookup error', { tenantId, groupId, slug, error: error.message });
      await setCached(cacheKey, null);
      return null;
    }

    const property = (data as PropertyRecord) ?? null;
    await setCached(cacheKey, property);
    return property;
  } catch (err) {
    logger.error('[PROPERTY] Unexpected slug lookup failure', { tenantId, groupId, slug, err });
    return null;
  }
}

// ============================================
// Single property lookup
// ============================================

async function lookupSingleProperty(groupId: string | null): Promise<PropertyRecord | null> {
  const cacheKey = groupId ? `single:${groupId}` : 'single:__global__';
  const cached = await getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const supabase = getSupabase();
    let query = supabase.from('properties').select('id, name, group_id, property_code').limit(2);
    query = groupId ? query.eq('group_id', groupId) : query;

    const { data, error } = await query;

    if (error) {
      logger.warn('[PROPERTY] Single-property lookup error', { groupId, error: error.message });
      await setCached(cacheKey, null);
      return null;
    }

    const rows = (data as PropertyRecord[]) ?? [];
    const property = rows.length === 1 ? rows[0] : null;
    await setCached(cacheKey, property);
    return property;
  } catch (err) {
    logger.error('[PROPERTY] Unexpected single-property lookup failure', { groupId, err });
    return null;
  }
}

// ============================================
// Middleware
// ============================================

export async function resolveProperty(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();
  const groupId = req.tenant?.property_group_id ?? null;
  const tenantId = req.tenant?.id ?? null;

  // Priority 1: explicit slug header (e.g. set from URL path /[property]/...)
  const propertySlugHeader = req.headers['x-property-slug'] as string | undefined;
  if (propertySlugHeader) {
    const property = await lookupBySlug(tenantId, groupId, propertySlugHeader);
    if (property) {
      req.property = property;
      logger.info(`[PropertyResolution] Resolved property "${property.name}" (${property.id}) via X-Property-Slug="${propertySlugHeader}" [${Date.now() - startTime}ms]`);
      return next();
    }
  }

  // Priority 2: explicit x-property-id header (fallback if no slug header provided or matched)
  const propertyIdHeader = req.headers['x-property-id'] as string | undefined;
  if (propertyIdHeader) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, group_id, property_code')
        .eq('id', propertyIdHeader)
        .maybeSingle();
      if (!error && data) {
        req.property = data as PropertyRecord;
        logger.info(`[PropertyResolution] Resolved property "${data.name}" (${data.id}) via x-property-id header [${Date.now() - startTime}ms]`);
        return next();
      }
    } catch (err) {
      logger.error('[PROPERTY] Failed to resolve property from x-property-id header', { propertyIdHeader, err });
    }
  }

  // Priority 3: single-property fallback, scoped to the tenant's group.
  if (groupId) {
    const property = await lookupSingleProperty(groupId);
    if (property) {
      req.property = property;
      logger.info(`[PropertyResolution] Resolved single property fallback "${property.name}" (${property.id}) [${Date.now() - startTime}ms]`);
      return next();
    }
  }

  // Priority 4: legacy single-tenant mode — no tenant resolved at all, but whole deployment has 1 property.
  if (!req.tenant) {
    const property = await lookupSingleProperty(null);
    if (property) {
      req.property = property;
      logger.info(`[PropertyResolution] Resolved legacy single-tenant property "${property.name}" (${property.id}) [${Date.now() - startTime}ms]`);
    }
  }

  next();
}
