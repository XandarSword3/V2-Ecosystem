import { Request, Response, NextFunction } from 'express';
import * as menuService from "../services/menu.service";
import { translateText } from '../../../services/translation.service.js';

// Get full menu with categories and items
export async function getFullMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const [categories, items] = await Promise.all([
      menuService.getAllCategories(),
      menuService.getMenuItems({ availableOnly: true }),
    ]);
    
    // Group items by category
    const menuByCategory = categories.map((category: any) => ({
      ...category,
      items: items.filter((item: any) => item.category_id === category.id),
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
    const categories = await menuService.getAllCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

export async function getMenuItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { categoryId, available } = req.query;
    const items = await menuService.getMenuItems({
      categoryId: categoryId as string,
      availableOnly: available === 'true',
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
    const items = await menuService.getFeaturedItems();
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, ...rest } = req.body;
    
    // Auto-translate name and description if not provided
    let translatedData = { ...rest, name };
    
    if (name && !req.body.name_ar) {
      try {
        const nameTranslations = await translateText(name, 'en');
        translatedData.name_ar = nameTranslations.ar;
        translatedData.name_fr = nameTranslations.fr;
      } catch (e) {
        console.warn('[MENU] Auto-translation failed for category name');
      }
    }
    
    if (description && !req.body.description_ar) {
      try {
        const descTranslations = await translateText(description, 'en');
        translatedData.description = description;
        translatedData.description_ar = descTranslations.ar;
        translatedData.description_fr = descTranslations.fr;
      } catch (e) {
        console.warn('[MENU] Auto-translation failed for category description');
      }
    }
    
    const category = await menuService.createCategory(translatedData);
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
    const { name, description, ...rest } = req.body;
    
    // Auto-translate name and description if not provided
    let translatedData = { ...rest, name };
    
    if (name && !req.body.name_ar) {
      try {
        console.log('[MENU] Auto-translating item name:', name);
        const nameTranslations = await translateText(name, 'en');
        translatedData.name_ar = nameTranslations.ar;
        translatedData.name_fr = nameTranslations.fr;
        console.log('[MENU] Translations:', nameTranslations);
      } catch (e) {
        console.warn('[MENU] Auto-translation failed for item name');
      }
    }
    
    if (description && !req.body.description_ar) {
      try {
        const descTranslations = await translateText(description, 'en');
        translatedData.description = description;
        translatedData.description_ar = descTranslations.ar;
        translatedData.description_fr = descTranslations.fr;
      } catch (e) {
        console.warn('[MENU] Auto-translation failed for item description');
      }
    }
    
    const item = await menuService.createMenuItem(translatedData);
    res.status(201).json({ success: true, data: item, autoTranslated: true });
  } catch (error) {
    next(error);
  }
}

export async function updateMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await menuService.updateMenuItem(req.params.id, req.body);
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
