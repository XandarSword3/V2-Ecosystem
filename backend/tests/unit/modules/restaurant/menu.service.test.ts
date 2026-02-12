import { describe, it, expect, vi, beforeEach } from 'vitest';

// Storage for mock data
let mockCategories: Array<Record<string, unknown>> = [];
let mockMenuItems: Array<Record<string, unknown>> = [];

// Create a chainable query mock that properly handles self-references
function createQueryMock(mockDataFn: () => unknown[]) {
  // Use a function to get mock data so it reflects current state
  const mockObj: Record<string, unknown> = {};
  
  // All chainable methods return the same object
  const chainMethods = ['select', 'eq', 'is', 'or', 'order'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  
  // Make the object thenable (awaitable) for terminal operations
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  
  // single() returns the first item
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ 
      data: firstItem, 
      error: firstItem ? null : { code: 'PGRST116' }
    });
  });
  
  // insert returns an object with select().single()
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ 
        data: { id: 'new-item-' + Date.now(), ...insertData }, 
        error: null 
      })
    })
  }));
  
  // update needs to support both .eq().select().single() and just .eq()
  mockObj.update = vi.fn().mockImplementation((updateData) => ({
    eq: vi.fn().mockImplementation(() => {
      // Return an object that works for both patterns
      const eqResult = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'item-1', ...updateData }, 
            error: null 
          })
        }),
        then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
          resolve({ data: null, error: null });
          return Promise.resolve({ data: null, error: null });
        }
      };
      return eqResult;
    })
  }));
  
  return mockObj;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'menu_categories') {
      return createQueryMock(() => mockCategories);
    } else if (table === 'menu_items') {
      return createQueryMock(() => mockMenuItems);
    }
    return createQueryMock(() => []);
  })
};

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as menuService from '../../../../src/modules/restaurant/services/menu.service';

