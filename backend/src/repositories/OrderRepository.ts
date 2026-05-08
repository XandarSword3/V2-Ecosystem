import { BaseRepository, type FindManyOptions, type Row } from './BaseRepository.js';
import { getSupabase } from '../database/connection.js';

// =============================================
// TYPES
// =============================================

export interface RestaurantOrder {
  id: string;
  module_id?: string;
  order_number: string;
  customer_id?: string;
  table_id?: string;
  staff_id?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  total_amount: number;
  tax_amount?: number;
  service_charge?: number;
  discount_amount?: number;
  net_amount: number;
  currency: string;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  [key: string]: unknown; // Index signature for Row constraint
}

export interface RestaurantOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
  [key: string]: unknown; // Index signature for Row constraint
}

// =============================================
// ORDER REPOSITORY
// =============================================

export class OrderRepository extends BaseRepository<RestaurantOrder> {
  constructor() {
    super('restaurant_orders');
  }

  async findByOrderNumber(orderNumber: string): Promise<RestaurantOrder | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (error || !data) return null;
    return data as RestaurantOrder;
  }

  async findByCustomerId(customerId: string, options?: FindManyOptions): Promise<RestaurantOrder[]> {
    const supabase = getSupabase();
    let query = supabase
      .from(this.tableName)
      .select('*')
      .eq('customer_id', customerId);

    if (options?.limit) query = query.limit(options.limit);
    if (options?.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      query = query.order(field, { ascending: direction === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as RestaurantOrder[];
  }

  async findByTableId(tableId: string, options?: FindManyOptions): Promise<RestaurantOrder[]> {
    const supabase = getSupabase();
    let query = supabase
      .from(this.tableName)
      .select('*')
      .eq('table_id', tableId);

    if (options?.limit) query = query.limit(options.limit);
    if (options?.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      query = query.order(field, { ascending: direction === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as RestaurantOrder[];
  }

  async findByStatus(status: string, options?: FindManyOptions): Promise<RestaurantOrder[]> {
    const supabase = getSupabase();
    let query = supabase
      .from(this.tableName)
      .select('*')
      .eq('status', status);

    if (options?.limit) query = query.limit(options.limit);
    if (options?.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      query = query.order(field, { ascending: direction === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as RestaurantOrder[];
  }

  async updateStatus(id: string, status: string): Promise<RestaurantOrder> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(this.tableName)
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to update order status');
    return data as RestaurantOrder;
  }

  async updatePaymentStatus(id: string, paymentStatus: string): Promise<RestaurantOrder> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(this.tableName)
      .update({ 
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to update payment status');
    return data as RestaurantOrder;
  }
}

// =============================================
// ORDER ITEM REPOSITORY
// =============================================

export class OrderItemRepository extends BaseRepository<RestaurantOrderItem> {
  constructor() {
    super('restaurant_order_items');
  }

  async findByOrderId(orderId: string): Promise<RestaurantOrderItem[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as RestaurantOrderItem[];
  }

  async findByMenuItemId(menuItemId: string, options?: FindManyOptions): Promise<RestaurantOrderItem[]> {
    const supabase = getSupabase();
    let query = supabase
      .from(this.tableName)
      .select('*')
      .eq('menu_item_id', menuItemId);

    if (options?.limit) query = query.limit(options.limit);
    if (options?.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      query = query.order(field, { ascending: direction === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as RestaurantOrderItem[];
  }

  async createOrderItem(item: Omit<RestaurantOrderItem, 'id' | 'created_at'>): Promise<RestaurantOrderItem> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(this.tableName)
      .insert({
        ...item,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create order item');
    return data as RestaurantOrderItem;
  }
}

// =============================================
// RESTAURANT ORDER REPOSITORY (Specialized)
// =============================================

export class RestaurantOrderRepository extends OrderRepository {
  async findWithItems(orderId: string): Promise<RestaurantOrder & { items: RestaurantOrderItem[] } | null> {
    const order = await this.findById(orderId);
    if (!order) return null;

    const orderItemRepo = new OrderItemRepository();
    const items = await orderItemRepo.findByOrderId(orderId);

    return { ...order, items };
  }

  async findActiveOrders(options?: FindManyOptions): Promise<RestaurantOrder[]> {
    return this.findByStatus('confirmed', options);
  }

  async findPendingOrders(options?: FindManyOptions): Promise<RestaurantOrder[]> {
    return this.findByStatus('pending', options);
  }

  async findPreparingOrders(options?: FindManyOptions): Promise<RestaurantOrder[]> {
    return this.findByStatus('preparing', options);
  }

  async findReadyOrders(options?: FindManyOptions): Promise<RestaurantOrder[]> {
    return this.findByStatus('ready', options);
  }

  async createOrder(order: Omit<RestaurantOrder, 'id' | 'created_at'>, items?: Omit<RestaurantOrderItem, 'id' | 'created_at' | 'order_id'>[]): Promise<RestaurantOrder> {
    const supabase = getSupabase();
    
    // Create the order first
    const { data: orderData, error: orderError } = await supabase
      .from(this.tableName)
      .insert({
        ...order,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError || !orderData) throw orderError || new Error('Failed to create order');

    // Create items if provided
    if (items && items.length > 0) {
      const orderItemRepo = new OrderItemRepository();
      for (const item of items) {
        await orderItemRepo.createOrderItem({
          ...item,
          order_id: orderData.id
        });
      }
    }

    return orderData as RestaurantOrder;
  }
}
