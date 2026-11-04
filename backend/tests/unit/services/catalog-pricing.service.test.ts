import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveAndPriceCatalogItems, type CatalogItemRequest } from '../../../src/services/catalog-pricing.service.js';

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/modules/customization/services/customization.service.js', () => ({
  customizationService: {
    validateSelections: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import { customizationService } from '../../../src/modules/customization/services/customization.service.js';

describe('CatalogPricingService (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when no valid item IDs are provided', async () => {
    const result = await resolveAndPriceCatalogItems([{}], 'mod-1');
    expect(result.validationErrors).toContain('No valid catalog item IDs provided');
    expect(result.resolvedItems).toHaveLength(0);
  });

  it('should resolve prices and names from catalog_items table', async () => {
    const mockCatalogRows = [
      { id: 'item-burger', name: 'Classic Burger', price: 15, is_available: true, lifecycle_status: 'active' },
      { id: 'item-fries', name: 'French Fries', price: 5, is_available: true, lifecycle_status: 'active' },
    ];

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'catalog_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockCatalogRows, error: null }),
              }),
            }),
          };
        }
        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { tax_category: 'food' }, error: null }),
              }),
            }),
          };
        }
        return {} as any;
      }),
    } as any);

    const items: CatalogItemRequest[] = [
      { catalog_item_id: 'item-burger', quantity: 2 },
      { menuItemId: 'item-fries', quantity: 1 },
    ];

    const result = await resolveAndPriceCatalogItems(items, 'mod-1');

    expect(result.validationErrors).toHaveLength(0);
    expect(result.resolvedItems).toHaveLength(2);

    expect(result.resolvedItems[0]).toEqual(expect.objectContaining({
      itemId: 'item-burger',
      name: 'Classic Burger',
      basePrice: 15,
      quantity: 2,
      modifierAdjustment: 0,
      taxCategory: 'food',
    }));

    expect(result.resolvedItems[1]).toEqual(expect.objectContaining({
      itemId: 'item-fries',
      name: 'French Fries',
      basePrice: 5,
      quantity: 1,
    }));
  });

  it('should hard-fail when an item ID cannot be resolved across any table', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'catalog_items' || table === 'bookable_units' || table === 'accommodation_add_ons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {} as any;
      }),
    } as any);

    const result = await resolveAndPriceCatalogItems([{ itemId: 'ghost-item' }], 'mod-1');

    expect(result.validationErrors).toContain('Unknown catalog item(s): ghost-item');
    expect(result.resolvedItems).toHaveLength(0);
  });

  it('should enforce quantity constraints (integer, positive, <= 50)', async () => {
    const mockCatalogRows = [
      { id: 'item-1', name: 'Item 1', price: 10, is_available: true, lifecycle_status: 'active' },
    ];

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockCatalogRows, error: null }),
          }),
        }),
      }),
    } as any);

    // Negative quantity
    const resNeg = await resolveAndPriceCatalogItems([{ itemId: 'item-1', quantity: -1 }], 'mod-1');
    expect(resNeg.validationErrors).toContain('Item 1: quantity must be at least 1');

    // Decimal quantity
    const resDec = await resolveAndPriceCatalogItems([{ itemId: 'item-1', quantity: 2.5 }], 'mod-1');
    expect(resDec.validationErrors).toContain('Item 1: quantity must be a whole number');

    // Exceeding max limit
    const resMax = await resolveAndPriceCatalogItems([{ itemId: 'item-1', quantity: 99 }], 'mod-1');
    expect(resMax.validationErrors).toContain('Item 1: quantity cannot exceed 50');
  });

  it('should reject unavailable or non-active catalog items', async () => {
    const mockCatalogRows = [
      { id: 'item-draft', name: 'Draft Item', price: 10, is_available: true, lifecycle_status: 'draft' },
      { id: 'item-soldout', name: 'Sold Out Item', price: 10, is_available: false, lifecycle_status: 'active' },
    ];

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockCatalogRows, error: null }),
          }),
        }),
      }),
    } as any);

    const result = await resolveAndPriceCatalogItems([
      { itemId: 'item-draft', quantity: 1 },
      { itemId: 'item-soldout', quantity: 1 },
    ], 'mod-1');

    expect(result.validationErrors).toContain('Item "Draft Item" is not available for ordering (status: draft)');
    expect(result.validationErrors).toContain('Item "Sold Out Item" is currently unavailable');
  });

  it('should validate customizations via customizationService and compute price adjustment', async () => {
    const mockCatalogRows = [
      { id: 'item-pizza', name: 'Pizza', price: 20, is_available: true, lifecycle_status: 'active' },
    ];

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockCatalogRows, error: null }),
          }),
        }),
      }),
    } as any);

    vi.mocked(customizationService.validateSelections).mockResolvedValue({
      isValid: true,
      totalPriceAdjustment: 4.5,
      validationErrors: [],
    } as any);

    const items: CatalogItemRequest[] = [
      {
        itemId: 'item-pizza',
        quantity: 1,
        metadata: {
          selectedModifiers: [
            { groupId: 'group-cheese', optionId: 'opt-extra-cheese', quantity: 1 },
          ],
        },
      },
    ];

    const result = await resolveAndPriceCatalogItems(items, 'mod-1', 'food');

    expect(result.validationErrors).toHaveLength(0);
    expect(result.resolvedItems[0].modifierAdjustment).toBe(4.5);
    expect(customizationService.validateSelections).toHaveBeenCalledWith(
      'catalog_item',
      'item-pizza',
      [{ groupId: 'group-cheese', optionId: 'opt-extra-cheese', quantity: 1 }]
    );
  });
});
