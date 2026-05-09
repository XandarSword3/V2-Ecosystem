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
    super('transactions');
    this.baseFilters = { engine_type: 'instant_transaction' };
  }

  async findByOrderNumber(orderNumber: string): Promise<RestaurantOrder | null> {
    const { data, error } = await this.getQuery()
      .eq('order_number', orderNumber)
      .single();

    if (error || !data) return null;
    return data as RestaurantOrder;
  }

  async findByCustomerId(customerId: string, options?: FindManyOptions): Promise<RestaurantOrder[]> {
    return this.findMany(
      { customer_id: customerId },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  async findByTableId(tableId: string, options?: FindManyOptions): Promise<RestaurantOrder[]> {
    const { data, error } = await this.getQuery()
      .contains('metadata', { table_id: tableId });

    if (error) throw error;
    return (data || []) as RestaurantOrder[];
  }

  async findByStatus(status: string, options?: FindManyOptions): Promise<RestaurantOrder[]> {
    return this.findMany(
      { status },
      { orderBy: 'created_at', ascending: true, ...options },
    );
  }

  async updateStatus(id: string, status: string): Promise<RestaurantOrder> {
    const { data, error } = await this.getClient()
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
    const { data, error } = await this.getClient()
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
// ORDER ITEM REPOSITORY (Now proxied to transactions metadata)
// =============================================

export class OrderItemRepository extends BaseRepository<RestaurantOrderItem> {
  constructor() {
    super('transactions');
    this.baseFilters = { engine_type: 'instant_transaction' };
  }

  async findByOrderId(orderId: string): Promise<RestaurantOrderItem[]> {
    const { data, error } = await this.getQuery()
      .eq('id', orderId)
      .single();

    if (error || !data) return [];
    const metadata = (data as any).metadata || {};
    return (metadata.items || []) as RestaurantOrderItem[];
  }

  async findByMenuItemId(menuItemId: string, options?: FindManyOptions): Promise<RestaurantOrderItem[]> {
    // This is more complex because items are inside metadata JSON array
    const { data, error } = await this.getQuery()
      .filter('metadata->items', 'cs', `[{"menu_item_id": "${menuItemId}"}]`);

    if (error) throw error;
    
    // Flatten the items from all matching orders
    const allItems: RestaurantOrderItem[] = [];
    for (const order of (data || [])) {
      const items = (order as any).metadata?.items || [];
      allItems.push(...items.filter((i: any) => i.menu_item_id === menuItemId));
    }
    return allItems;
  }

  async createOrderItem(item: Omit<RestaurantOrderItem, 'id' | 'created_at'>): Promise<RestaurantOrderItem> {
    // This should usually be handled during order creation, but if called separately:
    const orderId = (item as any).order_id;
    const { data: order } = await this.getClient().from('transactions').select('metadata').eq('id', orderId).single();
    
    const newItem = {
      ...item,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };

    const newMetadata = {
      ...((order as any)?.metadata || {}),
      items: [...((order as any)?.metadata?.items || []), newItem]
    };

    await this.getClient()
      .from('transactions')
      .update({ metadata: newMetadata })
      .eq('id', orderId);

    return newItem as RestaurantOrderItem;
  }
}

// Helper for uuid
import { v4 as uuidv4 } from 'uuid';

// =============================================
// RESTAURANT ORDER REPOSITORY (Specialized)
// =============================================

export class RestaurantOrderRepository extends OrderRepository {
  async findWithItems(orderId: string): Promise<RestaurantOrder & { items: RestaurantOrderItem[] } | null> {
    const order = await this.findById(orderId);
    if (!order) return null;

    const items = (order as any).metadata?.items || [];
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
    const orderId = uuidv4();
    const processedItems = (items || []).map(item => ({
      ...item,
      id: uuidv4(),
      order_id: orderId,
      created_at: new Date().toISOString()
    }));

    const { data: orderData, error: orderError } = await this.getClient()
      .from(this.tableName)
      .insert({
        ...order,
        id: orderId,
        engine_type: 'instant_transaction',
        metadata: {
          ...((order as any).metadata || {}),
          items: processedItems,
          table_id: (order as any).table_id,
          order_type: (order as any).order_type
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError || !orderData) throw orderError || new Error('Failed to create order');

    return orderData as RestaurantOrder;
  }
}
