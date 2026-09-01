import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { customizationService } from '../modules/customization/services/customization.service.js';
import { resolveTaxCategory } from './tax.service.js';

export interface CatalogItemRequest {
  catalog_item_id?: string;
  menuItemId?: string;
  itemId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface ResolvedCatalogItem {
  itemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  modifierAdjustment: number;
  taxCategory: string;
  metadata?: Record<string, unknown>;
}

export interface CatalogPricingResult {
  resolvedItems: ResolvedCatalogItem[];
  nameMap: Map<string, string>;
  priceMap: Map<string, number>;
  validationErrors: string[];
}

/**
 * Shared resolve-and-price function for catalog items.
 * 
 * This is the single source of truth for:
 * 1. Resolving catalog item IDs from various field names
 * 2. Fetching server-side prices from the database
 * 3. Validating modifiers and computing their price adjustments
 * 4. Hard-failing on unresolved catalog items or invalid modifiers
 * 
 * Both the order endpoint (dynamic-module.router.ts) and the preview endpoint
 * (pricing.controller.ts) must use this function to ensure pricing consistency.
 */
export async function resolveAndPriceCatalogItems(
  items: CatalogItemRequest[],
  moduleId: string,
  moduleTaxCategory?: string | null
): Promise<CatalogPricingResult> {
  const supabase = getSupabase();
  const validationErrors: string[] = [];

  // Resolve item IDs from various field names
  const itemIds = items
    .map((item) => {
      return item.catalog_item_id || item.menuItemId || item.itemId;
    })
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (itemIds.length === 0 && items.length > 0) {
    return {
      resolvedItems: [],
      nameMap: new Map(),
      priceMap: new Map(),
      validationErrors: ['No valid catalog item IDs provided'],
    };
  }

  // Fetch catalog items from database
  const { data: catalogRows, error: catalogError } = await supabase
    .from('catalog_items')
    .select('id, name, price')
    .eq('module_id', moduleId)
    .in('id', itemIds);

  if (catalogError) {
    logger.error('[CatalogPricing] Failed to fetch catalog items', { error: catalogError, moduleId, itemIds });
    throw new Error(`Failed to fetch catalog items: ${catalogError.message}`);
  }

  // Build price and name maps from catalog_items
  const priceMap = new Map<string, number>((catalogRows ?? []).map((row) => [row.id, Number(row.price)]));
  const nameMap = new Map<string, string>((catalogRows ?? []).map((row) => [row.id, row.name as string]));

  // If some items were not found in catalog_items, check bookable_units and accommodation_add_ons
  const remainingIds = itemIds.filter((id) => !priceMap.has(id));
  if (remainingIds.length > 0) {
    const { data: unitRows } = await supabase
      .from('bookable_units')
      .select('id, name, base_price, price')
      .in('id', remainingIds);
    (unitRows ?? []).forEach((row: any) => {
      priceMap.set(row.id, Number(row.base_price ?? row.price ?? 0));
      nameMap.set(row.id, row.name as string);
    });

    const stillRemaining = itemIds.filter((id) => !priceMap.has(id));
    if (stillRemaining.length > 0) {
      const { data: addOnRows } = await supabase
        .from('accommodation_add_ons')
        .select('id, name, price')
        .in('id', stillRemaining);
      (addOnRows ?? []).forEach((row: any) => {
        priceMap.set(row.id, Number(row.price ?? 0));
        nameMap.set(row.id, row.name as string);
      });
    }
  }

  // FIX 0: Hard-fail on unresolved catalog items
  const unknownIds = itemIds.filter((id) => !priceMap.has(id));
  if (unknownIds.length > 0) {
    logger.error('[CatalogPricing] Unresolved catalog item IDs', { unknownIds, moduleId });
    validationErrors.push(`Unknown catalog item(s): ${unknownIds.join(', ')}`);
    return {
      resolvedItems: [],
      nameMap,
      priceMap,
      validationErrors,
    };
  }

  // Fetch module's tax category if not provided
  let taxCategory = moduleTaxCategory;
  if (!taxCategory) {
    const { data: module } = await supabase
      .from('modules')
      .select('tax_category')
      .eq('id', moduleId)
      .maybeSingle();
    taxCategory = module?.tax_category ?? 'all';
  }

  // Validate modifiers and compute adjustments
  const modifierAdjustmentByIndex = new Map<number, number>();
  
  await Promise.all(items.map(async (item, index) => {
    const resolvedId = item.catalog_item_id || item.menuItemId || item.itemId || '';
    const rawSelections = Array.isArray(item.metadata?.selectedModifiers)
      ? item.metadata!.selectedModifiers as Array<Record<string, unknown>>
      : [];
    
    if (rawSelections.length === 0) return;

    const selections = rawSelections
      .map((m) => ({
        groupId: String(m.groupId ?? ''),
        optionId: String(m.optionId ?? ''),
        quantity: Number(m.quantity) || 1,
      }))
      .filter((s) => s.optionId.length > 0);

    if (selections.length === 0) return;

    try {
      const result = await customizationService.validateSelections('catalog_item', resolvedId, selections);
      
      // FIX 0B: Hard-fail on modifier validation failure
      if (!result.isValid) {
        validationErrors.push(...result.validationErrors.map((e) => `${resolvedId}: ${e}`));
        return;
      }
      
      modifierAdjustmentByIndex.set(index, result.totalPriceAdjustment);
    } catch (err) {
      logger.error('[CatalogPricing] Failed to validate item customizations', {
        itemId: resolvedId,
        error: err instanceof Error ? err.message : String(err),
      });
      validationErrors.push(`${resolvedId}: failed to validate customizations`);
    }
  }));

  if (validationErrors.length > 0) {
    return {
      resolvedItems: [],
      nameMap,
      priceMap,
      validationErrors,
    };
  }

  // Build resolved items with server-validated prices
  const resolvedItems: ResolvedCatalogItem[] = items.map((item, index) => {
    const resolvedId = item.catalog_item_id || item.menuItemId || item.itemId || '';
    const basePrice = priceMap.get(resolvedId) ?? 0;
    const modifierAdjustment = modifierAdjustmentByIndex.get(index) ?? 0;
    const quantity = Number(item.quantity) || 1;

    // Create a minimal PricingLineItem for tax category resolution
    const pricingLineItemForTax = {
      itemId: resolvedId,
      name: nameMap.get(resolvedId) || 'Item',
      unitPrice: basePrice,
      quantity,
      metadata: item.metadata || {},
    };

    const lineItem = {
      itemId: resolvedId,
      name: nameMap.get(resolvedId) || `catalog_item:${resolvedId}`,
      basePrice,
      quantity,
      modifierAdjustment,
      taxCategory: resolveTaxCategory(pricingLineItemForTax, taxCategory || 'all'),
      metadata: item.metadata || {},
    };

    return lineItem;
  });

  return {
    resolvedItems,
    nameMap,
    priceMap,
    validationErrors,
  };
}
