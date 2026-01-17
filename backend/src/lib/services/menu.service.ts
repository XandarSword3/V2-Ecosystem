/**
 * Menu Service
 * 
 * Business logic for restaurant menu management with dependency injection.
 * Handles categories, menu items, availability, and dietary filters.
 */

import type {
  MenuRepository,
  MenuCategory,
  RestaurantMenuItem,
  MenuItemFilters,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
} from '../container/types.js';

// ============================================
// ERROR TYPES
// ============================================

export class MenuServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'MenuServiceError';
  }
}

// ============================================
// SERVICE TYPES
// ============================================

export interface CreateCategoryInput {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  displayOrder?: number;
  imageUrl?: string;
  moduleId?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  displayOrder?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface CreateMenuItemInput {
  categoryId: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  price: number;
  discountPrice?: number;
  preparationTimeMinutes?: number;
  calories?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  isHalal?: boolean;
  isSpicy?: boolean;
  allergens?: string[];
  imageUrl?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
  moduleId?: string;
}

export interface UpdateMenuItemInput {
  categoryId?: string;
  name?: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  price?: number;
  discountPrice?: number;
  preparationTimeMinutes?: number;
  calories?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  isHalal?: boolean;
  isSpicy?: boolean;
  allergens?: string[];
  imageUrl?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
}

export interface MenuServiceDeps {
  menuRepository: MenuRepository;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
}

export interface MenuService {
  // Category operations
  getCategories(filters?: { moduleId?: string; activeOnly?: boolean }): Promise<MenuCategory[]>;
  getCategoryById(id: string): Promise<MenuCategory | null>;
  createCategory(input: CreateCategoryInput, userId?: string): Promise<MenuCategory>;
  updateCategory(id: string, input: UpdateCategoryInput, userId?: string): Promise<MenuCategory>;
  deleteCategory(id: string, userId?: string): Promise<void>;
  
