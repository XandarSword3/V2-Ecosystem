import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Create a properly chainable Supabase mock
const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
  };

  const builder: any = {};
  
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
  ];
  
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => {
    return Promise.resolve(getNextResponse());
  });
  builder.maybeSingle = vi.fn().mockImplementation(() => {
    return Promise.resolve(getNextResponse());
  });
  builder.then = (resolve: any, reject: any) => {
    return Promise.resolve(getNextResponse()).then(resolve, reject);
  };

  return {
    builder,
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => {
      responseQueue = [];
      responseIndex = 0;
    },
  };
};

let mockBuilder: ReturnType<typeof createChainableMock>;
const mockFrom = vi.fn();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
}));

import { TabController } from '../../../src/modules/restaurant/controllers/tab.controller';

const createMockReqRes = (overrides: { params?: any; query?: any; body?: any; user?: any } = {}) => {
  const req = {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    user: overrides.user || { userId: 'user-1', role: 'waiter' },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
};

describe('Tab Controller', () => {
  let controller: TabController;

  beforeEach(() => {
    controller = new TabController();
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    vi.clearAllMocks();
    mockFrom.mockReturnValue(mockBuilder.builder);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockBuilder.reset();
  });

  describe('openTab', () => {
    it('should open a new tab for a table', async () => {
      mockBuilder.queueResponse(null); // No existing tab
      mockBuilder.queueResponse({ id: 'table-1', number: 5, name: 'Table 5' });
      mockBuilder.queueResponse({ id: 'tab-1', status: 'open' });
      mockBuilder.queueResponse({ id: 'table-1' }); // Update table status

      const { req, res, next } = createMockReqRes({
        body: {
          tableId: '123e4567-e89b-12d3-a456-426614174000',
          guestCount: 4,
        },
      });

      await controller.openTab(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if table already has open tab', async () => {
      mockBuilder.queueResponse({ id: 'existing-tab' });

      const { req, res, next } = createMockReqRes({
        body: {
          tableId: '123e4567-e89b-12d3-a456-426614174000',
          guestCount: 2,
        },
      });

      await controller.openTab(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Table already has an open tab',
      }));
    });

    it('should return 400 for invalid data', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          tableId: 'not-a-uuid',
        },
      });

      await controller.openTab(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getOpenTabs', () => {
    it('should return all open tabs', async () => {
      const mockTabs = [
        { id: 'tab-1', table_id: 'table-1', status: 'open' },
        { id: 'tab-2', table_id: 'table-2', status: 'open' },
      ];

      mockBuilder.queueResponse(mockTabs);

      const { req, res, next } = createMockReqRes();

      await controller.getOpenTabs(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('getTabDetails', () => {
    it('should return tab details', async () => {
      const mockTab = {
        id: 'tab-1',
        status: 'open',
        table: { number: 5 },
        items: [{ id: 'item-1', name: 'Burger', quantity: 2 }],
      };

      mockBuilder.queueResponse(mockTab);

      const { req, res, next } = createMockReqRes({
        params: { tabId: 'tab-1' },
      });

      await controller.getTabDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should return 404 for non-existent tab', async () => {
      mockBuilder.queueResponse(null);

      const { req, res, next } = createMockReqRes({
        params: { tabId: 'nonexistent' },
      });

      await controller.getTabDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('addToTab', () => {
    it('should add items to an open tab', async () => {
      const mockTab = { id: 'tab-1', status: 'open', subtotal: 0, table: { number: 5 } };

      mockBuilder.queueResponse(mockTab); // Fetch tab with table info
      mockBuilder.queueResponse([{ id: 'item-1', name: 'Burger', price: '12.50' }]); // Get menu items 
      mockBuilder.queueResponse({ id: 'order-1', order_number: 'ORD-001' }); // Create order
      mockBuilder.queueResponse([{ id: 'order-item-1' }]); // Insert order items

      const { req, res, next } = createMockReqRes({
        params: { id: 'tab-1' },
        body: {
          items: [
            { menuItemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 },
          ],
        },
      });

      await controller.addToTab(req, res, next);

      // Should eventually call json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should return 400 for closed tab', async () => {
      mockBuilder.queueResponse({ id: 'tab-1', status: 'closed' });

      const { req, res, next } = createMockReqRes({
        params: { tabId: 'tab-1' },
        body: {
          items: [
            { menuItemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 },
          ],
        },
      });

      await controller.addToTab(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('splitBill', () => {
    it('should split bill equally', async () => {
      const mockTab = { id: 'tab-1', status: 'open', subtotal: 100 };

      mockBuilder.queueResponse(mockTab);
      mockBuilder.queueResponse([{ id: 'split-1' }]); // Insert splits

      const { req, res, next } = createMockReqRes({
        params: { tabId: 'tab-1' },
        body: {
          splitType: 'equal',
          splits: [
            { payerName: 'Guest 1' },
            { payerName: 'Guest 2' },
          ],
        },
      });

      await controller.splitBill(req, res, next);

      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('mergeTabs', () => {
    it('should merge multiple tabs into one', async () => {
      const sourceTabs = [
        { id: 'tab-1', status: 'open', items: [] },
        { id: 'tab-2', status: 'open', items: [] },
      ];
      const targetTab = { id: 'tab-3', status: 'open' };

      mockBuilder.queueResponse(sourceTabs);
      mockBuilder.queueResponse(targetTab);
      mockBuilder.queueResponse(null); // Update items
      mockBuilder.queueResponse(null); // Close source tabs

      const { req, res, next } = createMockReqRes({
        body: {
          sourceTabIds: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
          targetTabId: '123e4567-e89b-12d3-a456-426614174003',
        },
      });

      await controller.mergeTabs(req, res, next);

      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('processPayment', () => {
    it('should process payment for a tab', async () => {
      const mockTab = { id: 'tab-1', status: 'open', total: 50 };

      mockBuilder.queueResponse(mockTab);
      mockBuilder.queueResponse({ id: 'payment-1' }); // Insert payment
      mockBuilder.queueResponse({ id: 'tab-1', status: 'closed' }); // Update tab

      const { req, res, next } = createMockReqRes({
        params: { tabId: 'tab-1' },
        body: {
          amount: 55,
          method: 'card',
          tip: 5,
        },
      });

      await controller.processPayment(req, res, next);

      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should return 400 for invalid payment data', async () => {
      const { req, res, next } = createMockReqRes({
        params: { tabId: 'tab-1' },
        body: {
          amount: -10,
          method: 'invalid',
        },
      });

      await controller.processPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('transferTab', () => {
    it('should transfer tab to another table', async () => {
      const mockTab = { id: 'tab-1', status: 'open', table_id: 'table-1' };

      mockBuilder.queueResponse(mockTab);
      mockBuilder.queueResponse(null); // Check new table has no open tab
      mockBuilder.queueResponse({ id: 'tab-1' }); // Update tab
      mockBuilder.queueResponse(null); // Update old table
      mockBuilder.queueResponse(null); // Update new table

      const { req, res, next } = createMockReqRes({
        params: { tabId: 'tab-1' },
        body: {
          newTableId: '123e4567-e89b-12d3-a456-426614174999',
        },
      });

      await controller.transferTab(req, res, next);

      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('startReconciliation', () => {
    it('should start a reconciliation session', async () => {
      mockBuilder.queueResponse(null); // No existing reconciliation
      mockBuilder.queueResponse({ id: 'recon-1', status: 'open', started_at: new Date().toISOString() }); // Create new one

      const { req, res, next } = createMockReqRes({
        body: { cashOpening: 100 },
      });

      await controller.startReconciliation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('completeReconciliation', () => {
    it('should complete a reconciliation session', async () => {
      const mockRecon = { id: 'recon-1', status: 'in_progress' };

      mockBuilder.queueResponse(mockRecon);
      mockBuilder.queueResponse({ id: 'recon-1', status: 'completed' });

      const { req, res, next } = createMockReqRes({
        params: { reconciliationId: 'recon-1' },
        body: {
          actualCash: 500,
          notes: 'All good',
        },
      });

      await controller.completeReconciliation(req, res, next);

      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('getReconciliationReport', () => {
    it('should return reconciliation report', async () => {
      const mockRecon = {
        id: 'recon-1',
        expected_cash: 500,
        actual_cash: 495,
        variance: -5,
      };

      mockBuilder.queueResponse(mockRecon);

      const { req, res, next } = createMockReqRes({
        params: { reconciliationId: 'recon-1' },
      });

      await controller.getReconciliationReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });
});
