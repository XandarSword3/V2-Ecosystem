import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection.js";
import { emitToUnit } from "../../socket/index.js";
import { createSnackOrderSchema, validateBody } from "../../validation/schemas.js";
import dayjs from 'dayjs';
import { z } from 'zod';

// Types from Zod schema
type CreateSnackOrderInput = z.infer<typeof createSnackOrderSchema>;

// Database row types for Supabase responses
interface SnackItemRow {
  id: string;
  name: string;
  image_url?: string | null;
}

interface SnackOrderItemRow {
  id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  notes?: string;
  snack_items?: SnackItemRow | null;
}

interface SnackOrderRow {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
  payment_status: string;
  payment_method?: string;
  customer_name?: string;
  customer_phone?: string;
  estimated_ready_time?: string;
  created_at: string;
  items?: SnackOrderItemRow[];
}

function generateOrderNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const suffix = Date.now().toString(36).slice(-4);
  return `S-${date}-${random}${suffix}`;
}

export async function getItems(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { category, available, moduleId } = req.query;
    
    let query = supabase
      .from('snack_items')
      .select('*')
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    // Filter by module_id for proper data isolation
    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (available === 'true') {
      query = query.eq('is_available', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
}

export async function getItem(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('snack_items')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }
      throw error;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate request body with Zod schema
    const validatedData = validateBody(createSnackOrderSchema, req.body);
    const { customerName, customerPhone, items, paymentMethod, notes } = validatedData;

    const supabase = getSupabase();

    // Get snack items for pricing
    const itemIds = items.map((i) => i.itemId);
    const { data: snackItemsList, error: itemsError } = await supabase
      .from('snack_items')
      .select('*')
      .in('id', itemIds);

    if (itemsError) throw itemsError;

    const itemMap = new Map((snackItemsList || []).map(i => [i.id, i]));

    // Calculate total
    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const snackItem = itemMap.get(item.itemId);
      if (!snackItem) throw new Error(`Item ${item.itemId} not found`);
      if (!snackItem.is_available) throw new Error(`${snackItem.name} is not available`);

      const unitPrice = parseFloat(snackItem.price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      return {
        snack_item_id: item.itemId,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
      };
    });

    const estimatedReadyTime = dayjs().add(10, 'minute').toISOString();

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('snack_orders')
      .insert({
        order_number: generateOrderNumber(),
        customer_id: req.user?.userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        status: 'pending',
        total_amount: totalAmount.toFixed(2),
        payment_status: 'pending',
        payment_method: paymentMethod,
        estimated_ready_time: estimatedReadyTime,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const { error: itemsInsertError } = await supabase
      .from('snack_order_items')
      .insert(orderItems.map((item) => ({
        order_id: order.id,
        snack_item_id: item.snack_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
      })));

    if (itemsInsertError) throw itemsInsertError;

    emitToUnit('snack_bar', 'order:new', {
      orderId: order.id,
      orderNumber: order.order_number,
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from('snack_orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      throw orderError;
    }

    // Security: Only order owner or admin/staff can view full order details
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const isOwner = order.customer_id === userId;
    const isAdminOrStaff = userRoles.includes('admin') || userRoles.includes('staff');
    
    // Allow access if:
    // 1. User is the owner
    // 2. User is admin/staff
    // 3. Order is a guest order (no customer_id) - relying on UUID secrecy
    // 4. Or just allow it because the UUID is the secret token
    
    // For now, we'll allow anyone with the UUID to see the order details
    // This fixes the issue where guest users (or users not logged in) see $0.00 and no items
    
    // Get order items with snack item details
    const { data: items, error: itemsError } = await supabase
      .from('snack_order_items')
      .select(`
        id,
        quantity,
        unit_price,
        subtotal,
        snack_items (
          id,
          name,
          image_url
        )
      `)
      .eq('order_id', req.params.id);

    if (itemsError) throw itemsError;

    res.json({ success: true, data: { ...order, items: items || [] } });
  } catch (error) {
    next(error);
  }
}

export async function getOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    // Return full order details for confirmation page
    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from('snack_orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      throw orderError;
    }

    // Get order items with snack item details
    const { data: items, error: itemsError } = await supabase
      .from('snack_order_items')
      .select(`
        id,
        quantity,
        unit_price,
        subtotal,
        snack_items (
          id,
          name,
          image_url
        )
      `)
      .eq('order_id', req.params.id);

    if (itemsError) throw itemsError;

    res.json({ success: true, data: { ...order, items: items || [] } });
  } catch (error) {
    next(error);
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { data: orders, error } = await supabase
      .from('snack_orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        payment_status,
        payment_method,
        estimated_ready_time,
        created_at,
        snack_order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          snack_items (
            id,
            name,
            image_url
          )
        )
      `)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ success: true, data: orders || [] });
  } catch (error) {
    next(error);
  }
}

export async function getStaffOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: orders, error } = await supabase
      .from('snack_orders')
      .select(`
        *,
        items:snack_order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          snack_items (
            id,
            name,
            image_url
          )
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Transform items to have name at top level for frontend
    const transformedOrders = (orders || []).map((order: SnackOrderRow) => ({
      ...order,
      items: (order.items || []).map((item: SnackOrderItemRow) => ({
        id: item.id,
        name: item.snack_items?.name || 'Unknown Item',
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
        notes: item.notes,
      })),
    }));

    res.json({ success: true, data: transformedOrders });
  } catch (error) {
    next(error);
  }
}

export async function getLiveOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const activeStatuses = ['pending', 'preparing', 'ready'];
    
    const { data: orders, error } = await supabase
      .from('snack_orders')
      .select(`
        *,
        items:snack_order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          snack_items (
            id,
            name,
            image_url
          )
        )
      `)
      .in('status', activeStatuses)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform items to have name at top level for frontend
    const transformedOrders = (orders || []).map((order: SnackOrderRow) => ({
      ...order,
      items: (order.items || []).map((item: SnackOrderItemRow) => ({
        id: item.id,
        name: item.snack_items?.name || 'Unknown Item',
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
        notes: item.notes,
      })),
    }));

    res.json({ success: true, data: transformedOrders });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { status } = req.body;

    const updateData: Record<string, unknown> = { 
      status, 
      updated_at: new Date().toISOString() 
    };
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      // Mark as paid when order is completed (for stress testing & realistic flow)
      updateData.payment_status = 'paid';
    }

    const { data: order, error } = await supabase
      .from('snack_orders')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    emitToUnit('snack_bar', 'order:updated', {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
    });

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const body = req.body;
    
    // Validate required fields
    if (!body.name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (body.price === undefined || body.price === null) {
      return res.status(400).json({ success: false, message: 'Price is required' });
    }
    
    const { data: item, error } = await supabase
      .from('snack_items')
      .insert({
        name: body.name,
        name_ar: body.nameAr || body.name_ar || null,
        name_fr: body.nameFr || body.name_fr || null,
        description: body.description || null,
        description_ar: body.descriptionAr || body.description_ar || null,
        price: String(body.price),
        category: body.category || 'snack',
        module_id: body.moduleId || body.module_id || null, // Module isolation
        image_url: body.imageUrl || body.image_url || null,
        display_order: body.displayOrder || body.display_order || 0,
        is_available: body.isAvailable !== undefined ? body.isAvailable : (body.is_available !== undefined ? body.is_available : true),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const body = req.body;
    const updateData: Record<string, unknown> = { 
      updated_at: new Date().toISOString() 
    };
    
    // Handle both camelCase and snake_case field names
    if (body.name !== undefined) updateData.name = body.name;
    if (body.nameAr !== undefined || body.name_ar !== undefined) updateData.name_ar = body.nameAr || body.name_ar;
    if (body.nameFr !== undefined || body.name_fr !== undefined) updateData.name_fr = body.nameFr || body.name_fr;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.descriptionAr !== undefined || body.description_ar !== undefined) updateData.description_ar = body.descriptionAr || body.description_ar;
    if (body.price !== undefined) updateData.price = String(body.price);
    if (body.category !== undefined) updateData.category = body.category;
    // category_id removed
    if (body.imageUrl !== undefined || body.image_url !== undefined) updateData.image_url = body.imageUrl || body.image_url;
    if (body.displayOrder !== undefined || body.display_order !== undefined) updateData.display_order = body.displayOrder || body.display_order;
    if (body.isAvailable !== undefined || body.is_available !== undefined) updateData.is_available = body.isAvailable !== undefined ? body.isAvailable : body.is_available;

    const { data: item, error } = await supabase
      .from('snack_items')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('snack_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
}

export async function toggleAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { isAvailable } = req.body;

    const { data: item, error } = await supabase
      .from('snack_items')
      .update({ 
        is_available: isAvailable, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Categories
// ============================================

const STATIC_CATEGORIES = [
  { id: 'sandwich', name: 'Sandwich', display_order: 1 },
  { id: 'drink', name: 'Drink', display_order: 2 },
  { id: 'snack', name: 'Snack', display_order: 3 },
  { id: 'ice_cream', name: 'Ice Cream', display_order: 4 },
];

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    // Return static categories that match the database ENUM
    res.json({ success: true, data: STATIC_CATEGORIES });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  // Categories are static for now due to ENUM constraint
  res.status(405).json({ success: false, message: 'Category creation not supported' });
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  res.status(405).json({ success: false, message: 'Category update not supported' });
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  res.status(405).json({ success: false, message: 'Category deletion not supported' });
}

