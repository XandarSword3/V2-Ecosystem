/**
 * Restaurant Repository - Supabase Implementation
 * 
 * Handles all database operations for restaurant orders, menu items, and tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  RestaurantRepository, 
  RestaurantOrder, 
  RestaurantOrderItem, 
  RestaurantMenuItem, 
  RestaurantTable 
} from '../container/types.js';

export function createRestaurantRepository(supabase: SupabaseClient): RestaurantRepository {
  return {
    // ============================================
    // ORDER OPERATIONS
    // ============================================

    async createOrder(order: Omit<RestaurantOrder, 'id' | 'created_at' | 'updated_at'>): Promise<RestaurantOrder> {
      const { data, error } = await supabase
        .from('restaurant_orders')
        .insert(order)
        .select()
        .single();

      if (error) throw error;
      return data as RestaurantOrder;
    },

    async getOrderById(id: string): Promise<RestaurantOrder | null> {
      const { data, error } = await supabase
        .from('restaurant_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as RestaurantOrder;
    },

    async getOrderByNumber(orderNumber: string): Promise<RestaurantOrder | null> {
      const { data, error } = await supabase
        .from('restaurant_orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as RestaurantOrder;
    },

    async getOrders(filters: { status?: string; date?: string; moduleId?: string }): Promise<RestaurantOrder[]> {
      let query = supabase
        .from('restaurant_orders')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters.moduleId) {
        query = query.eq('module_id', filters.moduleId);
      }

      if (filters.status) {
        const statuses = filters.status.split(',').map(s => s.trim());
        if (statuses.length > 1) {
          query = query.in('status', statuses);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RestaurantOrder[];
    },

    async getLiveOrders(moduleId?: string): Promise<RestaurantOrder[]> {
      const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready'];

      let query = supabase
        .from('restaurant_orders')
        .select('*')
        .in('status', activeStatuses)
        .order('created_at', { ascending: true });

      if (moduleId) {
        query = query.eq('module_id', moduleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RestaurantOrder[];
    },

    async getOrdersByCustomer(customerId: string): Promise<RestaurantOrder[]> {
      const { data, error } = await supabase
        .from('restaurant_orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as RestaurantOrder[];
    },

    async updateOrder(id: string, updates: Partial<RestaurantOrder>): Promise<RestaurantOrder> {
      const { data, error } = await supabase
        .from('restaurant_orders')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RestaurantOrder;
    },

    // ============================================
    // ORDER ITEMS OPERATIONS
    // ============================================

    async createOrderItems(items: Omit<RestaurantOrderItem, 'id' | 'created_at'>[]): Promise<RestaurantOrderItem[]> {
      const { data, error } = await supabase
        .from('restaurant_order_items')
        .insert(items)
        .select();

      if (error) throw error;
      return (data || []) as RestaurantOrderItem[];
    },

    async getOrderItems(orderId: string): Promise<RestaurantOrderItem[]> {
      const { data, error } = await supabase
        .from('restaurant_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;
      return (data || []) as RestaurantOrderItem[];
    },

    // ============================================
    // MENU ITEMS OPERATIONS
    // ============================================

    async getMenuItemById(id: string): Promise<RestaurantMenuItem | null> {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as RestaurantMenuItem;
    },

    async getMenuItemsByIds(ids: string[]): Promise<RestaurantMenuItem[]> {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .in('id', ids);

      if (error) throw error;
      return (data || []) as RestaurantMenuItem[];
    },

    async getMenuItems(filters?: { categoryId?: string; moduleId?: string; available?: boolean }): Promise<RestaurantMenuItem[]> {
      let query = supabase
        .from('menu_items')
        .select('*')
        .order('name');

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.moduleId) {
        query = query.eq('module_id', filters.moduleId);
      }
      if (filters?.available !== undefined) {
        query = query.eq('is_available', filters.available);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RestaurantMenuItem[];
    },

    // ============================================
    // TABLE OPERATIONS
    // ============================================

    async getTableById(id: string): Promise<RestaurantTable | null> {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as RestaurantTable;
    },

    async getTables(moduleId?: string): Promise<RestaurantTable[]> {
      let query = supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number');

      if (moduleId) {
        query = query.eq('module_id', moduleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RestaurantTable[];
    },

    async updateTable(id: string, updates: Partial<RestaurantTable>): Promise<RestaurantTable> {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RestaurantTable;
    },

    async rpc(fn: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> {
      // @ts-ignore - PostgrestError is close enough to Error for our needs
      return supabase.rpc(fn, params);
    },
  };
}

export type { RestaurantRepository };
