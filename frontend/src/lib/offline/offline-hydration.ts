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
} from './offline-storage';
import api from '@/lib/api';

const MAX_CACHE_AGE_MINUTES = 60;

/**
 * Hydrate all critical offline stores for the current shift
 */
export async function hydrateOfflineStores(): Promise<void> {
  console.log('[Offline] Starting data hydration...');
  
  await Promise.allSettled([
    hydrateChalets(),
    hydrateTodayBookings(),
    hydratePoolSessions(),
    hydrateTodayTickets(),
    hydrateMyHousekeepingTasks(),
    hydrateMenu(),
    hydrateCustomers(),
  ]);
  
  console.log('[Offline] Hydration complete.');
}

/**
 * Fetch and store all chalets and their current status
 */
async function hydrateChalets(): Promise<void> {
  try {
    const response = await api.get('/chalets');
    if (response.data?.chalets) {
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
async function hydrateTodayBookings(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await api.get(`/chalets/staff/bookings?date=${today}`);
    if (response.data?.bookings) {
      await bookingsStore.clear();
      await bookingsStore.putMany(response.data.bookings);
      await cacheManager.updateMetadata('bookings', response.data.bookings.length);
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate today\'s bookings:', error);
  }
}

/**
 * Fetch and store pool sessions for today
 */
async function hydratePoolSessions(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await api.get(`/pool/sessions?date=${today}`);
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
async function hydrateTodayTickets(): Promise<void> {
  try {
    const response = await api.get('/pool/staff/tickets/today');
    if (response.data?.tickets) {
      await ticketsStore.clear();
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
async function hydrateMyHousekeepingTasks(): Promise<void> {
  try {
    const response = await api.get('/housekeeping/my-tasks');
    if (response.data?.tasks) {
      await housekeepingTasksStore.clear();
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
async function hydrateMenu(): Promise<void> {
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
  } catch (error) {
    console.error('[Offline] Failed to hydrate menu:', error);
  }
}

/**
 * Fetch and store recent customers
 */
async function hydrateCustomers(): Promise<void> {
  try {
    const response = await api.get('/users?role=customer&limit=500&sort=last_visit:desc');
    if (response.data?.users) {
      // For customers we merge instead of clear to build a larger offline directory over time
      for (const customer of response.data.users) {
        await customersStore.put(customer);
      }
      const count = await customersStore.count();
      await cacheManager.updateMetadata('customers', count);
    }
  } catch (error) {
    console.error('[Offline] Failed to hydrate customers:', error);
  }
}
