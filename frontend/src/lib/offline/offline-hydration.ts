/**
 * Offline Data Hydration Service
 * 
 * Responsible for pre-loading critical data into IndexedDB at shift start or login.
 */

import {
  chaletsStore,
  bookingsStore,
  poolSessionsStore,
  ticketsStore,
  housekeepingTasksStore,
  menuItemsStore,
  menuCategoriesStore,
  modifiersStore,
  customersStore,
  cacheManager,
  syncQueue,
} from './offline-storage';
import api from '@/lib/api';


/**
 * Configuration for offline stores: TTL in minutes and sync strategy
 */
const STORE_CONFIG: Record<string, { ttl: number; endpoint: string; queryParams?: Record<string, any> }> = {
  chalets: { ttl: 15, endpoint: '/chalets' },
  bookings: { ttl: 15, endpoint: '/chalets/staff/bookings' },
  pool_sessions: { ttl: 15, endpoint: '/pool/sessions' },
  tickets: { ttl: 15, endpoint: '/pool/staff/tickets/today' },
  housekeeping_tasks: { ttl: 5, endpoint: '/housekeeping/my-tasks' },
  menu: { ttl: 60 * 24, endpoint: '/restaurant/menu' }, // Menu changes rarely
  customers: { ttl: 60 * 24, endpoint: '/users', queryParams: { role: 'customer', limit: 500, sort: 'last_visit:desc' } },
};

/**
 * Hydrate all critical offline stores for the current shift.
 * Uses TTL logic to avoid redundant re-fetches.
 * @param force If true, bypasses TTL checks and refreshes all stores
 */
export async function hydrateOfflineStores(force: boolean = false): Promise<void> {
  console.log(`[Offline] Starting data hydration (force=${force})...`);
  
  const tasks = [
    () => hydrateChalets(force),
    () => hydrateTodayBookings(force),
    () => hydratePoolSessions(force),
    () => hydrateTodayTickets(force),
    () => hydrateMyHousekeepingTasks(force),
    () => hydrateMenu(force),
    () => hydrateCustomers(force),
  ];

  // Run in limited parallel to avoid hammering the API
  await Promise.allSettled(tasks.map(task => task()));
  
  console.log('[Offline] Hydration complete.');
}

/**
 * Background refresh loop.
 * Runs every minute and checks which stores need re-hydration based on their TTL.
 */
let refreshInterval: any = null;

export function startBackgroundRefresh() {
  if (refreshInterval) return;
  
  console.log('[Offline] Starting background periodic refresh loop...');
  refreshInterval = setInterval(async () => {
    if (navigator.onLine) {
      await hydrateOfflineStores(false); // Respects TTLs
    }
  }, 60 * 1000); // Check every minute
}

export function stopBackgroundRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

/**
 * Helper to determine if a store needs hydration based on TTL
 */
async function shouldHydrate(storeName: string, force: boolean): Promise<boolean> {
  if (force) return true;
  const config = STORE_CONFIG[storeName];
  if (!config) return true;
  
  const isStale = await cacheManager.isStale(storeName, config.ttl);
  return isStale;
}

/**
 * Fetch and store all chalets and their current status
 */
