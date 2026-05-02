/**
 * Offline Sync Manager
 * 
 * Manages synchronization between IndexedDB and the server:
 * - Background sync when online
 * - Conflict resolution
 * - Cache refresh
 * - Sync status notifications
 */

import {
  syncQueue,
  cacheManager,
  menuItemsStore,
  menuCategoriesStore,
  modifiersStore,
  customersStore,
  ordersStore,
  paymentsStore,
  chaletsStore,
  bookingsStore,
  poolSessionsStore,
  ticketsStore,
  housekeepingTasksStore,
  isOnline,
  onOnline,
  onOffline,
} from './offline-storage';
import { hydrateOfflineStores } from './offline-hydration';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Sync configuration
const SYNC_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 5000,
  cacheRefreshIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxCacheAgeMinutes: 60,
};

// Sync status callbacks
type SyncStatusCallback = (status: SyncStatus) => void;
const statusCallbacks: Set<SyncStatusCallback> = new Set();

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: Date | null;
  error: string | null;
}

let currentStatus: SyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: null,
  error: null,
};

function updateStatus(partial: Partial<SyncStatus>): void {
  currentStatus = { ...currentStatus, ...partial };
  statusCallbacks.forEach((cb) => cb(currentStatus));
}

export function subscribeToSyncStatus(callback: SyncStatusCallback): () => void {
  statusCallbacks.add(callback);
  callback(currentStatus);
  return () => statusCallbacks.delete(callback);
}

export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

/**
 * Initialize offline sync manager
 */
export async function initOfflineSync(): Promise<void> {
  // Update online status
  onOnline(() => {
    updateStatus({ isOnline: true });
    syncAll();
  });

  onOffline(() => {
    updateStatus({ isOnline: false });
  });

  // Initial cache refresh if online
  if (isOnline()) {
    await hydrateOfflineStores();
    await refreshAllCaches();
  }

  // Update pending count
  const stats = await syncQueue.getStats();
  updateStatus({
    pendingCount: stats.pending,
    failedCount: stats.failed,
  });

  // Start periodic sync
  setInterval(() => {
    if (isOnline() && !currentStatus.isSyncing) {
      syncAll();
    }
  }, SYNC_CONFIG.cacheRefreshIntervalMs);
}

/**
 * Refresh all caches from server
 */
export async function refreshAllCaches(): Promise<void> {
  if (!isOnline()) return;

  try {
    await Promise.all([
      refreshMenuCache(),
      refreshCustomerCache(),
      hydrateOfflineStores(),
    ]);
    
    updateStatus({ lastSyncAt: new Date(), error: null });
  } catch (error) {
    console.error('Cache refresh failed:', error);
    updateStatus({ error: error instanceof Error ? error.message : 'Cache refresh failed' });
  }
}

/**
 * Refresh menu data cache
 */
export async function refreshMenuCache(): Promise<void> {
  const isStale = await cacheManager.isStale('menu_items', SYNC_CONFIG.maxCacheAgeMinutes);
  if (!isStale && !isOnline()) return;

  try {
    // Fetch menu items
    const menuResponse = await api.get('/restaurant/menu');
    const menuData = menuResponse.data;
    
    // Store menu items
    if (menuData.items) {
      await menuItemsStore.clear();
      await menuItemsStore.putMany(menuData.items);
      await cacheManager.updateMetadata('menu_items', menuData.items.length);
    }
    
    // Store categories
    if (menuData.categories) {
      await menuCategoriesStore.clear();
      await menuCategoriesStore.putMany(menuData.categories);
      await cacheManager.updateMetadata('menu_categories', menuData.categories.length);
    }

    // Fetch modifiers
    const modifiersResponse = await api.get('/restaurant/modifiers');
    const modifiersData = modifiersResponse.data;
    if (modifiersData.modifiers) {
      await modifiersStore.clear();
      await modifiersStore.putMany(modifiersData.modifiers);
      await cacheManager.updateMetadata('modifiers', modifiersData.modifiers.length);
    }
  } catch (error) {
    console.error('Menu cache refresh failed:', error);
    throw error;
  }
}

/**
 * Refresh customer data cache (recent customers only)
 */
export async function refreshCustomerCache(): Promise<void> {
  const isStale = await cacheManager.isStale('customers', SYNC_CONFIG.maxCacheAgeMinutes);
  if (!isStale && !isOnline()) return;

  try {
    const response = await api.get('/users?role=customer&limit=500&sort=last_visit:desc');
    const data = response.data;
    
    if (data.users) {
      // Don't clear - merge with existing data
      for (const customer of data.users) {
        await customersStore.put(customer);
      }
      await cacheManager.updateMetadata('customers', await customersStore.count());
    }
  } catch (error) {
    console.error('Customer cache refresh failed:', error);
    throw error;
  }
}

/**
 * Sync all pending items to server
 */
