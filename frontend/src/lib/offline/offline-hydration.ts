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
