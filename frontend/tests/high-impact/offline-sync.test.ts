import { beforeEach, describe, expect, it, vi } from 'vitest';

const onlineState = vi.hoisted(() => ({ value: true }));
const onlineListeners = vi.hoisted(() => new Set<() => void>());
const offlineListeners = vi.hoisted(() => new Set<() => void>());

const syncQueueMock = vi.hoisted(() => ({
  getStats: vi.fn(async () => ({ pending: 1, failed: 0, syncing: 0, total: 1 })),
  getPending: vi.fn(async () => []),
  getFailed: vi.fn(async () => []),
  updateStatus: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  add: vi.fn(async () => 'sync-1'),
  clear: vi.fn(async () => undefined),
}));

const cacheManagerMock = vi.hoisted(() => ({
  isStale: vi.fn(async () => true),
  updateMetadata: vi.fn(async () => undefined),
  getMetadata: vi.fn(async () => undefined),
}));

const menuItemsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  getAll: vi.fn(async () => []),
}));

const menuCategoriesStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  getAll: vi.fn(async () => []),
}));

const modifiersStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
}));

const customersStoreMock = vi.hoisted(() => ({
  put: vi.fn(async () => undefined),
  getAll: vi.fn(async () => []),
  count: vi.fn(async () => 0),
  clear: vi.fn(async () => undefined),
}));

const ordersStoreMock = vi.hoisted(() => ({
  put: vi.fn(async () => undefined),
  getAll: vi.fn(async () => []),
  getById: vi.fn(async () => undefined),
  delete: vi.fn(async () => undefined),
  clear: vi.fn(async () => undefined),
}));

const paymentsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
}));

const apiGetMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {} }));
const apiCallableMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/offline/offline-hydration', () => ({
  hydrateOfflineStores: vi.fn(async () => undefined),
}));

vi.mock('../../src/lib/offline/offline-storage', () => ({
  syncQueue: syncQueueMock,
  cacheManager: cacheManagerMock,
  menuItemsStore: menuItemsStoreMock,
  menuCategoriesStore: menuCategoriesStoreMock,
  modifiersStore: modifiersStoreMock,
  customersStore: customersStoreMock,
  ordersStore: ordersStoreMock,
  paymentsStore: paymentsStoreMock,
  isOnline: () => onlineState.value,
  onOnline: (callback: () => void) => {
    onlineListeners.add(callback);
    return () => onlineListeners.delete(callback);
  },
  onOffline: (callback: () => void) => {
    offlineListeners.add(callback);
    return () => offlineListeners.delete(callback);
  },
}));

vi.mock('@/lib/api', () => {
  const callable = Object.assign(apiCallableMock, { get: apiGetMock });
  return {
    default: callable,
  };
});

async function loadModule() {
  vi.resetModules();
  return import('../../src/lib/offline/offline-sync');
}

describe('offline sync manager', () => {
  beforeEach(() => {
    onlineState.value = true;

    onlineListeners.clear();
    offlineListeners.clear();

    syncQueueMock.getStats.mockResolvedValue({ pending: 1, failed: 0, syncing: 0, total: 1 });
    syncQueueMock.getPending.mockResolvedValue([]);
    syncQueueMock.getFailed.mockResolvedValue([]);

    cacheManagerMock.isStale.mockResolvedValue(true);

    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: {} });
    apiGetMock
      .mockResolvedValueOnce({ data: { items: [], categories: [] } })
      .mockResolvedValueOnce({ data: { modifiers: [] } })
      .mockResolvedValueOnce({ data: { users: [] } });

    apiCallableMock.mockReset();
    apiCallableMock.mockResolvedValue({ status: 200, data: { id: 'server-order-1' } });
  });

  it('initializes sync and publishes status updates', async () => {
    const sync = await loadModule();

    const statuses: Array<ReturnType<typeof sync.getSyncStatus>> = [];
    const unsubscribe = sync.subscribeToSyncStatus((status) => {
      statuses.push(status);
    });

    await sync.initOfflineSync();

    expect(statuses.length).toBeGreaterThan(0);
    expect(syncQueueMock.getStats).toHaveBeenCalled();
    expect(onlineListeners.size).toBeGreaterThan(0);
    expect(offlineListeners.size).toBeGreaterThan(0);

    unsubscribe();
  });

  it('refreshes caches and creates offline orders', async () => {
    const sync = await loadModule();

    apiGetMock
      .mockResolvedValueOnce({ data: { items: [{ id: 'm1' }], categories: [{ id: 'c1' }] } })
      .mockResolvedValueOnce({ data: { modifiers: [{ id: 'mod-1' }] } })
      .mockResolvedValueOnce({ data: { users: [{ id: 'u1' }] } });

    await sync.refreshAllCaches();

    expect(menuItemsStoreMock.putMany).toHaveBeenCalled();
    expect(menuCategoriesStoreMock.putMany).toHaveBeenCalled();
    expect(apiGetMock).toHaveBeenCalledWith('/restaurant/modifiers');

    const orderId = await sync.createOfflineOrder({
      tableId: 'table-1',
      items: [{ menuItemId: 'menu-1', quantity: 2 }],
      notes: 'No ice',
    });

    expect(orderId.startsWith('offline_')).toBe(true);
    expect(ordersStoreMock.put).toHaveBeenCalled();
    expect(syncQueueMock.add).toHaveBeenCalled();
  });

  it('syncs pending items, retries failures, and clears offline data', async () => {
    const sync = await loadModule();

    syncQueueMock.getPending.mockResolvedValue([
      {
        id: 'sync-ok',
        entityType: 'order',
        entityId: 'offline-order-1',
        operation: 'create',
        data: { value: 1 },
        attempts: 0,
      },
      {
        id: 'sync-fail',
        entityType: 'payment',
        entityId: 'payment-1',
        operation: 'create',
        data: { value: 2 },
        attempts: 3,
      },
    ] as unknown as never[]);

    apiCallableMock
      .mockResolvedValueOnce({ status: 200, data: { id: 'server-order-1' } })
      .mockRejectedValueOnce(new Error('network down'));

    const syncResult = await sync.syncAll();
    expect(syncResult.synced).toBe(1);
    expect(syncResult.failed).toBe(1);
    expect(syncQueueMock.remove).toHaveBeenCalledWith('sync-ok');

    syncQueueMock.getFailed.mockResolvedValue([
      {
        id: 'sync-failed-1',
        entityType: 'order',
        entityId: 'offline-order-2',
        operation: 'update',
        data: {},
        attempts: 4,
      },
    ] as never[]);

    const retryResult = await sync.retryFailedItems();
    expect(retryResult.retried).toBe(1);
    expect(syncQueueMock.updateStatus).toHaveBeenCalledWith('sync-failed-1', 'pending');

    customersStoreMock.getAll.mockResolvedValue([
      { email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith', phone: '111' },
      { email: 'bob@example.com', first_name: 'Bob', last_name: 'Lee', phone: '222' },
    ] as unknown as never[]);

    const matches = await sync.searchOfflineCustomers('alice');
    expect(matches).toHaveLength(1);

    await sync.clearOfflineData();
    expect(syncQueueMock.clear).toHaveBeenCalled();
    expect(menuItemsStoreMock.clear).toHaveBeenCalled();
    expect(ordersStoreMock.clear).toHaveBeenCalled();
  });
});