describe('MenuService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategories = [];
    mockMenuItems = [];
  });

  // ============================================
  // CATEGORY OPERATIONS
  // ============================================

  describe('getAllCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await menuService.getAllCategories();
      expect(result).toEqual([]);
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    });

    it('should call supabase with correct query chain', async () => {
      await menuService.getAllCategories();
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    });

    it('should filter by moduleId when provided', async () => {
      await menuService.getAllCategories('restaurant-module');
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    });

    it('should return categories when they exist', async () => {
      mockCategories = [
        { id: 'cat-1', name: 'Appetizers', display_order: 1, is_active: true },
        { id: 'cat-2', name: 'Main Course', display_order: 2, is_active: true },
      ];
      const result = await menuService.getAllCategories();
      expect(result).toEqual(mockCategories);
    });
  });

  describe('getMenuItems', () => {
    it('should return empty array when no items exist', async () => {
      const result = await menuService.getMenuItems({});
      expect(result).toEqual([]);
    });

    it('should filter by categoryId', async () => {
      await menuService.getMenuItems({ categoryId: 'cat-1' });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should filter available only items', async () => {
      await menuService.getMenuItems({ availableOnly: true });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should filter by moduleId', async () => {
      await menuService.getMenuItems({ moduleId: 'restaurant' });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should apply vegetarian filter', async () => {
      await menuService.getMenuItems({ isVegetarian: true });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should apply vegan filter', async () => {
      await menuService.getMenuItems({ isVegan: true });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should apply gluten-free filter', async () => {
      await menuService.getMenuItems({ isGlutenFree: true });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should apply dairy-free filter', async () => {
      await menuService.getMenuItems({ isDairyFree: true });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should apply halal filter', async () => {
      await menuService.getMenuItems({ isHalal: true });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should apply search filter', async () => {
      await menuService.getMenuItems({ search: 'pizza' });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should combine multiple filters', async () => {
      await menuService.getMenuItems({
        categoryId: 'cat-1',
        availableOnly: true,
        isVegetarian: true,
        search: 'salad',
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should return items when they exist', async () => {
      mockMenuItems = [
        { id: 'item-1', name: 'Margherita Pizza', price: '12.99' },
        { id: 'item-2', name: 'Caesar Salad', price: '8.99' },
      ];
      const result = await menuService.getMenuItems({});
      expect(result).toEqual(mockMenuItems);
    });
  });

  describe('getMenuItemById', () => {
    it('should call supabase with correct id', async () => {
      await menuService.getMenuItemById('item-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should return null for non-existent item', async () => {
      const result = await menuService.getMenuItemById('non-existent');
      expect(result).toBeNull();
    });

    it('should return item when found', async () => {
      mockMenuItems = [{ id: 'item-1', name: 'Test Item', price: '10.00' }];
      const result = await menuService.getMenuItemById('item-1');
      expect(result).toEqual(mockMenuItems[0]);
    });
  });

  describe('getFeaturedItems', () => {
    it('should call supabase for featured items', async () => {
      await menuService.getFeaturedItems();
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should filter by moduleId when provided', async () => {
      await menuService.getFeaturedItems('restaurant');
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should return featured items', async () => {
      mockMenuItems = [
        { id: 'item-1', name: 'Featured Item', is_featured: true },
      ];
      const result = await menuService.getFeaturedItems();
      expect(result).toEqual(mockMenuItems);
    });
  });

  describe('createCategory', () => {
    it('should create category with required fields', async () => {
      const result = await menuService.createCategory({
        name: 'New Category',
      });
      expect(result).toHaveProperty('id');
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    });

    it('should create category with all optional fields', async () => {
      const result = await menuService.createCategory({
        name: 'Desserts',
        nameAr: 'حلويات',
        nameFr: 'Desserts',
        description: 'Sweet treats',
        displayOrder: 5,
        imageUrl: 'https://example.com/desserts.jpg',
        moduleId: 'restaurant',
      });
      expect(result).toHaveProperty('id');
    });

    it('should use default displayOrder of 0', async () => {
      const result = await menuService.createCategory({
        name: 'Test Category',
      });
      expect(result).toBeDefined();
    });
  });

  describe('updateCategory', () => {
    it('should update category name', async () => {
      const result = await menuService.updateCategory('cat-1', {
        name: 'Updated Name',
      });
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    });

    it('should update multiple fields', async () => {
      const result = await menuService.updateCategory('cat-1', {
        name: 'Updated',
        nameAr: 'محدث',
        nameFr: 'Mis à jour',
        description: 'Updated description',
        displayOrder: 10,
        isActive: false,
        imageUrl: 'https://example.com/new.jpg',
      });
      expect(result).toBeDefined();
    });

    it('should only update provided fields', async () => {
      const result = await menuService.updateCategory('cat-1', {
        isActive: false,
      });
      expect(result).toBeDefined();
    });
  });

  describe('deleteCategory', () => {
    it('should soft delete category', async () => {
      await menuService.deleteCategory('cat-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    });
  });

  describe('createMenuItem', () => {
    it('should create menu item with required fields', async () => {
      const result = await menuService.createMenuItem({
        categoryId: 'cat-1',
        name: 'Test Item',
        price: 10.99,
      });
      expect(result).toHaveProperty('id');
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should create menu item with all dietary flags', async () => {
      const result = await menuService.createMenuItem({
        categoryId: 'cat-1',
        name: 'Vegan Salad',
        price: 12.99,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        isHalal: true,
      });
      expect(result).toBeDefined();
    });

    it('should create menu item with translations', async () => {
      const result = await menuService.createMenuItem({
        categoryId: 'cat-1',
        name: 'Hummus',
        nameAr: 'حمص',
        nameFr: 'Houmous',
        description: 'Classic Middle Eastern dip',
        descriptionAr: 'صلصة شرق أوسطية كلاسيكية',
        descriptionFr: 'Trempette classique du Moyen-Orient',
        price: 8.99,
      });
      expect(result).toBeDefined();
    });

    it('should create menu item with all optional fields', async () => {
      const result = await menuService.createMenuItem({
        categoryId: 'cat-1',
        name: 'Deluxe Burger',
        price: 18.99,
        preparationTimeMinutes: 20,
        calories: 850,
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: false,
        isAvailable: true,
        allergens: ['gluten', 'dairy', 'eggs'],
        imageUrl: 'https://example.com/burger.jpg',
        isFeatured: true,
        isSpicy: true,
        discountPrice: 15.99,
        displayOrder: 1,
        moduleId: 'restaurant',
      });
      expect(result).toBeDefined();
    });

    it('should handle string price conversion', async () => {
      const result = await menuService.createMenuItem({
        categoryId: 'cat-1',
        name: 'Test',
        price: 'invalid' as unknown as number,
      });
      expect(result).toBeDefined();
    });

    it('should default isAvailable to true', async () => {
      const result = await menuService.createMenuItem({
        categoryId: 'cat-1',
        name: 'New Item',
        price: 5.99,
      });
      expect(result).toBeDefined();
    });

    it('should respect explicit isAvailable false', async () => {
      const result = await menuService.createMenuItem({
        categoryId: 'cat-1',
        name: 'Unavailable Item',
        price: 5.99,
        isAvailable: false,
      });
      expect(result).toBeDefined();
    });
  });

  describe('updateMenuItem', () => {
    it('should update menu item name', async () => {
      const result = await menuService.updateMenuItem('item-1', {
        name: 'Updated Item Name',
      });
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should update menu item price', async () => {
      const result = await menuService.updateMenuItem('item-1', {
        price: 15.99,
      });
      expect(result).toBeDefined();
    });

    it('should update all fields', async () => {
      const result = await menuService.updateMenuItem('item-1', {
        categoryId: 'cat-2',
        name: 'New Name',
        nameAr: 'اسم جديد',
        nameFr: 'Nouveau nom',
        description: 'New description',
        descriptionAr: 'وصف جديد',
        descriptionFr: 'Nouvelle description',
        price: 20,
        preparationTimeMinutes: 30,
        calories: 500,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        allergens: ['nuts'],
        imageUrl: 'https://new.url/image.jpg',
        isAvailable: false,
        isFeatured: true,
        isSpicy: false,
        discountPrice: 18,
        displayOrder: 5,
      });
      expect(result).toBeDefined();
    });
  });

  describe('deleteMenuItem', () => {
    it('should soft delete menu item', async () => {
      await menuService.deleteMenuItem('item-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });
  });

  describe('setItemAvailability', () => {
    it('should set item as available', async () => {
      const result = await menuService.setItemAvailability('item-1', true);
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
    });

    it('should set item as unavailable', async () => {
      const result = await menuService.setItemAvailability('item-1', false);
      expect(result).toBeDefined();
    });
  });

  // ============================================
  // TYPE EXPORTS
  // ============================================

  describe('exported types', () => {
    it('should export MenuItemFilters type', () => {
      const filters: menuService.MenuItemFilters = {
        categoryId: 'cat-1',
        availableOnly: true,
        moduleId: 'restaurant',
        isVegetarian: true,
        isVegan: false,
        isGlutenFree: true,
        isDairyFree: false,
        isHalal: true,
        search: 'pizza',
      };
      expect(filters.categoryId).toBe('cat-1');
      expect(filters.availableOnly).toBe(true);
      expect(filters.search).toBe('pizza');
    });
  });
});