  // Menu item operations
  getMenuItems(filters?: MenuItemFilters): Promise<RestaurantMenuItem[]>;
  getMenuItemById(id: string): Promise<RestaurantMenuItem | null>;
  getFeaturedItems(moduleId?: string): Promise<RestaurantMenuItem[]>;
  createMenuItem(input: CreateMenuItemInput, userId?: string): Promise<RestaurantMenuItem>;
  updateMenuItem(id: string, input: UpdateMenuItemInput, userId?: string): Promise<RestaurantMenuItem>;
  deleteMenuItem(id: string, userId?: string): Promise<void>;
  setItemAvailability(id: string, isAvailable: boolean, userId?: string): Promise<RestaurantMenuItem>;
  bulkUpdateAvailability(ids: string[], isAvailable: boolean, userId?: string): Promise<RestaurantMenuItem[]>;
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createMenuService(deps: MenuServiceDeps): MenuService {
  const { menuRepository, logger, activityLogger, socketEmitter } = deps;

  return {
    // ============================================
    // CATEGORY OPERATIONS
    // ============================================

    async getCategories(filters) {
      return menuRepository.getCategories(filters);
    },

    async getCategoryById(id) {
      return menuRepository.getCategoryById(id);
    },

    async createCategory(input, userId) {
      const category = await menuRepository.createCategory({
        name: input.name,
        name_ar: input.nameAr,
        name_fr: input.nameFr,
        description: input.description,
        display_order: input.displayOrder || 0,
        image_url: input.imageUrl,
        module_id: input.moduleId,
        is_active: true,
      });

      await activityLogger.log('CREATE_MENU_CATEGORY', {
        categoryId: category.id,
        name: category.name,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:categoryCreated', {
        id: category.id,
        name: category.name,
      });

      logger.info('Menu category created', { categoryId: category.id, name: category.name });

      return category;
    },

    async updateCategory(id, input, userId) {
      const existing = await menuRepository.getCategoryById(id);
      if (!existing) {
        throw new MenuServiceError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      const updateData: Partial<MenuCategory> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.nameAr !== undefined) updateData.name_ar = input.nameAr;
      if (input.nameFr !== undefined) updateData.name_fr = input.nameFr;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.displayOrder !== undefined) updateData.display_order = input.displayOrder;
      if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;

      const category = await menuRepository.updateCategory(id, updateData);

      await activityLogger.log('UPDATE_MENU_CATEGORY', {
        categoryId: id,
        changes: input,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:categoryUpdated', {
        id: category.id,
        name: category.name,
      });

      return category;
    },

    async deleteCategory(id, userId) {
      const existing = await menuRepository.getCategoryById(id);
      if (!existing) {
        throw new MenuServiceError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      // Check if category has items
      const items = await menuRepository.getMenuItems({ categoryId: id });
      if (items.length > 0) {
        throw new MenuServiceError(
          'Cannot delete category with existing items',
          'CATEGORY_HAS_ITEMS',
          400
        );
      }

      await menuRepository.deleteCategory(id);

      await activityLogger.log('DELETE_MENU_CATEGORY', {
        categoryId: id,
        name: existing.name,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:categoryDeleted', { id });
    },

    // ============================================
    // MENU ITEM OPERATIONS
    // ============================================

    async getMenuItems(filters) {
      return menuRepository.getMenuItems(filters);
    },

    async getMenuItemById(id) {
      return menuRepository.getMenuItemById(id);
    },

    async getFeaturedItems(moduleId) {
      return menuRepository.getFeaturedItems(moduleId);
    },

    async createMenuItem(input, userId) {
      // Validate category exists
      const category = await menuRepository.getCategoryById(input.categoryId);
      if (!category) {
        throw new MenuServiceError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      // Validate price
      if (input.price < 0) {
        throw new MenuServiceError('Price cannot be negative', 'INVALID_PRICE', 400);
      }

      if (input.discountPrice !== undefined && input.discountPrice >= input.price) {
        throw new MenuServiceError(
          'Discount price must be less than regular price',
          'INVALID_DISCOUNT',
          400
        );
      }

      const item = await menuRepository.createMenuItem({
        category_id: input.categoryId,
        name: input.name,
        name_ar: input.nameAr,
        name_fr: input.nameFr,
        description: input.description,
        description_ar: input.descriptionAr,
        description_fr: input.descriptionFr,
        price: input.price.toString(),
        discount_price: input.discountPrice?.toString(),
        preparation_time_minutes: input.preparationTimeMinutes,
        calories: input.calories,
        is_vegetarian: input.isVegetarian || false,
        is_vegan: input.isVegan || false,
        is_gluten_free: input.isGlutenFree || false,
        is_dairy_free: input.isDairyFree || false,
        is_halal: input.isHalal || false,
        is_spicy: input.isSpicy || false,
        allergens: input.allergens || [],
        image_url: input.imageUrl,
        is_available: input.isAvailable !== false,
        is_featured: input.isFeatured || false,
        display_order: input.displayOrder || 0,
        module_id: input.moduleId,
      });

      await activityLogger.log('CREATE_MENU_ITEM', {
        itemId: item.id,
        name: item.name,
        categoryId: input.categoryId,
        price: input.price,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:itemCreated', {
        id: item.id,
        name: item.name,
        categoryId: input.categoryId,
      });

      logger.info('Menu item created', { itemId: item.id, name: item.name });

      return item;
    },

    async updateMenuItem(id, input, userId) {
      const existing = await menuRepository.getMenuItemById(id);
      if (!existing) {
        throw new MenuServiceError('Menu item not found', 'ITEM_NOT_FOUND', 404);
      }

      // Validate category if changing
      if (input.categoryId) {
        const category = await menuRepository.getCategoryById(input.categoryId);
        if (!category) {
          throw new MenuServiceError('Category not found', 'CATEGORY_NOT_FOUND', 404);
        }
      }

      // Validate price
      if (input.price !== undefined && input.price < 0) {
        throw new MenuServiceError('Price cannot be negative', 'INVALID_PRICE', 400);
      }

      const currentPrice = input.price !== undefined ? input.price : parseFloat(existing.price);
      if (input.discountPrice !== undefined && input.discountPrice >= currentPrice) {
        throw new MenuServiceError(
          'Discount price must be less than regular price',
          'INVALID_DISCOUNT',
          400
        );
      }

      const updateData: Partial<RestaurantMenuItem> = {};
      if (input.categoryId !== undefined) updateData.category_id = input.categoryId;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.nameAr !== undefined) updateData.name_ar = input.nameAr;
      if (input.nameFr !== undefined) updateData.name_fr = input.nameFr;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.descriptionAr !== undefined) updateData.description_ar = input.descriptionAr;
      if (input.descriptionFr !== undefined) updateData.description_fr = input.descriptionFr;
      if (input.price !== undefined) updateData.price = input.price.toString();
      if (input.discountPrice !== undefined) updateData.discount_price = input.discountPrice.toString();
      if (input.preparationTimeMinutes !== undefined) updateData.preparation_time_minutes = input.preparationTimeMinutes;
      if (input.calories !== undefined) updateData.calories = input.calories;
      if (input.isVegetarian !== undefined) updateData.is_vegetarian = input.isVegetarian;
      if (input.isVegan !== undefined) updateData.is_vegan = input.isVegan;
      if (input.isGlutenFree !== undefined) updateData.is_gluten_free = input.isGlutenFree;
      if (input.isDairyFree !== undefined) updateData.is_dairy_free = input.isDairyFree;
      if (input.isHalal !== undefined) updateData.is_halal = input.isHalal;
      if (input.isSpicy !== undefined) updateData.is_spicy = input.isSpicy;
      if (input.allergens !== undefined) updateData.allergens = input.allergens;
      if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;
      if (input.isAvailable !== undefined) updateData.is_available = input.isAvailable;
      if (input.isFeatured !== undefined) updateData.is_featured = input.isFeatured;
      if (input.displayOrder !== undefined) updateData.display_order = input.displayOrder;

      const item = await menuRepository.updateMenuItem(id, updateData);

      await activityLogger.log('UPDATE_MENU_ITEM', {
        itemId: id,
        changes: input,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:itemUpdated', {
        id: item.id,
        name: item.name,
      });

      return item;
    },

    async deleteMenuItem(id, userId) {
      const existing = await menuRepository.getMenuItemById(id);
      if (!existing) {
        throw new MenuServiceError('Menu item not found', 'ITEM_NOT_FOUND', 404);
      }

      await menuRepository.deleteMenuItem(id);

      await activityLogger.log('DELETE_MENU_ITEM', {
        itemId: id,
        name: existing.name,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:itemDeleted', { id });
    },

    async setItemAvailability(id, isAvailable, userId) {
      const existing = await menuRepository.getMenuItemById(id);
      if (!existing) {
        throw new MenuServiceError('Menu item not found', 'ITEM_NOT_FOUND', 404);
      }

      const item = await menuRepository.setItemAvailability(id, isAvailable);

      await activityLogger.log('SET_ITEM_AVAILABILITY', {
        itemId: id,
        name: existing.name,
        isAvailable,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:availabilityChanged', {
        id: item.id,
        name: item.name,
        isAvailable,
      });

      return item;
    },

    async bulkUpdateAvailability(ids, isAvailable, userId) {
      const results: RestaurantMenuItem[] = [];

      for (const id of ids) {
        const existing = await menuRepository.getMenuItemById(id);
        if (existing) {
          const item = await menuRepository.setItemAvailability(id, isAvailable);
          results.push(item);
        }
      }

      await activityLogger.log('BULK_UPDATE_AVAILABILITY', {
        itemCount: results.length,
        isAvailable,
      }, userId);

      socketEmitter.emitToUnit('restaurant', 'menu:bulkAvailabilityChanged', {
        itemIds: ids,
        isAvailable,
      });

      return results;
    },
  };
}
