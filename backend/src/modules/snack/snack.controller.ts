import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection.js";
import { emitToUnit } from "../../socket/index.js";
import dayjs from 'dayjs';

function generateOrderNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `S-${date}-${random}`;
}

export async function getItems(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { category, available } = req.query;
    
    let query = supabase
      .from('snack_items')
      .select('*')
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

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
    const supabase = getSupabase();
    const { customerName, customerPhone, items, paymentMethod } = req.body;

    // Get snack items for pricing
    const itemIds = items.map((i: any) => i.snackItemId);
    const { data: snackItemsList, error: itemsError } = await supabase
      .from('snack_items')
      .select('*')
      .in('id', itemIds);

    if (itemsError) throw itemsError;

    const itemMap = new Map((snackItemsList || []).map(i => [i.id, i]));

    // Calculate total
    let totalAmount = 0;
    const orderItems = items.map((item: any) => {
      const snackItem = itemMap.get(item.snackItemId);
      if (!snackItem) throw new Error(`Item ${item.snackItemId} not found`);
      if (!snackItem.is_available) throw new Error(`${snackItem.name} is not available`);

      const unitPrice = parseFloat(snackItem.price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      return {
        snack_item_id: item.snackItemId,
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
      .insert(orderItems.map((item: any) => ({
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
    const supabase = getSupabase();
    const { data: order, error } = await supabase
      .from('snack_orders')
      .select('id, order_number, status, estimated_ready_time')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function getStaffOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: orders, error } = await supabase
      .from('snack_orders')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ success: true, data: orders || [] });
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
      .select('*')
      .in('status', activeStatuses)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: orders || [] });
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
    const { data: item, error } = await supabase
      .from('snack_items')
      .insert({
        name: req.body.name,
        name_ar: req.body.nameAr,
        name_fr: req.body.nameFr,
        description: req.body.description,
        price: req.body.price.toString(),
        category: req.body.category,
        image_url: req.body.imageUrl,
        display_order: req.body.displayOrder || 0,
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
    const updateData: Record<string, unknown> = { 
      updated_at: new Date().toISOString() 
    };
    
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.nameAr !== undefined) updateData.name_ar = req.body.nameAr;
    if (req.body.nameFr !== undefined) updateData.name_fr = req.body.nameFr;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.price !== undefined) updateData.price = req.body.price.toString();
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.imageUrl !== undefined) updateData.image_url = req.body.imageUrl;
    if (req.body.displayOrder !== undefined) updateData.display_order = req.body.displayOrder;
    if (req.body.isAvailable !== undefined) updateData.is_available = req.body.isAvailable;

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
