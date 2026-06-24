/**
 * Offline POS Service
 * 
 * Provides offline-first capabilities for POS operations:
 * - IndexedDB storage for offline data
 * - Sync queue management
 * - Conflict resolution
 * - Automatic sync when back online
 */

// IndexedDB Database Schema
const DB_NAME = 'v2-offline-pos';
const DB_VERSION = 3;

// Store names
const STORES = {
  CATALOG_ITEMS: 'catalog_items',
  CATALOG_CATEGORIES: 'catalog_categories',
  MODIFIERS: 'modifiers',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  SYNC_QUEUE: 'sync_queue',
  SETTINGS: 'settings',
  CACHE_METADATA: 'cache_metadata',
  BOOKABLE_UNITS: 'bookable_units',
  BOOKINGS: 'bookings',
  CAPACITY_WINDOWS: 'capacity_windows',
  TICKETS: 'tickets',
  HOUSEKEEPING_TASKS: 'housekeeping_tasks',
  CONFLICTS: 'conflicts',
  OFFLINE_ACTIVITY: 'offline_activity',
};

interface SyncConflict {
  id: string; // entityType + entityId
  entityType: string;
  entityId: string;
  localData: any;
  serverData: any;
  resolved: boolean;
  createdAt: Date;
}

// Sync queue item status
type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';

interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: Date;
  attempts: number;
  lastAttempt?: Date;
  status: SyncStatus;
  priority?: 0 | 1 | 2; // 0=financial, 1=operational, 2=ui
  error?: string;
  serverVersion?: number;
}

interface CacheMetadata {
  id: string;  // Alias for storeName, required by OfflineStore interface
  storeName: string;
  lastSyncAt: Date;
  recordCount: number;
  checksum?: string;
}

// Generic entity type for stores that hold any entity with id
interface OfflineEntity {
  id: string;
  [key: string]: unknown;
}

// Order entity for offline storage
interface OfflineOrder extends OfflineEntity {
  synced?: boolean;
  status?: string;
  created_at?: string;
  tableId?: string;
  customerId?: string;
  notes?: string;
  items?: Array<{
    catalogItemId?: string;
    menuItemId?: string;
    quantity: number;
    notes?: string;
    modifiers?: any[];
    name?: string;
    id?: string;
  }>;
}

/**
 * Initialize IndexedDB database
 */
