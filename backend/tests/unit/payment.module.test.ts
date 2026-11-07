import type { Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../src/database/connection';
import { createChainableMock, mockRequest, mockResponse, mockNext } from './utils';

// Mock dependencies
vi.mock('../../src/database/connection');
vi.mock('../../src/config', () => ({
  config: {
    env: 'test',
    stripe: { secretKey: 'sk_test_123', webhookSecret: 'whsec_123' },
  },
}));
vi.mock('../../src/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Import after mocks
import {
  getPaymentMethods,
  getTransactions,
  getTransaction,
  refundPayment,
} from '../../src/modules/payments/payment.controller';

describe('Payment Controller', () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof mockResponse>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  describe('getPaymentMethods', () => {
    it('should return available payment methods', async () => {
      await getPaymentMethods(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'cash', name: 'Cash' }),
          expect.objectContaining({ id: 'card', name: 'Credit/Debit Card' }),
          expect.objectContaining({ id: 'whish', name: 'Whish Money Transfer' }),
          expect.objectContaining({ id: 'omt', name: 'OMT Money Transfer' }),
        ]),
      });
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: 'tx-1', amount: '100.00', status: 'completed' },
        { id: 'tx-2', amount: '50.00', status: 'completed' },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockTransactions)),
      } as any);

      req.query = { limit: '50', offset: '0' };

      await getTransactions(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTransactions,
      });
    });

    it('should return empty array when no transactions', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null)),
      } as any);

      req.query = {};

      await getTransactions(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });
  });

  describe('getTransaction', () => {
    it('should return a single transaction by ID', async () => {
      const mockTransaction = {
        id: 'tx-123',
        amount: '75.00',
        status: 'completed',
        method: 'card',
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockTransaction)),
      } as any);

      req.params = { id: 'tx-123' };

      await getTransaction(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTransaction,
      });
    });

    it('should return 404 when transaction not found', async () => {
      // .maybeSingle() (used since the tenant-scoping fix) returns null data
      // with NO error when nothing matches -- unlike .single()'s PGRST116
      // error, which this test previously simulated.
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, null)
        ),
      } as any);

      req.params = { id: 'nonexistent' };

      await getTransaction(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Transaction not found',
      });
    });
  });

  describe('refundPayment', () => {
    it('should refund a cash payment successfully', async () => {
      const mockPayment = {
        id: 'payment-123',
        amount: '50.00',
        method: 'cash',
        status: 'completed',
        reference_type: 'instant_transaction',
        reference_id: 'order-123',
        notes: 'Original payment',
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockPayment)),
      } as any);

      req.params = { id: 'payment-123' };
      req.body = { reason: 'Customer request' };
      req.user = { userId: 'staff-123', role: 'staff', tenantId: 'tenant-1', scope: 'tenant_admin' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment refunded successfully',
      });
    });

    it('should return 404 when payment not found for refund', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116' })
        ),
      } as any);

      req.params = { id: 'nonexistent' };
      req.body = {};
      req.user = { userId: 'staff-123', role: 'staff', tenantId: 'tenant-1', scope: 'tenant_admin' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Payment record not found',
      });
    });

    it('should return error when payment already refunded', async () => {
      const mockPayment = {
        id: 'payment-123',
        status: 'refunded',
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockPayment)),
      } as any);

      req.params = { id: 'payment-123' };
      req.body = {};
      req.user = { userId: 'staff-123', role: 'staff', tenantId: 'tenant-1', scope: 'tenant_admin' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Payment is already refunded',
      });
    });

    it('should find and refund payment using order reference_id when id does not match payment id directly', async () => {
      const mockPayment = {
        id: 'real-payment-id-999',
        amount: '35.00',
        method: 'cash',
        status: 'completed',
        reference_type: 'instant_transaction',
        reference_id: 'order-xyz',
        notes: 'Original note',
      };

      let lookupCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'payments') {
            lookupCount++;
            if (lookupCount === 1) {
              // Direct ID lookup fails
              return createChainableMock(null);
            }
            // Fallback reference_id lookup finds payment
            return createChainableMock(mockPayment);
          }
          return createChainableMock([]);
        }),
      } as any);

      req.params = { id: 'order-xyz' };
      req.body = { reason: 'Incorrect order' };
      req.user = { userId: 'staff-123', role: 'staff', tenantId: 'tenant-1', scope: 'tenant_admin' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment refunded successfully',
      });
    });

    it('should cancel transaction, cancel fulfillment, and restore inventory when full refund is processed for an order', async () => {
      const mockPayment = {
        id: 'payment-full-order',
        amount: '60.00',
        method: 'cash',
        status: 'completed',
        reference_type: 'order',
        reference_id: 'order-full-refund',
        notes: 'Original note',
      };

      const mockOrder = {
        id: 'order-full-refund',
        status: 'confirmed',
        amount: 60.0,
        customer_id: 'cust-1',
        metadata: { discounts: [] },
      };

      const mockFulfillment = {
        id: 'fulf-1',
        status: 'queued',
      };

      const mockOrderItems = [
        { catalog_item_id: 'cat-item-1', quantity: 2 },
      ];

      const rpcCalls: { rpcName: string; params: any }[] = [];
      const updateCalls: { table: string; payload: any }[] = [];
      const insertCalls: { table: string; payload: any }[] = [];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'payments') {
            return {
              ...createChainableMock(mockPayment),
              update: vi.fn((payload) => {
                updateCalls.push({ table: 'payments', payload });
                return createChainableMock([mockPayment]);
              }),
            };
          }
          if (table === 'transactions') {
            return {
              ...createChainableMock(mockOrder),
              update: vi.fn((payload) => {
                updateCalls.push({ table: 'transactions', payload });
                return createChainableMock([mockOrder]);
              }),
            };
          }
          if (table === 'fulfillments') {
            return {
              ...createChainableMock(mockFulfillment),
              update: vi.fn((payload) => {
                updateCalls.push({ table: 'fulfillments', payload });
                return createChainableMock([mockFulfillment]);
              }),
            };
          }
          if (table === 'fulfillment_events') {
            return {
              insert: vi.fn((payload) => {
                insertCalls.push({ table: 'fulfillment_events', payload });
                return createChainableMock([payload]);
              }),
            };
          }
          if (table === 'order_items') {
            return createChainableMock(mockOrderItems);
          }
          return createChainableMock([]);
        }),
        rpc: vi.fn((rpcName, params) => {
          rpcCalls.push({ rpcName, params });
          return Promise.resolve({ data: { success: true }, error: null });
        }),
      } as any);

      req.params = { id: 'payment-full-order' };
      req.body = { reason: 'Defective item returned' };
      req.user = { userId: 'staff-123', role: 'admin', tenantId: 'tenant-1', scope: 'tenant_admin' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment refunded successfully',
      });

      // Verify transaction cancelled
      const statusUpdate = updateCalls.find((u) => u.table === 'transactions' && u.payload.status === 'cancelled');
      expect(statusUpdate).toBeDefined();
      expect(statusUpdate?.payload.status).toBe('cancelled');

      // Verify fulfillment cancelled
      const fulfUpdate = updateCalls.find((u) => u.table === 'fulfillments');
      expect(fulfUpdate).toBeDefined();
      expect(fulfUpdate?.payload.status).toBe('cancelled');

      // Verify fulfillment event inserted
      const fulfEvent = insertCalls.find((i) => i.table === 'fulfillment_events');
      expect(fulfEvent).toBeDefined();
      expect(fulfEvent?.payload.event_type).toBe('cancelled');

      // Verify inventory restoration RPC called
      const invRpc = rpcCalls.find((r) => r.rpcName === 'restore_inventory_for_order_items');
      expect(invRpc).toBeDefined();
      expect(invRpc?.params.p_items).toEqual([{ catalog_item_id: 'cat-item-1', quantity: 2 }]);
    });
  });
});
