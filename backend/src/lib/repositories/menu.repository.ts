/**
 * Menu Repository - Supabase Implementation
 * 
 * Implements MenuRepository interface using Supabase as the data store.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MenuCategory,
  RestaurantMenuItem,
  MenuRepository,
  MenuItemFilters,
} from '../container/types.js';

export function createSupabaseMenuRepository(supabase: SupabaseClient): MenuRepository {
  return {
    // ============================================
    // CATEGORY OPERATIONS
    // ============================================
    
    async getCategories(filters = {}) {
      let query = supabase
        .from('menu_categories')
        .select('*')
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      if (filters.moduleId) {
        query = query.eq('module_id', filters.moduleId);
      }
      if (filters.activeOnly !== false) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getCategoryById(id: string) {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async createCategory(category) {
      const { data, error } = await supabase
        .from('menu_categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateCategory(id: string, updates) {
      const { data, error } = await supabase
        .from('menu_categories')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteCategory(id: string) {
      const { error } = await supabase
        .from('menu_categories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },

    // ============================================
    // MENU ITEM OPERATIONS
    // ============================================

    async getMenuItems(filters: MenuItemFilters = {}) {
      let query = supabase
        .from('menu_items')
        .select(`
          *,
          category:menu_categories(id, name, name_ar, name_fr)
        `)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.moduleId) query = query.eq('module_id', filters.moduleId);
      if (filters.availableOnly) query = query.eq('is_available', true);
      if (filters.featuredOnly) query = query.eq('is_featured', true);
      if (filters.isVegetarian === true) query = query.eq('is_vegetarian', true);
      if (filters.isVegan === true) query = query.eq('is_vegan', true);
      if (filters.isGlutenFree === true) query = query.eq('is_gluten_free', true);
      if (filters.isDairyFree === true) query = query.eq('is_dairy_free', true);
      if (filters.isHalal === true) query = query.eq('is_halal', true);

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getMenuItemById(id: string) {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async getMenuItemsByIds(ids: string[]) {
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .in('id', ids);

      if (error) throw error;
      return data || [];
    },

    async getFeaturedItems(moduleId?: string) {
      let query = supabase
        .from('menu_items')
        .select('*')
        .eq('is_featured', true)
        .eq('is_available', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      if (moduleId) {
        query = query.eq('module_id', moduleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async createMenuItem(item) {
      const { data, error } = await supabase
        .from('menu_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateMenuItem(id: string, updates) {
      const { data, error } = await supabase
        .from('menu_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteMenuItem(id: string) {
      const { error } = await supabase
        .from('menu_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },

    async setItemAvailability(id: string, isAvailable: boolean) {
      const { data, error } = await supabase
        .from('menu_items')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  };
}
