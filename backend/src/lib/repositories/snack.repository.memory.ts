/**
 * Snack Repository - In-Memory Test Implementation
 * 
 * Implements SnackRepository interface using in-memory storage for testing.
 */

import type {
  SnackItem,
  SnackOrder,
  SnackOrderItem,
  SnackOrderWithItems,
  SnackRepository,
  SnackItemFilters,
  SnackOrderFilters,
  SnackOrderStatus,
} from '../container/types.js';

export interface InMemorySnackRepository extends SnackRepository {
  // Test helpers
  addItem(item: SnackItem): void;
  addOrder(order: SnackOrder): void;
  addOrderItem(item: SnackOrderItem): void;
  clear(): void;
  getAllItems(): SnackItem[];
  getAllOrders(): SnackOrder[];
}

export function createInMemorySnackRepository(): InMemorySnackRepository {
  const items = new Map<string, SnackItem>();
  const orders = new Map<string, SnackOrder>();
  const orderItems = new Map<string, SnackOrderItem[]>(); // order_id -> items
  
  let nextId = 1;
  const generateId = (prefix: string) => `${prefix}-${nextId++}`;

  return {
    // ============================================
    // ITEM OPERATIONS
    // ============================================
    
    async getItems(filters: SnackItemFilters = {}) {
      let result = Array.from(items.values()).filter(i => !i.deleted_at);
      
      if (filters.moduleId) {
        result = result.filter(i => i.module_id === filters.moduleId);
      }
      if (filters.category) {
        result = result.filter(i => i.category === filters.category);
      }
      if (filters.availableOnly) {
        result = result.filter(i => i.is_available);
      }
      
      return result.sort((a, b) => a.display_order - b.display_order);
    },

    async getItemById(id: string) {
      const item = items.get(id);
      if (!item || item.deleted_at) return null;
      return item;
    },

    async getItemsByIds(ids: string[]) {
      return ids
        .map(id => items.get(id))
        .filter((i): i is SnackItem => i !== undefined && !i.deleted_at);
    },

    async createItem(itemData) {
      const now = new Date().toISOString();
      const item: SnackItem = {
        ...itemData,
        id: generateId('snack-item'),
        created_at: now,
        updated_at: now,
      };
      items.set(item.id, item);
      return item;
    },

    async updateItem(id: string, updates) {
      const item = items.get(id);
      if (!item) throw new Error('Item not found');
      
      const updated: SnackItem = {
        ...item,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      items.set(id, updated);
      return updated;
    },

    async deleteItem(id: string) {
      const item = items.get(id);
      if (item) {
        item.deleted_at = new Date().toISOString();
        items.set(id, item);
      }
    },

    async setItemAvailability(id: string, isAvailable: boolean) {
      const item = items.get(id);
      if (!item) throw new Error('Item not found');
      
      const updated: SnackItem = {
        ...item,
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      };
      items.set(id, updated);
      return updated;
    },

    // ============================================
    // ORDER OPERATIONS
    // ============================================

    async createOrder(orderData) {
      const now = new Date().toISOString();
      const order: SnackOrder = {
        ...orderData,
        id: generateId('snack-order'),
        created_at: now,
        updated_at: now,
      };
      orders.set(order.id, order);
      orderItems.set(order.id, []);
      return order;
    },

    async createOrderItems(itemsData) {
      const created: SnackOrderItem[] = [];
      
      for (const itemData of itemsData) {
        const orderItem: SnackOrderItem = {
          ...itemData,
          id: generateId('snack-order-item'),
        };
        
        const existing = orderItems.get(itemData.order_id) || [];
        existing.push(orderItem);
        orderItems.set(itemData.order_id, existing);
        created.push(orderItem);
      }
      
      return created;
    },

    async getOrderById(id: string) {
      const order = orders.get(id);
      if (!order || order.deleted_at) return null;
      
      const items = orderItems.get(id) || [];
      return {
        ...order,
        items: items.map(oi => ({
          ...oi,
          item: this.getAllItems().find(i => i.id === oi.snack_item_id),
        })),
      } as SnackOrderWithItems;
    },

    async getOrders(filters: SnackOrderFilters = {}) {
      let result = Array.from(orders.values()).filter(o => !o.deleted_at);
      
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        result = result.filter(o => statuses.includes(o.status));
      }
      
      if (filters.customerId) {
        result = result.filter(o => o.customer_id === filters.customerId);
      }
      
      result = result.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      if (filters.limit) {
        result = result.slice(0, filters.limit);
      }
      
      return result.map(order => ({
        ...order,
        items: (orderItems.get(order.id) || []).map(oi => ({
          ...oi,
          item: this.getAllItems().find(i => i.id === oi.snack_item_id),
        })),
      })) as SnackOrderWithItems[];
    },

    async getOrdersByCustomer(customerId: string, limit = 50) {
      return this.getOrders({ customerId, limit });
    },

    async getLiveOrders() {
      const activeStatuses: SnackOrderStatus[] = ['pending', 'preparing', 'ready'];
      return this.getOrders({ status: activeStatuses });
    },

    async updateOrderStatus(id: string, status: SnackOrderStatus, additionalData = {}) {
      const order = orders.get(id);
      if (!order) throw new Error('Order not found');
      
      const updated: SnackOrder = {
        ...order,
        status,
        ...additionalData,
        updated_at: new Date().toISOString(),
      };
      orders.set(id, updated);
      return updated;
    },

    // ============================================
    // TEST HELPERS
    // ============================================

    addItem(item: SnackItem) {
      items.set(item.id, item);
    },

    addOrder(order: SnackOrder) {
      orders.set(order.id, order);
      if (!orderItems.has(order.id)) {
        orderItems.set(order.id, []);
      }
    },

    addOrderItem(item: SnackOrderItem) {
      const existing = orderItems.get(item.order_id) || [];
      existing.push(item);
      orderItems.set(item.order_id, existing);
    },

    clear() {
      items.clear();
      orders.clear();
      orderItems.clear();
      nextId = 1;
    },

    getAllItems() {
      return Array.from(items.values());
    },

    getAllOrders() {
      return Array.from(orders.values());
    },
  };
}
