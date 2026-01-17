/**
 * Menu Service Unit Tests
 * 
 * Tests for menu categories and items with dietary filters.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMenuService,
  MenuService,
  MenuServiceError,
} from '../../src/lib/services/menu.service.js';
import { createInMemoryMenuRepository } from '../../src/lib/repositories/menu.repository.memory.js';
import type { LoggerService, ActivityLoggerService, SocketEmitter } from '../../src/lib/container/types.js';

// ============================================
// TEST FIXTURES
// ============================================

function createMockLogger(): LoggerService {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockActivityLogger(): ActivityLoggerService {
  return {
    log: vi.fn().mockResolvedValue(undefined),
    getActivityLogs: vi.fn().mockResolvedValue([]),
  };
}

function createMockSocketEmitter(): SocketEmitter {
  return {
    emitToUnit: vi.fn(),
    emitToUser: vi.fn(),
  };
}

// ============================================
// CATEGORY TESTS
// ============================================

describe('MenuService - Categories', () => {
  let service: MenuService;
  let menuRepository: ReturnType<typeof createInMemoryMenuRepository>;
  let mockActivityLogger: ActivityLoggerService;
  let mockSocketEmitter: SocketEmitter;

  beforeEach(() => {
    menuRepository = createInMemoryMenuRepository();
    mockActivityLogger = createMockActivityLogger();
    mockSocketEmitter = createMockSocketEmitter();

    service = createMenuService({
      menuRepository,
      logger: createMockLogger(),
      activityLogger: mockActivityLogger,
      socketEmitter: mockSocketEmitter,
    });
  });

  describe('getCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await service.getCategories();
      expect(result).toEqual([]);
    });

    it('should return all categories', async () => {
      menuRepository.addCategory({
        id: 'cat-1',
        name: 'Appetizers',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addCategory({
        id: 'cat-2',
        name: 'Main Course',
        display_order: 2,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getCategories();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Appetizers');
      expect(result[1].name).toBe('Main Course');
    });

    it('should filter by module ID', async () => {
      menuRepository.addCategory({
        id: 'cat-1',
        name: 'Restaurant Category',
        module_id: 'restaurant',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addCategory({
        id: 'cat-2',
        name: 'Snack Category',
        module_id: 'snack',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getCategories({ moduleId: 'restaurant' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Restaurant Category');
    });

    it('should filter active only', async () => {
      menuRepository.addCategory({
        id: 'cat-1',
        name: 'Active Category',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addCategory({
        id: 'cat-2',
        name: 'Inactive Category',
        display_order: 2,
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getCategories({ activeOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Active Category');
    });
  });

  describe('getCategoryById', () => {
    it('should return category by ID', async () => {
      menuRepository.addCategory({
        id: 'cat-1',
        name: 'Test Category',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getCategoryById('cat-1');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Category');
    });

    it('should return null for non-existent category', async () => {
      const result = await service.getCategoryById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const result = await service.createCategory({
        name: 'New Category',
        description: 'Test description',
        displayOrder: 5,
      }, 'user-1');

      expect(result.name).toBe('New Category');
      expect(result.description).toBe('Test description');
      expect(result.display_order).toBe(5);
      expect(result.is_active).toBe(true);
    });

    it('should create category with translations', async () => {
      const result = await service.createCategory({
        name: 'Drinks',
        nameAr: 'مشروبات',
        nameFr: 'Boissons',
      });

      expect(result.name).toBe('Drinks');
      expect(result.name_ar).toBe('مشروبات');
      expect(result.name_fr).toBe('Boissons');
    });

    it('should log activity on category creation', async () => {
      await service.createCategory({ name: 'Logged Category' }, 'user-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'CREATE_MENU_CATEGORY',
        expect.objectContaining({ name: 'Logged Category' }),
        'user-123'
      );
    });

    it('should emit socket event on category creation', async () => {
      const result = await service.createCategory({ name: 'Socket Category' });

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'menu:categoryCreated',
        expect.objectContaining({ name: 'Socket Category' })
      );
    });
  });

  describe('updateCategory', () => {
    beforeEach(() => {
      menuRepository.addCategory({
        id: 'cat-update',
        name: 'Original Name',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should update category name', async () => {
      const result = await service.updateCategory('cat-update', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should update multiple fields', async () => {
      const result = await service.updateCategory('cat-update', {
        name: 'New Name',
        description: 'New Description',
        displayOrder: 10,
        isActive: false,
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Description');
      expect(result.display_order).toBe(10);
      expect(result.is_active).toBe(false);
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        service.updateCategory('non-existent', { name: 'Test' })
      ).rejects.toThrow(MenuServiceError);

      await expect(
        service.updateCategory('non-existent', { name: 'Test' })
      ).rejects.toMatchObject({
        code: 'CATEGORY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should log activity on update', async () => {
      await service.updateCategory('cat-update', { name: 'Logged Update' }, 'user-456');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'UPDATE_MENU_CATEGORY',
        expect.objectContaining({
          categoryId: 'cat-update',
          changes: { name: 'Logged Update' },
        }),
        'user-456'
      );
    });
  });

  describe('deleteCategory', () => {
    beforeEach(() => {
      menuRepository.addCategory({
        id: 'cat-delete',
        name: 'To Delete',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should delete empty category', async () => {
      await service.deleteCategory('cat-delete', 'user-1');

      const result = await service.getCategoryById('cat-delete');
      expect(result).toBeNull();
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        service.deleteCategory('non-existent')
      ).rejects.toMatchObject({
        code: 'CATEGORY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error when category has items', async () => {
      menuRepository.addMenuItem({
        id: 'item-1',
        category_id: 'cat-delete',
        name: 'Test Item',
        price: '10.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await expect(
        service.deleteCategory('cat-delete')
      ).rejects.toMatchObject({
        code: 'CATEGORY_HAS_ITEMS',
        statusCode: 400,
      });
    });

    it('should log activity and emit socket event', async () => {
      await service.deleteCategory('cat-delete', 'user-789');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'DELETE_MENU_CATEGORY',
        expect.objectContaining({
          categoryId: 'cat-delete',
          name: 'To Delete',
        }),
        'user-789'
      );

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'menu:categoryDeleted',
        { id: 'cat-delete' }
      );
    });
  });
});

// ============================================
// MENU ITEM TESTS
// ============================================

describe('MenuService - Menu Items', () => {
  let service: MenuService;
  let menuRepository: ReturnType<typeof createInMemoryMenuRepository>;
  let mockActivityLogger: ActivityLoggerService;
  let mockSocketEmitter: SocketEmitter;

  beforeEach(() => {
    menuRepository = createInMemoryMenuRepository();
    mockActivityLogger = createMockActivityLogger();
    mockSocketEmitter = createMockSocketEmitter();

    service = createMenuService({
      menuRepository,
      logger: createMockLogger(),
      activityLogger: mockActivityLogger,
      socketEmitter: mockSocketEmitter,
    });

    // Add a default category
    menuRepository.addCategory({
      id: 'default-cat',
      name: 'Default Category',
      display_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  describe('getMenuItems', () => {
    it('should return empty array when no items exist', async () => {
      const result = await service.getMenuItems();
      expect(result).toEqual([]);
    });

    it('should return all menu items', async () => {
      menuRepository.addMenuItem({
        id: 'item-1',
        category_id: 'default-cat',
        name: 'Burger',
        price: '15.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-2',
        category_id: 'default-cat',
        name: 'Pizza',
        price: '18.00',
        is_available: true,
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 2,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getMenuItems();
      expect(result).toHaveLength(2);
    });

    it('should filter by category', async () => {
      menuRepository.addCategory({
        id: 'cat-2',
        name: 'Second Category',
        display_order: 2,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-1',
        category_id: 'default-cat',
        name: 'Item 1',
        price: '10.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-2',
        category_id: 'cat-2',
        name: 'Item 2',
        price: '12.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getMenuItems({ categoryId: 'default-cat' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Item 1');
    });

    it('should filter by availability', async () => {
      menuRepository.addMenuItem({
        id: 'item-available',
        category_id: 'default-cat',
        name: 'Available Item',
        price: '10.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-unavailable',
        category_id: 'default-cat',
        name: 'Unavailable Item',
        price: '10.00',
        is_available: false,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 2,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getMenuItems({ availableOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Available Item');
    });
  });

  describe('getMenuItems - Dietary Filters', () => {
    beforeEach(() => {
      // Add various items with different dietary properties
      menuRepository.addMenuItem({
        id: 'item-vegan',
        category_id: 'default-cat',
        name: 'Vegan Salad',
        price: '12.00',
        is_available: true,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        is_dairy_free: true,
        is_halal: true,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-meat',
        category_id: 'default-cat',
        name: 'Steak',
        price: '35.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: true,
        is_dairy_free: true,
        is_halal: false,
        is_spicy: false,
        is_featured: true,
        display_order: 2,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-vegetarian',
        category_id: 'default-cat',
        name: 'Cheese Pizza',
        price: '18.00',
        is_available: true,
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: true,
        is_spicy: false,
        is_featured: false,
        display_order: 3,
        allergens: ['dairy', 'gluten'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-spicy',
        category_id: 'default-cat',
        name: 'Spicy Wings',
        price: '14.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: true,
        is_halal: true,
        is_spicy: true,
        is_featured: false,
        display_order: 4,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should filter vegetarian items', async () => {
      const result = await service.getMenuItems({ isVegetarian: true });
      expect(result).toHaveLength(2);
      expect(result.every(item => item.is_vegetarian)).toBe(true);
    });

    it('should filter vegan items', async () => {
      const result = await service.getMenuItems({ isVegan: true });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Vegan Salad');
    });

    it('should filter gluten-free items', async () => {
      const result = await service.getMenuItems({ isGlutenFree: true });
      expect(result).toHaveLength(2);
      expect(result.every(item => item.is_gluten_free)).toBe(true);
    });

    it('should filter dairy-free items', async () => {
      const result = await service.getMenuItems({ isDairyFree: true });
      expect(result).toHaveLength(3);
      expect(result.every(item => item.is_dairy_free)).toBe(true);
    });

    it('should filter halal items', async () => {
      const result = await service.getMenuItems({ isHalal: true });
      expect(result).toHaveLength(3);
      expect(result.every(item => item.is_halal)).toBe(true);
    });

    it('should combine multiple dietary filters', async () => {
      const result = await service.getMenuItems({
        isVegetarian: true,
        isGlutenFree: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Vegan Salad');
    });

    it('should filter featured items only', async () => {
      const result = await service.getMenuItems({ featuredOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Steak');
    });
  });

  describe('getMenuItems - Search', () => {
    beforeEach(() => {
      menuRepository.addMenuItem({
        id: 'item-burger',
        category_id: 'default-cat',
        name: 'Classic Burger',
        description: 'Beef patty with lettuce and tomato',
        price: '15.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'item-veggie',
        category_id: 'default-cat',
        name: 'Veggie Wrap',
        description: 'Fresh vegetables wrapped in tortilla',
        price: '12.00',
        is_available: true,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        is_dairy_free: true,
        is_halal: true,
        is_spicy: false,
        is_featured: false,
        display_order: 2,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should search by name', async () => {
      const result = await service.getMenuItems({ search: 'burger' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Classic Burger');
    });

    it('should search by description', async () => {
      const result = await service.getMenuItems({ search: 'vegetables' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Veggie Wrap');
    });

    it('should be case insensitive', async () => {
      const result = await service.getMenuItems({ search: 'BURGER' });
      expect(result).toHaveLength(1);
    });

    it('should return empty for no matches', async () => {
      const result = await service.getMenuItems({ search: 'sushi' });
      expect(result).toHaveLength(0);
    });
  });

  describe('getMenuItemById', () => {
    it('should return item by ID', async () => {
      menuRepository.addMenuItem({
        id: 'item-1',
        category_id: 'default-cat',
        name: 'Test Item',
        price: '10.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getMenuItemById('item-1');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Item');
    });

    it('should return null for non-existent item', async () => {
      const result = await service.getMenuItemById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getFeaturedItems', () => {
    beforeEach(() => {
      menuRepository.addMenuItem({
        id: 'featured-1',
        category_id: 'default-cat',
        name: 'Featured Item 1',
        price: '25.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: true,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'featured-2',
        category_id: 'default-cat',
        name: 'Featured Item 2',
        price: '30.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: true,
        display_order: 2,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'regular',
        category_id: 'default-cat',
        name: 'Regular Item',
        price: '15.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 3,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should return only featured items', async () => {
      const result = await service.getFeaturedItems();
      expect(result).toHaveLength(2);
      expect(result.every(item => item.is_featured)).toBe(true);
    });
  });

  describe('createMenuItem', () => {
    it('should create a new menu item', async () => {
      const result = await service.createMenuItem({
        categoryId: 'default-cat',
        name: 'New Dish',
        price: 24.99,
        description: 'Delicious new dish',
      }, 'user-1');

      expect(result.name).toBe('New Dish');
      expect(result.price).toBe('24.99');
      expect(result.description).toBe('Delicious new dish');
      expect(result.category_id).toBe('default-cat');
      expect(result.is_available).toBe(true);
    });

    it('should create item with all dietary flags', async () => {
      const result = await service.createMenuItem({
        categoryId: 'default-cat',
        name: 'Healthy Bowl',
        price: 18.00,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        isDairyFree: true,
        isHalal: true,
        isSpicy: false,
        allergens: ['nuts'],
        calories: 350,
      });

      expect(result.is_vegetarian).toBe(true);
      expect(result.is_vegan).toBe(true);
      expect(result.is_gluten_free).toBe(true);
      expect(result.is_dairy_free).toBe(true);
      expect(result.is_halal).toBe(true);
      expect(result.is_spicy).toBe(false);
      expect(result.allergens).toContain('nuts');
      expect(result.calories).toBe(350);
    });

    it('should create item with translations', async () => {
      const result = await service.createMenuItem({
        categoryId: 'default-cat',
        name: 'Pasta',
        nameAr: 'معكرونة',
        nameFr: 'Pâtes',
        descriptionAr: 'وصف عربي',
        descriptionFr: 'Description française',
        price: 16.00,
      });

      expect(result.name).toBe('Pasta');
      expect(result.name_ar).toBe('معكرونة');
      expect(result.name_fr).toBe('Pâtes');
      expect(result.description_ar).toBe('وصف عربي');
      expect(result.description_fr).toBe('Description française');
    });

    it('should create item with discount price', async () => {
      const result = await service.createMenuItem({
        categoryId: 'default-cat',
        name: 'Discounted Item',
        price: 20.00,
        discountPrice: 15.00,
      });

      expect(result.price).toBe('20');
      expect(result.discount_price).toBe('15');
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        service.createMenuItem({
          categoryId: 'non-existent',
          name: 'Test',
          price: 10.00,
        })
      ).rejects.toMatchObject({
        code: 'CATEGORY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error for negative price', async () => {
      await expect(
        service.createMenuItem({
          categoryId: 'default-cat',
          name: 'Test',
          price: -5.00,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PRICE',
        statusCode: 400,
      });
    });

    it('should throw error when discount price >= regular price', async () => {
      await expect(
        service.createMenuItem({
          categoryId: 'default-cat',
          name: 'Test',
          price: 10.00,
          discountPrice: 15.00,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DISCOUNT',
        statusCode: 400,
      });
    });

    it('should log activity on creation', async () => {
      await service.createMenuItem({
        categoryId: 'default-cat',
        name: 'Logged Item',
        price: 10.00,
      }, 'user-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'CREATE_MENU_ITEM',
        expect.objectContaining({
          name: 'Logged Item',
          categoryId: 'default-cat',
          price: 10.00,
        }),
        'user-123'
      );
    });

    it('should emit socket event on creation', async () => {
      const result = await service.createMenuItem({
        categoryId: 'default-cat',
        name: 'Socket Item',
        price: 10.00,
      });

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'menu:itemCreated',
        expect.objectContaining({
          name: 'Socket Item',
          categoryId: 'default-cat',
        })
      );
    });
  });

  describe('updateMenuItem', () => {
    beforeEach(() => {
      menuRepository.addMenuItem({
        id: 'item-update',
        category_id: 'default-cat',
        name: 'Original Item',
        price: '20.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should update item name', async () => {
      const result = await service.updateMenuItem('item-update', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should update price', async () => {
      const result = await service.updateMenuItem('item-update', {
        price: 25.00,
      });

      expect(result.price).toBe('25');
    });

    it('should update dietary flags', async () => {
      const result = await service.updateMenuItem('item-update', {
        isVegetarian: true,
        isGlutenFree: true,
      });

      expect(result.is_vegetarian).toBe(true);
      expect(result.is_gluten_free).toBe(true);
    });

    it('should update to new category', async () => {
      menuRepository.addCategory({
        id: 'new-cat',
        name: 'New Category',
        display_order: 2,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.updateMenuItem('item-update', {
        categoryId: 'new-cat',
      });

      expect(result.category_id).toBe('new-cat');
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        service.updateMenuItem('non-existent', { name: 'Test' })
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        service.updateMenuItem('item-update', { categoryId: 'non-existent' })
      ).rejects.toMatchObject({
        code: 'CATEGORY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error for negative price', async () => {
      await expect(
        service.updateMenuItem('item-update', { price: -5.00 })
      ).rejects.toMatchObject({
        code: 'INVALID_PRICE',
      });
    });

    it('should log activity on update', async () => {
      await service.updateMenuItem('item-update', { name: 'Updated' }, 'user-456');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'UPDATE_MENU_ITEM',
        expect.objectContaining({
          itemId: 'item-update',
          changes: { name: 'Updated' },
        }),
        'user-456'
      );
    });
  });

  describe('deleteMenuItem', () => {
    beforeEach(() => {
      menuRepository.addMenuItem({
        id: 'item-delete',
        category_id: 'default-cat',
        name: 'To Delete',
        price: '10.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should delete menu item', async () => {
      await service.deleteMenuItem('item-delete', 'user-1');

      const result = await service.getMenuItemById('item-delete');
      expect(result).toBeNull();
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        service.deleteMenuItem('non-existent')
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should log activity and emit socket event', async () => {
      await service.deleteMenuItem('item-delete', 'user-789');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'DELETE_MENU_ITEM',
        expect.objectContaining({
          itemId: 'item-delete',
          name: 'To Delete',
        }),
        'user-789'
      );

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'menu:itemDeleted',
        { id: 'item-delete' }
      );
    });
  });

  describe('setItemAvailability', () => {
    beforeEach(() => {
      menuRepository.addMenuItem({
        id: 'item-avail',
        category_id: 'default-cat',
        name: 'Toggle Item',
        price: '10.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should set item unavailable', async () => {
      const result = await service.setItemAvailability('item-avail', false, 'user-1');

      expect(result.is_available).toBe(false);
    });

    it('should set item available', async () => {
      await service.setItemAvailability('item-avail', false);
      const result = await service.setItemAvailability('item-avail', true, 'user-1');

      expect(result.is_available).toBe(true);
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        service.setItemAvailability('non-existent', true)
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should log activity and emit socket event', async () => {
      await service.setItemAvailability('item-avail', false, 'user-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'SET_ITEM_AVAILABILITY',
        expect.objectContaining({
          itemId: 'item-avail',
          name: 'Toggle Item',
          isAvailable: false,
        }),
        'user-123'
      );

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'menu:availabilityChanged',
        expect.objectContaining({
          id: 'item-avail',
          isAvailable: false,
        })
      );
    });
  });

  describe('bulkUpdateAvailability', () => {
    beforeEach(() => {
      menuRepository.addMenuItem({
        id: 'bulk-1',
        category_id: 'default-cat',
        name: 'Bulk Item 1',
        price: '10.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 1,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      menuRepository.addMenuItem({
        id: 'bulk-2',
        category_id: 'default-cat',
        name: 'Bulk Item 2',
        price: '15.00',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_dairy_free: false,
        is_halal: false,
        is_spicy: false,
        is_featured: false,
        display_order: 2,
        allergens: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should update multiple items availability', async () => {
      const result = await service.bulkUpdateAvailability(
        ['bulk-1', 'bulk-2'],
        false,
        'user-1'
      );

      expect(result).toHaveLength(2);
      expect(result.every(item => item.is_available === false)).toBe(true);
    });

    it('should skip non-existent items', async () => {
      const result = await service.bulkUpdateAvailability(
        ['bulk-1', 'non-existent', 'bulk-2'],
        false
      );

      expect(result).toHaveLength(2);
    });

    it('should log bulk activity', async () => {
      await service.bulkUpdateAvailability(['bulk-1', 'bulk-2'], false, 'user-456');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'BULK_UPDATE_AVAILABILITY',
        expect.objectContaining({
          itemCount: 2,
          isAvailable: false,
        }),
        'user-456'
      );
    });

    it('should emit bulk socket event', async () => {
      await service.bulkUpdateAvailability(['bulk-1', 'bulk-2'], false);

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'menu:bulkAvailabilityChanged',
        expect.objectContaining({
          itemIds: ['bulk-1', 'bulk-2'],
          isAvailable: false,
        })
      );
    });
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('MenuServiceError', () => {
  it('should create error with correct properties', () => {
    const error = new MenuServiceError('Test message', 'TEST_CODE', 500);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('MenuServiceError');
  });

  it('should default to 400 status code', () => {
    const error = new MenuServiceError('Test', 'TEST');

    expect(error.statusCode).toBe(400);
  });
});
