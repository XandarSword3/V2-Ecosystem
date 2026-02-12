import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InventoryItem {
  [key: string]: unknown;
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  category_id?: string | null;
  unit: string;
  current_stock?: string;
  min_stock_level?: string;
  max_stock_level?: string | null;
  reorder_point?: string;
  cost_per_unit?: string | null;
  last_purchase_price?: string | null;
  supplier?: string | null;
  location?: string | null;
  expiry_date?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface InventoryTransaction {
  [key: string]: unknown;
  id: string;
  item_id: string;
  transaction_type: string;
  quantity: string;
  unit_cost?: string | null;
  total_cost?: string | null;
  cost_impact?: string | null;
  stock_before?: string | null;
  stock_after?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  performed_by?: string | null;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class InventoryItemRepository extends BaseRepository<InventoryItem> {
  constructor() {
    super('inventory_items');
  }

  /** Find items by category. */
  async findByCategory(
    categoryId: string,
    options?: FindManyOptions,
  ): Promise<InventoryItem[]> {
    return this.findMany(
      { category_id: categoryId, is_active: true },
      { orderBy: 'name', ascending: true, ...options },
    );
  }

  /** Find items that are at or below their reorder point. */
  async findLowStock(): Promise<InventoryItem[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .filter('current_stock', 'lte', 'reorder_point');

    // The RPC filter above uses column comparison via `lte` on raw value.
    // Supabase REST doesn't natively support column-to-column filters,
    // so we fall back to client-side filtering.
    if (error) {
      const allItems = await this.findMany({ is_active: true });
      return allItems.filter(
        (i) =>
          i.current_stock !== undefined &&
          i.reorder_point !== undefined &&
          parseFloat(i.current_stock) <= parseFloat(i.reorder_point),
      );
    }
    return (data as InventoryItem[]) ?? [];
  }

  /** Find items by SKU. */
  async findBySku(sku: string): Promise<InventoryItem | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('sku', sku)
      .maybeSingle();

    if (error) throw new Error(`[inventory_items] findBySku failed: ${error.message}`);
    return (data as InventoryItem) ?? null;
  }

  /** Search inventory items by name (case-insensitive). */
  async search(term: string): Promise<InventoryItem[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .ilike('name', `%${term}%`)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (error) throw new Error(`[inventory_items] search failed: ${error.message}`);
    return (data as InventoryItem[]) ?? [];
  }

  /** Find items expiring before a given date. */
  async findExpiringSoon(beforeDate: string): Promise<InventoryItem[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', beforeDate)
      .order('expiry_date', { ascending: true });

    if (error) throw new Error(`[inventory_items] findExpiringSoon failed: ${error.message}`);
    return (data as InventoryItem[]) ?? [];
  }
}

export class InventoryTransactionRepository extends BaseRepository<InventoryTransaction> {
  constructor() {
    super('inventory_transactions');
  }

  /** Find transactions for a specific inventory item. */
  async findByItem(
    itemId: string,
    options?: FindManyOptions,
  ): Promise<InventoryTransaction[]> {
    return this.findMany(
      { item_id: itemId },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find transactions by type (e.g. 'purchase', 'consumption', 'adjustment'). */
  async findByType(
    transactionType: string,
    options?: FindManyOptions,
  ): Promise<InventoryTransaction[]> {
    return this.findMany(
      { transaction_type: transactionType },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find transactions within a date range. */
  async findByDateRange(from: string, to: string): Promise<InventoryTransaction[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[inventory_transactions] findByDateRange failed: ${error.message}`);
    return (data as InventoryTransaction[]) ?? [];
  }
}

/** Facade combining inventory sub-repositories. */
export class InventoryRepository {
  readonly items = new InventoryItemRepository();
  readonly transactions = new InventoryTransactionRepository();
}
