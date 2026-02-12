/**
 * Offline POS Service
 * 
 * Provides offline-first capabilities for restaurant POS operations:
 * - IndexedDB storage for offline data
 * - Sync queue management
 * - Conflict resolution
 * - Automatic sync when back online
 */

// IndexedDB Database Schema
const DB_NAME = 'v2-offline-pos';
const DB_VERSION = 1;

// Store names
const STORES = {
  MENU_ITEMS: 'menu_items',
  MENU_CATEGORIES: 'menu_categories',
  MODIFIERS: 'modifiers',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  SYNC_QUEUE: 'sync_queue',
  SETTINGS: 'settings',
  CACHE_METADATA: 'cache_metadata',
};

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
    menuItemId: string;
    quantity: number;
    notes?: string;
    modifiers?: string[];
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

      // Menu Items Store
      if (!db.objectStoreNames.contains(STORES.MENU_ITEMS)) {
        const menuStore = db.createObjectStore(STORES.MENU_ITEMS, { keyPath: 'id' });
        menuStore.createIndex('category_id', 'category_id', { unique: false });
        menuStore.createIndex('is_available', 'is_available', { unique: false });
        menuStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // Menu Categories Store
      if (!db.objectStoreNames.contains(STORES.MENU_CATEGORIES)) {
        const categoryStore = db.createObjectStore(STORES.MENU_CATEGORIES, { keyPath: 'id' });
        categoryStore.createIndex('sort_order', 'sort_order', { unique: false });
      }

      // Modifiers Store
      if (!db.objectStoreNames.contains(STORES.MODIFIERS)) {
        const modifierStore = db.createObjectStore(STORES.MODIFIERS, { keyPath: 'id' });
        modifierStore.createIndex('menu_item_id', 'menu_item_id', { unique: false });
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
  }
  return dbInstance;
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
}

// Export store instances
export const menuItemsStore = new OfflineStore<OfflineEntity>(STORES.MENU_ITEMS);
export const menuCategoriesStore = new OfflineStore<OfflineEntity>(STORES.MENU_CATEGORIES);
export const modifiersStore = new OfflineStore<OfflineEntity>(STORES.MODIFIERS);
export const customersStore = new OfflineStore<OfflineEntity>(STORES.CUSTOMERS);
export const ordersStore = new OfflineStore<OfflineOrder>(STORES.ORDERS);
export const paymentsStore = new OfflineStore<OfflineEntity>(STORES.PAYMENTS);

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
    return this.store.getByIndex('status', 'pending');
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
