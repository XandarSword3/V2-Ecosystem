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
  conflictsStore,
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
  // Update online status and handle iOS foreground sync fallback
  onOnline(() => {
    updateStatus({ isOnline: true });
    
    // Check if Workbox Background Sync is supported, if not, force a manual sync
    // This is critical for iOS/Safari which doesn't support BackgroundSync API
    const isBackgroundSyncSupported = 'serviceWorker' in navigator && 'SyncManager' in window;
    if (!isBackgroundSyncSupported) {
      console.log('[Offline Sync] Manual sync fallback for iOS/Safari');
      syncAll();
    } else {
      // Even if supported, a proactive syncAll is safer on network resume
      syncAll();
    }
  });

  onOffline(() => {
    updateStatus({ isOnline: false });
  });

  // Initial hydration if online (only call once)
  if (isOnline()) {
    await hydrateOfflineStores();
  }

  // Update pending count
  const stats = await syncQueue.getStats();
  updateStatus({
    pendingCount: stats.pending,
    failedCount: stats.failed,
  });

  // Start periodic sync/refresh
  setInterval(() => {
    if (isOnline() && !currentStatus.isSyncing) {
      syncAll();
      refreshAllCaches();
    }
  }, SYNC_CONFIG.cacheRefreshIntervalMs);
}

/**
 * Refresh all caches from server
 */
export async function refreshAllCaches(): Promise<void> {
  if (!isOnline()) return;

  try {
    // Note: hydrateOfflineStores now includes menu and customer data
    await hydrateOfflineStores();
    
    updateStatus({ lastSyncAt: new Date(), error: null });
  } catch (error) {
    console.error('Cache refresh failed:', error);
    updateStatus({ error: error instanceof Error ? error.message : 'Cache refresh failed' });
  }
}



/**
 * Sync all pending items to server
 */
export async function syncAll(): Promise<{ synced: number; failed: number }> {
  if (!isOnline() || currentStatus.isSyncing) {
    return { synced: 0, failed: 0 };
  }

  updateStatus({ isSyncing: true, error: null });
  
  let synced = 0;
  let failed = 0;

  try {
    const pending = await syncQueue.getPending();
    
    for (const item of pending) {
      try {
        await resolveSyncAction(item);
        await syncQueue.remove(item.id);
        synced++;
      } catch (error: any) {
        console.error(`[Offline Sync] Item ${item.id} failed:`, error);
        
        // Conflict handling (409)
        if (error.response?.status === 409) {
          await handleSyncConflict(item, error.response.data);
          await syncQueue.remove(item.id);
          synced++;
          continue;
        }

        const errorMessage = error.message || 'Unknown error';
        if (item.attempts >= SYNC_CONFIG.maxRetries) {
          await syncQueue.updateStatus(item.id, 'failed', errorMessage);
          failed++;
        } else {
          await syncQueue.updateStatus(item.id, 'pending', errorMessage);
        }
      }
    }

    const stats = await syncQueue.getStats();
    updateStatus({
      isSyncing: false,
      pendingCount: stats.pending,
      failedCount: stats.failed,
      lastSyncAt: new Date(),
    });

  } catch (error) {
    console.error('[Offline Sync] Global sync error:', error);
    updateStatus({
      isSyncing: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  }

  return { synced, failed };
}

/**
 * Handle sync conflicts based on Phase 1 rules
 */
async function handleSyncConflict(item: any, serverData: any): Promise<void> {
  const { entityType, entityId, data } = item;
  console.warn(`[Offline Sync] Conflict for ${entityType} ${entityId}. Server wins.`);
  
  // Persist conflict for manager review
  await conflictsStore.put({
    id: `${entityType}_${entityId}`,
    entityType,
    entityId,
    localData: data,
    serverData,
    resolved: false,
    createdAt: new Date(),
  });

  // Notify UI
  updateStatus({ error: `Conflict detected for ${entityType} ${entityId}. Flagged for review.` });
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
 * Update a restaurant order status offline
 */
export async function createOfflineOrderStatusUpdate(orderId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'restaurant_order_status',
    entityId: orderId,
    operation: 'update',
    data: { status },
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Update a restaurant table status offline
 */
export async function createOfflineTableStatusUpdate(tableId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'restaurant_table_status',
    entityId: tableId,
    operation: 'update',
    data: { status },
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Update a chalet status (clean/dirty/occupied) offline
 */
export async function createOfflineChaletStatusUpdate(chaletId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'chalet_status',
    entityId: chaletId,
    operation: 'update',
    data: { status },
  });
  
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

    case 'restaurant_order_status':
      if (operation === 'update') {
        return api.patch(`/restaurant/staff/orders/${entityId}/status`, data);
      }
      break;

    case 'restaurant_table_status':
      if (operation === 'update') {
        return api.put(`/restaurant/tables/${entityId}/status`, data);
      }
      break;

    case 'chalet_status':
      if (operation === 'update') {
        return api.patch(`/chalets/staff/status`, { chaletId: entityId, status: data.status });
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
