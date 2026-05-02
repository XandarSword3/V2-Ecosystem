import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

const storeMock = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  putMany: vi.fn(async () => undefined),
}));

const cacheManagerMock = vi.hoisted(() => ({
  updateMetadata: vi.fn(async () => undefined),
}));

vi.mock('../../src/lib/offline/offline-storage', () => ({
  chaletsStore: storeMock,
  bookingsStore: storeMock,
  poolSessionsStore: storeMock,
  ticketsStore: storeMock,
  housekeepingTasksStore: storeMock,
  cacheManager: cacheManagerMock,
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

  it('hydrates all stores successfully', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/chalets') return Promise.resolve({ data: { chalets: [{ id: '1' }] } });
      if (url.includes('/chalets/staff/bookings')) return Promise.resolve({ data: { bookings: [{ id: '2' }] } });
      if (url.includes('/pool/sessions')) return Promise.resolve({ data: { sessions: [{ id: '3' }] } });
      if (url === '/pool/staff/tickets/today') return Promise.resolve({ data: { tickets: [{ id: '4' }] } });
      if (url === '/housekeeping/my-tasks') return Promise.resolve({ data: { tasks: [{ id: '5' }] } });
      return Promise.resolve({ data: {} });
    });

    await hydrateOfflineStores();

    // Verify each store was cleared and populated
    expect(storeMock.clear).toHaveBeenCalledTimes(5);
    expect(storeMock.putMany).toHaveBeenCalledTimes(5);
    expect(cacheManagerMock.updateMetadata).toHaveBeenCalledTimes(5);
    
    // Verify specific API calls
    expect(apiGetMock).toHaveBeenCalledWith('/chalets');
    expect(apiGetMock).toHaveBeenCalledWith('/pool/staff/tickets/today');
    expect(apiGetMock).toHaveBeenCalledWith('/housekeeping/my-tasks');
  });

  it('handles partial failures gracefully', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/chalets') return Promise.reject(new Error('API Error'));
      return Promise.resolve({ data: { tasks: [{ id: '5' }] } });
    });

    await hydrateOfflineStores();

    // Should still continue with other stores
    expect(storeMock.putMany).toHaveBeenCalled();
  });
});
