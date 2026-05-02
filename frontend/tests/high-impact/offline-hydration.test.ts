import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

const chaletsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const bookingsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const poolSessionsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const ticketsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const housekeepingTasksStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const menuItemsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const menuCategoriesStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const modifiersStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));
const customersStoreMock = vi.hoisted(() => ({
  put: vi.fn(async () => undefined),
  count: vi.fn(async () => 0),
}));

const cacheManagerMock = vi.hoisted(() => ({
  updateMetadata: vi.fn(async () => undefined),
  getMetadata: vi.fn(async () => undefined),
  isStale: vi.fn(async () => true),
}));

vi.mock('../../src/lib/offline/offline-storage', () => ({
  chaletsStore: chaletsStoreMock,
  bookingsStore: bookingsStoreMock,
  poolSessionsStore: poolSessionsStoreMock,
  ticketsStore: ticketsStoreMock,
  housekeepingTasksStore: housekeepingTasksStoreMock,
  menuItemsStore: menuItemsStoreMock,
  menuCategoriesStore: menuCategoriesStoreMock,
  modifiersStore: modifiersStoreMock,
  customersStore: customersStoreMock,
  cacheManager: cacheManagerMock,
  syncQueue: {
    hasPending: vi.fn(() => false),
  },
  isOnline: vi.fn(() => true),
}));

vi.mock('@/lib/api', () => ({
  default: {
    get: apiGetMock,
  },
}));

import { hydrateOfflineStores } from '../../src/lib/offline/offline-hydration';

describe('offline hydration service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: {} });
  });

  it('hydrates all stores successfully and individually', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/chalets') return Promise.resolve({ data: { chalets: [{ id: 'c1' }] } });
      if (url.includes('/chalets/staff/bookings')) return Promise.resolve({ data: { bookings: [{ id: 'b1' }] } });
      if (url.includes('/pool/sessions')) return Promise.resolve({ data: { sessions: [{ id: 's1' }] } });
      if (url === '/pool/staff/tickets/today') return Promise.resolve({ data: { tickets: [{ id: 't1' }] } });
      if (url === '/housekeeping/my-tasks') return Promise.resolve({ data: { tasks: [{ id: 'h1' }] } });
      return Promise.resolve({ data: {} });
    });

    await hydrateOfflineStores();

    // Verify each store was cleared and populated individually
    expect(chaletsStoreMock.putMany).toHaveBeenCalledWith([{ id: 'c1' }]);
    expect(bookingsStoreMock.putMany).toHaveBeenCalledWith([{ id: 'b1' }]);
    expect(poolSessionsStoreMock.putMany).toHaveBeenCalledWith([{ id: 's1' }]);
    expect(ticketsStoreMock.putMany).toHaveBeenCalledWith([{ id: 't1' }]);
    expect(housekeepingTasksStoreMock.putMany).toHaveBeenCalledWith([{ id: 'h1' }]);

    expect(chaletsStoreMock.clear).toHaveBeenCalled();
    expect(bookingsStoreMock.clear).toHaveBeenCalled();
    expect(poolSessionsStoreMock.clear).toHaveBeenCalled();
    expect(ticketsStoreMock.clear).toHaveBeenCalled();
    expect(housekeepingTasksStoreMock.clear).toHaveBeenCalled();
  });

  it('handles partial failures gracefully by continuing with other stores', async () => {
    apiGetMock.mockImplementation((url: string) => {
      // Fail chalets, succeed others with correct data keys
      if (url === '/chalets') return Promise.reject(new Error('API Error'));
      if (url.includes('/chalets/staff/bookings')) return Promise.resolve({ data: { bookings: [1] } });
      if (url.includes('/pool/sessions')) return Promise.resolve({ data: { sessions: [1] } });
      if (url === '/pool/staff/tickets/today') return Promise.resolve({ data: { tickets: [1] } });
      if (url === '/housekeeping/my-tasks') return Promise.resolve({ data: { tasks: [1] } });
      return Promise.resolve({ data: {} });
    });

    await hydrateOfflineStores();

    // Chalets should NOT have been updated
    expect(chaletsStoreMock.putMany).not.toHaveBeenCalled();
    
    // BUT other 4 stores should have been updated EXACTLY once each
    expect(bookingsStoreMock.putMany).toHaveBeenCalledTimes(1);
    expect(poolSessionsStoreMock.putMany).toHaveBeenCalledTimes(1);
    expect(ticketsStoreMock.putMany).toHaveBeenCalledTimes(1);
    expect(housekeepingTasksStoreMock.putMany).toHaveBeenCalledTimes(1);
  });

  it('performs incremental sync when metadata exists', async () => {
    const lastSyncAt = new Date('2024-01-01').toISOString();
    cacheManagerMock.getMetadata = vi.fn().mockResolvedValue({ lastSyncAt });
    cacheManagerMock.isStale = vi.fn().mockResolvedValue(true);

    apiGetMock.mockResolvedValue({ 
      data: { 
        bookings: [{ id: 'b2' }],
        isIncremental: true 
      } 
    });

    await hydrateOfflineStores();

    // Verify 'since' parameter was sent
    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining('/bookings'), 
      expect.objectContaining({ params: expect.objectContaining({ since: lastSyncAt }) })
    );

    // Verify we didn't clear the store for incremental update
    expect(bookingsStoreMock.clear).not.toHaveBeenCalled();
    expect(bookingsStoreMock.putMany).toHaveBeenCalledWith([{ id: 'b2' }]);
  });

  it('skips hydration when data is not stale', async () => {
    cacheManagerMock.isStale = vi.fn().mockResolvedValue(false);
    
    await hydrateOfflineStores(false); // force = false

    expect(apiGetMock).not.toHaveBeenCalled();
    expect(chaletsStoreMock.putMany).not.toHaveBeenCalled();
  });
});
