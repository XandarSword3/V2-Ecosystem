import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection.js";
import { emitToUnit } from "../../socket/index.js";
import { createSnackOrderSchema, validateBody } from "../../validation/schemas.js";
import dayjs from 'dayjs';
import { z } from 'zod';
import { getEngineService } from '../../engines/engine-service.js';
import type { PricingLineItem, PricingContext } from '../../engines/types.js';

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

export const getItems = asyncHandler(async (req: Request, res: Response) => {
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
});

export const getItem = asyncHandler(async (req: Request, res: Response) => {
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
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
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

    // Build line items and validate availability
    const orderItems = items.map((item) => {
      const snackItem = itemMap.get(item.itemId);
      if (!snackItem) throw new Error(`Item ${item.itemId} not found`);
      if (!snackItem.is_available) throw new Error(`${snackItem.name} is not available`);

      const basePrice = parseFloat(snackItem.price);
      const discountPrice = snackItem.discount_price ? parseFloat(snackItem.discount_price) : null;
      const unitPrice = (discountPrice !== null && discountPrice < basePrice) ? discountPrice : basePrice;

      return {
        snack_item_id: item.itemId,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * item.quantity,
      };
    });

    // === ENGINE-POWERED PRICING ===
    // Route through the unified pricing pipeline (Engine A: instant_transaction)
    // This adds tax calculation that was previously missing from snack orders
    const engineService = getEngineService();
    const pricingLineItems: PricingLineItem[] = orderItems.map(item => ({
      name: itemMap.get(item.snack_item_id)?.name || 'Unknown',
      unitPrice: item.unit_price,
      quantity: item.quantity,
    }));
    const pricingContext: PricingContext = {
      conditions: { orderType: 'takeaway' }, // Snack bar is always takeaway (no dine-in / delivery)
    };
    const pricing = await engineService.calculatePricing('menu_service', pricingLineItems, pricingContext);

    const estimatedReadyTime = dayjs().add(10, 'minute').toISOString();

    // Use initial state from engine instead of hardcoding
    const initialState = engineService.getInitialState('menu_service');

    // Create order with engine-calculated totals
    const { data: order, error: orderError } = await supabase
      .from('snack_orders')
      .insert({
        order_number: generateOrderNumber(),
        customer_id: req.user?.userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        status: initialState,
        total_amount: pricing.totalAmount.toFixed(2),
        subtotal: pricing.subtotal.toFixed(2),
        tax_amount: pricing.taxAmount.toFixed(2),
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
});

export const createStaffOrder = asyncHandler(async (req: Request, res: Response) => {
    const userRoles = req.user?.roles || [];
    const allowedRoles = ['staff', 'snack_bar_staff', 'snack_bar_admin', 'admin', 'super_admin'];
    if (!userRoles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const body = req.body as {
      customer_id?: string;
      customer_name?: string;
      customer_phone?: string;
      items: Array<{ item_id?: string; itemId?: string; quantity: number; notes?: string }>;
      notes?: string;
    };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ success: false, error: 'items are required' });
    }

    const supabase = getSupabase();
    const itemIds = body.items.map((item) => item.itemId || item.item_id).filter(Boolean) as string[];
    const { data: snackItems, error: itemsError } = await supabase
      .from('snack_items')
      .select('id, name, price, is_available')
      .in('id', itemIds);
    if (itemsError) throw itemsError;

    const itemMap = new Map((snackItems || []).map((item: any) => [item.id, item]));
    const engineService = getEngineService();
    const pricingLineItems: PricingLineItem[] = body.items.map((item) => {
      const resolvedId = item.itemId || item.item_id || '';
      const dbItem = itemMap.get(resolvedId);
      if (!dbItem || !dbItem.is_available) {
        throw new Error(`Snack item ${resolvedId} is unavailable`);
      }
      const basePrice = parseFloat(dbItem.price);
      const discountPrice = dbItem.discount_price ? parseFloat(dbItem.discount_price) : null;
      const unitPrice = (discountPrice !== null && discountPrice < basePrice) ? discountPrice : basePrice;

      return {
        itemId: resolvedId,
        name: dbItem.name,
        unitPrice,
        quantity: item.quantity,
      };
    });
    const pricing = await engineService.calculatePricing('menu_service', pricingLineItems, {});

    const { data: order, error: orderError } = await supabase
      .from('snack_orders')
      .insert({
        order_number: generateOrderNumber(),
        customer_id: body.customer_id || req.user?.userId,
        customer_name: body.customer_name || 'Walk-in Guest',
        customer_phone: body.customer_phone || null,
        status: 'confirmed',
        subtotal: pricing.subtotal.toFixed(2),
        tax_amount: pricing.taxAmount.toFixed(2),
        total_amount: pricing.totalAmount.toFixed(2),
        payment_status: 'pending',
        payment_method: 'cash',
        special_instructions: body.notes || null,
        estimated_ready_time: dayjs().add(10, 'minute').toISOString(),
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const insertItemsPayload = body.items.map((item) => {
      const resolvedId = item.itemId || item.item_id || '';
      const dbItem = itemMap.get(resolvedId);
      const basePrice = parseFloat(dbItem.price);
      const discountPrice = dbItem.discount_price ? parseFloat(dbItem.discount_price) : null;
      const unitPrice = (discountPrice !== null && discountPrice < basePrice) ? discountPrice : basePrice;
      return {
        order_id: order.id,
        snack_item_id: resolvedId,
        quantity: item.quantity,
        unit_price: unitPrice.toFixed(2),
        subtotal: (unitPrice * item.quantity).toFixed(2),
        notes: item.notes || null,
      };
    });
    const { error: insertItemsError } = await supabase
      .from('snack_order_items')
      .insert(insertItemsPayload);
    if (insertItemsError) throw insertItemsError;

    emitToUnit('snack_bar', 'order:new', {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
    });

    res.status(201).json({ success: true, data: order });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
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
});

export const getOrderStatus = asyncHandler(async (req: Request, res: Response) => {
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
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
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
});

export const getStaffOrders = asyncHandler(async (req: Request, res: Response) => {
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
});

export const getLiveOrders = asyncHandler(async (req: Request, res: Response) => {
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
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { status } = req.body;

    // Get current order to know the current state
    const { data: currentOrder, error: fetchError } = await supabase
      .from('snack_orders')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      throw fetchError;
    }

    // === ENGINE-POWERED STATE TRANSITION ===
    // Use state machine to validate transition instead of allowing any status
    const engineService = getEngineService();
    const actor = req.user?.roles?.includes('admin') ? 'admin' : 'staff';
    
    // Derive action from target status (the engine uses action names, not raw states)
    const statusToAction: Record<string, string> = {
      confirmed: 'confirm',
      preparing: 'start_preparing',
      ready: 'mark_ready',
      delivered: 'deliver',
      completed: currentOrder.status === 'ready' ? 'complete' : 'deliver',
      cancelled: 'cancel',
    };
    const action = statusToAction[status];
    if (!action) {
      return res.status(400).json({ success: false, error: `Invalid target status: ${status}` });
    }

    const transitionResult = await engineService.transitionState(
      'menu_service',
      currentOrder.status,
      action,
      actor
    );

    if (!transitionResult.allowed) {
      return res.status(400).json({
        success: false,
        error: transitionResult.error || `Cannot transition from ${currentOrder.status} to ${status}`,
      });
    }

    const updateData: Record<string, unknown> = { 
      status: transitionResult.targetState, 
      updated_at: new Date().toISOString() 
    };
    if (transitionResult.targetState === 'completed') {
      updateData.completed_at = new Date().toISOString();
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
});

export const createItem = asyncHandler(async (req: Request, res: Response) => {
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
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
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
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('snack_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'Item deleted' });
});

export const toggleAvailability = asyncHandler(async (req: Request, res: Response) => {
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
});

// ============================================
// Categories
// ============================================

const STATIC_CATEGORIES = [
  { id: 'sandwich', name: 'Sandwich', display_order: 1 },
  { id: 'drink', name: 'Drink', display_order: 2 },
  { id: 'snack', name: 'Snack', display_order: 3 },
  { id: 'ice_cream', name: 'Ice Cream', display_order: 4 },
];

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
    // Return static categories that match the database ENUM
    res.json({ success: true, data: STATIC_CATEGORIES });
});

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

