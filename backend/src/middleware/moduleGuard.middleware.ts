import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

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

async function getModuleStatus(slug: string): Promise<boolean> {
  const now = Date.now();
  const cached = moduleCache[slug];

  // Return cached value if still valid
  if (cached && (now - cached.cachedAt) < CACHE_TTL) {
    return cached.isActive;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('modules')
    .select('is_active')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Module slug not registered in DB — fail closed. Unknown modules are not active.
      logger.warn(`Module '${slug}' not found in database — treating as inactive (fail-closed).`);
      moduleCache[slug] = { isActive: false, cachedAt: now };
      return false;
    }
    // Any other DB error — throw so the caller catches it and returns 503.
    throw error;
  }

  const isActive = data?.is_active ?? false;
  moduleCache[slug] = { isActive, cachedAt: now };
  return isActive;
}

/**
 * Clear the module cache (call when modules are updated)
 */
export function clearModuleCache(slug?: string): void {
  if (slug) {
    delete moduleCache[slug];
  } else {
    Object.keys(moduleCache).forEach(key => delete moduleCache[key]);
  }
}

/**
 * Middleware factory that creates a guard for a specific module.
 * SECURITY: Fails CLOSED on any error — DB errors do not grant access.
 * @param moduleSlug - The slug of the module to check (e.g., 'restaurant', 'pool', 'chalets')
 */
export function requireModule(moduleSlug: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isActive = await getModuleStatus(moduleSlug);

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

/**
 * Map of route prefixes to module slugs
 */
export const moduleRouteMap: Record<string, string> = {
  '/api/restaurant': 'restaurant',
  '/api/pool': 'pool',
  '/api/chalets': 'chalets',
  '/api/snack': 'snack-bar'
};

/**
 * Dynamic module guard that checks the route prefix
 * Use this as a catch-all middleware
 */
export async function dynamicModuleGuard(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  
  for (const [prefix, moduleSlug] of Object.entries(moduleRouteMap)) {
    if (path.startsWith(prefix.replace('/api', ''))) {
      const isActive = await getModuleStatus(moduleSlug);
      
      if (!isActive) {
        logger.info(`Blocked request to disabled module: ${moduleSlug}, path: ${path}`);
        return res.status(503).json({
          success: false,
          error: 'This feature is currently unavailable',
          code: 'MODULE_DISABLED'
        });
      }
      break;
    }
  }
  
  next();
}
