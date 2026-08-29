/**
 * Offline Data Hydration Service
 * 
 * Dynamic module-based hydration - supports any engine type without hardcoded endpoints.
 * Fetches active modules first, then hydrates based on engine_type.
 * 
 * Engine Types (canonical only — F1):
 * - instant_transaction: /items, /modifiers
 * - time_exclusive_reservation: /bookable_units, /bookings
 * - shared_capacity_access: /sessions, /tickets
 * - ongoing_entitlement: /plans, /subscriptions
 * - platform_entitlement: (internal-only, no offline hydration needed)
 */

import {
  moduleDataStore,
  moduleCacheStore,
  customersStore,
} from './offline-storage';
import api from '@/lib/api';

interface ActiveModule {
  id: string;
  slug: string;
  name: string;
  engine_type: 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access' | 'ongoing_entitlement' | 'platform_entitlement';
  is_active: boolean;
}

interface HydrationConfig {
  ttl: number; // minutes
  endpoints: string[];
}

// Engine type to hydration configuration (canonical keys only — F1)
const ENGINE_HYDRATION: Record<string, HydrationConfig> = {
  instant_transaction: {
    ttl: 60 * 24, // Catalog rarely changes
    endpoints: ['items', 'modifiers'],
  },
  time_exclusive_reservation: {
    ttl: 15,
    endpoints: ['bookable_units', 'bookings'],
  },
  shared_capacity_access: {
    ttl: 15,
    endpoints: ['sessions', 'tickets'],
  },
  ongoing_entitlement: {
    ttl: 60 * 24,
    endpoints: ['plans', 'subscriptions'],
  },
  // platform_entitlement: internal-only — no offline hydration needed
};

let activeModules: ActiveModule[] = [];
let refreshInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Hydrate all critical offline stores for the current shift.
 * Dynamically discovers active modules and hydrates based on engine_type.
 * @param force If true, bypasses TTL checks and refreshes all stores
 */
export async function hydrateOfflineStores(force: boolean = false): Promise<void> {
  try {
    // Step 1: Fetch active modules if not already loaded
    if (activeModules.length === 0 || force) {
      let response;
      try {
        response = await api.get('/admin/modules', { params: { activeOnly: 'true' } });
      } catch (err: any) {
        // Not authenticated yet — bail silently. Hydration will retry on the next
        // online event or when the background refresh fires after login.
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          console.log('[Offline] Not authenticated, skipping hydration');
          return;
        }
        throw err; // Re-throw unexpected errors
      }
      activeModules = (response.data?.modules || []).filter((m: ActiveModule) => m.is_active);
      console.log(`[Offline] Loaded ${activeModules.length} active modules`);
    }

    if (activeModules.length === 0) {
      console.log('[Offline] No active modules to hydrate');
      return;
    }

    // Step 2: Hydrate each module based on its template type
    const hydrationTasks = activeModules.map(module => () => hydrateModule(module, force));
    await Promise.allSettled(hydrationTasks.map(task => task()));

    // Step 3: Always hydrate customers (cross-module)
    await hydrateCustomers(force);

    console.log('[Offline] Hydration cycle complete.');
  } catch (error: any) {
    // Silently skip auth errors — the user isn't logged in yet
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      console.log('[Offline] Not authenticated, skipping hydration');
      return;
    }
    console.error('[Offline] Failed to hydrate stores:', error);
  }
}

/**
 * Hydrate data for a specific module based on its template type
 */
async function hydrateModule(module: ActiveModule, force: boolean): Promise<void> {
  const config = ENGINE_HYDRATION[module.engine_type];
  if (!config) {
    console.log(`[Offline] No hydration config for engine type: ${module.engine_type}`);
    return;
  }

  const cacheKey = `module:${module.id}`;
  const isStale = await moduleCacheStore.isStale(cacheKey, config.ttl);
  
  if (!force && !isStale) {
    console.log(`[Offline] Cache for ${module.slug} is fresh, skipping`);
    return;
  }

  console.log(`[Offline] Hydrating ${module.slug} (${module.engine_type})...`);

  // Hydrate each endpoint for this template type
  for (const endpoint of config.endpoints) {
    try {
      const response = await api.get(`/v1/${module.slug}/${endpoint}`);
      const data = response.data?.data || response.data || [];
      
      // Store in module-specific cache
      await moduleDataStore.put({
        id: `${module.id}:${endpoint}`,
        moduleId: module.id,
        endpoint,
        data,
        hydratedAt: new Date().toISOString(),
      });
      
      console.log(`[Offline] Hydrated ${module.slug}/${endpoint}: ${data.length} items`);
    } catch (error) {
      console.error(`[Offline] Failed to hydrate ${module.slug}/${endpoint}:`, error);
    }
  }

  await moduleCacheStore.updateMetadata(cacheKey, { 
    lastSyncAt: new Date().toISOString(),
    templateType: module.engine_type,
  });
}

/**
 * Background refresh loop.
 * Runs every minute and checks which stores need re-hydration based on their TTL.
 */
export function startBackgroundRefresh() {
  if (refreshInterval) return;
  
  console.log('[Offline] Starting background periodic refresh loop...');
  refreshInterval = setInterval(async () => {
    if (navigator.onLine) {
      await hydrateOfflineStores(false);
    }
  }, 60 * 1000);
}

export function stopBackgroundRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

/**
 * Fetch and store recent customers (cross-module)
 */
async function hydrateCustomers(force: boolean): Promise<void> {
  const ttl = 60 * 24; // 24 hours
  const isStale = await moduleCacheStore.isStale('customers', ttl);
  
  if (!force && !isStale) return;

  try {
    const response = await api.get('/users', {
      params: { role: 'customer', limit: 500, sort: 'last_visit:desc' }
    });
    
    const users = response.data?.users || [];
    
    // Merge instead of clear to build offline directory
    for (const customer of users) {
      await customersStore.put(customer);
    }
    
    // Size cap at 500
    const count = await customersStore.count();
    if (count > 500) {
      const all = await customersStore.getAll();
      const toRemove = all.slice(0, all.length - 500);
      for (const item of toRemove) {
        await customersStore.delete(item.id);
      }
    }
    
    await moduleCacheStore.updateMetadata('customers', { 
      lastSyncAt: new Date().toISOString(),
      recordCount: await customersStore.count(),
    });
    
    console.log(`[Offline] Hydrated ${users.length} customers`);
  } catch (error) {
    console.error('[Offline] Failed to hydrate customers:', error);
  }
}

/**
 * Get hydrated data for a specific module and endpoint
 */
export async function getModuleOfflineData(
  moduleId: string, 
  endpoint: string
): Promise<unknown[] | null> {
  const cached = await moduleDataStore.get(`${moduleId}:${endpoint}`);
  return cached?.data || null;
}

/**
 * Clear all offline data
 */
export async function clearAllOfflineData(): Promise<void> {
  await moduleDataStore.clear();
  await moduleCacheStore.clear();
  await customersStore.clear();
  activeModules = [];
  console.log('[Offline] All offline data cleared');
}