export function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Version 2→3: rename chalet_id index to unit_id in housekeeping tasks
      if (event.oldVersion < 3 && db.objectStoreNames.contains(STORES.HOUSEKEEPING_TASKS)) {
        const upgradeTx = (event.target as IDBOpenDBRequest).transaction!;
        const hkUpgrade = upgradeTx.objectStore(STORES.HOUSEKEEPING_TASKS);
        if (hkUpgrade.indexNames.contains('chalet_id')) hkUpgrade.deleteIndex('chalet_id');
        if (!hkUpgrade.indexNames.contains('unit_id')) hkUpgrade.createIndex('unit_id', 'unit_id', { unique: false });
      }

      // Catalog Items Store
      if (!db.objectStoreNames.contains(STORES.CATALOG_ITEMS)) {
        const catalogItemsStore = db.createObjectStore(STORES.CATALOG_ITEMS, { keyPath: 'id' });
        catalogItemsStore.createIndex('category_id', 'category_id', { unique: false });
        catalogItemsStore.createIndex('is_available', 'is_available', { unique: false });
        catalogItemsStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // Catalog Categories Store
      if (!db.objectStoreNames.contains(STORES.CATALOG_CATEGORIES)) {
        const categoryStore = db.createObjectStore(STORES.CATALOG_CATEGORIES, { keyPath: 'id' });
        categoryStore.createIndex('sort_order', 'sort_order', { unique: false });
      }

      // Modifiers Store
      if (!db.objectStoreNames.contains(STORES.MODIFIERS)) {
        const modifierStore = db.createObjectStore(STORES.MODIFIERS, { keyPath: 'id' });
        modifierStore.createIndex('catalog_item_id', 'catalog_item_id', { unique: false });
      }

      // Customers Store
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customerStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        customerStore.createIndex('email', 'email', { unique: true });
        customerStore.createIndex('phone', 'phone', { unique: false });
        customerStore.createIndex('last_visit', 'last_visit', { unique: false });
      }

      // Orders Store (offline orders awaiting sync)
      if (!db.objectStoreNames.contains(STORES.ORDERS)) {
        const orderStore = db.createObjectStore(STORES.ORDERS, { keyPath: 'id' });
        orderStore.createIndex('status', 'status', { unique: false });
        orderStore.createIndex('created_at', 'created_at', { unique: false });
        orderStore.createIndex('synced', 'synced', { unique: false });
        orderStore.createIndex('table_id', 'table_id', { unique: false });
      }

      // Payments Store (offline payments awaiting sync)
      if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
        const paymentStore = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' });
        paymentStore.createIndex('order_id', 'order_id', { unique: false });
        paymentStore.createIndex('synced', 'synced', { unique: false });
      }

      // Sync Queue Store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('entityType', 'entityType', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Settings Store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // Cache Metadata Store
      if (!db.objectStoreNames.contains(STORES.CACHE_METADATA)) {
        db.createObjectStore(STORES.CACHE_METADATA, { keyPath: 'storeName' });
      }

      // Bookable Units Store
      if (!db.objectStoreNames.contains(STORES.BOOKABLE_UNITS)) {
        const unitStore = db.createObjectStore(STORES.BOOKABLE_UNITS, { keyPath: 'id' });
        unitStore.createIndex('status', 'status', { unique: false });
      }

      // Bookings Store
      if (!db.objectStoreNames.contains(STORES.BOOKINGS)) {
        const bookingStore = db.createObjectStore(STORES.BOOKINGS, { keyPath: 'id' });
        bookingStore.createIndex('date', 'date', { unique: false });
        bookingStore.createIndex('status', 'status', { unique: false });
        bookingStore.createIndex('synced', 'synced', { unique: false });
      }

      // Capacity Windows Store
      if (!db.objectStoreNames.contains(STORES.CAPACITY_WINDOWS)) {
        const windowStore = db.createObjectStore(STORES.CAPACITY_WINDOWS, { keyPath: 'id' });
        windowStore.createIndex('date', 'date', { unique: false });
      }

      // Tickets Store
      if (!db.objectStoreNames.contains(STORES.TICKETS)) {
        const ticketStore = db.createObjectStore(STORES.TICKETS, { keyPath: 'id' });
        ticketStore.createIndex('session_id', 'session_id', { unique: false });
        ticketStore.createIndex('qr_code', 'qr_code', { unique: true });
        ticketStore.createIndex('synced', 'synced', { unique: false });
      }

      // Housekeeping Tasks Store
      if (!db.objectStoreNames.contains(STORES.HOUSEKEEPING_TASKS)) {
        const hkStore = db.createObjectStore(STORES.HOUSEKEEPING_TASKS, { keyPath: 'id' });
        hkStore.createIndex('unit_id', 'unit_id', { unique: false });
        hkStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CONFLICTS)) {
        const conflictStore = db.createObjectStore(STORES.CONFLICTS, { keyPath: 'id' });
        conflictStore.createIndex('resolved', 'resolved', { unique: false });
        conflictStore.createIndex('entityType', 'entityType', { unique: false });
      }

      // Offline Activity Store
      if (!db.objectStoreNames.contains(STORES.OFFLINE_ACTIVITY)) {
        const activityStore = db.createObjectStore(STORES.OFFLINE_ACTIVITY, { keyPath: 'id' });
        activityStore.createIndex('timestamp', 'timestamp', { unique: false });
        activityStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

/**
 * Get database instance (singleton)
 */
let dbInstance: IDBDatabase | null = null;

export async function getDatabase(): Promise<IDBDatabase> {
  if (!dbInstance) {
    dbInstance = await initDatabase();
    
    // Layer 5: Platform Hardening - Request persistent storage
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const persisted = await navigator.storage.persist();
      console.log(`[Offline] Storage persisted: ${persisted}`);
    }
  }
  return dbInstance;
}

/**
 * Get estimated storage usage and quota
 */
export async function getStorageEstimate() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    return await navigator.storage.estimate();
  }
  return null;
}

/**
 * Generic store operations
 */
export class OfflineStore<T extends { id: string }> {
  private storeName: string;

  constructor(storeName: string) {
    this.storeName = storeName;
  }

