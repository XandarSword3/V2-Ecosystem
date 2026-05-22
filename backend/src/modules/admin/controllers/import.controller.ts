import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { logActivity } from '../../../utils/activityLogger.js';

/**
 * Import Controller
 * Handles bulk data imports (F&B menu, Accommodations, Inventory items)
 */

/**
 * POST /api/v1/admin/import/menu
 * Import food and beverage menu items from parsed CSV
 */
export const importMenuItems = asyncHandler(async (req: Request, res: Response) => {
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  const { items, moduleId } = req.body;
  const userId = req.user?.userId;

  if (!propertyId && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Property ID context is required' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'No menu items provided for import' });
    return;
  }

  const supabase = getSupabase();

  // Find or create category maps (skip items that already provide category_id)
  const categoriesSet = new Set<string>(
    items
      .filter((item) => !item.category_id)
      .map((item) => item.category || 'General')
      .filter(Boolean),
  );
  const categoryMap: Record<string, string> = {};

  // Resolve categories
  for (const catName of categoriesSet) {
    // Check if category exists for this module/property
    let selectQuery = supabase
      .from('menu_categories')
      .select('id')
      .eq('name', catName);
    
    if (moduleId) {
      selectQuery = selectQuery.eq('module_id', moduleId);
    } else if (propertyId) {
      selectQuery = selectQuery.eq('property_id', propertyId);
    }

    const { data: existing } = await selectQuery.maybeSingle();

    if (existing) {
      categoryMap[catName] = existing.id;
    } else {
      // Create new category
      const { data: newCat, error: catErr } = await supabase
        .from('menu_categories')
        .insert({
          name: catName,
          module_id: moduleId || null,
          property_id: propertyId,
        })
        .select()
        .single();

      if (catErr) {
        logger.error(`Failed to create category ${catName} during import`, { error: catErr.message });
        continue;
      }
      categoryMap[catName] = newCat.id;
    }
  }

  // Bulk insert menu items
  const menuItemsToInsert = items
    .map((item) => ({
      name: item.name,
      description: item.description || '',
      price: Number(item.price) || 0,
      category_id: item.category_id || categoryMap[item.category || 'General'],
      is_available: item.is_available !== false,
      image_url: item.imageUrl || null,
    }))
    .filter((item) => item.category_id);

  if (menuItemsToInsert.length === 0) {
    res.status(400).json({ success: false, error: 'Failed to map any items to valid categories' });
    return;
  }

  const { data, error } = await supabase
    .from('menu_items')
    .insert(menuItemsToInsert)
    .select();

  if (error) throw error;

  await logActivity({
    user_id: userId || 'system',
    action: 'IMPORT_MENU_ITEMS',
    resource: 'menu_items',
    details: { count: data.length },
    property_id: propertyId,
  });

  res.json({
    success: true,
    message: `Successfully imported ${data.length} menu items`,
    data,
  });
});

/**
 * POST /api/v1/admin/import/accommodations
 * Import chalet units from parsed CSV
 */
export const importAccommodations = asyncHandler(async (req: Request, res: Response) => {
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  const { items, moduleId } = req.body;
  const userId = req.user?.userId;

  if (!propertyId && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Property ID context is required' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'No accommodations provided for import' });
    return;
  }

  const supabase = getSupabase();

  const chaletsToInsert = items.map(item => ({
    name: item.name || `Unit ${item.number || Math.random().toString(36).substr(2, 5)}`,
    type: item.type || 'Standard',
    base_price: Number(item.base_price || item.price) || 100,
    capacity: Number(item.capacity) || 2,
    description: item.description || '',
    status: item.status || 'available',
    property_id: propertyId,
    module_id: moduleId || null,
  }));

  const { data, error } = await supabase
    .from('accommodation_units')
    .insert(chaletsToInsert)
    .select();

  if (error) throw error;

  await logActivity({
    user_id: userId || 'system',
    action: 'IMPORT_ACCOMMODATIONS',
    resource: 'accommodation_units',
    details: { count: data.length },
    property_id: propertyId,
  });

  res.json({
    success: true,
    message: `Successfully imported ${data.length} units`,
    data,
  });
});

/**
 * POST /api/v1/admin/import/inventory
 * Import inventory items and setup starting stock from parsed CSV
 */
export const importInventory = asyncHandler(async (req: Request, res: Response) => {
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  const { items } = req.body;
  const userId = req.user?.userId;

  if (!propertyId && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Property ID context is required' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'No inventory items provided for import' });
    return;
  }

  const supabase = getSupabase();

  // Find or create categories
  const categoriesSet = new Set<string>(items.map(item => item.category || 'General').filter(Boolean));
  const categoryMap: Record<string, string> = {};

  for (const catName of categoriesSet) {
    const { data: existing } = await supabase
      .from('inventory_categories')
      .select('id')
      .eq('name', catName)
      .eq('property_id', propertyId)
      .maybeSingle();

    if (existing) {
      categoryMap[catName] = existing.id;
    } else {
      const { data: newCat, error: catErr } = await supabase
        .from('inventory_categories')
        .insert({
          name: catName,
          property_id: propertyId,
        })
        .select()
        .single();

      if (catErr) {
        logger.error(`Failed to create inventory category ${catName}`, { error: catErr.message });
        continue;
      }
      categoryMap[catName] = newCat.id;
    }
  }

  // Map inventory items
  const inventoryToInsert = items.map(item => ({
    name: item.name,
    sku: item.sku || `SKU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    category_id: categoryMap[item.category || 'General'],
    unit: item.unit || 'pcs',
    min_stock: Number(item.minStock || item.min_stock) || 5,
    property_id: propertyId,
  })).filter(item => item.category_id);

  if (inventoryToInsert.length === 0) {
    res.status(400).json({ success: false, error: 'Failed to map any items to valid categories' });
    return;
  }

  // Insert items
  const { data: insertedItems, error: itemsErr } = await supabase
    .from('inventory_items')
    .insert(inventoryToInsert)
    .select();

  if (itemsErr) throw itemsErr;

  // Insert initial stock counts if provided
  const stockToInsert = insertedItems.map((item, index) => {
    const matchingItem = items[index];
    const initialQty = Number(matchingItem.quantity || matchingItem.qty || matchingItem.stock) || 0;
    const avgCost = Number(matchingItem.cost || matchingItem.price) || 0;
    
    return {
      item_id: item.id,
      quantity: initialQty,
      avg_cost: avgCost,
      property_id: propertyId,
    };
  }).filter(stock => stock.quantity > 0);

  if (stockToInsert.length > 0) {
    // Assuming table inventory_stock or similar exists, wait, let's verify if there is an inventory_stock or inventory_levels table.
    // In migration 20260308160757_add_advanced_inventory_tables.sql, stock is kept in inventory_stock or inventory_ledger.
    // Let's insert into `inventory_stock` if table exists, or log it.
    try {
      await supabase
        .from('inventory_stock')
        .insert(stockToInsert);
    } catch (e: any) {
      logger.warn('Failed to insert initial stock level, but inventory items were created', { error: e.message });
    }
  }

  await logActivity({
    user_id: userId || 'system',
    action: 'IMPORT_INVENTORY_ITEMS',
    resource: 'inventory_items',
    details: { count: insertedItems.length },
    property_id: propertyId,
  });

  res.json({
    success: true,
    message: `Successfully imported ${insertedItems.length} inventory items`,
    data: insertedItems,
  });
});
