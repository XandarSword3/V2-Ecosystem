import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  customizationService,
  CreateCustomizationGroupRequest,
  CreateCustomizationOptionRequest,
  LinkCustomizationRequest,
} from '../../../../src/modules/customization/services/customization.service.js';

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../../../src/database/connection.js';
import { createChainableMock } from '../../utils.js';

describe('CustomizationService (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Group Management', () => {
    it('should create a customization group and map db row properly', async () => {
      const mockRow = {
        id: 'grp-1',
        name: 'Burger Add-ons',
        name_ar: 'إضافات',
        name_fr: null,
        description: 'Choose your toppings',
        description_ar: null,
        display_name: 'Toppings',
        display_name_ar: null,
        icon: 'burger',
        selection_mode: 'multiple',
        min_selections: 0,
        max_selections: 5,
        is_required: false,
        applicable_entity_types: ['catalog_item'],
        is_global: false,
        is_available: true,
        available_from: null,
        available_until: null,
        available_days: null,
        display_conditions: {},
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'customization_groups') {
            return createChainableMock(mockRow);
          }
          return createChainableMock(null);
        }),
      } as any);

      const request: CreateCustomizationGroupRequest = {
        name: 'Burger Add-ons',
        displayName: 'Toppings',
        icon: 'burger',
        selectionMode: 'multiple',
        minSelections: 0,
        maxSelections: 5,
        applicableEntityTypes: ['catalog_item'],
        sortOrder: 1,
      };

      const group = await customizationService.createGroup(request, { tenantId: 'tenant-1' });
      expect(group.id).toBe('grp-1');
      expect(group.name).toBe('Burger Add-ons');
      expect(group.selectionMode).toBe('multiple');
      expect(group.applicableEntityTypes).toEqual(['catalog_item']);
    });

    it('should update an existing group and throw 404 if not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'customization_groups') {
            return createChainableMock(null);
          }
          return createChainableMock(null);
        }),
      } as any);

      await expect(
        customizationService.updateGroup('non-existent', { name: 'Updated' }, 'tenant-1')
      ).rejects.toThrow('Customization group not found');
    });

    it('should soft delete group by setting deleted_at', async () => {
      const mockUpdate = vi.fn().mockReturnThis();

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'customization_groups') {
            const chain = createChainableMock({ id: 'grp-1' });
            chain.update = mockUpdate;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      await customizationService.deleteGroup('grp-1', 'tenant-1');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String),
        })
      );
    });

    it('should throw 404 when deleting non-existent group', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      await expect(customizationService.deleteGroup('grp-404', 'tenant-1')).rejects.toThrow(
        'Customization group not found'
      );
    });
  });

  describe('Option Management', () => {
    it('should create an option and map numbers and db fields properly', async () => {
      const mockOptionRow = {
        id: 'opt-1',
        group_id: 'grp-1',
        name: 'Extra Cheese',
        name_ar: 'جبنة إضافية',
        name_fr: null,
        description: 'Cheddar cheese slice',
        description_ar: null,
        customization_type: 'add',
        price_adjustment: '1.50',
        price_type: 'fixed',
        inventory_item_id: 'inv-item-1',
        quantity_per_selection: '1',
        inventory_unit: 'slice',
        replaces_inventory_item_id: null,
        max_quantity: 3,
        quantity_increment: '1',
        is_default: false,
        is_popular: true,
        badge_text: 'HOT',
        badge_color: '#ff0000',
        image_url: 'https://example.com/cheese.jpg',
        is_available: true,
        available_stock: 50,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'customization_groups') {
            return createChainableMock({ tenant_id: 'tenant-1', property_id: 'prop-1' });
          }
          if (table === 'customization_options') {
            return createChainableMock(mockOptionRow);
          }
          return createChainableMock(null);
        }),
      } as any);

      const request: CreateCustomizationOptionRequest = {
        groupId: 'grp-1',
        name: 'Extra Cheese',
        customizationType: 'add',
        priceAdjustment: 1.5,
        priceType: 'fixed',
        inventoryItemId: 'inv-item-1',
        maxQuantity: 3,
        isPopular: true,
      };

      const option = await customizationService.createOption(request);
      expect(option.id).toBe('opt-1');
      expect(option.priceAdjustment).toBe(1.5);
      expect(option.isPopular).toBe(true);
      expect(option.maxQuantity).toBe(3);
    });

    it('should throw 404 when updating non-existent option', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      await expect(
        customizationService.updateOption('opt-none', { name: 'Non Existent' }, 'tenant-1')
      ).rejects.toThrow('Customization option not found');
    });
  });

  describe('Entity Linking', () => {
    it('should link customization group to an entity', async () => {
      const mockLinkRow = {
        id: 'link-1',
        entity_type: 'catalog_item',
        entity_id: 'item-100',
        customization_group_id: 'grp-1',
        is_required_override: true,
        min_selections_override: 1,
        max_selections_override: 3,
        price_multiplier: '1.25',
        is_enabled: true,
        sort_order: 0,
        created_at: new Date().toISOString(),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'customization_groups') {
            return createChainableMock({ tenant_id: 'tenant-1', property_id: 'prop-1' });
          }
          if (table === 'entity_customizations') {
            return createChainableMock(mockLinkRow);
          }
          return createChainableMock(null);
        }),
      } as any);

      const linkReq: LinkCustomizationRequest = {
        entityType: 'catalog_item',
        entityId: 'item-100',
        customizationGroupId: 'grp-1',
        isRequiredOverride: true,
        minSelectionsOverride: 1,
        maxSelectionsOverride: 3,
        priceMultiplier: 1.25,
      };

      const link = await customizationService.linkToEntity(linkReq);
      expect(link.id).toBe('link-1');
      expect(link.entityId).toBe('item-100');
      expect(link.priceMultiplier).toBe(1.25);
      expect(link.isRequiredOverride).toBe(true);
    });
  });

  describe('validateSelections & RPC pipelines', () => {
    it('should invoke validate_customizations RPC and return parsed result', async () => {
      const mockRpcResult = [
        {
          is_valid: true,
          total_price_adjustment: '3.50',
          validated_selections: [
            {
              group_id: 'grp-1',
              group_name: 'Burger Add-ons',
              option_id: 'opt-1',
              option_name: 'Extra Cheese',
              quantity: 2,
              price_adjustment: 3.0,
            },
          ],
          validation_errors: [],
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
      } as any);

      const result = await customizationService.validateSelections(
        'catalog_item',
        'item-100',
        [{ optionId: 'opt-1', quantity: 2 }]
      );

      expect(result.isValid).toBe(true);
      expect(result.totalPriceAdjustment).toBe(3.5);
      expect(result.validatedSelections).toHaveLength(1);
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should throw error when validate_customizations RPC fails', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database RPC failure' } }),
      } as any);

      await expect(
        customizationService.validateSelections('catalog_item', 'item-100', [])
      ).rejects.toThrow('Failed to validate customizations: Database RPC failure');
    });

    it('should process inventory deductions via process_customization_inventory_safe', async () => {
      const mockInventoryRpc = [
        {
          items_added: 2,
          items_removed: 0,
          items_swapped: 0,
          deduction_log: [{ action: 'deduct', inventoryItemId: 'inv-item-1', quantity: 2 }],
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ data: mockInventoryRpc, error: null }),
      } as any);

      const invResult = await customizationService.processInventory(
        'pos_order',
        'order-100',
        'item-200',
        [{ optionId: 'opt-1', quantity: 2 } as any],
        1,
        'user-1'
      );

      expect(invResult.itemsAdded).toBe(2);
      expect(invResult.deductionLog).toHaveLength(1);
    });
  });

  describe('Reversal and Dual-Write Analytics', () => {
    it('should reverse inventory and enforce tenant isolation check', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'order_customizations') {
            return createChainableMock({ id: 'snap-1' });
          }
          return createChainableMock(null);
        }),
        rpc: vi.fn().mockResolvedValue({
          data: [{ success: true, items_reversed: 2, reversal_log: [{ restored: true }] }],
          error: null,
        }),
      } as any);

      const rev = await customizationService.reverseOrderItemInventory('snap-1', 'Guest Refund', 'staff-1', 'tenant-1');
      expect(rev.success).toBe(true);
      expect(rev.itemsReversed).toBe(2);
    });

    it('should throw 404 when reversing snapshot belonging to different tenant', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'order_customizations') {
            return createChainableMock(null); // not found for tenant
          }
          return createChainableMock(null);
        }),
      } as any);

      await expect(
        customizationService.reverseOrderItemInventory('snap-other-tenant', 'Refund', 'staff-1', 'tenant-1')
      ).rejects.toThrow('Order snapshot not found');
    });

    it('should compute dual write statistics accurately', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'customization_dual_write_log') {
            const chain = createChainableMock({ count: 100 });
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      const stats = await customizationService.getDualWriteStats();
      expect(stats.total).toBe(100);
      expect(stats.matches).toBe(100);
      expect(stats.mismatches).toBe(0);
      expect(stats.matchRate).toBe(100);
    });
  });
});
