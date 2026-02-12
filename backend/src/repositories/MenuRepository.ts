import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MenuCategory {
  [key: string]: unknown;
  id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface MenuItem {
  [key: string]: unknown;
  id: string;
  category_id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  description_ar?: string | null;
  description_fr?: string | null;
  price: string;
  preparation_time_minutes?: number | null;
  calories?: number | null;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  allergens?: string[] | null;
  image_url?: string | null;
  is_available?: boolean;
  is_featured?: boolean;
  display_order?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class MenuCategoryRepository extends BaseRepository<MenuCategory> {
  constructor() {
    super('menu_categories');
  }

  /** Find only active categories, ordered by display_order. */
  async findActive(): Promise<MenuCategory[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    if (error) throw new Error(`[menu_categories] findActive failed: ${error.message}`);
    return (data as MenuCategory[]) ?? [];
  }
}

export class MenuItemRepository extends BaseRepository<MenuItem> {
  constructor() {
    super('menu_items');
  }

  /** Find menu items belonging to a specific category. */
  async findByCategory(
    categoryId: string,
    options?: FindManyOptions,
  ): Promise<MenuItem[]> {
    return this.findMany({ category_id: categoryId, is_available: true }, options);
  }

  /** Find all available menu items (not deleted). */
  async findAvailable(options?: FindManyOptions): Promise<MenuItem[]> {
    let query = this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('is_available', true)
      .is('deleted_at', null);

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[menu_items] findAvailable failed: ${error.message}`);
    return (data as MenuItem[]) ?? [];
  }

  /** Find featured menu items. */
  async findFeatured(): Promise<MenuItem[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('is_featured', true)
      .eq('is_available', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    if (error) throw new Error(`[menu_items] findFeatured failed: ${error.message}`);
    return (data as MenuItem[]) ?? [];
  }

  /** Search menu items by name (case-insensitive). */
  async search(term: string): Promise<MenuItem[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .ilike('name', `%${term}%`)
      .is('deleted_at', null);

    if (error) throw new Error(`[menu_items] search failed: ${error.message}`);
    return (data as MenuItem[]) ?? [];
  }
}

/** Facade combining both sub-repositories. */
export class MenuRepository {
  readonly categories = new MenuCategoryRepository();
  readonly items = new MenuItemRepository();
}
