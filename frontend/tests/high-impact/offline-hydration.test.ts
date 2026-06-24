import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

const moduleDataStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  put: vi.fn(async () => undefined),
  get: vi.fn(async () => null),
}));

const moduleCacheStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  updateMetadata: vi.fn(async () => undefined),
  getMetadata: vi.fn(async () => undefined),
  isStale: vi.fn(async () => true),
}));

const customersStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  put: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
  getAll: vi.fn(async () => []),
  delete: vi.fn(async () => undefined),
}));

vi.mock('../../src/lib/offline/offline-storage', () => ({
  moduleDataStore: moduleDataStoreMock,
  moduleCacheStore: moduleCacheStoreMock,
  customersStore: customersStoreMock,
}));

vi.mock('@/lib/api', () => ({
  default: {
    get: apiGetMock,
  },
}));

import { hydrateOfflineStores, clearAllOfflineData } from '../../src/lib/offline/offline-hydration';

describe('offline hydration service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    moduleCacheStoreMock.isStale.mockResolvedValue(true);
    apiGetMock.mockResolvedValue({ data: {} });
    await clearAllOfflineData(); // reset activeModules array
  });

  it('fetches active modules and hydrates them based on template_type', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.includes('/admin/modules')) {
        return Promise.resolve({
          data: {
            modules: [
              { id: 'm1', slug: 'menu_service', name: 'MenuService', template_type: 'menu_service', is_active: true },
              { id: 'm2', slug: 'cabanas', name: 'Cabanas', template_type: 'multi_day_booking', is_active: true }
            ]
          }
        });
      }
      if (url === '/v1/menu_service/items') return Promise.resolve({ data: [{ id: 'item1' }] });
      if (url === '/v1/menu_service/modifiers') return Promise.resolve({ data: [{ id: 'mod1' }] });
      if (url === '/v1/cabanas/bookable_units') return Promise.resolve({ data: [{ id: 'unit1' }] });
      if (url === '/v1/cabanas/bookings') return Promise.resolve({ data: [{ id: 'booking1' }] });
      if (url.includes('/users')) return Promise.resolve({ data: { users: [] } });
      return Promise.resolve({ data: {} });
    });

    await hydrateOfflineStores();

    // Verify it saved data to moduleDataStore
    expect(moduleDataStoreMock.put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'm1:items',
      moduleId: 'm1',
      endpoint: 'items',
      data: [{ id: 'item1' }]
    }));
    expect(moduleDataStoreMock.put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'm2:bookings',
      moduleId: 'm2',
      endpoint: 'bookings',
      data: [{ id: 'booking1' }]
    }));
  });

  it('skips hydration when cache is fresh', async () => {
    moduleCacheStoreMock.isStale.mockResolvedValue(false);
    
    apiGetMock.mockImplementation((url: string) => {
      if (url.includes('/admin/modules')) {
        return Promise.resolve({
          data: {
            modules: [{ id: 'm1', slug: 'test', template_type: 'menu_service', is_active: true }]
          }
        });
      }
      return Promise.resolve({ data: {} });
    });

    await hydrateOfflineStores(); // Not forced
    
    // Modules fetched, but their individual endpoints should NOT be fetched
    expect(apiGetMock).not.toHaveBeenCalledWith('/v1/test/items');
    expect(moduleDataStoreMock.put).not.toHaveBeenCalled();
  });

  it('continues hydration even if one module fails', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.includes('/admin/modules')) {
        return Promise.resolve({
          data: {
            modules: [
              { id: 'fail_mod', slug: 'fail', template_type: 'menu_service', is_active: true },
              { id: 'ok_mod', slug: 'ok', template_type: 'session_access', is_active: true }
            ]
          }
        });
      }
      if (url.includes('/v1/fail')) return Promise.reject(new Error('Network error'));
      if (url.includes('/v1/ok/sessions')) return Promise.resolve({ data: [{ id: 'sess1' }] });
      if (url.includes('/v1/ok/tickets')) return Promise.resolve({ data: [{ id: 'tick1' }] });
      return Promise.resolve({ data: {} });
    });

    await hydrateOfflineStores();

    // The ok_mod should still get hydrated
    expect(moduleDataStoreMock.put).toHaveBeenCalledWith(expect.objectContaining({
      moduleId: 'ok_mod',
      endpoint: 'sessions'
    }));
  });
});
