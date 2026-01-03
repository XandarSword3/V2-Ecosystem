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
  
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('modules')
      .select('is_active')
      .eq('slug', slug)
      .single();
    
    if (error) {
      // If module doesn't exist in DB, assume it's a core feature and allow
      if (error.code === 'PGRST116') {
        logger.warn(`Module '${slug}' not found in database, defaulting to active`);
        return true;
      }
      throw error;
    }
    
    // Update cache
    moduleCache[slug] = {
      isActive: data?.is_active ?? true,
      cachedAt: now
    };
    
    return data?.is_active ?? true;
  } catch (error) {
    logger.error(`Error checking module status for '${slug}':`, error);
    // On error, allow access to prevent blocking legitimate requests
    return true;
  }
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
 * Middleware factory that creates a guard for a specific module
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
          code: 'MODULE_DISABLED'
        });
      }
      
      next();
    } catch (error) {
      logger.error(`Module guard error for '${moduleSlug}':`, error);
      // On error, allow request to proceed to avoid blocking
      next();
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
