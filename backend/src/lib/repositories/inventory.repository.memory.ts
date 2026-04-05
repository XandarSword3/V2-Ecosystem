/**
 * In-Memory Inventory Repository
 * Test double for InventoryRepository using in-memory data structures.
 */

import type {
  InventoryRepository,
  InventoryItem,
  StockMovement,
  InventoryFilters,
} from '../container/types.js';

export class InMemoryInventoryRepository implements InventoryRepository {
  private items = new Map<string, InventoryItem>();
  private movements: StockMovement[] = [];

  /** Test helper: directly insert an item */
  addItem(item: InventoryItem): void {
    this.items.set(item.id, item);
  }

  reset() {
    this.items.clear();
    this.movements = [];
  }

  async create(data: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem> {
    const id = crypto.randomUUID();
    const item: InventoryItem = { ...data, id, createdAt: new Date().toISOString() } as InventoryItem;
    this.items.set(id, item);
    return item;
  }

  async getById(id: string): Promise<InventoryItem | null> {
    return this.items.get(id) ?? null;
  }

  async getBySku(sku: string): Promise<InventoryItem | null> {
    for (const item of this.items.values()) {
      if (item.sku === sku) return item;
    }
    return null;
  }

  async getAll(filters?: InventoryFilters): Promise<InventoryItem[]> {
    let result = [...this.items.values()];
    if (filters?.category) result = result.filter(i => i.category === filters.category);
    if (filters?.lowStock) result = result.filter(i => i.quantity <= i.minQuantity);
    if (filters?.isActive !== undefined) result = result.filter(i => i.isActive === filters.isActive);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    }
    return result;
  }

  async update(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const existing = this.items.get(id);
    if (!existing) throw new Error(`Item ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async recordMovement(data: Omit<StockMovement, 'id' | 'createdAt'>): Promise<StockMovement> {
    const movement: StockMovement = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.movements.push(movement);
    const item = this.items.get(data.itemId);
    if (item) {
      item.quantity = data.newQuantity;
      this.items.set(item.id, item);
    }
    return movement;
  }

  async getMovements(itemId: string, limit?: number): Promise<StockMovement[]> {
    let result = this.movements.filter(m => m.itemId === itemId);
    if (limit) result = result.slice(-limit);
    return result;
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return [...this.items.values()].filter(i => i.quantity <= i.minQuantity && i.isActive);
  }
}
