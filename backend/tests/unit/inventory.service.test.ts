/**
 * Inventory Service Unit Tests
 *
 * Comprehensive tests for the inventory service covering:
 * - Item CRUD operations
 * - Stock movements
 * - Low stock management
 * - Valuation calculations
 * - Validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInventoryService, InventoryServiceError } from '../../src/lib/services/inventory.service';
import { InMemoryInventoryRepository } from '../../src/lib/repositories/inventory.repository.memory';
import type { Container, InventoryItem, InventoryCategory, StockMovementType } from '../../src/lib/container/types';

// Test data
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ITEM_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUPPLIER_ID = '33333333-3333-3333-3333-333333333333';
const TEST_ORDER_ID = '44444444-4444-4444-4444-444444444444';

function createMockContainer(inventoryRepo: InMemoryInventoryRepository): Container {
  return {
    inventoryRepository: inventoryRepo,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as Container;
}

function createTestItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: TEST_ITEM_ID,
    name: 'Test Item',
    sku: 'TST-001',
    category: 'food',
    unit: 'kg',
    quantity: 100,
    minQuantity: 10,
    maxQuantity: 500,
    costPerUnit: 5.99,
    supplierId: null,
    location: 'Warehouse A',
    notes: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  };
}

describe('InventoryService', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let container: Container;
  let inventoryService: ReturnType<typeof createInventoryService>;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    container = createMockContainer(inventoryRepo);
    inventoryService = createInventoryService(container);
  });

  // =============================================
  // CREATE ITEM TESTS
  // =============================================
  describe('createItem', () => {
    it('should create an inventory item', async () => {
      const result = await inventoryService.createItem({
        name: 'Flour',
        sku: 'FD-FLR01',
        category: 'food',
        unit: 'kg',
        costPerUnit: 2.50,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Flour');
      expect(result.sku).toBe('FD-FLR01');
      expect(result.category).toBe('food');
      expect(result.isActive).toBe(true);
    });

    it('should create item with initial quantity', async () => {
      const result = await inventoryService.createItem({
        name: 'Sugar',
        sku: 'FD-SGR01',
        category: 'food',
        unit: 'kg',
        quantity: 50,
        costPerUnit: 3.00,
      });

      expect(result.quantity).toBe(50);
    });

    it('should create item with min/max quantities', async () => {
      const result = await inventoryService.createItem({
        name: 'Salt',
        sku: 'FD-SALT01',
        category: 'food',
        unit: 'kg',
        minQuantity: 5,
        maxQuantity: 200,
        costPerUnit: 1.50,
      });

      expect(result.minQuantity).toBe(5);
      expect(result.maxQuantity).toBe(200);
    });

    it('should create item with supplier and location', async () => {
      const result = await inventoryService.createItem({
        name: 'Olive Oil',
        sku: 'FD-OIL01',
        category: 'food',
        unit: 'liters',
        costPerUnit: 12.00,
        supplierId: TEST_SUPPLIER_ID,
        location: 'Storage Room B',
      });

      expect(result.supplierId).toBe(TEST_SUPPLIER_ID);
      expect(result.location).toBe('Storage Room B');
    });

    it('should uppercase SKU', async () => {
      const result = await inventoryService.createItem({
        name: 'Pepper',
        sku: 'fd-001',
        category: 'food',
        unit: 'g',
        costPerUnit: 15.00,
      });

      expect(result.sku).toBe('FD-001');
    });

    it('should trim name', async () => {
      const result = await inventoryService.createItem({
        name: '  Garlic  ',
        sku: 'FD-002',
        category: 'food',
        unit: 'pieces',
        costPerUnit: 0.50,
      });

      expect(result.name).toBe('Garlic');
    });

    it('should throw error for short name', async () => {
      await expect(
        inventoryService.createItem({
          name: 'A',
          sku: 'FD-A01',
          category: 'food',
          unit: 'kg',
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Name must be at least 2 characters');
    });

    it('should throw error for long name', async () => {
      await expect(
        inventoryService.createItem({
          name: 'A'.repeat(101),
          sku: 'FD-LONG01',
          category: 'food',
          unit: 'kg',
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Name cannot exceed 100 characters');
    });

    it('should throw error for invalid SKU format', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'invalid',
          category: 'food',
          unit: 'kg',
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Invalid SKU format');
    });

    it('should throw error for empty SKU', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: '',
          category: 'food',
          unit: 'kg',
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Invalid SKU format');
    });

    it('should throw error for duplicate SKU', async () => {
      inventoryRepo.addItem(createTestItem({ sku: 'FD-DUP01' }));

      await expect(
        inventoryService.createItem({
          name: 'Duplicate Item',
          sku: 'FD-DUP01',
          category: 'food',
          unit: 'kg',
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('An item with this SKU already exists');
    });

    it('should throw error for invalid category', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'XX-TEST01',
          category: 'invalid' as InventoryCategory,
          unit: 'kg',
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Invalid category');
    });

    it('should throw error for missing unit', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'FD-TEST01',
          category: 'food',
          unit: '',
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Unit is required');
    });

    it('should throw error for negative quantity', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'FD-TEST01',
          category: 'food',
          unit: 'kg',
          quantity: -10,
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Quantity cannot be negative');
    });

    it('should throw error for negative min quantity', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'FD-TEST01',
          category: 'food',
          unit: 'kg',
          minQuantity: -5,
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Minimum quantity cannot be negative');
    });

    it('should throw error when max less than min', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'FD-TEST01',
          category: 'food',
          unit: 'kg',
          minQuantity: 100,
          maxQuantity: 50,
          costPerUnit: 1.00,
        })
      ).rejects.toThrow('Maximum quantity must be greater than or equal to minimum quantity');
    });

    it('should throw error for negative cost', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'FD-TEST01',
          category: 'food',
          unit: 'kg',
          costPerUnit: -5.00,
        })
      ).rejects.toThrow('Cost per unit cannot be negative');
    });

    it('should throw error for invalid supplier ID', async () => {
      await expect(
        inventoryService.createItem({
          name: 'Test Item',
          sku: 'FD-TEST01',
          category: 'food',
          unit: 'kg',
          costPerUnit: 1.00,
          supplierId: 'invalid-id',
        })
      ).rejects.toThrow('Invalid supplier ID format');
    });

    it('should accept all valid categories', async () => {
      const categories: InventoryCategory[] = ['food', 'beverage', 'supplies', 'equipment', 'other'];
      let counter = 1;
      for (const category of categories) {
        const result = await inventoryService.createItem({
          name: `Item ${counter}`,
          sku: `CAT-ITEM${counter.toString().padStart(2, '0')}`,
          category,
          unit: 'each',
          costPerUnit: 1.00,
        });
        expect(result.category).toBe(category);
        counter++;
      }
    });
  });

  // =============================================
  // GET ITEM TESTS
  // =============================================
  describe('getItemById', () => {
    it('should get item by ID', async () => {
      inventoryRepo.addItem(createTestItem());

      const result = await inventoryService.getItemById(TEST_ITEM_ID);

      expect(result).toBeDefined();
      expect(result?.id).toBe(TEST_ITEM_ID);
    });

    it('should return null for non-existent item', async () => {
      const result = await inventoryService.getItemById(TEST_ITEM_ID);
      expect(result).toBeNull();
    });

    it('should throw error for invalid ID format', async () => {
      await expect(inventoryService.getItemById('invalid')).rejects.toThrow(
        'Invalid item ID format'
      );
    });

    it('should throw error for empty ID', async () => {
      await expect(inventoryService.getItemById('')).rejects.toThrow(
        'Invalid item ID format'
      );
    });
  });

  describe('getItemBySku', () => {
    it('should get item by SKU', async () => {
      inventoryRepo.addItem(createTestItem({ sku: 'FD-FIND01' }));

      const result = await inventoryService.getItemBySku('FD-FIND01');

      expect(result).toBeDefined();
      expect(result?.sku).toBe('FD-FIND01');
    });

    it('should be case insensitive', async () => {
      inventoryRepo.addItem(createTestItem({ sku: 'FD-CASE01' }));

      const result = await inventoryService.getItemBySku('fd-case01');

      expect(result).toBeDefined();
    });

    it('should return null for non-existent SKU', async () => {
      const result = await inventoryService.getItemBySku('XX-NONE01');
      expect(result).toBeNull();
    });

    it('should throw error for empty SKU', async () => {
      await expect(inventoryService.getItemBySku('')).rejects.toThrow('SKU is required');
    });
  });

  // =============================================
  // LIST ITEMS TESTS
  // =============================================
  describe('listItems', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ id: '11111111-1111-1111-1111-111111111111', sku: 'FD-001', name: 'Flour', category: 'food', quantity: 100 }));
      inventoryRepo.addItem(createTestItem({ id: '22222222-2222-2222-2222-222222222222', sku: 'BV-001', name: 'Water', category: 'beverage', quantity: 50 }));
      inventoryRepo.addItem(createTestItem({ id: '33333333-3333-3333-3333-333333333333', sku: 'SP-001', name: 'Napkins', category: 'supplies', quantity: 5, minQuantity: 10 }));
      inventoryRepo.addItem(createTestItem({ id: '44444444-4444-4444-4444-444444444444', sku: 'FD-002', name: 'Inactive', category: 'food', isActive: false }));
    });

    it('should list all items', async () => {
      const result = await inventoryService.listItems();
      expect(result.length).toBe(4);
    });

    it('should filter by category', async () => {
      const result = await inventoryService.listItems({ category: 'beverage' });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Water');
    });

    it('should filter by active status', async () => {
      const result = await inventoryService.listItems({ isActive: true });
      expect(result.length).toBe(3);
    });

    it('should filter low stock items', async () => {
      const result = await inventoryService.listItems({ lowStock: true });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Napkins');
    });

    it('should search by name', async () => {
      const result = await inventoryService.listItems({ search: 'flour' });
      expect(result.length).toBe(1);
    });

    it('should throw error for invalid category filter', async () => {
      await expect(
        inventoryService.listItems({ category: 'invalid' as InventoryCategory })
      ).rejects.toThrow('Invalid category filter');
    });
  });

  // =============================================
  // UPDATE ITEM TESTS
  // =============================================
  describe('updateItem', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem());
    });

    it('should update item name', async () => {
      const result = await inventoryService.updateItem(TEST_ITEM_ID, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should update item category', async () => {
      const result = await inventoryService.updateItem(TEST_ITEM_ID, { category: 'beverage' });
      expect(result.category).toBe('beverage');
    });

    it('should update min/max quantities', async () => {
      const result = await inventoryService.updateItem(TEST_ITEM_ID, {
        minQuantity: 20,
        maxQuantity: 1000,
      });
      expect(result.minQuantity).toBe(20);
      expect(result.maxQuantity).toBe(1000);
    });

    it('should deactivate item', async () => {
      const result = await inventoryService.updateItem(TEST_ITEM_ID, { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        inventoryService.updateItem('99999999-9999-9999-9999-999999999999', { name: 'Test' })
      ).rejects.toThrow('Inventory item not found');
    });

    it('should throw error for invalid ID', async () => {
      await expect(inventoryService.updateItem('invalid', { name: 'Test' })).rejects.toThrow(
        'Invalid item ID format'
      );
    });

    it('should throw error for short name', async () => {
      await expect(
        inventoryService.updateItem(TEST_ITEM_ID, { name: 'A' })
      ).rejects.toThrow('Name must be at least 2 characters');
    });

    it('should throw error for long name', async () => {
      await expect(
        inventoryService.updateItem(TEST_ITEM_ID, { name: 'A'.repeat(101) })
      ).rejects.toThrow('Name cannot exceed 100 characters');
    });

    it('should throw error for invalid category', async () => {
      await expect(
        inventoryService.updateItem(TEST_ITEM_ID, { category: 'invalid' as InventoryCategory })
      ).rejects.toThrow('Invalid category');
    });

    it('should throw error for negative min quantity', async () => {
      await expect(
        inventoryService.updateItem(TEST_ITEM_ID, { minQuantity: -5 })
      ).rejects.toThrow('Minimum quantity cannot be negative');
    });

    it('should throw error when max less than min', async () => {
      await expect(
        inventoryService.updateItem(TEST_ITEM_ID, { maxQuantity: 5 }) // min is 10
      ).rejects.toThrow('Maximum quantity must be greater than or equal to minimum quantity');
    });

    it('should throw error for negative cost', async () => {
      await expect(
        inventoryService.updateItem(TEST_ITEM_ID, { costPerUnit: -1 })
      ).rejects.toThrow('Cost per unit cannot be negative');
    });

    it('should throw error for invalid supplier ID', async () => {
      await expect(
        inventoryService.updateItem(TEST_ITEM_ID, { supplierId: 'invalid' })
      ).rejects.toThrow('Invalid supplier ID format');
    });
  });

  // =============================================
  // DELETE ITEM TESTS
  // =============================================
  describe('deleteItem', () => {
    it('should delete item with zero quantity', async () => {
      inventoryRepo.addItem(createTestItem({ quantity: 0 }));

      await inventoryService.deleteItem(TEST_ITEM_ID);

      const result = await inventoryService.getItemById(TEST_ITEM_ID);
      expect(result).toBeNull();
    });

    it('should throw error when item has stock', async () => {
      inventoryRepo.addItem(createTestItem({ quantity: 50 }));

      await expect(inventoryService.deleteItem(TEST_ITEM_ID)).rejects.toThrow(
        'Cannot delete item with remaining stock'
      );
    });

    it('should throw error for non-existent item', async () => {
      await expect(inventoryService.deleteItem(TEST_ITEM_ID)).rejects.toThrow(
        'Inventory item not found'
      );
    });

    it('should throw error for invalid ID', async () => {
      await expect(inventoryService.deleteItem('invalid')).rejects.toThrow(
        'Invalid item ID format'
      );
    });
  });

  // =============================================
  // STOCK ADJUSTMENT TESTS
  // =============================================
  describe('adjustStock', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ quantity: 100 }));
    });

    it('should add stock (in)', async () => {
      const result = await inventoryService.adjustStock({
        itemId: TEST_ITEM_ID,
        type: 'in',
        quantity: 50,
        performedBy: TEST_USER_ID,
      });

      expect(result.type).toBe('in');
      expect(result.previousQuantity).toBe(100);
      expect(result.newQuantity).toBe(150);
    });

    it('should remove stock (out)', async () => {
      const result = await inventoryService.adjustStock({
        itemId: TEST_ITEM_ID,
        type: 'out',
        quantity: 30,
        performedBy: TEST_USER_ID,
      });

      expect(result.type).toBe('out');
      expect(result.newQuantity).toBe(70);
    });

    it('should handle return', async () => {
      const result = await inventoryService.adjustStock({
        itemId: TEST_ITEM_ID,
        type: 'return',
        quantity: 10,
        performedBy: TEST_USER_ID,
      });

      expect(result.type).toBe('return');
      expect(result.newQuantity).toBe(110);
    });

    it('should handle waste', async () => {
      const result = await inventoryService.adjustStock({
        itemId: TEST_ITEM_ID,
        type: 'waste',
        quantity: 5,
        performedBy: TEST_USER_ID,
        reason: 'Expired',
      });

      expect(result.type).toBe('waste');
      expect(result.newQuantity).toBe(95);
    });

    it('should handle adjustment (set absolute)', async () => {
      const result = await inventoryService.adjustStock({
        itemId: TEST_ITEM_ID,
        type: 'adjustment',
        quantity: 75,
        performedBy: TEST_USER_ID,
        reason: 'Inventory count correction',
      });

      expect(result.newQuantity).toBe(75);
    });

    it('should include reference ID', async () => {
      const result = await inventoryService.adjustStock({
        itemId: TEST_ITEM_ID,
        type: 'out',
        quantity: 10,
        performedBy: TEST_USER_ID,
        referenceId: TEST_ORDER_ID,
      });

      expect(result.referenceId).toBe(TEST_ORDER_ID);
    });

    it('should throw error for insufficient stock', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: TEST_ITEM_ID,
          type: 'out',
          quantity: 150,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Insufficient stock');
    });

    it('should throw error when exceeding max quantity', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: TEST_ITEM_ID,
          type: 'in',
          quantity: 500,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Exceeds maximum quantity');
    });

    it('should throw error for invalid item ID', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: 'invalid',
          type: 'in',
          quantity: 10,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Invalid item ID format');
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: '99999999-9999-9999-9999-999999999999',
          type: 'in',
          quantity: 10,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Inventory item not found');
    });

    it('should throw error for inactive item', async () => {
      inventoryRepo.addItem(
        createTestItem({ id: '55555555-5555-5555-5555-555555555555', isActive: false })
      );

      await expect(
        inventoryService.adjustStock({
          itemId: '55555555-5555-5555-5555-555555555555',
          type: 'in',
          quantity: 10,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Cannot adjust stock for inactive item');
    });

    it('should throw error for invalid movement type', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: TEST_ITEM_ID,
          type: 'invalid' as StockMovementType,
          quantity: 10,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Invalid movement type');
    });

    it('should throw error for zero quantity', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: TEST_ITEM_ID,
          type: 'in',
          quantity: 0,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Quantity must be a positive number');
    });

    it('should throw error for negative quantity', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: TEST_ITEM_ID,
          type: 'in',
          quantity: -10,
          performedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Quantity must be a positive number');
    });

    it('should throw error for invalid performer ID', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: TEST_ITEM_ID,
          type: 'in',
          quantity: 10,
          performedBy: 'invalid',
        })
      ).rejects.toThrow('Invalid performer ID format');
    });

    it('should throw error for invalid reference ID', async () => {
      await expect(
        inventoryService.adjustStock({
          itemId: TEST_ITEM_ID,
          type: 'out',
          quantity: 10,
          performedBy: TEST_USER_ID,
          referenceId: 'invalid',
        })
      ).rejects.toThrow('Invalid reference ID format');
    });
  });

  // =============================================
  // CONVENIENCE STOCK METHODS
  // =============================================
  describe('addStock', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ quantity: 100 }));
    });

    it('should add stock', async () => {
      const result = await inventoryService.addStock(TEST_ITEM_ID, 25, TEST_USER_ID);
      expect(result.newQuantity).toBe(125);
    });

    it('should add stock with reason', async () => {
      const result = await inventoryService.addStock(
        TEST_ITEM_ID,
        25,
        TEST_USER_ID,
        'Delivery received'
      );
      expect(result.reason).toBe('Delivery received');
    });
  });

  describe('removeStock', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ quantity: 100 }));
    });

    it('should remove stock', async () => {
      const result = await inventoryService.removeStock(TEST_ITEM_ID, 25, TEST_USER_ID);
      expect(result.newQuantity).toBe(75);
    });

    it('should remove stock with reference', async () => {
      const result = await inventoryService.removeStock(
        TEST_ITEM_ID,
        25,
        TEST_USER_ID,
        'Order fulfillment',
        TEST_ORDER_ID
      );
      expect(result.referenceId).toBe(TEST_ORDER_ID);
    });
  });

  describe('recordWaste', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ quantity: 100 }));
    });

    it('should record waste', async () => {
      const result = await inventoryService.recordWaste(
        TEST_ITEM_ID,
        10,
        TEST_USER_ID,
        'Expired items'
      );
      expect(result.type).toBe('waste');
      expect(result.newQuantity).toBe(90);
    });

    it('should throw error without reason', async () => {
      await expect(
        inventoryService.recordWaste(TEST_ITEM_ID, 10, TEST_USER_ID, '')
      ).rejects.toThrow('Reason is required for waste');
    });
  });

  // =============================================
  // STOCK MOVEMENTS TESTS
  // =============================================
  describe('getStockMovements', () => {
    beforeEach(async () => {
      inventoryRepo.addItem(createTestItem({ quantity: 100 }));
      await inventoryService.addStock(TEST_ITEM_ID, 10, TEST_USER_ID);
      await inventoryService.removeStock(TEST_ITEM_ID, 5, TEST_USER_ID);
    });

    it('should get stock movements', async () => {
      const result = await inventoryService.getStockMovements(TEST_ITEM_ID);
      expect(result.length).toBe(2);
    });

    it('should limit results', async () => {
      const result = await inventoryService.getStockMovements(TEST_ITEM_ID, 1);
      expect(result.length).toBe(1);
    });

    it('should throw error for invalid item ID', async () => {
      await expect(inventoryService.getStockMovements('invalid')).rejects.toThrow(
        'Invalid item ID format'
      );
    });

    it('should throw error for invalid limit', async () => {
      await expect(inventoryService.getStockMovements(TEST_ITEM_ID, 0)).rejects.toThrow(
        'Limit must be between 1 and 1000'
      );
    });

    it('should throw error for limit too high', async () => {
      await expect(inventoryService.getStockMovements(TEST_ITEM_ID, 1001)).rejects.toThrow(
        'Limit must be between 1 and 1000'
      );
    });
  });

  // =============================================
  // LOW STOCK TESTS
  // =============================================
  describe('getLowStockItems', () => {
    it('should get low stock items', async () => {
      inventoryRepo.addItem(createTestItem({ id: '11111111-1111-1111-1111-111111111111', quantity: 100, minQuantity: 10 }));
      inventoryRepo.addItem(createTestItem({ id: '22222222-2222-2222-2222-222222222222', quantity: 5, minQuantity: 10 }));
      inventoryRepo.addItem(createTestItem({ id: '33333333-3333-3333-3333-333333333333', quantity: 10, minQuantity: 10 }));

      const result = await inventoryService.getLowStockItems();
      expect(result.length).toBe(2); // 5 and 10 (equal to min counts as low)
    });
  });

  describe('getLowStockCount', () => {
    it('should get low stock count', async () => {
      inventoryRepo.addItem(createTestItem({ id: '11111111-1111-1111-1111-111111111111', quantity: 5, minQuantity: 10 }));
      inventoryRepo.addItem(createTestItem({ id: '22222222-2222-2222-2222-222222222222', quantity: 100, minQuantity: 10 }));

      const result = await inventoryService.getLowStockCount();
      expect(result).toBe(1);
    });
  });

  describe('isLowStock', () => {
    it('should return true for low stock', async () => {
      inventoryRepo.addItem(createTestItem({ quantity: 5, minQuantity: 10 }));

      const result = await inventoryService.isLowStock(TEST_ITEM_ID);
      expect(result).toBe(true);
    });

    it('should return false for adequate stock', async () => {
      inventoryRepo.addItem(createTestItem({ quantity: 100, minQuantity: 10 }));

      const result = await inventoryService.isLowStock(TEST_ITEM_ID);
      expect(result).toBe(false);
    });

    it('should throw error for non-existent item', async () => {
      await expect(inventoryService.isLowStock(TEST_ITEM_ID)).rejects.toThrow('Item not found');
    });
  });

  // =============================================
  // VALUATION TESTS
  // =============================================
  describe('getValuation', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ id: '11111111-1111-1111-1111-111111111111', category: 'food', quantity: 100, costPerUnit: 5.00 }));
      inventoryRepo.addItem(createTestItem({ id: '22222222-2222-2222-2222-222222222222', category: 'beverage', quantity: 50, costPerUnit: 2.00 }));
      inventoryRepo.addItem(createTestItem({ id: '33333333-3333-3333-3333-333333333333', category: 'food', quantity: 25, costPerUnit: 10.00 }));
    });

    it('should calculate total valuation', async () => {
      const result = await inventoryService.getValuation();

      expect(result.totalItems).toBe(3);
      expect(result.totalQuantity).toBe(175);
      expect(result.totalValue).toBe(850); // 500 + 100 + 250
    });

    it('should break down by category', async () => {
      const result = await inventoryService.getValuation();

      expect(result.byCategory.food.count).toBe(2);
      expect(result.byCategory.food.value).toBe(750);
      expect(result.byCategory.beverage.count).toBe(1);
      expect(result.byCategory.beverage.value).toBe(100);
    });
  });

  // =============================================
  // SEARCH TESTS
  // =============================================
  describe('searchItems', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ id: '11111111-1111-1111-1111-111111111111', name: 'Chocolate Chips', sku: 'FD-CHOC01' }));
      inventoryRepo.addItem(createTestItem({ id: '22222222-2222-2222-2222-222222222222', name: 'Vanilla Extract', sku: 'FD-VANL01' }));
    });

    it('should search by name', async () => {
      const result = await inventoryService.searchItems('chocolate');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Chocolate Chips');
    });

    it('should search by SKU', async () => {
      const result = await inventoryService.searchItems('vanl');
      expect(result.length).toBe(1);
    });

    it('should throw error for short query', async () => {
      await expect(inventoryService.searchItems('a')).rejects.toThrow(
        'Search query must be at least 2 characters'
      );
    });

    it('should throw error for empty query', async () => {
      await expect(inventoryService.searchItems('')).rejects.toThrow(
        'Search query must be at least 2 characters'
      );
    });
  });

  describe('getItemsByCategory', () => {
    beforeEach(() => {
      inventoryRepo.addItem(createTestItem({ id: '11111111-1111-1111-1111-111111111111', category: 'food' }));
      inventoryRepo.addItem(createTestItem({ id: '22222222-2222-2222-2222-222222222222', category: 'beverage' }));
    });

    it('should get items by category', async () => {
      const result = await inventoryService.getItemsByCategory('food');
      expect(result.length).toBe(1);
    });

    it('should throw error for invalid category', async () => {
      await expect(
        inventoryService.getItemsByCategory('invalid' as InventoryCategory)
      ).rejects.toThrow('Invalid category');
    });
  });

  // =============================================
  // UTILITY TESTS
  // =============================================
  describe('getCategories', () => {
    it('should return all categories', () => {
      const categories = inventoryService.getCategories();
      expect(categories).toContain('food');
      expect(categories).toContain('beverage');
      expect(categories).toContain('supplies');
      expect(categories).toContain('equipment');
      expect(categories).toContain('other');
    });
  });

  describe('getMovementTypes', () => {
    it('should return all movement types', () => {
      const types = inventoryService.getMovementTypes();
      expect(types).toContain('in');
      expect(types).toContain('out');
      expect(types).toContain('adjustment');
      expect(types).toContain('return');
      expect(types).toContain('waste');
    });
  });

  describe('validateSku', () => {
    it('should return true for valid SKU', () => {
      expect(inventoryService.validateSku('FD-001')).toBe(true);
      expect(inventoryService.validateSku('ABC-1234')).toBe(true);
      expect(inventoryService.validateSku('XX-ABC123-Y')).toBe(true);
    });

    it('should return false for invalid SKU', () => {
      expect(inventoryService.validateSku('invalid')).toBe(false);
      expect(inventoryService.validateSku('')).toBe(false);
      expect(inventoryService.validateSku('A-1')).toBe(false);
    });
  });

  describe('generateSkuSuggestion', () => {
    it('should generate SKU suggestion', () => {
      const sku = inventoryService.generateSkuSuggestion('food', 'Chocolate Chips');
      expect(sku).toMatch(/^FOO-CHOC\d{3}$/);
    });

    it('should handle short names', () => {
      const sku = inventoryService.generateSkuSuggestion('beverage', 'Tea');
      expect(sku).toMatch(/^BEV-TEA\d{3}$/);
    });

    it('should handle names with special characters', () => {
      const sku = inventoryService.generateSkuSuggestion('supplies', 'Paper Towels!');
      expect(sku).toMatch(/^SUP-PAPE\d{3}$/);
    });
  });

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================
  describe('InventoryServiceError', () => {
    it('should have correct error name', async () => {
      try {
        await inventoryService.getItemById('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(InventoryServiceError);
        expect((error as InventoryServiceError).name).toBe('InventoryServiceError');
      }
    });

    it('should have error code', async () => {
      try {
        await inventoryService.getItemById('invalid');
      } catch (error) {
        expect((error as InventoryServiceError).code).toBe('INVALID_ITEM_ID');
      }
    });
  });
});
