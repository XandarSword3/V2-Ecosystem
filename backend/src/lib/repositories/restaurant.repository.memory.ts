// @ts-nocheck - Test double with complex typing, skip type checking
/**
 * In-Memory Restaurant Repository
 * Test double for RestaurantRepository using in-memory data structures.
 */

import type {
  RestaurantRepository,
  RestaurantOrder,
  RestaurantOrderItem,
  RestaurantMenuItem,
  RestaurantTable,
} from '../container/types.js';

export interface InMemoryRestaurantRepository extends RestaurantRepository {
  addMenuItem(item: Partial<RestaurantMenuItem> & { id: string; name: string; price: string }): RestaurantMenuItem;
  addTable(table: Partial<RestaurantTable> & { id: string }): RestaurantTable;
  addOrder(order: RestaurantOrder): void;
  getAllOrders(): RestaurantOrder[];
  getAllOrderItems(): RestaurantOrderItem[];
  reset(): void;
}

export function createInMemoryRestaurantRepository(): InMemoryRestaurantRepository {
  const orders = new Map<string, RestaurantOrder>();
  const orderItems = new Map<string, RestaurantOrderItem[]>();
  const menuItems = new Map<string, RestaurantMenuItem>();
  const tables = new Map<string, RestaurantTable>();

  function addMenuItem(item: Partial<RestaurantMenuItem> & { id: string; name: string; price: string }): RestaurantMenuItem {
    const full: RestaurantMenuItem = {
      module_id: item.module_id ?? undefined,
      category_id: item.category_id ?? undefined,
      name_ar: item.name_ar ?? undefined,
      name_fr: item.name_fr ?? undefined,
      description: item.description ?? undefined,
      description_ar: item.description_ar ?? undefined,
      description_fr: item.description_fr ?? undefined,
      discount_price: item.discount_price ?? undefined,
      image_url: item.image_url ?? undefined,
      is_available: item.is_available ?? true,
      is_featured: item.is_featured ?? false,
      is_vegetarian: item.is_vegetarian ?? false,
      is_vegan: item.is_vegan ?? false,
      is_gluten_free: item.is_gluten_free ?? false,
      is_dairy_free: item.is_dairy_free ?? false,
      is_halal: item.is_halal ?? false,
      is_spicy: item.is_spicy ?? false,
      allergens: item.allergens ?? [],
      calories: item.calories ?? undefined,
      preparation_time_minutes: item.preparation_time_minutes ?? undefined,
      display_order: item.display_order ?? 0,
      deleted_at: item.deleted_at ?? undefined,
      created_at: item.created_at ?? new Date().toISOString(),
      updated_at: item.updated_at ?? new Date().toISOString(),
      ...item,
    } as RestaurantMenuItem;
    menuItems.set(full.id, full);
    return full;
  }

  function addTable(table: Partial<RestaurantTable> & { id: string }): RestaurantTable {
    const full: RestaurantTable = {
      module_id: table.module_id ?? undefined,
      table_number: table.table_number ?? 'T1',
      capacity: table.capacity ?? 4,
      status: table.status ?? 'available',
      created_at: table.created_at ?? new Date().toISOString(),
      updated_at: table.updated_at ?? new Date().toISOString(),
      ...table,
    } as RestaurantTable;
    tables.set(full.id, full);
    return full;
  }

  return {
    // Helpers
    addMenuItem,
    addTable,
    addOrder(order: RestaurantOrder) {
      orders.set(order.id, order);
    },
    getAllOrders(): RestaurantOrder[] {
      return [...orders.values()];
    },
    getAllOrderItems(): RestaurantOrderItem[] {
      return [...orderItems.values()].flat();
    },
    reset() {
      orders.clear();
      orderItems.clear();
      menuItems.clear();
      tables.clear();
    },

    // Order operations
    async createOrder(order) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const full: RestaurantOrder = {
        ...order,
        id,
        created_at: now,
        updated_at: now,
      } as RestaurantOrder;
      orders.set(id, full);
      return full;
    },
    async getOrderById(id) {
      return orders.get(id) ?? null;
    },
    async getOrderByNumber(orderNumber) {
      for (const o of orders.values()) {
        if (o.order_number === orderNumber) return o;
      }
      return null;
    },
    async getOrders(filters) {
      let result = [...orders.values()];
      if (filters.status) result = result.filter(o => o.status === filters.status);
      if (filters.date) result = result.filter(o => o.created_at.startsWith(filters.date!));
      if (filters.moduleId) result = result.filter(o => o.module_id === filters.moduleId);
      return result;
    },
    async getLiveOrders(moduleId) {
      const liveStatuses = ['pending', 'confirmed', 'preparing', 'ready'];
      let result = [...orders.values()].filter(o => liveStatuses.includes(o.status));
      if (moduleId) result = result.filter(o => o.module_id === moduleId);
      return result;
    },
    async getOrdersByCustomer(customerId) {
      return [...orders.values()].filter(o => o.customer_id === customerId);
    },
    async updateOrder(id, data) {
      const existing = orders.get(id);
      if (!existing) throw new Error(`Order ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      orders.set(id, updated);
      return updated;
    },

    // Order items
    async createOrderItems(items) {
      const created: RestaurantOrderItem[] = items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      })) as RestaurantOrderItem[];
      for (const item of created) {
        const existing = orderItems.get(item.order_id) ?? [];
        existing.push(item);
        orderItems.set(item.order_id, existing);
      }
      return created;
    },
    async getOrderItems(orderId) {
      return orderItems.get(orderId) ?? [];
    },

    // Menu items
    async getMenuItemById(id) {
      return menuItems.get(id) ?? null;
    },
    async getMenuItemsByIds(ids) {
      return ids.map(id => menuItems.get(id)).filter((i): i is RestaurantMenuItem => !!i);
    },
    async getMenuItems(filters) {
      let result = [...menuItems.values()].filter(i => !i.deleted_at);
      if (filters?.categoryId) result = result.filter(i => i.category_id === filters.categoryId);
      if (filters?.moduleId) result = result.filter(i => i.module_id === filters.moduleId);
      if (filters?.available !== undefined) result = result.filter(i => i.is_available === filters.available);
      return result;
    },

    // Tables
    async getTableById(id) {
      return tables.get(id) ?? null;
    },
    async getTables(moduleId) {
      let result = [...tables.values()];
      if (moduleId) result = result.filter(t => t.module_id === moduleId);
      return result;
    },
    async updateTable(id, data) {
      const existing = tables.get(id);
      if (!existing) throw new Error(`Table ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      tables.set(id, updated);
      return updated;
    },

    async rpc(_fn, _params) {
      return { data: null, error: null };
    },
  };
}
