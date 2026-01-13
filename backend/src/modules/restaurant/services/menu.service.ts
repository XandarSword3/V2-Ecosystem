import { getSupabase } from "../../../database/connection.js";

export async function getAllCategories(moduleId?: string) {
  const supabase = getSupabase();
  let query = supabase
    .from('menu_categories')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export interface MenuItemFilters {
  categoryId?: string;
  availableOnly?: boolean;
  moduleId?: string;
  // Dietary filters
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  isHalal?: boolean;
  // Search filter
  search?: string;
}

export async function getMenuItems(filters: MenuItemFilters) {
  const supabase = getSupabase();

  let query = supabase
    .from('menu_items')
    .select(`
      *,
      category:menu_categories(id, name, name_ar, name_fr)
    `)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters.availableOnly) {
    query = query.eq('is_available', true);
  }
  if (filters.moduleId) {
    query = query.eq('module_id', filters.moduleId);
  }

  // Dietary filters - only filter if explicitly set to true
  if (filters.isVegetarian === true) {
    query = query.eq('is_vegetarian', true);
  }
  if (filters.isVegan === true) {
    query = query.eq('is_vegan', true);
  }
  if (filters.isGlutenFree === true) {
    query = query.eq('is_gluten_free', true);
  }
  if (filters.isDairyFree === true) {
    query = query.eq('is_dairy_free', true);
  }
  if (filters.isHalal === true) {
    query = query.eq('is_halal', true);
  }

  // Text search filter
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getMenuItemById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getFeaturedItems(moduleId?: string) {
  const supabase = getSupabase();
  let query = supabase
    .from('menu_items')
    .select('*')
    .eq('is_featured', true)
    .eq('is_available', true)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  // Filter by module_id for proper data isolation
  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function createCategory(data: {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  displayOrder?: number;
  imageUrl?: string;
  moduleId?: string;
}) {
  const supabase = getSupabase();
  const { data: category, error } = await supabase
    .from('menu_categories')
    .insert({
      name: data.name,
      name_ar: data.nameAr,
      name_fr: data.nameFr,
      description: data.description,
      display_order: data.displayOrder || 0,
      image_url: data.imageUrl,
      module_id: data.moduleId,
    })
    .select()
    .single();

  if (error) throw error;
  return category;
}

export async function updateCategory(id: string, data: Partial<{
  name: string;
  nameAr: string;
  nameFr: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  imageUrl: string;
}>) {
  const supabase = getSupabase();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameAr !== undefined) updateData.name_ar = data.nameAr;
  if (data.nameFr !== undefined) updateData.name_fr = data.nameFr;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

  const { data: category, error } = await supabase
    .from('menu_categories')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return category;
}

export async function deleteCategory(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('menu_categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function createMenuItem(data: {
  categoryId: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  price: number;
  preparationTimeMinutes?: number;
  calories?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isAvailable?: boolean;
  allergens?: string[];
  imageUrl?: string;
  isFeatured?: boolean;
  isSpicy?: boolean;
  discountPrice?: number;
  displayOrder?: number;
  moduleId?: string;
}) {
  const supabase = getSupabase();

  // Ensure price is a valid number
  const priceValue = typeof data.price === 'number' ? data.price : parseFloat(String(data.price)) || 0;

  const { data: item, error } = await supabase
    .from('menu_items')
    .insert({
      category_id: data.categoryId,
      name: data.name,
      name_ar: data.nameAr,
      name_fr: data.nameFr,
      description: data.description,
      description_ar: data.descriptionAr,
      description_fr: data.descriptionFr,
      price: priceValue.toString(),
      preparation_time_minutes: data.preparationTimeMinutes,
      calories: data.calories,
      is_vegetarian: data.isVegetarian || false,
      is_vegan: data.isVegan || false,
      is_gluten_free: data.isGlutenFree || false,
      is_available: data.isAvailable !== undefined ? data.isAvailable : true,
      allergens: data.allergens || [],
      image_url: data.imageUrl,
      is_featured: data.isFeatured || false,
      is_spicy: data.isSpicy || false,
      discount_price: data.discountPrice,
      display_order: data.displayOrder || 0,
      module_id: data.moduleId,
    })
    .select()
    .single();

  if (error) throw error;
  return item;
}

export async function updateMenuItem(id: string, data: Partial<{
  categoryId: string;
  name: string;
  nameAr: string;
  nameFr: string;
  description: string;
  descriptionAr: string;
  descriptionFr: string;
  price: number;
  preparationTimeMinutes: number;
  calories: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  allergens: string[];
  imageUrl: string;
  isAvailable: boolean;
  isFeatured: boolean;
  isSpicy: boolean;
  discountPrice: number;
  displayOrder: number;
}>) {
  const supabase = getSupabase();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameAr !== undefined) updateData.name_ar = data.nameAr;
  if (data.nameFr !== undefined) updateData.name_fr = data.nameFr;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.descriptionAr !== undefined) updateData.description_ar = data.descriptionAr;
  if (data.descriptionFr !== undefined) updateData.description_fr = data.descriptionFr;
  if (data.price !== undefined) updateData.price = data.price.toString();
  if (data.preparationTimeMinutes !== undefined) updateData.preparation_time_minutes = data.preparationTimeMinutes;
  if (data.calories !== undefined) updateData.calories = data.calories;
  if (data.isVegetarian !== undefined) updateData.is_vegetarian = data.isVegetarian;
  if (data.isVegan !== undefined) updateData.is_vegan = data.isVegan;
  if (data.isGlutenFree !== undefined) updateData.is_gluten_free = data.isGlutenFree;
  if (data.allergens !== undefined) updateData.allergens = data.allergens;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
  if (data.isAvailable !== undefined) updateData.is_available = data.isAvailable;
  if (data.isFeatured !== undefined) updateData.is_featured = data.isFeatured;
  if (data.isSpicy !== undefined) updateData.is_spicy = data.isSpicy;
  if (data.discountPrice !== undefined) updateData.discount_price = data.discountPrice;
  if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;

  const { data: item, error } = await supabase
    .from('menu_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return item;
}

export async function deleteMenuItem(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function setItemAvailability(id: string, isAvailable: boolean) {
  const supabase = getSupabase();
  const { data: item, error } = await supabase
    .from('menu_items')
    .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return item;
}
