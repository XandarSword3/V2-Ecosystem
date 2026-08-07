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
  catalogItemsStore,
  catalogCategoriesStore,
  modifiersStore,
  customersStore,
  ordersStore,
  paymentsStore,
  bookableUnitsStore,
  bookingsStore,
  ticketsStore,
  housekeepingTasksStore,
  conflictsStore,
  offlineActivityStore,
  isOnline,
  onOnline,
  onOffline,
} from './offline-storage';
import { hydrateOfflineStores } from './offline-hydration';
import api from '@/lib/api';



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
    // Force hydration when manually requested
    await hydrateOfflineStores(true);
    
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
    if (pending.length === 0) {
      updateStatus({ isSyncing: false });
      return { synced: 0, failed: 0 };
    }

    // Optimization: Fetch all activities once and create a Map for O(1) lookup
    const activities = await offlineActivityStore.getAll();
    const activityMap = new Map();
    activities.forEach((a: any) => {
      // Use a composite key or just entityId if it's unique enough for pending items
      activityMap.set(a.entityId, a);
    });
    
    for (const item of pending) {
      try {
        await resolveSyncAction(item);
        
        // After successful sync, update the local record with synced: true
        await updateLocalRecordSyncStatus(item.entityType, item.entityId, true);
        
        await syncQueue.remove(item.id);
        
        // Find and update the activity log entry for this entity
        const entry = activityMap.get(item.entityId);
        if (entry) {
          const updatedEntry = { ...entry, syncedAt: new Date().toISOString() };
          await offlineActivityStore.put(updatedEntry);
          // Update map to keep it in sync for subsequent items with same entityId
          activityMap.set(item.entityId, updatedEntry);
        }
        
        synced++;
      } catch (error: any) {
        console.error(`[Offline Sync] Item ${item.id} failed:`, error);
        
        // Conflict handling (409)
        if (error.response?.status === 409) {
          await handleSyncConflict(item, error.response.data);
          await syncQueue.remove(item.id);
          
          // Find and update the activity log entry for this entity (conflicts also count as synced)
          const entry = activityMap.get(item.entityId);
          if (entry) {
            const updatedEntry = { ...entry, syncedAt: new Date().toISOString() };
            await offlineActivityStore.put(updatedEntry);
            activityMap.set(item.entityId, updatedEntry);
          }
          
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
 * Helper to update a local record's sync status or data
 */
async function updateLocalRecordSyncStatus(entityType: string, entityId: string, synced: boolean, extraData: any = {}): Promise<void> {
  let store: any = null;
  
  switch (entityType) {
    case 'order':
      store = ordersStore;
      break;
    case 'booking':
    case 'booking_check_in':
    case 'booking_check_out':
      store = bookingsStore;
      break;
    case 'ticket':
      store = ticketsStore;
      break;
    case 'housekeeping_task':
      store = housekeepingTasksStore;
      break;
    case 'unit_status':
      store = bookableUnitsStore;
      break;
    case 'payment':
      store = paymentsStore;
      break;
  }

  if (store) {
    const record = await store.getById(entityId);
    if (record) {
      await store.put({ ...record, ...extraData, synced });
    }
  }
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
 * Resolve a sync conflict (Phase 4)
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'accept_local' | 'accept_server'
): Promise<void> {
  const conflict = await conflictsStore.getById(conflictId);
  if (!conflict) throw new Error('Conflict not found');

  if (resolution === 'accept_local') {
    // Re-queue the local write with elevated priority
    await syncQueue.add({
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      operation: 'update',
      data: { ...conflict.localData, _conflictOverride: true },
      priority: 0, // Force sync immediately
    });
    await syncAll();
  }
  // accept_server: local data is already overwritten by background hydration, just mark resolved

  await conflictsStore.put({ ...conflict, resolved: true });
  updateStatus({ error: null });
}

/**
 * Create an offline order
 */
export async function createOfflineOrder(orderData: {
  moduleId: string;
  // Required, not cosmetic: resolveSyncAction's replay POST is
  // `/${data.moduleSlug}/orders` (the dynamic module router is mounted by
  // slug, not id) — without this, every offline-created order replays to
  // `/undefined/orders` and fails silently after retries exhaust, with the
  // order stuck unsynced in the local store looking like it went through.
  moduleSlug: string;
  tableId?: string;
  tableNumber?: string;
  items: Array<{ menuItemId: string; quantity: number; notes?: string; modifiers?: any[] }>;
  customerName?: string;
  paymentMethod?: string;
  specialInstructions?: string;
}): Promise<string> {
  // Generate a temp ID so UI can reference it immediately
  const tempId = `offline_${crypto.randomUUID()}`;

  // Write to local store immediately so KitchenView shows it
  await ordersStore.put({
    id: tempId,
    ...orderData,
    status: 'pending',
    synced: false,
    createdAt: new Date().toISOString(),
    isOfflineCreated: true,
  });

  const syncId = await syncQueue.add({
    entityType: 'order',
    entityId: tempId,
    operation: 'create',
    data: { ...orderData, tempId },
    priority: 0, // Order creation is high priority
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'order',
    entityId: tempId,
    action: 'create',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });

  await publishSyncStatus();
  return syncId;
}

/**
 * Record an offline cash payment
 */
export async function createOfflineCashPayment(paymentData: {
  referenceType: 'order' | 'ticket' | 'booking' | 'restaurant_order';
  referenceId: string;
  amount: number;
  currency?: string;
  customerName?: string;
  notes?: string;
}): Promise<string> {
  const tempId = `offline_payment_${crypto.randomUUID()}`;

  await paymentsStore.put({
    id: tempId,
    ...paymentData,
    method: 'cash',
    status: 'pending_sync',
    synced: false,
    recordedAt: new Date().toISOString(),
  });

  const syncId = await syncQueue.add({
    entityType: 'payment',
    entityId: tempId,
    operation: 'create',
    data: paymentData,
    priority: 0, // Financial operations sync first
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'payment',
    entityId: tempId,
    action: 'create',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });

  await publishSyncStatus();
  return syncId;
}

/**
 * Local QR validation for staff
 */
export async function validateTicketOffline(ticketNumber: string, moduleSlug: string): Promise<{
  valid: boolean;
  ticket?: any;
  reason?: string;
}> {
  // Search local cache by ticket_number index
  const allTickets = await ticketsStore.getAll();
  const ticket = allTickets.find(
    (t: any) => t.ticket_number === ticketNumber || t.qr_code === ticketNumber
  );

  if (!ticket) {
    return { valid: false, reason: 'Ticket not found in offline cache. May need to sync.' };
  }

  const today = new Date().toISOString().split('T')[0];
  const ticketDate = ticket.valid_date || ticket.ticket_date;

  if (ticketDate && ticketDate !== today) {
    return { valid: false, reason: 'Ticket is not valid for today.' };
  }

  if (ticket.status === 'used' || ticket.status === 'expired') {
    return { valid: false, reason: `Ticket already ${ticket.status}.` };
  }

  if (ticket.status === 'cancelled') {
    return { valid: false, reason: 'Ticket has been cancelled.' };
  }

  // Duplicate entry fraud check
  if (ticket.entry_time && !ticket.exit_time) {
    return { valid: false, reason: 'Ticket already checked in. Exit first.' };
  }

  // Mark as entered locally immediately (optimistic)
  await ticketsStore.put({
    ...ticket,
    status: 'active',
    entry_time: new Date().toISOString(),
    synced: false,
  });

  // Queue the server confirmation
  await createOfflineTicketEntry(ticket.id, moduleSlug);

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'ticket',
    entityId: ticket.id,
    action: 'validate',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });

  return { valid: true, ticket };
}

/**
 * Internal helper to update status and trigger sync if online
 */
async function publishSyncStatus(): Promise<void> {
  const stats = await syncQueue.getStats();
  const allMetadata = await cacheManager.getAllMetadata();
  
  // Find the most recent sync time across all stores
  let lastSyncAt = null;
  if (allMetadata.length > 0) {
    const times = allMetadata.map(m => new Date(m.lastSyncAt).getTime());
    lastSyncAt = new Date(Math.max(...times));
  }

  updateStatus({
    pendingCount: stats.pending,
    failedCount: stats.failed,
    lastSyncAt,
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
    priority: 1,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'booking',
    entityId: bookingId,
    action: 'update',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  // Optimistic update to local store
  await updateLocalRecordSyncStatus('booking', bookingId, false, { status });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Update an order status offline
 */
export async function createOfflineOrderStatusUpdate(orderId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'restaurant_order_status',
    entityId: orderId,
    operation: 'update',
    data: { status },
    priority: 1,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'restaurant_order_status',
    entityId: orderId,
    action: 'update',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  // Optimistic update to local store
  await updateLocalRecordSyncStatus('order', orderId, false, { status });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Update a table status offline
 */
export async function createOfflineTableStatusUpdate(tableId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'restaurant_table_status',
    entityId: tableId,
    operation: 'update',
    data: { status },
    priority: 2,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'restaurant_table_status',
    entityId: tableId,
    action: 'update',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Update a unit status (clean/dirty/occupied) offline
 */
export async function createOfflineUnitStatusUpdate(unitId: string, status: string, moduleSlug: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'unit_status',
    entityId: unitId,
    operation: 'update',
    data: { status, moduleSlug },
    priority: 2,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'unit_status',
    entityId: unitId,
    action: 'update',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  // Optimistic update to local store
  await updateLocalRecordSyncStatus('unit_status', unitId, false, { status });
  
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
    priority: 1,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'housekeeping_task',
    entityId: taskId,
    action: 'update',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  // Optimistic update to local store
  await updateLocalRecordSyncStatus('housekeeping_task', taskId, false, { status });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Perform a guest check-in offline
 */
export async function createOfflineGuestCheckIn(bookingId: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'booking_check_in',
    entityId: bookingId,
    operation: 'update',
    data: { status: 'checked_in' },
    priority: 1,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'booking',
    entityId: bookingId,
    action: 'check_in',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Perform a guest check-out offline
 */
export async function createOfflineGuestCheckOut(bookingId: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'booking_check_out',
    entityId: bookingId,
    operation: 'update',
    data: { status: 'checked_out' },
    priority: 1,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'booking',
    entityId: bookingId,
    action: 'check_out',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record an offline cash payment
 */
export async function createOfflinePaymentRecord(orderId: string, amount: number, method: string = 'cash'): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'payment',
    entityId: orderId,
    operation: 'create',
    data: { amount, method, status: 'completed', offline: true },
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record an offline inventory adjustment
 */
export async function createOfflineInventoryAdjustment(itemId: string, adjustment: number, reason: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'inventory_adjustment',
    entityId: itemId,
    operation: 'update',
    data: { adjustment, reason },
    priority: 2,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'inventory',
    entityId: itemId,
    action: 'adjust',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record a maintenance log offline
 */
export async function createOfflineMaintenanceLog(data: {
  type: string;
  notes: string;
  readings?: Record<string, string | number>;
}): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'maintenance_log',
    entityId: `log_${Date.now()}`,
    operation: 'create',
    data,
    priority: 2,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'maintenance',
    entityId: `log_${Date.now()}`,
    action: 'log',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record a maintenance flag offline
 */
export async function createOfflineMaintenanceFlag(resourceType: string, resourceId: string, issue: string, priority: string = 'medium'): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'maintenance_flag',
    entityId: `${resourceType}_${resourceId}`,
    operation: 'create',
    data: { resourceType, resourceId, issue, priority },
    priority: 2,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'maintenance_flag',
    entityId: `${resourceType}_${resourceId}`,
    action: 'flag',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}


/**
 * Record a pool entry offline
 */
export async function createOfflineTicketEntry(ticketId: string, moduleSlug: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'capacity_ticket',
    entityId: ticketId,
    operation: 'update',
    data: { type: 'entry', entry_time: new Date().toISOString(), moduleSlug },
    priority: 1,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'ticket',
    entityId: ticketId,
    action: 'entry',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record a pool exit offline
 */
export async function createOfflineTicketExit(ticketId: string, moduleSlug: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'capacity_ticket',
    entityId: ticketId,
    operation: 'update',
    data: { type: 'exit', exit_time: new Date().toISOString(), moduleSlug },
    priority: 1,
  });

  // Log activity
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'ticket',
    entityId: ticketId,
    action: 'exit',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Validate a pool ticket offline
 */
export async function createOfflineTicketValidation(ticketNumber: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'capacity_ticket',
    entityId: ticketNumber,
    operation: 'update',
    data: { type: 'validate', ticketNumber },
  });
  
  await publishSyncStatus();
  return syncId;
}

/**
 * Record a pool/capacity entry offline (no module-slug required)
 */
export async function createOfflinePoolEntry(ticketId: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'capacity_ticket',
    entityId: ticketId,
    operation: 'update',
    data: { type: 'entry' },
    priority: 1,
  });
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'ticket',
    entityId: ticketId,
    action: 'entry',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  await publishSyncStatus();
  return syncId;
}

/**
 * Record a pool/capacity exit offline (no module-slug required)
 */
export async function createOfflinePoolExit(ticketId: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'capacity_ticket',
    entityId: ticketId,
    operation: 'update',
    data: { type: 'exit' },
    priority: 1,
  });
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'ticket',
    entityId: ticketId,
    action: 'exit',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  await publishSyncStatus();
  return syncId;
}

/**
 * Update a chalet/accommodation-unit status offline
 */
export async function createOfflineChaletStatusUpdate(chaletId: string, status: string): Promise<string> {
  const syncId = await syncQueue.add({
    entityType: 'chalet_status',
    entityId: chaletId,
    operation: 'update',
    data: { status },
    priority: 2,
  });
  await offlineActivityStore.put({
    id: crypto.randomUUID(),
    type: 'unit_status',
    entityId: chaletId,
    action: 'update',
    timestamp: new Date().toISOString(),
    syncedAt: null,
  });
  await publishSyncStatus();
  return syncId;
}

// --- Internal Sync Logic ---

async function resolveSyncAction(item: any): Promise<any> {
  const { entityType, entityId, operation, data } = item;

  switch (entityType) {
    case 'order':
      if (operation === 'create') {
        const response = await api.post(`/${data.moduleSlug}/orders`, data);
        // Replace temp record with real server ID
        const realId = response.data?.data?.id;
        if (realId && data.tempId) {
          const local = await ordersStore.getById(data.tempId);
          if (local) {
            await ordersStore.delete(data.tempId);
            await ordersStore.put({ ...local, id: realId, synced: true });
          }
        }
        return response;
      }
      if (operation === 'update') {
        return api.patch(`/${data.moduleSlug}/orders/${entityId}/status`, data);
      }
      break;
    
    case 'booking':
      if (operation === 'update') {
        return api.patch(`/${data.moduleSlug}/bookings/${entityId}/status`, data);
      }
      break;

    case 'restaurant_order_status':
      if (operation === 'update') {
        return api.patch(`/${data.moduleSlug}/orders/${entityId}/status`, data);
      }
      break;

    case 'restaurant_table_status':
      if (operation === 'update') {
        return api.patch(`/${data.moduleSlug}/tables/${entityId}`, data);
      }
      break;

    case 'unit_status':
      if (operation === 'update') {
        return api.patch(`/${data.moduleSlug}/units/${entityId}/status`, { status: data.status });
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

    case 'capacity_ticket':
      if (operation === 'update') {
        const base = data.moduleSlug ? `/${data.moduleSlug}` : '/pool';
        if (data.type === 'entry') return api.post(`${base}/tickets/${entityId}/entry`);
        if (data.type === 'exit') return api.post(`${base}/tickets/${entityId}/exit`);
        if (data.type === 'validate') {
          return api.post(`${base}/staff/validate`, { ticketNumber: data.ticketNumber });
        }
      }
      break;

    // Legacy alias kept for backward-compat with queued items pre-rename
    case 'ticket':
      if (operation === 'update') {
        if (data.type === 'entry') {
          return api.post(`/${data.moduleSlug}/tickets/${entityId}/entry`);
        }
        if (data.type === 'exit') {
          return api.post(`/${data.moduleSlug}/tickets/${entityId}/exit`);
        }
        if (data.type === 'validate') {
          return api.post(`/${data.moduleSlug}/staff/validate`, { ticketNumber: data.ticketNumber });
        }
      }
      break;

    case 'booking_check_in':
      return api.patch(`/${data.moduleSlug}/bookings/${entityId}/check-in`, data);
    
    case 'booking_check_out':
      return api.patch(`/${data.moduleSlug}/bookings/${entityId}/check-out`, data);

    case 'payment':
      if (operation === 'create') {
        return api.post('/payments/cash', data);
      }
      break;

    case 'inventory_adjustment':
      return api.patch(`/inventory/items/${entityId}/adjust`, data);

    case 'maintenance_log':
      return api.post('/maintenance/logs', data);

    case 'maintenance_flag':
      return api.post('/maintenance/tickets', data);

    case 'chalet_status':
      if (operation === 'update') {
        const moduleSlug = data.moduleSlug ?? 'bookings';
        return api.patch(`/${moduleSlug}/units/${entityId}/status`, { status: data.status });
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
 * Get catalog items from cache
 */
export async function getOfflineCatalogItems(): Promise<unknown[]> {
  return catalogItemsStore.getAll();
}

/**
 * Get catalog categories from cache
 */
export async function getOfflineCategories(): Promise<unknown[]> {
  return catalogCategoriesStore.getAll();
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
    catalogItemsStore.clear(),
    catalogCategoriesStore.clear(),
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
