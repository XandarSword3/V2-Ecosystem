import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/menu-import.parser.js';
import * as menuService from '../services/menu.service.js';
import { CommitImportRequest, ImportedMenuItem, ModifierOption, ModifierGroup } from '../types/menu-import.types.js';
import { logger } from '../../../utils/logger.js';
import { getSupabase } from '../../../database/connection.js';

/**
 * Handles initial parsing of menu data from various sources
 */
export const parseImport = asyncHandler(async (req: Request, res: Response) => {
  let result: { items: unknown[]; warnings: string[]; errors: string[]; totalParsed: number; successful: number } | null = null;
  try {
    if (req.file) {
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      
      if (mimeType === 'application/json' || req.file.originalname.endsWith('.json')) {
        result = parser.parseJsonImport(JSON.parse(buffer.toString()));
      } else if (mimeType === 'text/csv' || req.file.originalname.endsWith('.csv')) {
        result = await parser.parseCsvImport(buffer);
      } else {
        return res.status(400).json({ success: false, errors: ['Unsupported file type. Use JSON or CSV.'] });
      }
    } else if (req.body.text) {
      result = await parser.parseLlmImport(req.body.text);
    } else if (req.body.json) {
      result = parser.parseJsonImport(req.body.json);
    } else {
      return res.status(400).json({ success: false, errors: ['No data provided for parsing.'] });
    }

    if (result.successful === 0 && result.errors.length > 0) {
      return res.status(422).json({ success: false, ...result });
    }

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    logger.error('Import Parse Controller Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Helper to find or create inventory item by name
 */
async function findOrCreateInventoryItem(
  supabase: ReturnType<typeof getSupabase>,
  name: string,
  unit: string,
  warnings: string[]
): Promise<string | null> {
  // Search existing inventory item by name (case-insensitive)
  const { data: existing } = await supabase
    .from('inventory_items')
    .select('id, name, current_stock')
    .ilike('name', name)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new inventory item with 0 stock
  const { data: newItem, error } = await supabase
    .from('inventory_items')
    .insert({
      name,
      unit,
      current_stock: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    logger.error(`Failed to create inventory item ${name}:`, error);
    warnings.push(`${name}: created with 0 stock — set opening stock in Inventory`);
    return null;
  }

  warnings.push(`${name}: created with 0 stock — set opening stock in Inventory`);
  return newItem.id;
}

/**
 * Helper to create modifier groups and options for a menu item
 */
async function createModifiersForItem(
  supabase: ReturnType<typeof getSupabase>,
  menuItemId: string,
  modifiers: ModifierGroup[] | undefined,
  moduleId: string,
  ingredientMap: Map<string, string>, // name -> inventory_item_id
  warnings: string[]
): Promise<void> {
  if (!modifiers || modifiers.length === 0) return;

  const groupIds: { groupId: string; sortOrder: number }[] = [];

  for (let i = 0; i < modifiers.length; i++) {
    const group = modifiers[i];

    // Create modifier group
    const { data: groupData, error: groupError } = await supabase
      .from('menu_modifier_groups')
      .insert({
        name: group.name,
        is_required: group.is_required,
        min_selections: 0,
        max_selections: 1,
        module_id: moduleId,
        display_order: i,
      })
      .select()
      .single();

    if (groupError || !groupData) {
      logger.error(`Failed to create modifier group ${group.name}:`, groupError);
      warnings.push(`Modifier group "${group.name}" failed to create`);
      continue;
    }

    groupIds.push({ groupId: groupData.id, sortOrder: i });

    // Create options for this group
    if (group.options && group.options.length > 0) {
      const optionsData = group.options.map((opt: ModifierOption, idx: number) => {
        // Check if this option should link to an inventory item
        let inventoryItemId: string | null = null;
        let quantityRequired = 1;

        if (opt.inventoryItemName) {
          const linkedId = ingredientMap.get(opt.inventoryItemName.toLowerCase());
          if (linkedId) {
            inventoryItemId = linkedId;
            // Find matching ingredient for quantity
            const matchingIngredient = opt.inventoryItemName ? 
              { name: opt.inventoryItemName, estimatedQuantity: opt.price ? 1 : 1 } : null;
            if (matchingIngredient) {
              quantityRequired = matchingIngredient.estimatedQuantity || 1;
            }
          }
        }

        return {
          modifier_group_id: groupData.id,
          name: opt.name,
          price_adjustment: opt.price || 0,
          is_available: true,
          modifier_type: opt.modifierType || 'add',
          inventory_item_id: inventoryItemId,
          quantity_required: quantityRequired,
          unit: 'pcs',
          display_order: idx,
        };
      });

      const { error: optionsError } = await supabase
        .from('menu_modifier_options')
        .insert(optionsData);

      if (optionsError) {
        logger.error(`Failed to create modifier options for group ${group.name}:`, optionsError);
        warnings.push(`Some options for "${group.name}" failed to create`);
      }
    }
  }

  // Link modifier groups to menu item
  if (groupIds.length > 0) {
    const { error: linkError } = await supabase
      .from('menu_item_modifiers')
      .insert(
        groupIds.map(({ groupId, sortOrder }) => ({
          menu_item_id: menuItemId,
          modifier_group_id: groupId,
          sort_order: sortOrder,
        }))
      );

    if (linkError) {
      logger.error(`Failed to link modifiers to menu item ${menuItemId}:`, linkError);
      warnings.push(`Modifiers created but not linked to item`);
    }
  }
}

/**
 * Commits the approved items to the database
 * Includes: menu items, modifiers, and inventory BOM linking
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { moduleId, items, categoryMap } = req.body as CommitImportRequest;

  if (!moduleId || !items || !categoryMap) {
    return res.status(400).json({ success: false, error: 'Missing required commit data' });
  }

  const supabase = getSupabase();

  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
    inventoryCreated: 0,
    inventoryLinked: 0,
    inventoryWarnings: [] as string[],
  };

  // 1. Create categories that don't exist yet
  const resolvedCategoryMap: Record<string, string> = {};
  for (const [name, id] of Object.entries(categoryMap)) {
    if (id) {
      resolvedCategoryMap[name] = id;
    } else {
      try {
        const newCat = await menuService.createCategory({ name, moduleId });
        resolvedCategoryMap[name] = newCat.id;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to create category ${name}:`, err);
        results.errors.push(`Category ${name}: ${errMsg}`);
      }
    }
  }

  // 2. Process each item: create menu item, modifiers, inventory links
  const importPromises = items.map(async (item: ImportedMenuItem) => {
    const categoryId = resolvedCategoryMap[item.category];
    if (!categoryId) {
      throw new Error(`Category ${item.category} not found or failed to create`);
    }

    // Build ingredient map for this item (name -> inventory_item_id)
    const ingredientMap = new Map<string, string>();

    // Process ingredients: find or create inventory items
    if (item.ingredients && item.ingredients.length > 0) {
      for (const ingredient of item.ingredients) {
        const inventoryId = await findOrCreateInventoryItem(
          supabase,
          ingredient.name,
          ingredient.estimatedUnit,
          results.inventoryWarnings
        );

        if (inventoryId) {
          ingredientMap.set(ingredient.name.toLowerCase(), inventoryId);
          results.inventoryCreated++;
        }
      }
    }

    // Create the menu item
    const menuItem = await menuService.createMenuItem({
      name: item.name,
      price: item.price,
      description: item.description,
      categoryId,
      moduleId,
      isAvailable: item.is_available,
      discountPrice: item.discount_price,
      preparationTimeMinutes: item.preparation_time,
      calories: item.calories,
      allergens: item.allergens,
    });

    // Create inventory BOM links for ingredients
    if (item.ingredients && item.ingredients.length > 0) {
      for (const ingredient of item.ingredients) {
        const inventoryId = ingredientMap.get(ingredient.name.toLowerCase());
        if (inventoryId && menuItem.id) {
          const { error: bomError } = await supabase
            .from('inventory_bom')
            .insert({
              menu_item_id: menuItem.id,
              inventory_item_id: inventoryId,
              quantity: ingredient.estimatedQuantity,
            });

          if (bomError) {
            logger.error(`Failed to create BOM link for ${ingredient.name}:`, bomError);
            results.inventoryWarnings.push(`Failed to link ${ingredient.name} to ${item.name}`);
          } else {
            results.inventoryLinked++;
          }
        }
      }
    }

    // Create modifiers and link to inventory where applicable
    if (item.modifiers && item.modifiers.length > 0 && menuItem.id) {
      await createModifiersForItem(
        supabase,
        menuItem.id,
        item.modifiers,
        moduleId,
        ingredientMap,
        results.inventoryWarnings
      );
    }

    return menuItem;
  });

  const settleResults = await Promise.allSettled(importPromises);

  settleResults.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      results.created++;
    } else {
      results.failed++;
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
      results.errors.push(`${items[idx]?.name || `Item ${idx + 1}`}: ${reason}`);
    }
  });

  res.json({ success: true, data: results });
});
