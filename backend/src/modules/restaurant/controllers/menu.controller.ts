import { Request, Response, NextFunction } from 'express';
import * as menuService from "../services/menu.service";
import { translateText } from '../../../services/translation.service.js';
import { MenuCategoryRow, MenuItemRow, getErrorMessage } from '../../../types/index.js';
import { logger } from '../../../utils/logger.js';

// Get full menu with categories and items
export async function getFullMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const { moduleId } = req.query;
    const [categories, items] = await Promise.all([
      menuService.getAllCategories(moduleId as string),
      menuService.getMenuItems({ availableOnly: true, moduleId: moduleId as string }),
    ]);

    // Group items by category
    const menuByCategory = categories.map((category: MenuCategoryRow) => ({
      ...category,
      items: items.filter((item: MenuItemRow) => item.category_id === category.id),
    }));

    res.json({
      success: true,
      data: {
        categories,
        items,
        menuByCategory,
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const { moduleId } = req.query;
    const categories = await menuService.getAllCategories(moduleId as string);
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

export async function getMenuItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { 
      categoryId, 
      available, 
      moduleId,
      // Dietary filters
      vegetarian,
      vegan,
      glutenFree,
      dairyFree,
      halal,
      // Search filter
      search
    } = req.query;
    
    const items = await menuService.getMenuItems({
      categoryId: categoryId as string,
      availableOnly: available === 'true',
      moduleId: moduleId as string,
      // Parse dietary filters - only pass if explicitly 'true'
      isVegetarian: vegetarian === 'true' ? true : undefined,
      isVegan: vegan === 'true' ? true : undefined,
      isGlutenFree: glutenFree === 'true' ? true : undefined,
      isDairyFree: dairyFree === 'true' ? true : undefined,
      isHalal: halal === 'true' ? true : undefined,
      // Search filter
      search: search as string,
    });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await menuService.getMenuItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function getFeaturedItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { moduleId } = req.query;
    const items = await menuService.getFeaturedItems(moduleId as string);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, moduleId, module_id, ...rest } = req.body;
    const resolvedModuleId = moduleId || module_id;

    // Auto-translate name and description if not provided
    const translatedData: Record<string, unknown> = { 
      name,
      description,
      moduleId: resolvedModuleId
    };

    if (name && !req.body.name_ar) {
      try {
        const nameTranslations = await translateText(name, 'en');
        translatedData.nameAr = nameTranslations.ar;
        translatedData.nameFr = nameTranslations.fr;
      } catch (e) {
        logger.warn('[MENU] Auto-translation failed for category name');
      }
    } else {
      if (req.body.name_ar) translatedData.nameAr = req.body.name_ar;
      if (req.body.name_fr) translatedData.nameFr = req.body.name_fr;
    }

    if (description && !req.body.description_ar) {
      try {
        const descTranslations = await translateText(description, 'en');
        translatedData.descriptionAr = descTranslations.ar;
        translatedData.descriptionFr = descTranslations.fr;
      } catch (e) {
        logger.warn('[MENU] Auto-translation failed for category description');
      }
    } else {
      if (req.body.description_ar) translatedData.descriptionAr = req.body.description_ar;
      if (req.body.description_fr) translatedData.descriptionFr = req.body.description_fr;
    }

    // Copy other fields
    if (rest.displayOrder !== undefined) translatedData.displayOrder = rest.displayOrder;
    if (rest.imageUrl !== undefined) translatedData.imageUrl = rest.imageUrl;

    const category = await menuService.createCategory(translatedData as Parameters<typeof menuService.createCategory>[0]);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await menuService.updateCategory(req.params.id, req.body);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await menuService.deleteCategory(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
}

export async function createMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    // Accept both camelCase and snake_case field names for flexibility
    const { name, description, categoryId, category_id, price, module_id, moduleId, ...rest } = req.body;

    // Use categoryId or category_id (frontend may send either)
    const resolvedCategoryId = categoryId || category_id;
    // Use moduleId or module_id (frontend may send either)
    const resolvedModuleId = moduleId || module_id;

    // Validate required fields
    if (!resolvedCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'categoryId is required'
      });
    }
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'name is required'
      });
    }
    if (price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: 'price is required'
      });
    }

    // Auto-translate name and description if not provided
    const translatedData = { ...rest, name, categoryId: resolvedCategoryId, price: Number(price), moduleId: resolvedModuleId };

    if (name && !req.body.name_ar) {
      try {
        const nameTranslations = await translateText(name, 'en');
        translatedData.name_ar = nameTranslations.ar;
        translatedData.name_fr = nameTranslations.fr;
      } catch (e) {
        // Auto-translation failed, continue without translations
      }
    }

    if (description && !req.body.description_ar) {
      try {
        const descTranslations = await translateText(description, 'en');
        translatedData.description = description;
        translatedData.description_ar = descTranslations.ar;
        translatedData.description_fr = descTranslations.fr;
      } catch (e) {
        logger.warn('[MENU] Auto-translation failed for item description');
      }
    }

    const item = await menuService.createMenuItem(translatedData);
    res.status(201).json({ success: true, data: item, autoTranslated: true });
  } catch (error: unknown) {
    const errWithCode = error as { code?: string; message?: string };
    if (errWithCode.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category - category does not exist'
      });
    }
    next(error);
  }
}

export async function updateMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    // Convert snake_case to camelCase for service compatibility
    const body = req.body;
    const normalizedData: Record<string, any> = {};

    // Map snake_case fields to camelCase
    if (body.category_id !== undefined) normalizedData.categoryId = body.category_id;
    if (body.categoryId !== undefined) normalizedData.categoryId = body.categoryId;
    if (body.name !== undefined) normalizedData.name = body.name;
    if (body.name_ar !== undefined) normalizedData.nameAr = body.name_ar;
    if (body.name_fr !== undefined) normalizedData.nameFr = body.name_fr;
    if (body.description !== undefined) normalizedData.description = body.description;
    if (body.description_ar !== undefined) normalizedData.descriptionAr = body.description_ar;
    if (body.description_fr !== undefined) normalizedData.descriptionFr = body.description_fr;
    if (body.price !== undefined) normalizedData.price = Number(body.price);
    if (body.preparation_time_minutes !== undefined) normalizedData.preparationTimeMinutes = body.preparation_time_minutes;
    if (body.calories !== undefined) normalizedData.calories = body.calories;
    if (body.is_vegetarian !== undefined) normalizedData.isVegetarian = body.is_vegetarian;
    if (body.is_vegan !== undefined) normalizedData.isVegan = body.is_vegan;
    if (body.is_gluten_free !== undefined) normalizedData.isGlutenFree = body.is_gluten_free;
    if (body.allergens !== undefined) normalizedData.allergens = body.allergens;
    if (body.image_url !== undefined) normalizedData.imageUrl = body.image_url;
    if (body.is_available !== undefined) normalizedData.isAvailable = body.is_available;
    if (body.is_featured !== undefined) normalizedData.isFeatured = body.is_featured;
    if (body.display_order !== undefined) normalizedData.displayOrder = body.display_order;

    const item = await menuService.updateMenuItem(req.params.id, normalizedData);
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deleteMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    await menuService.deleteMenuItem(req.params.id);
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
}

export async function toggleAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { isAvailable } = req.body;
    const item = await menuService.setItemAvailability(req.params.id, isAvailable);
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

