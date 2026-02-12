import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';
import * as menuController from '../../../src/modules/restaurant/controllers/menu.controller';
import * as menuService from '../../../src/modules/restaurant/services/menu.service';
import { translateText } from '../../../src/services/translation.service';

// Mock dependencies
vi.mock('../../../src/modules/restaurant/services/menu.service');
vi.mock('../../../src/services/translation.service');
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('Menu Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(translateText).mockResolvedValue({ ar: 'translated_ar', fr: 'translated_fr' });
  });

  describe('getFullMenu', () => {
    it('should return full menu with categories and items', async () => {
      const mockCategories = [{ id: 'cat-1', name: 'Appetizers' }];
      const mockItems = [{ id: 'item-1', name: 'Wings', category_id: 'cat-1' }];

      vi.mocked(menuService.getAllCategories).mockResolvedValue(mockCategories);
      vi.mocked(menuService.getMenuItems).mockResolvedValue(mockItems);

      const { req, res, next } = createMockReqRes({
        query: { moduleId: 'mod-1' }
      });

      await menuController.getFullMenu(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          categories: mockCategories,
          items: mockItems,
          menuByCategory: [{ ...mockCategories[0], items: mockItems }]
        }
      });
    });

    it('should call next on error', async () => {
      const error = new Error('Service error');
      vi.mocked(menuService.getAllCategories).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await menuController.getFullMenu(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getCategories', () => {
    it('should return categories', async () => {
      const mockCategories = [{ id: 'cat-1', name: 'Mains' }];
      vi.mocked(menuService.getAllCategories).mockResolvedValue(mockCategories);

      const { req, res, next } = createMockReqRes({
        query: { moduleId: 'mod-1' }
      });

      await menuController.getCategories(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockCategories });
    });
  });

  describe('getMenuItems', () => {
    it('should return menu items with filters', async () => {
      const mockItems = [{ id: 'item-1', name: 'Salad' }];
      vi.mocked(menuService.getMenuItems).mockResolvedValue(mockItems);

      const { req, res, next } = createMockReqRes({
        query: { 
          categoryId: 'cat-1', 
          available: 'true',
          vegetarian: 'true',
          search: 'salad'
        }
      });

      await menuController.getMenuItems(req, res, next);

      expect(menuService.getMenuItems).toHaveBeenCalledWith({
        categoryId: 'cat-1',
        availableOnly: true,
        moduleId: undefined,
        isVegetarian: true,
        isVegan: undefined,
        isGlutenFree: undefined,
        isDairyFree: undefined,
        isHalal: undefined,
        search: 'salad'
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockItems });
    });
  });

  describe('getMenuItem', () => {
    it('should return a single menu item', async () => {
      const mockItem = { id: 'item-1', name: 'Pizza' };
      vi.mocked(menuService.getMenuItemById).mockResolvedValue(mockItem);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' }
      });

      await menuController.getMenuItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockItem });
    });

    it('should return 404 if item not found', async () => {
      vi.mocked(menuService.getMenuItemById).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-999' }
      });

      await menuController.getMenuItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Item not found' });
    });
  });

  describe('getFeaturedItems', () => {
    it('should return featured items', async () => {
      const mockItems = [{ id: 'item-1', name: 'Featured Dish', is_featured: true }];
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue(mockItems);

      const { req, res, next } = createMockReqRes({
        query: { moduleId: 'mod-1' }
      });

      await menuController.getFeaturedItems(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockItems });
    });
  });

  describe('createCategory', () => {
    it('should create a category with translations', async () => {
      const mockCategory = { id: 'cat-new', name: 'Desserts' };
      vi.mocked(menuService.createCategory).mockResolvedValue(mockCategory);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Desserts', description: 'Sweet treats', moduleId: 'mod-1' }
      });

      await menuController.createCategory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockCategory });
    });

    it('should use provided translations instead of auto-translate', async () => {
      const mockCategory = { id: 'cat-new', name: 'Desserts' };
      vi.mocked(menuService.createCategory).mockResolvedValue(mockCategory);

      const { req, res, next } = createMockReqRes({
        body: { 
          name: 'Desserts', 
          name_ar: 'حلويات',
          name_fr: 'Desserts',
          moduleId: 'mod-1'
        }
      });

      await menuController.createCategory(req, res, next);

      expect(translateText).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateCategory', () => {
    it('should update a category', async () => {
      const mockUpdated = { id: 'cat-1', name: 'Updated Category' };
      vi.mocked(menuService.updateCategory).mockResolvedValue(mockUpdated);

      const { req, res, next } = createMockReqRes({
        params: { id: 'cat-1' },
        body: { name: 'Updated Category' }
      });

      await menuController.updateCategory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      vi.mocked(menuService.deleteCategory).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'cat-1' }
      });

      await menuController.deleteCategory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Category deleted' });
    });
  });

  describe('createMenuItem', () => {
    it('should create a menu item', async () => {
      const mockItem = { id: 'item-new', name: 'Burger', price: 12.99 };
      vi.mocked(menuService.createMenuItem).mockResolvedValue(mockItem);

      const { req, res, next } = createMockReqRes({
        body: { 
          name: 'Burger',
          categoryId: 'cat-1',
          price: 12.99,
          description: 'Delicious burger'
        }
      });

      await menuController.createMenuItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ 
        success: true, 
        data: mockItem,
        autoTranslated: true
      });
    });

    it('should return 400 if categoryId is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'Burger', price: 12.99 }
      });

      await menuController.createMenuItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        message: 'categoryId is required' 
      });
    });

    it('should return 400 if name is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { categoryId: 'cat-1', price: 12.99 }
      });

      await menuController.createMenuItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        message: 'name is required' 
      });
    });

    it('should return 400 if price is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { categoryId: 'cat-1', name: 'Burger' }
      });

      await menuController.createMenuItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        message: 'price is required' 
      });
    });

    it('should handle invalid category error', async () => {
      const error = { code: '23503', message: 'FK violation' };
      vi.mocked(menuService.createMenuItem).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        body: { 
          name: 'Burger',
          categoryId: 'invalid-cat',
          price: 12.99
        }
      });

      await menuController.createMenuItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        message: 'Invalid category - category does not exist' 
      });
    });
  });

  describe('updateMenuItem', () => {
    it('should update a menu item', async () => {
      const mockUpdated = { id: 'item-1', name: 'Updated Item', price: 15.99 };
      vi.mocked(menuService.updateMenuItem).mockResolvedValue(mockUpdated);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { name: 'Updated Item', price: 15.99 }
      });

      await menuController.updateMenuItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it('should handle snake_case to camelCase conversion', async () => {
      const mockUpdated = { id: 'item-1', is_vegetarian: true };
      vi.mocked(menuService.updateMenuItem).mockResolvedValue(mockUpdated);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { 
          is_vegetarian: true,
          is_vegan: false,
          is_gluten_free: true
        }
      });

      await menuController.updateMenuItem(req, res, next);

      expect(menuService.updateMenuItem).toHaveBeenCalledWith('item-1', {
        isVegetarian: true,
        isVegan: false,
        isGlutenFree: true
      });
    });
  });

  describe('deleteMenuItem', () => {
    it('should delete a menu item', async () => {
      vi.mocked(menuService.deleteMenuItem).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' }
      });

      await menuController.deleteMenuItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Item deleted' });
    });
  });

  describe('toggleAvailability', () => {
    it('should toggle item availability', async () => {
      const mockItem = { id: 'item-1', is_available: false };
      vi.mocked(menuService.setItemAvailability).mockResolvedValue(mockItem);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { isAvailable: false }
      });

      await menuController.toggleAvailability(req, res, next);

      expect(menuService.setItemAvailability).toHaveBeenCalledWith('item-1', false);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockItem });
    });
  });
});
