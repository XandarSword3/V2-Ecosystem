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
// Short-lived in-process cache (mirrors tenantCache's TTL/shape)
// ============================================

const CACHE_TTL_MS = 30_000;
interface CacheEntry {
  property: PropertyRecord | null;
  fetchedAt: number;
}
const propertyCache = new Map<string, CacheEntry>();

function getCached(key: string): PropertyRecord | null | undefined {
  const cached = propertyCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.property;
  }
  return undefined;
}

function setCached(key: string, property: PropertyRecord | null): void {
  propertyCache.set(key, { property, fetchedAt: Date.now() });
}

/** Invalidate cached property lookups (call after a property is created/renamed/re-slugged). */
export function invalidatePropertyCache(groupId?: string | null, code?: string | null): void {
  if (groupId && code) propertyCache.delete(`slug:${groupId}:${code}`);
  if (groupId) propertyCache.delete(`single:${groupId}`);
  propertyCache.delete('single:__global__');
}

// ============================================
// Lookups
// ============================================

async function lookupBySlug(groupId: string, slug: string): Promise<PropertyRecord | null> {
  const cacheKey = `slug:${groupId}:${slug}`;
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, group_id, property_code')
      .eq('group_id', groupId)
      .eq('property_code', slug)
      .maybeSingle();

    if (error) {
      logger.warn('[PROPERTY] Slug lookup error', { groupId, slug, error: error.message });
      setCached(cacheKey, null);
      return null;
    }

    const property = (data as PropertyRecord) ?? null;
    setCached(cacheKey, property);
    return property;
  } catch (err) {
    logger.error('[PROPERTY] Unexpected slug lookup failure', { groupId, slug, err });
    return null;
  }
}

/**
 * Single-property fallback, scoped to a group (or globally, when groupId is
 * null, for legacy single-tenant deployments). Returns the lone property if
 * and only if exactly one exists in scope — anything else (zero, or more
 * than one without a slug to disambiguate) returns null and lets downstream
 * code fall back to global/system settings, same as no property context.
 */
async function lookupSingleProperty(groupId: string | null): Promise<PropertyRecord | null> {
  const cacheKey = groupId ? `single:${groupId}` : 'single:__global__';
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const supabase = getSupabase();
    let query = supabase.from('properties').select('id, name, group_id, property_code').limit(2);
    query = groupId ? query.eq('group_id', groupId) : query;

    const { data, error } = await query;

    if (error) {
      logger.warn('[PROPERTY] Single-property lookup error', { groupId, error: error.message });
      setCached(cacheKey, null);
      return null;
    }

    const rows = (data as PropertyRecord[]) ?? [];
    const property = rows.length === 1 ? rows[0] : null;
    setCached(cacheKey, property);
    return property;
  } catch (err) {
    logger.error('[PROPERTY] Unexpected single-property lookup failure', { groupId, err });
    return null;
  }
}

// ============================================
// Middleware
// ============================================

/**
 * Resolve property from request context and attach to req.property.
 * Priority 0 accepts x-property-id but validates the UUID against the DB
 * before trusting it — admin/staff flows only, validated separately by
 * validatePropertyAccess. Falls through to slug/fallback for public traffic.
 */
export async function resolveProperty(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Priority 0: explicit x-property-id header (e.g. admin dashboard preview or local development override)
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
        return next();
      }
    } catch (err) {
      logger.error('[PROPERTY] Failed to resolve property from x-property-id header', { propertyIdHeader, err });
    }
  }

  const groupId = req.tenant?.property_group_id ?? null;

  // Priority 1: explicit slug header, scoped to the resolved tenant's group.
  // Only meaningful when a tenant (and therefore a group) is known — a slug
  // with no group to scope it to can't be safely resolved.
  const propertySlugHeader = req.headers['x-property-slug'] as string | undefined;
  if (propertySlugHeader && groupId) {
    const property = await lookupBySlug(groupId, propertySlugHeader);
    if (property) {
      req.property = property;
      return next();
    }
    // Slug present but didn't resolve (typo, stale DNS, property renamed) —
    // fall through to the single-property fallback rather than dead-ending.
  }

  // Priority 2: single-property fallback, scoped to the tenant's group.
  // Covers the overwhelming majority case (starter tier, maxProperties: 1) —
  // nothing to disambiguate, so no header is even necessary.
  if (groupId) {
    const property = await lookupSingleProperty(groupId);
    if (property) {
      req.property = property;
      return next();
    }
  }

  // Priority 3: legacy single-tenant mode — no tenant resolved at all, but
  // the whole deployment has exactly one property. Same "nothing to
  // disambiguate" rule, one level up.
  if (!req.tenant) {
    const property = await lookupSingleProperty(null);
    if (property) {
      req.property = property;
    }
  }

  next();
}
