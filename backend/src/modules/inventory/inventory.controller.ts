import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';

// Validation schemas
const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  unit: z.enum(['piece', 'kg', 'liter', 'box', 'pack', 'bottle']).default('piece'),
  currentStock: z.number().min(0).default(0),
  minStockLevel: z.number().min(0).default(10),
  maxStockLevel: z.number().min(0).optional(),
  reorderPoint: z.number().min(0).default(5),
  costPerUnit: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateItemSchema = createItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const transactionSchema = z.object({
  itemId: z.string().uuid(),
  type: z.enum(['in', 'out', 'adjustment', 'waste', 'return']),
  quantity: z.number().positive(),
  reason: z.string().optional(),
  referenceType: z.enum(['purchase', 'order', 'manual', 'waste', 'return']).default('manual'),
  referenceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const bulkTransactionSchema = z.object({
  transactions: z.array(transactionSchema),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export class InventoryController {
  /**
   * Get all categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      
      const { data: categories, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      // Get item counts for each category
      const { data: items } = await supabase
        .from('inventory_items')
        .select('category_id, current_stock')
        .eq('is_active', true);

      const categoryStats = (categories || []).map(cat => {
        const catItems = (items || []).filter(i => i.category_id === cat.id);
        return {
          ...cat,
          item_count: catItems.length,
          total_stock: catItems.reduce((sum, i) => sum + parseFloat(i.current_stock || 0), 0),
        };
      });

      res.json({
        success: true,
        data: categoryStats,
      });
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch categories',
        message: error.message,
      });
    }
  }

  /**
   * Create a category
   */
  async createCategory(req: Request, res: Response) {
    try {
      const validation = createCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const supabase = getSupabase();

      const { data: result, error } = await supabase
        .from('inventory_categories')
        .insert({
          name: data.name,
          description: data.description,
          color: data.color,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error creating category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create category',
        message: error.message,
      });
    }
  }

  /**
   * Update a category
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = createCategorySchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const supabase = getSupabase();

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (data.name) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.color) updates.color = data.color;

      if (Object.keys(updates).length === 1) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      const { data: result, error } = await supabase
        .from('inventory_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error updating category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update category',
        message: error.message,
      });
    }
  }

  /**
   * Get all inventory items
   */
  async getItems(req: Request, res: Response) {
    try {
      const { 
        page = '1', 
        limit = '50', 
        categoryId, 
        search, 
        lowStock,
        outOfStock,
        expiringSoon,
        sortBy = 'name',
        sortOrder = 'asc',
      } = req.query;
      
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const supabase = getSupabase();

      let query = supabase
        .from('inventory_items')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

      if (categoryId) {
        query = query.eq('category_id', categoryId as string);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      if (lowStock === 'true') {
        query = query.gt('current_stock', 0).lte('current_stock', 'reorder_point');
      }

      if (outOfStock === 'true') {
        query = query.eq('current_stock', 0);
      }

      if (expiringSoon === 'true') {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        query = query
          .not('expiry_date', 'is', null)
          .lte('expiry_date', sevenDaysFromNow.toISOString());
      }

      // Sorting
      const allowedSorts = ['name', 'current_stock', 'updated_at'];
      const sortField = allowedSorts.includes(sortBy as string) ? sortBy as string : 'name';
      
      const { data: items, error, count } = await query
        .order(sortField, { ascending: sortOrder !== 'desc' })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      // Get category info
      const categoryIds = [...new Set((items || []).map(i => i.category_id).filter(Boolean))];
      let categoriesMap: Record<string, any> = {};
      if (categoryIds.length > 0) {
        const { data: categories } = await supabase
          .from('inventory_categories')
          .select('id, name, color')
          .in('id', categoryIds);
        categoriesMap = (categories || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, any>);
      }

      // Add stock status and category info
      const enrichedItems = (items || []).map(item => ({
        ...item,
        category_name: categoriesMap[item.category_id]?.name,
        category_color: categoriesMap[item.category_id]?.color,
        stock_status: item.current_stock === 0 ? 'out_of_stock'
          : item.current_stock <= item.reorder_point ? 'low_stock'
          : item.max_stock_level && item.current_stock > item.max_stock_level ? 'overstock'
          : 'normal',
      }));

      res.json({
        success: true,
        data: enrichedItems,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
        },
      });
    } catch (error: any) {
      console.error('Error fetching items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch items',
        message: error.message,
      });
    }
  }

  /**
   * Get single item details
   */
  async getItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supabase = getSupabase();

      const { data: item, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !item) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      // Get category
      let categoryInfo = null;
      if (item.category_id) {
        const { data: category } = await supabase
          .from('inventory_categories')
          .select('name, color')
          .eq('id', item.category_id)
          .single();
        categoryInfo = category;
      }

      // Get recent transactions
      const { data: transactions } = await supabase
        .from('inventory_transactions')
        .select('*')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get user names for transactions
      const userIds = [...new Set((transactions || []).map(t => t.performed_by).filter(Boolean))];
      let usersMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, full_name').in('id', userIds);
        usersMap = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);
      }

      // Map DB field names to frontend expected names
      const dbTypeToApiType: Record<string, string> = {
        purchase: 'in',
        sale: 'out',
        adjustment: 'adjustment',
        waste: 'waste',
        return: 'return',
      };

      const enrichedTransactions = (transactions || []).map(t => ({
        id: t.id,
        item_id: t.item_id,
        type: dbTypeToApiType[t.transaction_type] || t.transaction_type,
        quantity: Math.abs(t.quantity),
        previous_stock: t.stock_before,
        new_stock: t.stock_after,
        reference_type: t.reference_type,
        notes: t.notes,
        performed_by_name: usersMap[t.performed_by]?.full_name,
        created_at: t.created_at,
      }));

      // Get linked menu items
      const { data: linkedMenuItems } = await supabase
        .from('menu_item_ingredients')
        .select('menu_item_id, quantity_needed')
        .eq('inventory_item_id', id);

      let menuItemsInfo: any[] = [];
      if (linkedMenuItems && linkedMenuItems.length > 0) {
        const menuItemIds = linkedMenuItems.map(l => l.menu_item_id);
        const { data: menuItems } = await supabase
          .from('menu_items')
          .select('id, name')
          .in('id', menuItemIds);
        
        menuItemsInfo = (linkedMenuItems || []).map(link => ({
          id: link.menu_item_id,
          name: menuItems?.find(m => m.id === link.menu_item_id)?.name,
          quantity_needed: link.quantity_needed,
        }));
      }

      res.json({
        success: true,
        data: {
          ...item,
          category_name: categoryInfo?.name,
          category_color: categoryInfo?.color,
          transactions: enrichedTransactions,
          linkedMenuItems: menuItemsInfo,
        },
      });
    } catch (error: any) {
      console.error('Error fetching item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch item',
        message: error.message,
      });
    }
  }

  /**
   * Create an inventory item
   */
  async createItem(req: Request, res: Response) {
    try {
      const validation = createItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const userId = (req as any).user?.id;
      const supabase = getSupabase();

      // Generate SKU if not provided
      let sku = data.sku;
      if (!sku) {
        const prefix = data.name.substring(0, 3).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        sku = `${prefix}-${random}`;
      }

      const { data: result, error } = await supabase
        .from('inventory_items')
        .insert({
          name: data.name,
          sku,
          description: data.description,
          category_id: data.categoryId,
          unit: data.unit,
          current_stock: data.currentStock,
          min_stock_level: data.minStockLevel,
          max_stock_level: data.maxStockLevel,
          reorder_point: data.reorderPoint,
          cost_per_unit: data.costPerUnit,
          supplier: data.supplier,
          location: data.location,
          expiry_date: data.expiryDate,
          notes: data.notes,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // Record initial stock transaction if stock > 0
      if (data.currentStock > 0) {
        await supabase.from('inventory_transactions').insert({
          item_id: result.id,
          transaction_type: 'purchase',
          quantity: data.currentStock,
          stock_before: 0,
          stock_after: data.currentStock,
          reference_type: 'manual',
          notes: 'Initial stock',
          performed_by: userId,
        });
      }

      // Check for low stock alert
      if (data.currentStock <= data.reorderPoint) {
        await this.createStockAlert(result.id, 'low_stock', data.currentStock);
      }

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error creating item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create item',
        message: error.message,
      });
    }
  }

  /**
   * Update an inventory item
   */
  async updateItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = updateItemSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const supabase = getSupabase();

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) updates.name = data.name;
      if (data.sku !== undefined) updates.sku = data.sku;
      if (data.description !== undefined) updates.description = data.description;
      if (data.categoryId !== undefined) updates.category_id = data.categoryId;
      if (data.unit !== undefined) updates.unit = data.unit;
      if (data.minStockLevel !== undefined) updates.min_stock_level = data.minStockLevel;
      if (data.maxStockLevel !== undefined) updates.max_stock_level = data.maxStockLevel;
      if (data.reorderPoint !== undefined) updates.reorder_point = data.reorderPoint;
      if (data.costPerUnit !== undefined) updates.cost_per_unit = data.costPerUnit;
      if (data.supplier !== undefined) updates.supplier = data.supplier;
      if (data.location !== undefined) updates.location = data.location;
      if (data.expiryDate !== undefined) updates.expiry_date = data.expiryDate;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.isActive !== undefined) updates.is_active = data.isActive;

      if (Object.keys(updates).length === 1) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      const { data: result, error } = await supabase
        .from('inventory_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error updating item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update item',
        message: error.message,
      });
    }
  }

  /**
   * Delete/Deactivate an inventory item
   */
  async deleteItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supabase = getSupabase();

      // Soft delete
      const { error } = await supabase
        .from('inventory_items')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Item deactivated successfully',
      });
    } catch (error: any) {
      console.error('Error deleting item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete item',
        message: error.message,
      });
    }
  }

  /**
   * Record a stock transaction
   */
  async recordTransaction(req: Request, res: Response) {
    try {
      const validation = transactionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const userId = (req as any).user?.id;
      const supabase = getSupabase();

      // Get current stock
      const { data: item, error: itemError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', data.itemId)
        .single();

      if (itemError || !item) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      const currentStock = parseFloat(item.current_stock);
      let newStock = currentStock;

      // Calculate new stock based on transaction type
      switch (data.type) {
        case 'in':
        case 'return':
          newStock = currentStock + data.quantity;
          break;
        case 'out':
        case 'waste':
          if (currentStock < data.quantity) {
            return res.status(400).json({
              success: false,
              error: `Insufficient stock. Available: ${currentStock}`,
            });
          }
          newStock = currentStock - data.quantity;
          break;
        case 'adjustment':
          newStock = data.quantity; // Direct set
          break;
      }

      // Record transaction
      // Map API types to DB transaction_type: in→purchase, out→sale
      const dbTransactionType = data.type === 'in' ? 'purchase' : data.type === 'out' ? 'sale' : data.type;
      
      const { data: transaction, error: txError } = await supabase
        .from('inventory_transactions')
        .insert({
          item_id: data.itemId,
          transaction_type: dbTransactionType,
          quantity: data.quantity,
          stock_before: currentStock,
          stock_after: newStock,
          reference_type: data.referenceType,
          reference_id: data.referenceId,
          notes: data.notes || data.reason,
          performed_by: userId,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update item stock
      const updateData: Record<string, any> = {
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      };
      if (data.type === 'in') {
        updateData.last_restocked_at = new Date().toISOString();
      }

      await supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', data.itemId);

      // Check for alerts
      const reorderPoint = parseFloat(item.reorder_point);
      if (newStock === 0) {
        await this.createStockAlert(data.itemId, 'out_of_stock', newStock);
      } else if (newStock <= reorderPoint) {
        await this.createStockAlert(data.itemId, 'low_stock', newStock);
      }

      res.status(201).json({
        success: true,
        data: {
          transaction,
          newStock,
        },
      });
    } catch (error: any) {
      console.error('Error recording transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record transaction',
        message: error.message,
      });
    }
  }

  /**
   * Bulk stock transactions
   */
  async bulkTransaction(req: Request, res: Response) {
    try {
      const validation = bulkTransactionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { transactions } = validation.data;
      const userId = (req as any).user?.id;
      const supabase = getSupabase();
      const results: any[] = [];
      const errors: any[] = [];

      for (const txn of transactions) {
        try {
          // Get current stock
          const { data: item } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('id', txn.itemId)
            .single();

          if (!item) {
            errors.push({ itemId: txn.itemId, error: 'Item not found' });
            continue;
          }

          const currentStock = parseFloat(item.current_stock);
          let newStock = currentStock;

          switch (txn.type) {
            case 'in':
            case 'return':
              newStock = currentStock + txn.quantity;
              break;
            case 'out':
            case 'waste':
              if (currentStock < txn.quantity) {
                errors.push({ itemId: txn.itemId, error: `Insufficient stock: ${currentStock}` });
                continue;
              }
              newStock = currentStock - txn.quantity;
              break;
            case 'adjustment':
              newStock = txn.quantity;
              break;
          }

          // Record transaction
          await supabase.from('inventory_transactions').insert({
            item_id: txn.itemId,
            transaction_type: txn.type === 'in' ? 'purchase' : txn.type === 'out' ? 'sale' : txn.type,
            quantity: txn.quantity,
            stock_before: currentStock,
            stock_after: newStock,
            reference_type: txn.referenceType,
            notes: txn.notes,
            performed_by: userId,
          });

          // Update stock
          await supabase
            .from('inventory_items')
            .update({ 
              current_stock: newStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', txn.itemId);

          results.push({ itemId: txn.itemId, newStock });
        } catch (err: any) {
          errors.push({ itemId: txn.itemId, error: err.message });
        }
      }

      res.json({
        success: errors.length === 0,
        data: {
          processed: results.length,
          errors: errors.length,
          results,
          errorDetails: errors,
        },
      });
    } catch (error: any) {
      console.error('Error in bulk transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process bulk transaction',
        message: error.message,
      });
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(req: Request, res: Response) {
    try {
      const { page = '1', limit = '50', itemId, type, startDate, endDate } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const supabase = getSupabase();

      let query = supabase
        .from('inventory_transactions')
        .select('*');

      if (itemId) {
        query = query.eq('item_id', itemId as string);
      }

      if (type) {
        query = query.eq('type', type as string);
      }

      if (startDate) {
        query = query.gte('created_at', startDate as string);
      }

      if (endDate) {
        query = query.lte('created_at', endDate as string);
      }

      const { data: transactions, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      // Enrich with item and user info
      const itemIds = [...new Set((transactions || []).map(t => t.item_id).filter(Boolean))];
      const userIds = [...new Set((transactions || []).map(t => t.performed_by).filter(Boolean))];

      const [itemsResult, usersResult] = await Promise.all([
        itemIds.length > 0 
          ? supabase.from('inventory_items').select('id, name, sku').in('id', itemIds)
          : { data: [] },
        userIds.length > 0 
          ? supabase.from('users').select('id, full_name').in('id', userIds)
          : { data: [] },
      ]);

      const itemsMap = ((itemsResult.data || []) as any[]).reduce((acc, i) => { acc[i.id] = i; return acc; }, {} as Record<string, any>);
      const usersMap = ((usersResult.data || []) as any[]).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);

      // Map DB field names to frontend expected names
      // DB: transaction_type (purchase/sale/etc), stock_before, stock_after
      // Frontend: type (in/out/etc), previous_stock, new_stock
      const dbTypeToApiType: Record<string, string> = {
        purchase: 'in',
        sale: 'out',
        adjustment: 'adjustment',
        waste: 'waste',
        return: 'return',
      };

      const enrichedTransactions = (transactions || []).map(t => ({
        id: t.id,
        item_id: t.item_id,
        item_name: itemsMap[t.item_id]?.name,
        sku: itemsMap[t.item_id]?.sku,
        type: dbTypeToApiType[t.transaction_type] || t.transaction_type,
        quantity: Math.abs(t.quantity), // Always show positive quantity, sign is indicated by type
        previous_stock: t.stock_before,
        new_stock: t.stock_after,
        reference_type: t.reference_type,
        notes: t.notes,
        performed_by_name: usersMap[t.performed_by]?.full_name,
        created_at: t.created_at,
      }));

      res.json({
        success: true,
        data: enrichedTransactions,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        },
      });
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: error.message,
      });
    }
  }

  /**
   * Get alerts
   */
  async getAlerts(req: Request, res: Response) {
    try {
      const { resolved = 'false' } = req.query;
      const supabase = getSupabase();

      const { data: alerts, error } = await supabase
        .from('inventory_alerts')
        .select('*')
        .eq('is_resolved', resolved === 'true')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with item info
      const itemIds = [...new Set((alerts || []).map(a => a.item_id).filter(Boolean))];
      let itemsMap: Record<string, any> = {};
      if (itemIds.length > 0) {
        const { data: items } = await supabase
          .from('inventory_items')
          .select('id, name, sku, current_stock')
          .in('id', itemIds);
        itemsMap = (items || []).reduce((acc, i) => { acc[i.id] = i; return acc; }, {} as Record<string, any>);
      }

      const enrichedAlerts = (alerts || []).map(alert => ({
        ...alert,
        item_name: itemsMap[alert.item_id]?.name,
        sku: itemsMap[alert.item_id]?.sku,
        current_stock: itemsMap[alert.item_id]?.current_stock,
      }));

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      enrichedAlerts.sort((a, b) => 
        (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - 
        (priorityOrder[b.priority as keyof typeof priorityOrder] || 4)
      );

      res.json({
        success: true,
        data: enrichedAlerts,
      });
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts',
        message: error.message,
      });
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const supabase = getSupabase();

      const { error } = await supabase
        .from('inventory_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        })
        .eq('id', id);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Alert resolved',
      });
    } catch (error: any) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve alert',
        message: error.message,
      });
    }
  }

  /**
   * Get inventory statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      // Get all items
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true);

      if (itemsError) throw itemsError;

      const allItems = items || [];
      const summary = {
        total_items: allItems.length,
        out_of_stock: allItems.filter(i => parseFloat(i.current_stock) === 0).length,
        low_stock: allItems.filter(i => 
          parseFloat(i.current_stock) > 0 && 
          parseFloat(i.current_stock) <= parseFloat(i.reorder_point)
        ).length,
        overstock: allItems.filter(i => 
          i.max_stock_level && parseFloat(i.current_stock) > parseFloat(i.max_stock_level)
        ).length,
        total_value: allItems.reduce((sum, i) => 
          sum + (parseFloat(i.current_stock) * parseFloat(i.cost_per_unit || 0)), 0
        ),
      };

      // Get categories
      const { data: categories } = await supabase
        .from('inventory_categories')
        .select('*');

      const categoryBreakdown = (categories || []).map(cat => {
        const catItems = allItems.filter(i => i.category_id === cat.id);
        return {
          name: cat.name,
          color: cat.color,
          items: catItems.length,
          stock: catItems.reduce((sum, i) => sum + parseFloat(i.current_stock), 0),
          value: catItems.reduce((sum, i) => 
            sum + (parseFloat(i.current_stock) * parseFloat(i.cost_per_unit || 0)), 0
          ),
        };
      }).sort((a, b) => b.value - a.value);

      // Get recent transactions
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentTransactions } = await supabase
        .from('inventory_transactions')
        .select('type, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Group by date
      const activityByDate: Record<string, any> = {};
      (recentTransactions || []).forEach(t => {
        const date = t.created_at.split('T')[0];
        if (!activityByDate[date]) {
          activityByDate[date] = { date, stock_in: 0, stock_out: 0, waste: 0 };
        }
        if (t.type === 'in') activityByDate[date].stock_in++;
        else if (t.type === 'out') activityByDate[date].stock_out++;
        else if (t.type === 'waste') activityByDate[date].waste++;
      });

      const recentActivity = Object.values(activityByDate)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Get expiring items
      const fourteenDaysFromNow = new Date();
      fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
      
      const expiringItems = allItems
        .filter(i => i.expiry_date && new Date(i.expiry_date) <= fourteenDaysFromNow)
        .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
        .slice(0, 10)
        .map(i => ({
          id: i.id,
          name: i.name,
          sku: i.sku,
          expiry_date: i.expiry_date,
          current_stock: i.current_stock,
        }));

      // Get unresolved alerts count
      const { count: unresolvedAlerts } = await supabase
        .from('inventory_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_resolved', false);

      res.json({
        success: true,
        data: {
          summary: {
            ...summary,
            unresolvedAlerts: unresolvedAlerts || 0,
          },
          categoryBreakdown,
          recentActivity,
          expiringItems,
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message,
      });
    }
  }

  /**
   * Generate inventory report
   */
  async generateReport(req: Request, res: Response) {
    try {
      const { format = 'json', categoryId } = req.query;
      const supabase = getSupabase();

      let query = supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true);

      if (categoryId) {
        query = query.eq('category_id', categoryId as string);
      }

      const { data: items, error } = await query.order('name', { ascending: true });

      if (error) throw error;

      // Get categories
      const categoryIds = [...new Set((items || []).map(i => i.category_id).filter(Boolean))];
      let categoriesMap: Record<string, any> = {};
      if (categoryIds.length > 0) {
        const { data: categories } = await supabase
          .from('inventory_categories')
          .select('id, name')
          .in('id', categoryIds);
        categoriesMap = (categories || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, any>);
      }

      const enrichedItems = (items || []).map(item => ({
        ...item,
        category: categoriesMap[item.category_id]?.name,
        total_value: parseFloat(item.current_stock) * parseFloat(item.cost_per_unit || 0),
        status: item.current_stock === 0 ? 'OUT OF STOCK'
          : parseFloat(item.current_stock) <= parseFloat(item.reorder_point) ? 'LOW STOCK'
          : 'IN STOCK',
      }));

      if (format === 'csv') {
        const headers = ['Name', 'SKU', 'Category', 'Unit', 'Stock', 'Min Level', 'Reorder Point', 'Cost', 'Value', 'Status'];
        const csv = [
          headers.join(','),
          ...enrichedItems.map(item => [
            `"${item.name}"`,
            item.sku,
            item.category,
            item.unit,
            item.current_stock,
            item.min_stock_level,
            item.reorder_point,
            item.cost_per_unit || 0,
            item.total_value,
            item.status,
          ].join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="inventory-report-${new Date().toISOString().split('T')[0]}.csv"`);
        return res.send(csv);
      }

      res.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          itemCount: enrichedItems.length,
          items: enrichedItems,
        },
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        message: error.message,
      });
    }
  }

  /**
   * Check expiring items (for cron job)
   */
  async checkExpiringItems(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Items expiring within 7 days
      const { data: expiringItems } = await supabase
        .from('inventory_items')
        .select('id, name, expiry_date')
        .eq('is_active', true)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', sevenDaysFromNow.toISOString())
        .gt('expiry_date', now.toISOString());

      // Expired items
      const { data: expiredItems } = await supabase
        .from('inventory_items')
        .select('id, name, expiry_date')
        .eq('is_active', true)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', now.toISOString());

      // Get existing unresolved alerts
      const { data: existingAlerts } = await supabase
        .from('inventory_alerts')
        .select('item_id, alert_type')
        .eq('is_resolved', false)
        .in('alert_type', ['expiring_soon', 'expired']);

      const existingAlertSet = new Set(
        (existingAlerts || []).map(a => `${a.item_id}-${a.alert_type}`)
      );

      let alertsCreated = 0;

      for (const item of expiringItems || []) {
        if (!existingAlertSet.has(`${item.id}-expiring_soon`)) {
          await this.createStockAlert(item.id, 'expiring_soon', item.expiry_date);
          alertsCreated++;
        }
      }

      for (const item of expiredItems || []) {
        if (!existingAlertSet.has(`${item.id}-expired`)) {
          await this.createStockAlert(item.id, 'expired', item.expiry_date, 'critical');
          alertsCreated++;
        }
      }

      res.json({
        success: true,
        message: `Created ${alertsCreated} alerts`,
        data: {
          expiringSoon: (expiringItems || []).length,
          expired: (expiredItems || []).length,
        },
      });
    } catch (error: any) {
      console.error('Error checking expiring items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check expiring items',
        message: error.message,
      });
    }
  }

  /**
   * Link inventory item to menu item
   */
  async linkToMenuItem(req: Request, res: Response) {
    try {
      const { itemId } = req.params;
      const { menuItemId, quantityNeeded } = req.body;
      const supabase = getSupabase();

      // Check if link exists
      const { data: existing } = await supabase
        .from('menu_item_ingredients')
        .select('id')
        .eq('menu_item_id', menuItemId)
        .eq('inventory_item_id', itemId)
        .single();

      if (existing) {
        // Update
        await supabase
          .from('menu_item_ingredients')
          .update({
            quantity_needed: quantityNeeded,
            updated_at: new Date().toISOString(),
          })
          .eq('menu_item_id', menuItemId)
          .eq('inventory_item_id', itemId);
      } else {
        // Insert
        await supabase.from('menu_item_ingredients').insert({
          menu_item_id: menuItemId,
          inventory_item_id: itemId,
          quantity_needed: quantityNeeded,
        });
      }

      res.json({
        success: true,
        message: 'Linked successfully',
      });
    } catch (error: any) {
      console.error('Error linking items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to link items',
        message: error.message,
      });
    }
  }

  /**
   * Helper: Create stock alert
   */
  private async createStockAlert(
    itemId: string, 
    alertType: string, 
    stockOrDate: any,
    priority: string = 'medium'
  ) {
    let message = '';
    
    switch (alertType) {
      case 'out_of_stock':
        message = 'Item is out of stock';
        priority = 'high';
        break;
      case 'low_stock':
        message = `Stock level low: ${stockOrDate} units remaining`;
        break;
      case 'expiring_soon':
        message = `Item expiring on ${new Date(stockOrDate).toLocaleDateString()}`;
        break;
      case 'expired':
        message = `Item expired on ${new Date(stockOrDate).toLocaleDateString()}`;
        priority = 'critical';
        break;
      case 'overstock':
        message = `Stock level exceeds maximum: ${stockOrDate} units`;
        priority = 'low';
        break;
    }

    const supabase = getSupabase();
    
    // Check if alert already exists
    const { data: existing } = await supabase
      .from('inventory_alerts')
      .select('id')
      .eq('item_id', itemId)
      .eq('alert_type', alertType)
      .eq('is_resolved', false)
      .single();

    if (!existing) {
      await supabase.from('inventory_alerts').insert({
        item_id: itemId,
        alert_type: alertType,
        message,
        priority,
      });
    }
  }
}

export const inventoryController = new InventoryController();
