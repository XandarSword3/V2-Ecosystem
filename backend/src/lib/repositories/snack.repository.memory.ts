/**
 * In-Memory Snack Repository
 * Test double for SnackRepository using in-memory data structures.
 */

import type {
  SnackRepository,
  SnackItem,
  SnackOrder,
  SnackOrderItem,
  SnackOrderWithItems,
  SnackItemFilters,
  SnackOrderFilters,
  SnackOrderStatus,
} from '../container/types.js';

export interface InMemorySnackRepo extends SnackRepository {
  addItem(item: SnackItem): void;
  reset(): void;
}

export function createInMemorySnackRepository(): InMemorySnackRepo {
  const items = new Map<string, SnackItem>();
  const orders = new Map<string, SnackOrder>();
  const orderItems = new Map<string, SnackOrderItem[]>(); // orderId -> items
  let orderCounter = 5000;

  function buildOrderWithItems(order: SnackOrder): SnackOrderWithItems {
    const oi = orderItems.get(order.id) ?? [];
    return {
      ...order,
      items: oi.map(i => {
        const item = items.get(i.snack_item_id);
        return item ? { ...i, item } : i;
      }) as any,
    };
  }

  return {
    addItem(item: SnackItem) {
      items.set(item.id, item);
    },
    reset() {
      items.clear();
      orders.clear();
      orderItems.clear();
      orderCounter = 5000;
    },

    // Item operations
    async getItems(filters?: SnackItemFilters) {
      let result = [...items.values()].filter(i => !i.deleted_at);
      if (filters?.category) result = result.filter(i => i.category === filters.category);
      if (filters?.moduleId) result = result.filter(i => i.module_id === filters.moduleId);
      if (filters?.availableOnly) result = result.filter(i => i.is_available);
      return result;
    },
    async getItemById(id) {
      const item = items.get(id);
      return item && !item.deleted_at ? item : null;
    },
    async getItemsByIds(ids) {
      return ids.map(id => items.get(id)).filter((i): i is SnackItem => !!i && !i.deleted_at);
    },
    async createItem(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: SnackItem = { ...data, id, created_at: now, updated_at: now } as SnackItem;
      items.set(id, item);
      return item;
    },
    async updateItem(id, data) {
      const existing = items.get(id);
      if (!existing) throw new Error(`Item ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      items.set(id, updated);
      return updated;
    },
    async deleteItem(id) {
      const existing = items.get(id);
      if (existing) {
        items.set(id, { ...existing, deleted_at: new Date().toISOString() });
      }
    },
    async setItemAvailability(id, isAvailable) {
      const existing = items.get(id);
      if (!existing) throw new Error(`Item ${id} not found`);
      const updated = { ...existing, is_available: isAvailable, updated_at: new Date().toISOString() };
      items.set(id, updated);
      return updated;
    },

    // Order operations
    async createOrder(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const order: SnackOrder = {
        ...data,
        id,
        order_number: data.order_number ?? `SN-${++orderCounter}`,
        created_at: now,
        updated_at: now,
      } as SnackOrder;
      orders.set(id, order);
      return order;
    },
    async createOrderItems(newItems) {
      const created: SnackOrderItem[] = newItems.map(item => ({
        ...item,
        id: crypto.randomUUID(),
      }));
      for (const item of created) {
        const existing = orderItems.get(item.order_id) ?? [];
        existing.push(item);
        orderItems.set(item.order_id, existing);
      }
      return created;
    },
    async getOrderById(id) {
      const order = orders.get(id);
      if (!order || order.deleted_at) return null;
      return buildOrderWithItems(order);
    },
    async getOrders(filters?: SnackOrderFilters) {
      let result = [...orders.values()].filter(o => !o.deleted_at);
      if (filters?.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        result = result.filter(o => statuses.includes(o.status));
      }
      if (filters?.customerId) result = result.filter(o => o.customer_id === filters.customerId);
      if (filters?.limit) result = result.slice(0, filters.limit);
      return result.map(buildOrderWithItems);
    },
    async getOrdersByCustomer(customerId, limit?) {
      let result = [...orders.values()].filter(o => o.customer_id === customerId && !o.deleted_at);
      if (limit) result = result.slice(0, limit);
      return result.map(buildOrderWithItems);
    },
    async getLiveOrders() {
      const liveStatuses: SnackOrderStatus[] = ['pending', 'preparing', 'ready'];
      return [...orders.values()]
        .filter(o => liveStatuses.includes(o.status) && !o.deleted_at)
        .map(buildOrderWithItems);
    },
    async updateOrderStatus(id, status, additionalData?) {
      const existing = orders.get(id);
      if (!existing) throw new Error(`Order ${id} not found`);
      const updated = { ...existing, ...additionalData, status, updated_at: new Date().toISOString() };
      orders.set(id, updated);
      return updated;
    },
  };
}