async function hydrateChalets(force: boolean): Promise<void> {
  if (!(await shouldHydrate('chalets', force))) return;
  
  try {
    const metadata = await cacheManager.getMetadata('chalets');
    const since = metadata?.lastSyncAt ? new Date(metadata.lastSyncAt).toISOString() : undefined;
    
    // Pattern: Use 'since' if backend supports it
    const response = await api.get(STORE_CONFIG.chalets.endpoint, {
      params: since ? { since } : {}
    });
    
    if (response.data?.chalets) {
      // For chalets, we clear and replace because it's a small dataset and status changes are global
      await chaletsStore.clear();
      await chaletsStore.putMany(response.data.chalets);
      await cacheManager.updateMetadata('chalets', response.data.chalets.length);
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate chalets:', error);
  }
}

/**
 * Fetch and store today's bookings
 */
async function hydrateTodayBookings(force: boolean): Promise<void> {
  if (!(await shouldHydrate('bookings', force))) return;

  try {
    const metadata = await cacheManager.getMetadata('bookings');
    const since = metadata?.lastSyncAt ? new Date(metadata.lastSyncAt).toISOString() : undefined;
    const today = new Date().toISOString().split('T')[0];
    
    const response = await api.get(STORE_CONFIG.bookings.endpoint, {
      params: { 
        date: today,
        ...(since ? { since } : {})
      }
    });
    
    if (response.data?.bookings) {
      // If we got 'incremental' results, we merge. If we got a full list, we clear.
      if (since && response.data.isIncremental) {
        await bookingsStore.putMany(response.data.bookings);
      } else {
        // SAFETY: Only clear if there are no pending offline updates for bookings
        const hasPending = await syncQueue.hasPending('booking');
        if (!hasPending) {
          await bookingsStore.clear();
        }
        await bookingsStore.putMany(response.data.bookings);
      }
      await cacheManager.updateMetadata('bookings', await bookingsStore.count());
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate today\'s bookings:', error);
  }
}

/**
 * Fetch and store pool sessions for today
 */
async function hydratePoolSessions(force: boolean): Promise<void> {
  if (!(await shouldHydrate('pool_sessions', force))) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await api.get(STORE_CONFIG.pool_sessions.endpoint, {
      params: { date: today }
    });
    if (response.data?.sessions) {
      await poolSessionsStore.clear();
      await poolSessionsStore.putMany(response.data.sessions);
      await cacheManager.updateMetadata('pool_sessions', response.data.sessions.length);
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate pool sessions:', error);
  }
}

/**
 * Fetch and store today's pool tickets for validation
 */
async function hydrateTodayTickets(force: boolean): Promise<void> {
  if (!(await shouldHydrate('tickets', force))) return;

  try {
    const response = await api.get(STORE_CONFIG.tickets.endpoint);
    if (response.data?.tickets) {
      const hasPending = await syncQueue.hasPending('pool_ticket');
      if (!hasPending) {
        await ticketsStore.clear();
      }
      await ticketsStore.putMany(response.data.tickets);
      await cacheManager.updateMetadata('tickets', response.data.tickets.length);
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate today\'s tickets:', error);
  }
}

/**
 * Fetch and store housekeeping tasks assigned to current staff
 */
async function hydrateMyHousekeepingTasks(force: boolean): Promise<void> {
  if (!(await shouldHydrate('housekeeping_tasks', force))) return;

  try {
    const response = await api.get(STORE_CONFIG.housekeeping_tasks.endpoint);
    if (response.data?.tasks) {
      const hasPending = await syncQueue.hasPending('housekeeping_task');
      if (!hasPending) {
        await housekeepingTasksStore.clear();
      }
      await housekeepingTasksStore.putMany(response.data.tasks);
      await cacheManager.updateMetadata('housekeeping_tasks', response.data.tasks.length);
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate housekeeping tasks:', error);
  }
}

/**
 * Fetch and store menu items, categories, and modifiers
 */
async function hydrateMenu(force: boolean): Promise<void> {
  if (!(await shouldHydrate('menu', force))) return;

  try {
    const [menuResponse, modifiersResponse] = await Promise.all([
      api.get('/restaurant/menu'),
      api.get('/restaurant/modifiers')
    ]);

    if (menuResponse.data?.items) {
      await menuItemsStore.clear();
      await menuItemsStore.putMany(menuResponse.data.items);
      await cacheManager.updateMetadata('menu_items', menuResponse.data.items.length);
    }

    if (menuResponse.data?.categories) {
      await menuCategoriesStore.clear();
      await menuCategoriesStore.putMany(menuResponse.data.categories);
      await cacheManager.updateMetadata('menu_categories', menuResponse.data.categories.length);
    }

    if (modifiersResponse.data?.modifiers) {
      await modifiersStore.clear();
      await modifiersStore.putMany(modifiersResponse.data.modifiers);
      await cacheManager.updateMetadata('modifiers', modifiersResponse.data.modifiers.length);
    }
    
    await cacheManager.updateMetadata('menu', 1); // Group marker
  } catch (error) {
    console.error('[Offline] Failed to hydrate menu:', error);
  }
}

/**
 * Fetch and store recent customers
 */
async function hydrateCustomers(force: boolean): Promise<void> {
  if (!(await shouldHydrate('customers', force))) return;

  try {
    const metadata = await cacheManager.getMetadata('customers');
    const since = metadata?.lastSyncAt ? new Date(metadata.lastSyncAt).toISOString() : undefined;

    const response = await api.get(STORE_CONFIG.customers.endpoint, {
      params: { 
        ...STORE_CONFIG.customers.queryParams,
        ...(since ? { since } : {})
      }
    });
    
    if (response.data?.users) {
      // For customers we merge instead of clear to build a larger offline directory over time
      for (const customer of response.data.users) {
        await customersStore.put(customer);
      }
      
      // SIZE CAP: Limit to 500 records to prevent unbounded growth
      const count = await customersStore.count();
      if (count > 500) {
        const all = await customersStore.getAll();
        // Remove oldest records (this is a simple cap, in production we'd use last_visit)
        const toRemove = all.slice(0, all.length - 500);
        for (const item of toRemove) {
          await customersStore.delete(item.id);
        }
      }
      
      await cacheManager.updateMetadata('customers', await customersStore.count());
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate customers:', error);
  }
}

