import { describe, expect, it, vi, beforeEach } from 'vitest';

const syncQueueMock = vi.hoisted(() => ({
  add: vi.fn(async () => 'sync-123'),
  getPending: vi.fn(async () => []),
  remove: vi.fn(async () => undefined),
  updateStatus: vi.fn(async () => undefined),
  getStats: vi.fn(async () => ({ pending: 0, failed: 0 })),
}));

const ordersStoreMock = vi.hoisted(() => ({
  getById: vi.fn(async () => null),
  delete: vi.fn(async () => undefined),
  put: vi.fn(async () => undefined),
  getAll: vi.fn(async () => []),
}));

const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/offline/offline-storage', () => ({
  syncQueue: syncQueueMock,
  ordersStore: ordersStoreMock,
  menuItemsStore: { getAll: vi.fn(async () => []) },
  menuCategoriesStore: { getAll: vi.fn(async () => []) },
  modifiersStore: { getAll: vi.fn(async () => []) },
  customersStore: { getAll: vi.fn(async () => []) },
  paymentsStore: { getAll: vi.fn(async () => []) },
  ticketsStore: { getAll: vi.fn(async () => []) },
  chaletsStore: { getAll: vi.fn(async () => []) },
  bookingsStore: { getAll: vi.fn(async () => []) },
  housekeepingTasksStore: { getAll: vi.fn(async () => []) },
  conflictsStore: { put: vi.fn(async () => undefined), getAll: vi.fn(async () => []) },
  cacheManager: { isStale: vi.fn(async () => true), updateMetadata: vi.fn(), getAllMetadata: vi.fn(async () => []) },
  isOnline: vi.fn(() => true),
}));

vi.mock('@/lib/api', () => ({
  default: {
    post: apiPostMock,
    put: apiPutMock,
    patch: apiPatchMock,
    get: vi.fn(),
  },
}));

import { 
  createOfflineBookingStatusUpdate,
  createOfflineTaskStatusUpdate,
  createOfflinePoolEntry,
  createOfflinePoolExit,
  createOfflineTicketValidation,
  createOfflineOrderStatusUpdate,
  createOfflineChaletStatusUpdate,
  createOfflineTableStatusUpdate,
  syncAll
} from '../../src/lib/offline/offline-sync';

describe('offline sync manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('covers all new action creators for Phase 2', async () => {
    // 1. Booking Status Update
    await createOfflineBookingStatusUpdate('b-1', 'confirmed');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'booking',
      entityId: 'b-1',
      operation: 'update',
      data: { status: 'confirmed' }
    }));

    // 2. Housekeeping Task Update
    await createOfflineTaskStatusUpdate('h-1', 'completed');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'housekeeping_task',
      entityId: 'h-1',
      operation: 'update',
      data: { status: 'completed' }
    }));

    // 3. Pool Entry
    await createOfflinePoolEntry('t-1');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'pool_ticket',
      entityId: 't-1',
      operation: 'update',
      data: expect.objectContaining({ type: 'entry' })
    }));

    // 4. Pool Exit
    await createOfflinePoolExit('t-1');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'pool_ticket',
      entityId: 't-1',
      operation: 'update',
      data: expect.objectContaining({ type: 'exit' })
    }));

    // 5. Ticket Validation
    await createOfflineTicketValidation('VAL-123');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'pool_ticket',
      entityId: 'VAL-123',
      operation: 'update',
      data: expect.objectContaining({ type: 'validate', ticketNumber: 'VAL-123' })
    }));

    // 6. Restaurant Order Status Update
    await createOfflineOrderStatusUpdate('o-1', 'preparing');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'restaurant_order_status',
      entityId: 'o-1',
      operation: 'update',
      data: { status: 'preparing' }
    }));

    // 7. Chalet Status Update
    await createOfflineChaletStatusUpdate('c-1', 'clean');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'chalet_status',
      entityId: 'c-1',
      operation: 'update',
      data: { status: 'clean' }
    }));

    // 8. Restaurant Table Status Update
    await createOfflineTableStatusUpdate('tab-1', 'AVAILABLE');
    expect(syncQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'restaurant_table_status',
      entityId: 'tab-1',
      operation: 'update',
      data: { status: 'AVAILABLE' }
    }));
  });

  it('resolves complex Phase 2 state transitions during sync', async () => {
    syncQueueMock.getPending.mockResolvedValue([
      { id: '1', entityType: 'housekeeping_task', entityId: 'h-1', operation: 'update', data: { status: 'completed' }, attempts: 0 },
      { id: '2', entityType: 'pool_ticket', entityId: 'p-1', operation: 'update', data: { type: 'exit' }, attempts: 0 }
    ]);

    apiPostMock.mockResolvedValue({ status: 200, data: {} });

    await syncAll();

    // Verify correct endpoints for transitions
    expect(apiPostMock).toHaveBeenCalledWith('/housekeeping/tasks/h-1/complete', {});
    expect(apiPostMock).toHaveBeenCalledWith('/pool/tickets/p-1/exit');
  });

  it('handles 409 conflicts by letting server win and removing from queue', async () => {
    syncQueueMock.getPending.mockResolvedValue([
      { id: 'conf-1', entityType: 'booking', entityId: 'b-1', operation: 'update', data: { status: 'checked_in' }, attempts: 0 }
    ]);

    // Mock a 409 conflict error from axios/api
    const conflictError = {
      response: {
        status: 409,
        data: { message: 'Already updated on server' }
      }
    };
    apiPatchMock.mockRejectedValue(conflictError);

    await syncAll();

    // Should still remove from queue after handling conflict
    expect(apiPatchMock).toHaveBeenCalled();
    expect(syncQueueMock.remove).toHaveBeenCalledWith('conf-1');
  });

  it('retries failed items until max retries reached', async () => {
    syncQueueMock.getPending.mockResolvedValue([
      { id: 'fail-1', entityType: 'order', entityId: 'o-1', operation: 'create', data: {}, attempts: 1 }
    ]);
    apiPostMock.mockRejectedValue(new Error('Network Error'));

    await syncAll();

    // Should update status to pending (retry)
    expect(syncQueueMock.updateStatus).toHaveBeenCalledWith('fail-1', 'pending', 'Network Error');
  });
});
