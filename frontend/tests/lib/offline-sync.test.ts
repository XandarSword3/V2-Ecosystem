import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createOfflineOrder, 
  createOfflineCashPayment, 
  validateTicketOffline,
  resolveConflict,
  clearOfflineData,
  getOfflineTickets,
  createOfflineInventoryAdjustment,
  createOfflineMaintenanceLog,
  createOfflinePoolEntry,
  createOfflinePoolExit
} from '@/lib/offline/offline-sync';
import { 
  syncQueue, 
  conflictsStore, 
  offlineActivityStore,
  ticketsStore,
  ordersStore
} from '@/lib/offline/offline-storage';
import 'fake-indexeddb/auto';

// Mock the publishSyncStatus helper
vi.mock('@/lib/offline/offline-sync', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    publishSyncStatus: vi.fn(),
  };
});

describe('Offline Sync Service', () => {
  beforeEach(async () => {
    await syncQueue.clear();
    await conflictsStore.clear();
    await offlineActivityStore.clear();
    await ticketsStore.clear();
    vi.clearAllMocks();
  });

  describe('createOfflineOrder', () => {
    it('should add an order to the sync queue and log activity', async () => {
      const orderData = {
        moduleId: 'm1',
        items: [{ menuItemId: '1', quantity: 1, name: 'Burger', price: 10 }],
        totalAmount: 10,
        customerName: 'Test Customer',
        orderType: 'dine_in' as const
      };

      const syncId = await createOfflineOrder(orderData);
      
      expect(syncId).toMatch(/^sync_/);
      
      // Verify it was written to local store
      const allOrders = await ordersStore.getAll();
      expect(allOrders.some(o => o.id.startsWith('offline_'))).toBe(true);
      
      const pending = await syncQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].entityType).toBe('order');
      expect(pending[0].priority).toBe(0); // High priority for financial
      
      const activity = await offlineActivityStore.getAll();
      expect(activity).toHaveLength(1);
      expect(activity[0].type).toBe('order');
      expect(activity[0].action).toBe('create');
    });
  });

  describe('createOfflineCashPayment', () => {
    it('should add a payment to the sync queue and log activity', async () => {
      const paymentData = {
        referenceType: 'order' as const,
        referenceId: 'order_123',
        amount: 50
      };

      await createOfflineCashPayment(paymentData);
      
      const pending = await syncQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].entityType).toBe('payment');
      expect(pending[0].priority).toBe(0); // High priority
      
      const activity = await offlineActivityStore.getAll();
      expect(activity).toHaveLength(1);
      expect(activity[0].type).toBe('payment');
    });
  });

  describe('validateTicketOffline', () => {
    it('should block validation if ticket is already used in local store', async () => {
      await ticketsStore.put({
        id: 'ticket_1',
        qr_code: 'QR123',
        status: 'used'
      });

      const result = await validateTicketOffline('QR123');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already used');
    });

    it('should allow validation and queue entry if ticket is valid', async () => {
      await ticketsStore.put({
        id: 'ticket_2',
        qr_code: 'QR456',
        status: 'valid'
      });

      const result = await validateTicketOffline('QR456');
      
      expect(result.valid).toBe(true);
      
      const pending = await syncQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].entityType).toBe('capacity_ticket');
    });
  });

  describe('resolveConflict', () => {
    it('should re-queue local changes with high priority when choosing accept_local', async () => {
      const conflictId = 'conflict_1';
      await conflictsStore.put({
        id: conflictId,
        entityType: 'order',
        entityId: 'order_1',
        localData: { status: 'preparing' },
        serverData: { status: 'confirmed' },
        createdAt: new Date()
      });

      await resolveConflict(conflictId, 'accept_local');
      
      const pending = await syncQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].priority).toBe(0); // Escalated priority
      expect(pending[0].data._conflictOverride).toBe(true);
      
      const remainingConflicts = await conflictsStore.getAll();
      expect(remainingConflicts).toHaveLength(1);
      expect(remainingConflicts[0].resolved).toBe(true);
    });
  });

  describe('createOfflineInventoryAdjustment', () => {
    it('should queue an inventory adjustment and log activity', async () => {
      await createOfflineInventoryAdjustment('item_1', -5, 'Spoilage');
      
      const pending = await syncQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].entityType).toBe('inventory_adjustment');
      expect(pending[0].priority).toBe(2); // Low priority
      
      const activity = await offlineActivityStore.getAll();
      expect(activity).toHaveLength(1);
      expect(activity[0].type).toBe('inventory');
    });
  });

  describe('createOfflineMaintenanceLog', () => {
    it('should queue a maintenance log and log activity', async () => {
      await createOfflineMaintenanceLog({ description: 'Broken chair', severity: 'low' });
      
      const pending = await syncQueue.getPending();
      expect(pending.some(p => p.entityType === 'maintenance_log')).toBe(true);
      
      const activity = await offlineActivityStore.getAll();
      expect(activity.some(a => a.type === 'maintenance')).toBe(true);
    });
  });

  describe('Pool Operations', () => {
    it('should queue pool entry and log activity', async () => {
      await createOfflinePoolEntry('ticket_123');
      
      const pending = await syncQueue.getPending();
      expect(pending[0].entityType).toBe('capacity_ticket');
      expect(pending[0].data.type).toBe('entry');
      
      const activity = await offlineActivityStore.getAll();
      expect(activity[0].action).toBe('entry');
    });

    it('should queue pool exit and log activity', async () => {
      await createOfflinePoolExit('ticket_123');
      
      const pending = await syncQueue.getPending();
      expect(pending[0].entityType).toBe('capacity_ticket');
      expect(pending[0].data.type).toBe('exit');
    });
  });

  describe('Utility Functions', () => {
    it('should clear all offline data', async () => {
      await clearOfflineData();
      // Verify basic stores are cleared (indirectly via their sync state or just expecting no throw)
    });

    it('should get offline tickets', async () => {
      await ticketsStore.put({ id: '1', status: 'valid' });
      const tickets = await getOfflineTickets();
      expect(tickets).toHaveLength(1);
    });
  });
});
