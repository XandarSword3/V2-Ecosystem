import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { getCallerTenantId } from '../security/tenant-scope.js';

/**
 * Module Guard Middleware
 * Prevents access to API endpoints when the corresponding module is disabled
 * This is critical for the modularity system to work properly
 */

// Cache for module status to avoid excessive DB queries
interface ModuleCache {
  [slug: string]: {
    isActive: boolean;
    cachedAt: number;
  };
}

const moduleCache: ModuleCache = {};
const CACHE_TTL = 60000; // 1 minute cache

export async function getModuleStatus(slug: string, tenantId: string | null): Promise<boolean> {
  const cacheKey = tenantId ? `${tenantId}:${slug}` : `global:${slug}`;
  const now = Date.now();
  const cached = moduleCache[cacheKey];

  // Return cached value if still valid
  if (cached && (now - cached.cachedAt) < CACHE_TTL) {
    return cached.isActive;
  }

  const supabase = getSupabase();

  // Two different tenants may legitimately create modules that share a slug
  // (see modules.controller.ts createModule, "Q171 — scope slug uniqueness
  // to tenant"). Querying by slug alone with .single() is unsafe once that
  // happens: Postgres/PostgREST throws the same PGRST116 code for "0 rows"
  // and "more than 1 row", so a cross-tenant slug collision was previously
  // indistinguishable from "module doesn't exist" and failed closed for
  // BOTH tenants. Fix: resolve tenant-scoped first, then fall back to an
  // unscoped/global module (tenant_id IS NULL) — same precedence used by
  // getModules() in modules.controller.ts — using maybeSingle() so a clean
  // zero-row miss returns (null, null) instead of throwing.
  let data: { is_active: boolean } | null = null;
  let error: { code?: string; message: string } | null = null;

  if (tenantId) {
    ({ data, error } = await supabase
      .from('modules')
      .select('is_active')
      .eq('slug', slug)
      .eq('tenant_id', tenantId)
      .maybeSingle());
  }

  if (!error && !data) {
    ({ data, error } = await supabase
      .from('modules')
      .select('is_active')
      .eq('slug', slug)
      .is('tenant_id', null)
      .maybeSingle());
  }

  if (error) {
    // A real DB error, or a genuine duplicate WITHIN one scope (e.g. two
    // null-tenant global rows with the same slug) — that's an actual data
    // integrity problem, not a cross-tenant collision, so fail closed and
    // let the caller's catch block report it as a check failure.
    throw error;
  }

  if (!data) {
    // Confirmed absent in both the tenant-scoped and global scope.
    logger.warn(`Module '${slug}' not found in database (tenant=${tenantId ?? 'none'}) — treating as inactive (fail-closed).`);
    moduleCache[cacheKey] = { isActive: false, cachedAt: now };
    return false;
  }

  const isActive = data.is_active ?? false;
  moduleCache[cacheKey] = { isActive, cachedAt: now };
  return isActive;
}

/**
 * Clear the module cache (call when modules are updated)
 */
export function clearModuleCache(slug?: string): void {
  if (slug) {
    // Cache keys are now `${tenantId}:${slug}` or `global:${slug}` (see
    // getModuleStatus) — clear every variant for this slug regardless of
    // which tenant's row triggered the update, since callers here
    // (modules.controller.ts create/update/delete) only have the slug.
    Object.keys(moduleCache).forEach(key => {
      if (key.endsWith(`:${slug}`)) delete moduleCache[key];
    });
  } else {
    Object.keys(moduleCache).forEach(key => delete moduleCache[key]);
  }
}

/**
 * Middleware factory that creates a guard for a specific module.
 * SECURITY: Fails CLOSED on any error — DB errors do not grant access.
 * @param moduleSlug - The slug of the module to check (e.g., 'bar', 'spa', 'accommodation')
 */
export function requireModule(moduleSlug: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // JWT-derived only — see remediation plan Phase 0, item 0.3. All routes
      // through this guard run behind `authenticate` (see the router.use()
      // chain), so req.user is always populated here; null only for
      // super_admin, which getModuleStatus treats as the legacy/global-module
      // fallback (tenant_id IS NULL).
      const tenantId = getCallerTenantId(req);
      const isActive = await getModuleStatus(moduleSlug, tenantId);

      if (!isActive) {
        logger.info(`Blocked request to disabled module: ${moduleSlug}, path: ${req.path}`);
        return res.status(503).json({
          success: false,
          error: 'This feature is currently unavailable',
          code: 'MODULE_DISABLED',
        });
      }

      next();
    } catch (error) {
      // DB error — fail closed. Do NOT call next().
      logger.error(`Module guard DB error for '${moduleSlug}' — blocking request:`, error);
      return res.status(503).json({
        success: false,
        error: 'Unable to verify module status',
        code: 'MODULE_CHECK_FAILED',
      });
    }
  };
}

