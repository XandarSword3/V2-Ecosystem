import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

async function loadModule() {
  vi.resetModules();
  return import('../../src/lib/offline/offline-storage');
}

describe('offline storage', () => {
  it('initializes database stores and reuses singleton instance', async () => {
    const mod = await loadModule();

    const db1 = await mod.initDatabase();
    expect(db1.objectStoreNames.contains('catalog_items')).toBe(true);
    expect(db1.objectStoreNames.contains('sync_queue')).toBe(true);
    expect(db1.objectStoreNames.contains('cache_metadata')).toBe(true);

    const db2 = await mod.getDatabase();
    const db3 = await mod.getDatabase();
    expect(db2).toBe(db3);
  });

  it('supports offline store CRUD, indexes, and counts', async () => {
    const mod = await loadModule();
    await mod.getDatabase();
    await mod.catalogItemsStore.clear();

    await mod.catalogItemsStore.putMany([
      { id: 'item-1', name: 'Espresso', category_id: 'c-1', is_available: true, updated_at: 'now' },
      { id: 'item-2', name: 'Tea', category_id: 'c-1', is_available: false, updated_at: 'now' },
      { id: 'item-3', name: 'Cake', category_id: 'c-2', is_available: true, updated_at: 'now' },
    ]);

    const byId = await mod.catalogItemsStore.getById('item-1');
    expect(byId?.id).toBe('item-1');

    const byCategory = await mod.catalogItemsStore.getByIndex('category_id', 'c-1');
    expect(byCategory).toHaveLength(2);

    expect(await mod.catalogItemsStore.count()).toBe(3);

    await mod.catalogItemsStore.delete('item-2');
    expect(await mod.catalogItemsStore.count()).toBe(2);

    await mod.catalogItemsStore.clear();
    expect(await mod.catalogItemsStore.count()).toBe(0);
  });

  it('manages sync queue lifecycle and aggregates stats', async () => {
    const mod = await loadModule();
    await mod.getDatabase();
    await mod.syncQueue.clear();

    const queue = new mod.SyncQueue();
    const firstId = await queue.add({
      entityType: 'order',
      entityId: 'order-1',
      operation: 'create',
      data: { total: 20 },
    });
    const secondId = await queue.add({
      entityType: 'order',
      entityId: 'order-2',
      operation: 'update',
      data: { total: 30 },
    });

    expect(firstId).toContain('sync_');
    expect(secondId).toContain('sync_');

    const pending = await queue.getPending();
    expect(pending.length).toBeGreaterThanOrEqual(2);

    await queue.updateStatus(firstId, 'failed', 'timeout');
    const failed = await queue.getFailed();
    expect(failed.some((item) => item.id === firstId && item.error === 'timeout')).toBe(true);

    const stats = await queue.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.failed).toBeGreaterThanOrEqual(1);

    await queue.remove(firstId);
    await queue.clear();

    const clearedStats = await queue.getStats();
    expect(clearedStats.total).toBe(0);
  });

  it('updates cache metadata and stale checks', async () => {
    const mod = await loadModule();
    await mod.getDatabase();
    await mod.catalogItemsStore.clear();

    await mod.cacheManager.updateMetadata('catalog_items', 12);
    const metadata = await mod.cacheManager.getMetadata('catalog_items');
    expect(metadata?.recordCount).toBe(12);

    const all = await mod.cacheManager.getAllMetadata();
    expect(all.length).toBeGreaterThanOrEqual(1);

    const fresh = await mod.cacheManager.isStale('catalog_items', 60);
    expect(fresh).toBe(false);

    const stale = await mod.cacheManager.isStale('catalog_items', -1);
    expect(stale).toBe(true);

    const missing = await mod.cacheManager.isStale('missing_store', 60);
    expect(missing).toBe(true);
  });

  it('handles network helpers and offline id generation', async () => {
    const mod = await loadModule();

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    expect(mod.isOnline()).toBe(true);

    const onlineCb = vi.fn();
    const offlineCb = vi.fn();

    const cleanupOnline = mod.onOnline(onlineCb);
    const cleanupOffline = mod.onOffline(offlineCb);

    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('offline'));

    expect(onlineCb).toHaveBeenCalledTimes(1);
    expect(offlineCb).toHaveBeenCalledTimes(1);

    cleanupOnline();
    cleanupOffline();

    const offlineId = mod.generateOfflineId();
    expect(offlineId.startsWith('offline_')).toBe(true);
  });
});
