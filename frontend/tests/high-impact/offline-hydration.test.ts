import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

const chaletsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
}));
const bookingsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
}));
const poolSessionsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
}));
const ticketsStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
}));
const housekeepingTasksStoreMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
}));

const cacheManagerMock = vi.hoisted(() => ({
  updateMetadata: vi.fn(async () => undefined),
}));

vi.mock('../../src/lib/offline/offline-storage', () => ({
  chaletsStore: chaletsStoreMock,
  bookingsStore: bookingsStoreMock,
  poolSessionsStore: poolSessionsStoreMock,
  ticketsStore: ticketsStoreMock,
  housekeepingTasksStore: housekeepingTasksStoreMock,
  cacheManager: cacheManagerMock,
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
});