  async getAll(): Promise<T[]> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<T | undefined> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(item: T): Promise<void> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putMany(items: T[]): Promise<void> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      items.forEach((item) => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async count(): Promise<number> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<K extends IDBValidKey>(indexName: string, value: K): Promise<T[]> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic key-value operations for flexible stores
  async get(id: string): Promise<T | undefined> {
    return this.getById(id);
  }

  // Cache-specific helpers
  async isStale(id: string, ttlMinutes: number): Promise<boolean> {
    const item = await this.getById(id);
    if (!item) return true;
    const lastSync = (item as unknown as { lastSyncAt?: string }).lastSyncAt;
    if (!lastSync) return true;
    const ageMs = Date.now() - new Date(lastSync).getTime();
    return ageMs > ttlMinutes * 60 * 1000;
  }

  async updateMetadata(id: string, metadata: Partial<T>): Promise<void> {
    const existing = await this.getById(id);
    const updated = { ...existing, ...metadata, id } as T;
    await this.put(updated);
  }

}

// Export store instances
export const catalogItemsStore = new OfflineStore<OfflineEntity>(STORES.CATALOG_ITEMS);
export const catalogCategoriesStore = new OfflineStore<OfflineEntity>(STORES.CATALOG_CATEGORIES);
export const modifiersStore = new OfflineStore<OfflineEntity>(STORES.MODIFIERS);
export const customersStore = new OfflineStore<OfflineEntity>(STORES.CUSTOMERS);
export const ordersStore = new OfflineStore<OfflineOrder>(STORES.ORDERS);
export const paymentsStore = new OfflineStore<OfflineEntity>(STORES.PAYMENTS);
export const bookableUnitsStore = new OfflineStore<OfflineEntity>(STORES.BOOKABLE_UNITS);
export const bookingsStore = new OfflineStore<OfflineEntity>(STORES.BOOKINGS);
export const capacityWindowsStore = new OfflineStore<OfflineEntity>(STORES.CAPACITY_WINDOWS);
export const ticketsStore = new OfflineStore<OfflineEntity>(STORES.TICKETS);
export const housekeepingTasksStore = new OfflineStore<OfflineEntity>(STORES.HOUSEKEEPING_TASKS);
export const conflictsStore = new OfflineStore<SyncConflict>(STORES.CONFLICTS);
export const offlineActivityStore = new OfflineStore<OfflineEntity>(STORES.OFFLINE_ACTIVITY);

// Generic key-value store for dynamic module data (moduleId:endpoint -> data)
export const moduleDataStore = new OfflineStore<{ id: string; moduleId: string; endpoint: string; data: unknown[]; hydratedAt: string }>('module_data');

// Generic cache metadata store with flexible metadata object
export const moduleCacheStore = new OfflineStore<{ id: string; lastSyncAt: string; [key: string]: unknown }>('module_cache');

/**
 * Sync Queue Management
 */
export class SyncQueue {
  private store = new OfflineStore<SyncQueueItem>(STORES.SYNC_QUEUE);

  async add(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<string> {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queueItem: SyncQueueItem = {
      ...item,
      id,
      createdAt: new Date(),
      attempts: 0,
      status: 'pending',
    };
    await this.store.put(queueItem);
    return id;
  }

  async getPending(): Promise<SyncQueueItem[]> {
    const all = await this.store.getAll();
    return all
      .filter((i) => i.status === 'pending' || i.status === 'failed')
      .sort((a, b) => 
        (a.priority ?? 2) - (b.priority ?? 2) || 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }

  async getFailed(): Promise<SyncQueueItem[]> {
    return this.store.getByIndex('status', 'failed');
  }

  async updateStatus(id: string, status: SyncStatus, error?: string): Promise<void> {
    const item = await this.store.getById(id);
    if (item) {
      item.status = status;
      item.attempts += 1;
      item.lastAttempt = new Date();
      if (error) item.error = error;
      await this.store.put(item);
    }
  }

  async remove(id: string): Promise<void> {
    await this.store.delete(id);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  async getStats(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    total: number;
  }> {
    const all = await this.store.getAll();
    return {
      pending: all.filter((i) => i.status === 'pending').length,
      syncing: all.filter((i) => i.status === 'syncing').length,
      failed: all.filter((i) => i.status === 'failed').length,
      total: all.length,
    };
  }

  async hasPending(entityType: string): Promise<boolean> {
    const all = await this.store.getAll();
    return all.some((i) => i.entityType === entityType && i.status === 'pending');
  }
}

export const syncQueue = new SyncQueue();

/**
 * Cache Metadata Management
 */
export class CacheManager {
  private store = new OfflineStore<CacheMetadata>(STORES.CACHE_METADATA);

  async updateMetadata(storeName: string, recordCount: number): Promise<void> {
    await this.store.put({
      id: storeName,
      storeName,
      lastSyncAt: new Date(),
      recordCount,
    });
  }

  async getMetadata(storeName: string): Promise<CacheMetadata | undefined> {
    return this.store.getById(storeName);
  }

  async getAllMetadata(): Promise<CacheMetadata[]> {
    return this.store.getAll();
  }

  async isStale(storeName: string, maxAgeMinutes: number): Promise<boolean> {
    const metadata = await this.getMetadata(storeName);
    if (!metadata) return true;

    const ageMs = Date.now() - new Date(metadata.lastSyncAt).getTime();
    return ageMs > maxAgeMinutes * 60 * 1000;
  }

  async isFresh(storeName: string, ttlMinutes: number): Promise<boolean> {
    const meta = await this.getMetadata(storeName);
    if (!meta?.lastSyncAt) return false;
    const ageMs = Date.now() - new Date(meta.lastSyncAt).getTime();
    return ageMs < ttlMinutes * 60 * 1000;
  }
}

export const cacheManager = new CacheManager();

/**
 * Network Status Detection
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}

/**
 * Generate offline-safe UUID
 */
export function generateOfflineId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
