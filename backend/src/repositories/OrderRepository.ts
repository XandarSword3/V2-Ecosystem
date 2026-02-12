import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RestaurantOrder {
  [key: string]: unknown;
  id: string;
  order_number: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  table_id?: string | null;
  tab_id?: string | null;
  waiter_id?: string | null;
  served_by?: string | null;
  split_from_order_id?: string | null;
  order_type: string;
  status: string;
  subtotal: string;
  tax_amount: string;
  service_charge?: string | null;
  delivery_fee?: string | null;
  discount_amount?: string;
  total_amount: string;
  modifiers_total?: string;
  coupon_id?: string | null;
  coupon_code?: string | null;
  coupon_discount?: string;
  gift_card_amount?: string;
  loyalty_points_used?: number;
  loyalty_discount?: string;
  special_instructions?: string | null;
  estimated_ready_time?: string | null;
  actual_ready_time?: string | null;
  payment_status: string;
  payment_method?: string | null;
  assigned_to_staff?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  deleted_at?: string | null;
}

export interface RestaurantOrderItem {
  [key: string]: unknown;
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  selected_modifiers?: unknown;
  modifier_total?: string;
  special_instructions?: string | null;
  status?: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class RestaurantOrderRepository extends BaseRepository<RestaurantOrder> {
  constructor() {
    super('restaurant_orders');
  }

  /** Find orders placed by a specific customer. */
  async findByCustomer(
    customerId: string,
    options?: FindManyOptions,
  ): Promise<RestaurantOrder[]> {
    return this.findMany(
      { customer_id: customerId },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find orders by status (e.g. 'pending', 'preparing'). */
  async findByStatus(
    status: string,
    options?: FindManyOptions,
  ): Promise<RestaurantOrder[]> {
    return this.findMany(
      { status },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find orders assigned to a specific table. */
  async findByTable(tableId: string): Promise<RestaurantOrder[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('table_id', tableId)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[restaurant_orders] findByTable failed: ${error.message}`);
    return (data as RestaurantOrder[]) ?? [];
  }

  /** Find orders created within a date range. */
  async findByDateRange(from: string, to: string): Promise<RestaurantOrder[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[restaurant_orders] findByDateRange failed: ${error.message}`);
    return (data as RestaurantOrder[]) ?? [];
  }

  /** Find active (non-completed, non-cancelled) orders. */
  async findActive(): Promise<RestaurantOrder[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .not('status', 'in', '("completed","cancelled")')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[restaurant_orders] findActive failed: ${error.message}`);
    return (data as RestaurantOrder[]) ?? [];
  }
}

export class OrderItemRepository extends BaseRepository<RestaurantOrderItem> {
  constructor() {
    super('restaurant_order_items');
  }

  /** Find all items belonging to a specific order. */
  async findByOrder(orderId: string): Promise<RestaurantOrderItem[]> {
    return this.findMany({ order_id: orderId });
  }
}

/** Facade combining order and order-item repositories. */
export class OrderRepository {
  readonly orders = new RestaurantOrderRepository();
  readonly items = new OrderItemRepository();
}
