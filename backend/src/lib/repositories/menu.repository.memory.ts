/**
 * Menu Repository - In-Memory Test Implementation
 * 
 * Implements MenuRepository interface using in-memory storage for testing.
 */

import type {
  MenuCategory,
  RestaurantMenuItem,
  MenuRepository,
  MenuItemFilters,
} from '../container/types.js';

export interface InMemoryMenuRepository extends MenuRepository {
  // Test helpers
  addCategory(category: MenuCategory): void;
  addMenuItem(item: RestaurantMenuItem): void;
  clear(): void;
  getAllCategories(): MenuCategory[];
  getAllMenuItems(): RestaurantMenuItem[];
}

export function createInMemoryMenuRepository(): InMemoryMenuRepository {
  const categories = new Map<string, MenuCategory>();
  const menuItems = new Map<string, RestaurantMenuItem>();
  
  let nextId = 1;
  const generateId = () => `menu-item-${nextId++}`;

  return {
    // ============================================
    // CATEGORY OPERATIONS
    // ============================================
    
    async getCategories(filters = {}) {
      let result = Array.from(categories.values()).filter(c => !c.deleted_at);
      
      if (filters.moduleId) {
        result = result.filter(c => c.module_id === filters.moduleId);
      }
      if (filters.activeOnly !== false) {
        result = result.filter(c => c.is_active);
      }
      
      return result.sort((a, b) => a.display_order - b.display_order);
    },

    async getCategoryById(id: string) {
      const category = categories.get(id);
      if (!category || category.deleted_at) return null;
      return category;
    },

    async createCategory(categoryData) {
      const now = new Date().toISOString();
      const category: MenuCategory = {
        ...categoryData,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };
      categories.set(category.id, category);
      return category;
    },

    async updateCategory(id: string, updates) {
      const category = categories.get(id);
      if (!category) throw new Error('Category not found');
      
      const updated: MenuCategory = {
        ...category,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      categories.set(id, updated);
      return updated;
    },

    async deleteCategory(id: string) {
      const category = categories.get(id);
      if (category) {
        category.deleted_at = new Date().toISOString();
        categories.set(id, category);
      }
    },

    // ============================================
    // MENU ITEM OPERATIONS
    // ============================================

    async getMenuItems(filters: MenuItemFilters = {}) {
      let result = Array.from(menuItems.values()).filter(i => !i.deleted_at);
      
      if (filters.categoryId) result = result.filter(i => i.category_id === filters.categoryId);
      if (filters.moduleId) result = result.filter(i => i.module_id === filters.moduleId);
      if (filters.availableOnly) result = result.filter(i => i.is_available);
      if (filters.featuredOnly) result = result.filter(i => i.is_featured);
      if (filters.isVegetarian === true) result = result.filter(i => i.is_vegetarian);
      if (filters.isVegan === true) result = result.filter(i => i.is_vegan);
      if (filters.isGlutenFree === true) result = result.filter(i => i.is_gluten_free);
      if (filters.isDairyFree === true) result = result.filter(i => i.is_dairy_free);
      if (filters.isHalal === true) result = result.filter(i => i.is_halal);
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(i => 
          i.name.toLowerCase().includes(searchLower) ||
          (i.description && i.description.toLowerCase().includes(searchLower))
        );
      }
      
      return result.sort((a, b) => a.display_order - b.display_order);
    },

    async getMenuItemById(id: string) {
      const item = menuItems.get(id);
      if (!item || item.deleted_at) return null;
      return item;
    },

    async getMenuItemsByIds(ids: string[]) {
      return ids.map(id => menuItems.get(id)).filter((i): i is RestaurantMenuItem => i !== undefined);
    },

    async getFeaturedItems(moduleId?: string) {
      let result = Array.from(menuItems.values())
        .filter(i => i.is_featured && i.is_available && !i.deleted_at);
      
      if (moduleId) {
        result = result.filter(i => i.module_id === moduleId);
      }
      
      return result.sort((a, b) => a.display_order - b.display_order);
    },

    async createMenuItem(itemData) {
      const now = new Date().toISOString();
      const item: RestaurantMenuItem = {
        ...itemData,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };
      menuItems.set(item.id, item);
      return item;
    },

    async updateMenuItem(id: string, updates) {
      const item = menuItems.get(id);
      if (!item) throw new Error('Menu item not found');
      
      const updated: RestaurantMenuItem = {
        ...item,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      menuItems.set(id, updated);
      return updated;
    },

    async deleteMenuItem(id: string) {
      const item = menuItems.get(id);
      if (item) {
        item.deleted_at = new Date().toISOString();
        menuItems.set(id, item);
      }
    },

    async setItemAvailability(id: string, isAvailable: boolean) {
      const item = menuItems.get(id);
      if (!item) throw new Error('Menu item not found');
      
      const updated: RestaurantMenuItem = {
        ...item,
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      };
      menuItems.set(id, updated);
      return updated;
    },

    // ============================================
    // TEST HELPERS
    // ============================================

    addCategory(category: MenuCategory) {
      categories.set(category.id, category);
    },

    addMenuItem(item: RestaurantMenuItem) {
      menuItems.set(item.id, item);
    },

    clear() {
      categories.clear();
      menuItems.clear();
      nextId = 1;
    },

    getAllCategories() {
      return Array.from(categories.values());
    },

    getAllMenuItems() {
      return Array.from(menuItems.values());
    },
  };
}