export async function syncAll(): Promise<{ synced: number; failed: number }> {
  if (!isOnline() || currentStatus.isSyncing) {
    return { synced: 0, failed: 0 };
  }

  updateStatus({ isSyncing: true });
  
  let synced = 0;
  let failed = 0;

  try {
    // Get all pending items
    const pending = await syncQueue.getPending();
    
    for (const item of pending) {
      try {
        await syncItem(item);
        await syncQueue.remove(item.id);
        synced++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update item status
        if (item.attempts >= SYNC_CONFIG.maxRetries) {
          await syncQueue.updateStatus(item.id, 'failed', errorMessage);
          failed++;
        } else {
          await syncQueue.updateStatus(item.id, 'pending', errorMessage);
        }
      }
    }

    // Update status
    const stats = await syncQueue.getStats();
    updateStatus({
      isSyncing: false,
      pendingCount: stats.pending,
      failedCount: stats.failed,
      lastSyncAt: new Date(),
      error: null,
    });

    // Refresh caches after sync
    await refreshAllCaches();

  } catch (error) {
    updateStatus({
      isSyncing: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  }

  return { synced, failed };
}

/**
 * Sync a single queue item
 */
async function syncItem(item: { entityType: string; entityId: string; operation: string; data: unknown }): Promise<void> {
  const { entityType, entityId, operation, data } = item;
  
  let endpoint: string;
  let method: string;
  
  switch (entityType) {
    case 'order':
      endpoint = operation === 'create' 
        ? `${API_BASE}/api/v1/restaurant/orders`
        : `${API_BASE}/api/v1/restaurant/orders/${entityId}`;
      break;
    case 'payment':
      endpoint = `${API_BASE}/api/v1/payments`;
      break;
    case 'booking':
      endpoint = `${API_BASE}/api/v1/chalets/staff/bookings/${entityId}/status`;
      break;
    case 'check-in':
      endpoint = `${API_BASE}/api/v1/chalets/staff/bookings/${entityId}/check-in`;
      break;
    case 'pool-check-in':
      endpoint = `${API_BASE}/api/v1/pool/staff/validate`;
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  switch (operation) {
    case 'create':
      method = 'POST';
      break;
    case 'update':
      method = 'PUT';
      break;
    case 'delete':
      method = 'DELETE';
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  const response = await api({
    url: endpoint.replace(`${API_BASE}/api/v1`, ''),
    method,
    data: operation !== 'delete' ? data : undefined,
  });

  if (response.status >= 400) {
    // Handle conflict detection
    if (response.status === 409) {
      await handleSyncConflict(item, response.data);
      return;
    }
    throw new Error(`HTTP ${response.status}`);
  }

  // If this was an offline order, update local record with server ID
  if (entityType === 'order' && operation === 'create') {
    const result = response.data;
    if (result.id && result.id !== entityId) {
      // Update local order with server ID
      const localOrder = await ordersStore.getById(entityId);
      if (localOrder) {
        await ordersStore.delete(entityId);
        await ordersStore.put({ ...localOrder, id: result.id, synced: true });
      }
    }
  }
}

/**
 * Handle sync conflicts based on Phase 1 rules
 */
async function handleSyncConflict(item: any, serverData: any): Promise<void> {
  const { entityType, entityId, data } = item;

  switch (entityType) {
    case 'booking':
      // Chalet status: server wins on sync, flag mismatch for manager review
      console.warn(`[Offline] Conflict detected for booking ${entityId}. Server data wins.`);
      // We could add a 'flagged_for_review' field if the schema allowed
      break;
    case 'check-in':
      // Check-ins: union merge - if already checked in, we just accept it
      console.log(`[Offline] Check-in merge for ${entityId}.`);
      break;
    default:
      console.warn(`[Offline] Unhandled conflict for ${entityType}`);
  }
}

/**
 * Create an offline order
 */
export async function createOfflineOrder(orderData: {
  tableId?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    notes?: string;
    modifiers?: string[];
  }>;
  customerId?: string;
  notes?: string;
}): Promise<string> {
  const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const order = {
    id: offlineId,
    ...orderData,
    status: 'pending',
    created_at: new Date().toISOString(),
    synced: false,
  };

  // Save to local store
  await ordersStore.put(order);

  // Add to sync queue
  await syncQueue.add({
    entityType: 'order',
    entityId: offlineId,
    operation: 'create',
    data: orderData,
  });

  // Update pending count
  const stats = await syncQueue.getStats();
  updateStatus({ pendingCount: stats.pending });

  // Try to sync immediately if online
  if (isOnline()) {
    syncAll();
  }

  return offlineId;
}

/**
 * Internal helper to update status and trigger sync if online
 */
async function publishSyncStatus(): Promise<void> {
  const stats = await syncQueue.getStats();
  updateStatus({
    pendingCount: stats.pending,
    failedCount: stats.failed,
  });
  if (isOnline() && stats.pending > 0) {
    syncAll();
  }
}

// --- Action Creators for Other Modules ---

/**
 * Update a booking status offline
 */
export async function createOfflineBookingStatusUpdate(bookingId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'booking',
    entityId: bookingId,
    operation: 'update',
    data: { status },
  });
  
  // No store update needed here as the UI uses optimistic updates or re-fetches
  await publishSyncStatus();
  return syncId;
}

/**
 * Update a housekeeping task status offline
 */
export async function createOfflineTaskStatusUpdate(taskId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'housekeeping_task',
    entityId: taskId,
    operation: 'update',
    data: { status },
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record a pool entry offline
 */
export async function createOfflinePoolEntry(ticketId: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'pool_ticket',
    entityId: ticketId,
    operation: 'update', // entry is an update to the ticket
    data: { type: 'entry', entry_time: new Date().toISOString() },
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record a pool exit offline
 */
export async function createOfflinePoolExit(ticketId: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'pool_ticket',
    entityId: ticketId,
    operation: 'update', // exit is an update to the ticket
    data: { type: 'exit', exit_time: new Date().toISOString() },
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Validate a pool ticket offline
 */
export async function createOfflineTicketValidation(ticketNumber: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'pool_ticket',
    entityId: ticketNumber,
    operation: 'update', // validation is an update/check
    data: { type: 'validate', ticketNumber },
  });
  
  await publishSyncStatus();
  return syncId;
}

// --- Internal Sync Logic ---

async function resolveSyncAction(item: any): Promise<any> {
  const { entityType, entityId, operation, data } = item;

  switch (entityType) {
    case 'order':
      return api.post('/restaurant/orders', data);
    
    case 'booking':
      if (operation === 'update') {
        return api.patch(`/chalets/bookings/${entityId}/status`, data);
      }
      break;

    case 'housekeeping_task':
      if (operation === 'update') {
        const { status } = data;
        let endpoint = `/housekeeping/tasks/${entityId}`;
        let method: 'put' | 'post' = 'put';
        
        if (status === 'in_progress') {
          endpoint = `/housekeeping/tasks/${entityId}/start`;
          method = 'post';
        } else if (status === 'completed') {
          endpoint = `/housekeeping/tasks/${entityId}/complete`;
          method = 'post';
        }
        
        return method === 'post' ? api.post(endpoint, {}) : api.put(endpoint, { status });
      }
      break;

    case 'pool_ticket':
      if (operation === 'update') {
        if (data.type === 'entry') {
          return api.post(`/pool/tickets/${entityId}/entry`);
        }
        if (data.type === 'exit') {
          return api.post(`/pool/tickets/${entityId}/exit`);
        }
        if (data.type === 'validate') {
          return api.post('/pool/staff/validate', { ticketNumber: data.ticketNumber });
        }
      }
      break;
  }

  throw new Error(`Unsupported sync action: ${entityType}/${operation}`);
}

/**
 * Get pool tickets from cache
 */
export async function getOfflineTickets(): Promise<unknown[]> {
  return ticketsStore.getAll();
}

/**
 * Get housekeeping tasks from cache
 */
export async function getOfflineTasks(): Promise<unknown[]> {
  return housekeepingTasksStore.getAll();
}

/**
 * Get menu items from cache
 */
export async function getOfflineMenuItems(): Promise<unknown[]> {
  return menuItemsStore.getAll();
}

/**
 * Get menu categories from cache
 */
export async function getOfflineCategories(): Promise<unknown[]> {
  return menuCategoriesStore.getAll();
}

/**
 * Get customers from cache
 */
export async function getOfflineCustomers(): Promise<unknown[]> {
  return customersStore.getAll();
}

/**
 * Search customers in cache
 */
export async function searchOfflineCustomers(query: string): Promise<unknown[]> {
  const customers = await customersStore.getAll();
  const lowerQuery = query.toLowerCase();
  
  return customers.filter((c: any) => 
    c.email?.toLowerCase().includes(lowerQuery) ||
    c.first_name?.toLowerCase().includes(lowerQuery) ||
    c.last_name?.toLowerCase().includes(lowerQuery) ||
    c.phone?.includes(query)
  );
}

/**
 * Get unsent orders
 */
export async function getUnsentOrders(): Promise<unknown[]> {
  // Get all orders and filter for unsynced ones
  // (IndexedDB doesn't support boolean index keys directly)
  const allOrders = await ordersStore.getAll();
  return allOrders.filter((order) => !order.synced);
}

/**
 * Force retry failed items
 */
export async function retryFailedItems(): Promise<{ retried: number }> {
  const failed = await syncQueue.getFailed();
  
  for (const item of failed) {
    await syncQueue.updateStatus(item.id, 'pending');
  }

  // Update counts
  const stats = await syncQueue.getStats();
  updateStatus({
    pendingCount: stats.pending,
    failedCount: stats.failed,
  });

  // Trigger sync
  if (isOnline()) {
    syncAll();
  }

  return { retried: failed.length };
}

/**
 * Clear all offline data
 */
export async function clearOfflineData(): Promise<void> {
  await Promise.all([
    menuItemsStore.clear(),
    menuCategoriesStore.clear(),
    modifiersStore.clear(),
    customersStore.clear(),
    ordersStore.clear(),
    paymentsStore.clear(),
    syncQueue.clear(),
  ]);

  updateStatus({
    pendingCount: 0,
    failedCount: 0,
    lastSyncAt: null,
  });
}
