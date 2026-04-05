/**
 * In-Memory Menu Repository
 * Test double for MenuRepository using in-memory data structures.
 */

import type {
  MenuRepository,
  MenuCategory,
  RestaurantMenuItem,
  MenuItemFilters,
} from '../container/types.js';

export function createInMemoryMenuRepository(): MenuRepository & {
  addCategory(cat: Partial<MenuCategory> & { id: string; name: string }): MenuCategory;
  addMenuItem(item: Partial<RestaurantMenuItem> & { id: string; name: string; price: string }): RestaurantMenuItem;
  reset(): void;
} {
  const categories = new Map<string, MenuCategory>();
  const menuItems = new Map<string, RestaurantMenuItem>();

  return {
    addCategory(cat) {
      const full: MenuCategory = {
        display_order: cat.display_order ?? 0,
        is_active: cat.is_active ?? true,
        created_at: cat.created_at ?? new Date().toISOString(),
        updated_at: cat.updated_at ?? new Date().toISOString(),
        ...cat,
      } as MenuCategory;
      categories.set(full.id, full);
      return full;
    },
    addMenuItem(item) {
      const full: RestaurantMenuItem = {
        is_available: item.is_available ?? true,
        is_featured: item.is_featured ?? false,
        is_vegetarian: item.is_vegetarian ?? false,
        is_vegan: item.is_vegan ?? false,
        is_gluten_free: item.is_gluten_free ?? false,
        is_dairy_free: item.is_dairy_free ?? false,
        is_halal: item.is_halal ?? false,
        is_spicy: item.is_spicy ?? false,
        allergens: item.allergens ?? [],
        display_order: item.display_order ?? 0,
        created_at: item.created_at ?? new Date().toISOString(),
        updated_at: item.updated_at ?? new Date().toISOString(),
        ...item,
      } as RestaurantMenuItem;
      menuItems.set(full.id, full);
      return full;
    },
    reset() {
      categories.clear();
      menuItems.clear();
    },

    // Category operations
    async getCategories(filters) {
      let result = [...categories.values()].filter(c => !c.deleted_at);
      if (filters?.moduleId) result = result.filter(c => c.module_id === filters.moduleId);
      if (filters?.activeOnly) result = result.filter(c => c.is_active);
      return result.sort((a, b) => a.display_order - b.display_order);
    },
    async getCategoryById(id) {
      const c = categories.get(id);
      return c && !c.deleted_at ? c : null;
    },
    async createCategory(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const cat: MenuCategory = { ...data, id, created_at: now, updated_at: now } as MenuCategory;
      categories.set(id, cat);
      return cat;
    },
    async updateCategory(id, data) {
      const existing = categories.get(id);
      if (!existing) throw new Error(`Category ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      categories.set(id, updated);
      return updated;
    },
    async deleteCategory(id) {
      const existing = categories.get(id);
      if (existing) categories.set(id, { ...existing, deleted_at: new Date().toISOString() });
    },

    // Menu item operations
    async getMenuItems(filters?: MenuItemFilters) {
      let result = [...menuItems.values()].filter(i => !i.deleted_at);
      if (filters?.categoryId) result = result.filter(i => i.category_id === filters.categoryId);
      if (filters?.moduleId) result = result.filter(i => i.module_id === filters.moduleId);
      if (filters?.availableOnly) result = result.filter(i => i.is_available);
      if (filters?.featuredOnly) result = result.filter(i => i.is_featured);
      if (filters?.isVegetarian) result = result.filter(i => i.is_vegetarian);
      if (filters?.isVegan) result = result.filter(i => i.is_vegan);
      if (filters?.isGlutenFree) result = result.filter(i => i.is_gluten_free);
      if (filters?.isDairyFree) result = result.filter(i => i.is_dairy_free);
      if (filters?.isHalal) result = result.filter(i => i.is_halal);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
      }
      return result.sort((a, b) => a.display_order - b.display_order);
    },
    async getMenuItemById(id) {
      const i = menuItems.get(id);
      return i && !i.deleted_at ? i : null;
    },
    async getMenuItemsByIds(ids) {
      return ids.map(id => menuItems.get(id)).filter((i): i is RestaurantMenuItem => !!i && !i.deleted_at);
    },
    async getFeaturedItems(moduleId) {
      let result = [...menuItems.values()].filter(i => i.is_featured && !i.deleted_at);
      if (moduleId) result = result.filter(i => i.module_id === moduleId);
      return result;
    },
    async createMenuItem(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: RestaurantMenuItem = { ...data, id, created_at: now, updated_at: now } as RestaurantMenuItem;
      menuItems.set(id, item);
      return item;
    },
    async updateMenuItem(id, data) {
      const existing = menuItems.get(id);
      if (!existing) throw new Error(`Menu item ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      menuItems.set(id, updated);
      return updated;
    },
    async deleteMenuItem(id) {
      const existing = menuItems.get(id);
      if (existing) menuItems.set(id, { ...existing, deleted_at: new Date().toISOString() });
    },
    async setItemAvailability(id, isAvailable) {
      const existing = menuItems.get(id);
      if (!existing) throw new Error(`Menu item ${id} not found`);
      const updated = { ...existing, is_available: isAvailable, updated_at: new Date().toISOString() };
      menuItems.set(id, updated);
      return updated;
    },
  };
}
