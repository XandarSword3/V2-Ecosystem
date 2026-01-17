/**
 * Restaurant Repository - In-Memory Implementation
 * 
 * Test double for RestaurantRepository that stores data in memory.
 * Provides test helpers for inspecting and manipulating state.
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  RestaurantRepository, 
  RestaurantOrder, 
  RestaurantOrderItem, 
  RestaurantMenuItem, 
  RestaurantTable 
} from '../container/types.js';

export interface InMemoryRestaurantRepository extends RestaurantRepository {
  // Test helpers
  addOrder(order: RestaurantOrder): void;
  addOrderItem(item: RestaurantOrderItem): void;
  addMenuItem(item: RestaurantMenuItem): void;
  addTable(table: RestaurantTable): void;
  clear(): void;
  getAllOrders(): RestaurantOrder[];
  getAllOrderItems(): RestaurantOrderItem[];
  getAllMenuItems(): RestaurantMenuItem[];
  getAllTables(): RestaurantTable[];
}

export function createInMemoryRestaurantRepository(): InMemoryRestaurantRepository {
  // In-memory storage
  const orders = new Map<string, RestaurantOrder>();
  const ordersByNumber = new Map<string, RestaurantOrder>();
  const orderItems = new Map<string, RestaurantOrderItem[]>(); // orderId -> items
  const menuItems = new Map<string, RestaurantMenuItem>();
  const tables = new Map<string, RestaurantTable>();

  return {
    // ============================================
    // ORDER OPERATIONS
    // ============================================

    async createOrder(orderData: Omit<RestaurantOrder, 'id' | 'created_at' | 'updated_at'>): Promise<RestaurantOrder> {
      const order: RestaurantOrder = {
        ...orderData,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      orders.set(order.id, order);
      ordersByNumber.set(order.order_number, order);
      return order;
    },

    async getOrderById(id: string): Promise<RestaurantOrder | null> {
      return orders.get(id) || null;
    },

    async getOrderByNumber(orderNumber: string): Promise<RestaurantOrder | null> {
      return ordersByNumber.get(orderNumber) || null;
    },

    async getOrders(filters: { status?: string; date?: string; moduleId?: string }): Promise<RestaurantOrder[]> {
      let result = Array.from(orders.values());

      if (filters.moduleId) {
        result = result.filter(o => o.module_id === filters.moduleId);
      }

      if (filters.status) {
        const statuses = filters.status.split(',').map(s => s.trim());
        result = result.filter(o => statuses.includes(o.status));
      }

      if (filters.date) {
        const filterDate = new Date(filters.date);
        result = result.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate.toDateString() === filterDate.toDateString();
        });
      }

      return result.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },

    async getLiveOrders(moduleId?: string): Promise<RestaurantOrder[]> {
      const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready'];
      let result = Array.from(orders.values()).filter(o => activeStatuses.includes(o.status));

      if (moduleId) {
        result = result.filter(o => o.module_id === moduleId);
      }

      return result.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    },

    async getOrdersByCustomer(customerId: string): Promise<RestaurantOrder[]> {
      return Array.from(orders.values())
        .filter(o => o.customer_id === customerId)
        .sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    },

    async updateOrder(id: string, updates: Partial<RestaurantOrder>): Promise<RestaurantOrder> {
      const order = orders.get(id);
      if (!order) throw new Error('Order not found');

      const updatedOrder: RestaurantOrder = {
        ...order,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      orders.set(id, updatedOrder);
      ordersByNumber.set(updatedOrder.order_number, updatedOrder);
      return updatedOrder;
    },

    // ============================================
    // ORDER ITEMS OPERATIONS
    // ============================================

    async createOrderItems(items: Omit<RestaurantOrderItem, 'id' | 'created_at'>[]): Promise<RestaurantOrderItem[]> {
      const createdItems: RestaurantOrderItem[] = items.map(item => ({
        ...item,
        id: uuidv4(),
        created_at: new Date().toISOString(),
      }));

      for (const item of createdItems) {
        const existingItems = orderItems.get(item.order_id) || [];
        orderItems.set(item.order_id, [...existingItems, item]);
      }

      return createdItems;
    },

    async getOrderItems(orderId: string): Promise<RestaurantOrderItem[]> {
      return orderItems.get(orderId) || [];
    },

    // ============================================
    // MENU ITEMS OPERATIONS
    // ============================================

    async getMenuItemById(id: string): Promise<RestaurantMenuItem | null> {
      return menuItems.get(id) || null;
    },

    async getMenuItemsByIds(ids: string[]): Promise<RestaurantMenuItem[]> {
      return ids.map(id => menuItems.get(id)).filter(Boolean) as RestaurantMenuItem[];
    },

    async getMenuItems(filters?: { categoryId?: string; moduleId?: string; available?: boolean }): Promise<RestaurantMenuItem[]> {
      let result = Array.from(menuItems.values());

      if (filters?.categoryId) {
        result = result.filter(i => i.category_id === filters.categoryId);
      }
      if (filters?.moduleId) {
        result = result.filter(i => i.module_id === filters.moduleId);
      }
      if (filters?.available !== undefined) {
        result = result.filter(i => i.is_available === filters.available);
      }

      return result.sort((a, b) => a.name.localeCompare(b.name));
    },

    // ============================================
    // TABLE OPERATIONS
    // ============================================

    async getTableById(id: string): Promise<RestaurantTable | null> {
      return tables.get(id) || null;
    },

    async getTables(moduleId?: string): Promise<RestaurantTable[]> {
      let result = Array.from(tables.values());

      if (moduleId) {
        result = result.filter(t => t.module_id === moduleId);
      }

      return result.sort((a, b) => a.table_number.localeCompare(b.table_number));
    },

    async updateTable(id: string, updates: Partial<RestaurantTable>): Promise<RestaurantTable> {
      const table = tables.get(id);
      if (!table) throw new Error('Table not found');

      const updatedTable: RestaurantTable = {
        ...table,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      tables.set(id, updatedTable);
      return updatedTable;
    },

    // ============================================
    // TEST HELPERS
    // ============================================

    addOrder(order: RestaurantOrder): void {
      orders.set(order.id, order);
      ordersByNumber.set(order.order_number, order);
    },

    addOrderItem(item: RestaurantOrderItem): void {
      const existingItems = orderItems.get(item.order_id) || [];
      orderItems.set(item.order_id, [...existingItems, item]);
    },

    addMenuItem(item: RestaurantMenuItem): void {
      menuItems.set(item.id, item);
    },

    addTable(table: RestaurantTable): void {
      tables.set(table.id, table);
    },

    clear(): void {
      orders.clear();
      ordersByNumber.clear();
      orderItems.clear();
      menuItems.clear();
      tables.clear();
    },

    getAllOrders(): RestaurantOrder[] {
      return Array.from(orders.values());
    },

    getAllOrderItems(): RestaurantOrderItem[] {
      const allItems: RestaurantOrderItem[] = [];
      for (const items of orderItems.values()) {
        allItems.push(...items);
      }
      return allItems;
    },

    getAllMenuItems(): RestaurantMenuItem[] {
      return Array.from(menuItems.values());
    },

    getAllTables(): RestaurantTable[] {
      return Array.from(tables.values());
    },
  };
}

export type { RestaurantOrder, RestaurantOrderItem, RestaurantMenuItem, RestaurantTable };
