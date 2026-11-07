import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { createStatefulDbHarness } from '../../helpers/stateful-db-harness';

const harness = createStatefulDbHarness();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/database/connection', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/security/tenant-scope.js', () => ({
  getCallerTenantId: (req: any) => req?.user?.tenantId || 'tenant-1',
  requireTenantScope: (req: any) => req?.user?.tenantId || 'tenant-1',
}));

vi.mock('../../../src/security/property-scope.js', () => ({
  getCallerPropertyId: (req: any) => req?.headers?.['x-property-id'] || 'prop-1',
  requireCallerPropertyId: (req: any) => req?.headers?.['x-property-id'] || 'prop-1',
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { InventoryAdvancedController } from '../../../src/modules/inventory/inventory-advanced.controller';

describe('Inventory Advanced Controller (Genuine Stateful Database Verification)', () => {
  let controller: InventoryAdvancedController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    harness.clear();
    controller = new InventoryAdvancedController();
    responseJson = {};
    responseStatus = 200;

    mockResponse = {
      status: vi.fn().mockImplementation((code) => {
        responseStatus = code;
        return mockResponse;
      }),
      json: vi.fn().mockImplementation((data) => {
        responseJson = data;
        return mockResponse;
      }),
    };

    mockRequest = {
      user: { userId: 'staff-123', id: 'staff-123', role: 'staff', tenantId: 'tenant-1', scope: 'staff' },
      params: {},
      query: {},
      body: {},
      headers: { 'x-property-id': 'prop-1' },
    };
  });

  describe('recordWastage', () => {
    it('records wastage and automatically deducts stock via FIFO when quantity <= 10', async () => {
      const itemId = '123e4567-e89b-12d3-a456-426614174000';

      // Seed item in stateful database
      harness.seed('inventory_items', [
        {
          id: itemId,
          name: 'Olive Oil 1L',
          cost_per_unit: '10.00',
          current_stock: 50,
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);
      harness.seed('inventory_wastage', []);

      mockRequest.body = {
        itemId,
        quantity: 5,
        reason: 'expired',
        notes: 'Expired bottle',
      };

      await controller.recordWastage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson.success).toBe(true);
      expect(responseJson.data.approval_status).toBe('approved');
      expect(responseJson.data.cost_impact).toBe(50); // 5 * 10.00

      // Verify real state mutations across tables
      const wastageRows = harness.getTable('inventory_wastage');
      expect(wastageRows.length).toBe(1);
      expect(wastageRows[0].quantity).toBe(5);
      expect(wastageRows[0].approval_status).toBe('approved');

      // Verify stock was genuinely decremented in inventory_items
      const itemInDb = harness.getTable('inventory_items').find((i) => i.id === itemId);
      expect(itemInDb?.current_stock).toBe(45); // 50 - 5

      // Verify RPC call was recorded
      const rpcCalls = harness.getRpcCalls('deduct_stock_fifo');
      expect(rpcCalls.length).toBe(1);
      expect(rpcCalls[0]).toEqual({
        p_item_id: itemId,
        p_quantity: 5,
        p_reason: 'wastage',
        p_user_id: 'staff-123',
      });
    });

    it('sets approval_status to pending and does NOT deduct stock when quantity > 10', async () => {
      const itemId = '223e4567-e89b-12d3-a456-426614174000';

      harness.seed('inventory_items', [
        {
          id: itemId,
          name: 'Ribeye Steaks',
          cost_per_unit: '25.00',
          current_stock: 100,
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);
      harness.seed('inventory_wastage', []);

      mockRequest.body = {
        itemId,
        quantity: 15, // > 10 requires approval
        reason: 'spoiled',
        notes: 'Refrigerator malfunction',
      };

      await controller.recordWastage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson.data.approval_status).toBe('pending');

      // Verify stock was NOT yet decremented
      const itemInDb = harness.getTable('inventory_items').find((i) => i.id === itemId);
      expect(itemInDb?.current_stock).toBe(100);
      expect(harness.getRpcCalls('deduct_stock_fifo').length).toBe(0);
    });

    it('returns 400 when body fails schema validation', async () => {
      mockRequest.body = {
        itemId: 'not-a-valid-uuid',
        quantity: -5,
      };

      await controller.recordWastage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseJson.success).toBe(false);
    });

    it('returns 404 when item does not exist in inventory', async () => {
      harness.seed('inventory_items', []);

      mockRequest.body = {
        itemId: '323e4567-e89b-12d3-a456-426614174000',
        quantity: 2,
        reason: 'damaged',
      };

      await controller.recordWastage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseJson.error).toBe('Item not found');
    });
  });

  describe('approveWastage', () => {
    it('approves pending wastage and triggers FIFO stock deduction', async () => {
      const itemId = '423e4567-e89b-12d3-a456-426614174000';
      const wastageId = '523e4567-e89b-12d3-a456-426614174000';

      harness.seed('inventory_items', [
        { id: itemId, current_stock: 80, tenant_id: 'tenant-1', property_id: 'prop-1' },
      ]);

      harness.seed('inventory_wastage', [
        {
          id: wastageId,
          item_id: itemId,
          quantity: 20,
          approval_status: 'pending',
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);

      mockRequest.params = { id: wastageId };
      mockRequest.body = { approved: true };

      await controller.approveWastage(mockRequest as Request, mockResponse as Response);

      expect(responseJson.success).toBe(true);

      // Verify wastage status was updated to approved
      const wastage = harness.getTable('inventory_wastage').find((w) => w.id === wastageId);
      expect(wastage?.approval_status).toBe('approved');

      // Verify FIFO deduction was dispatched and stock dropped from 80 to 60
      const item = harness.getTable('inventory_items').find((i) => i.id === itemId);
      expect(item?.current_stock).toBe(60);
    });

    it('rejects attempt to approve an already processed wastage record with 400', async () => {
      const itemId = '623e4567-e89b-12d3-a456-426614174000';
      const wastageId = '723e4567-e89b-12d3-a456-426614174000';

      harness.seed('inventory_items', [
        { id: itemId, current_stock: 40, tenant_id: 'tenant-1', property_id: 'prop-1' },
      ]);

      harness.seed('inventory_wastage', [
        {
          id: wastageId,
          item_id: itemId,
          quantity: 10,
          approval_status: 'approved', // Already approved!
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);

      mockRequest.params = { id: wastageId };

      await controller.approveWastage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseJson.error).toBe('Wastage already processed');

      // Stock remains unchanged
      const item = harness.getTable('inventory_items').find((i) => i.id === itemId);
      expect(item?.current_stock).toBe(40);
      expect(harness.getRpcCalls('deduct_stock_fifo').length).toBe(0);
    });
  });

  describe('recordPhysicalCount', () => {
    it('records physical count in inventory_variance and mutates current_stock with variance calculation', async () => {
      const itemId = '823e4567-e89b-12d3-a456-426614174000';

      harness.seed('inventory_items', [
        {
          id: itemId,
          name: 'Basmati Rice 5kg',
          current_stock: 100,
          cost_per_unit: '8.00',
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);
      harness.seed('inventory_variance', []);

      mockRequest.body = {
        itemId,
        actualQuantity: 96, // variance -4% (<= 5% auto-approves)
        notes: 'End of month audit',
      };

      await controller.recordPhysicalCount(mockRequest as Request, mockResponse as Response);

      expect(responseJson.success).toBe(true);

      // Verify physical count row recorded in inventory_variance: 96 - 100 = -4
      const varianceRows = harness.getTable('inventory_variance');
      expect(varianceRows.length).toBe(1);
      expect(varianceRows[0].actual_quantity).toBe(96);
      expect(varianceRows[0].system_quantity).toBe(100);
      expect(varianceRows[0].variance_quantity).toBe(-4);
      expect(varianceRows[0].status).toBe('approved');

      // Verify item current_stock was genuinely updated to actual count
      const item = harness.getTable('inventory_items').find((i) => i.id === itemId);
      expect(item?.current_stock).toBe(96);
    });
  });
});
