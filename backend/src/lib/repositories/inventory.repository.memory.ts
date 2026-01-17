/**
 * In-memory Inventory Repository for Testing
 *
 * This is a test double for the inventory repository that stores
 * inventory items and stock movements in memory for unit testing.
 */

import { randomUUID } from 'crypto';
import type {
  InventoryCategory,
  InventoryFilters,
  InventoryItem,
  InventoryRepository,
  StockMovement,
} from '../container/types';

export class InMemoryInventoryRepository implements InventoryRepository {
  private items: Map<string, InventoryItem> = new Map();
  private movements: Map<string, StockMovement[]> = new Map();

  async create(data: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem> {
    const item: InventoryItem = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.items.set(item.id, item);
    this.movements.set(item.id, []);
    return item;
  }

  async getById(id: string): Promise<InventoryItem | null> {
    return this.items.get(id) || null;
  }

  async getBySku(sku: string): Promise<InventoryItem | null> {
    for (const item of this.items.values()) {
      if (item.sku === sku) {
        return item;
      }
    }
    return null;
  }

  async getAll(filters?: InventoryFilters): Promise<InventoryItem[]> {
    let result = Array.from(this.items.values());

    if (filters) {
      if (filters.category) {
        result = result.filter((i) => i.category === filters.category);
      }
      if (filters.isActive !== undefined) {
        result = result.filter((i) => i.isActive === filters.isActive);
      }
      if (filters.lowStock) {
        result = result.filter((i) => i.quantity <= i.minQuantity);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(
          (i) =>
            i.name.toLowerCase().includes(searchLower) ||
            i.sku.toLowerCase().includes(searchLower)
        );
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async update(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error('Inventory item not found');
    }

    const updated: InventoryItem = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.items.has(id)) {
      throw new Error('Inventory item not found');
    }
    this.items.delete(id);
    this.movements.delete(id);
  }

  async recordMovement(
    movement: Omit<StockMovement, 'id' | 'createdAt'>
  ): Promise<StockMovement> {
    const fullMovement: StockMovement = {
      ...movement,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    const itemMovements = this.movements.get(movement.itemId) || [];
    itemMovements.push(fullMovement);
    this.movements.set(movement.itemId, itemMovements);

    // Update the item quantity
    const item = this.items.get(movement.itemId);
    if (item) {
      item.quantity = movement.newQuantity;
      this.items.set(movement.itemId, item);
    }

    return fullMovement;
  }

  async getMovements(itemId: string, limit = 50): Promise<StockMovement[]> {
    const movements = this.movements.get(itemId) || [];
    return movements
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.isActive && i.quantity <= i.minQuantity)
      .sort((a, b) => a.quantity - b.quantity);
  }

  // Test helper methods
  clear(): void {
    this.items.clear();
    this.movements.clear();
  }

  addItem(item: InventoryItem): void {
    this.items.set(item.id, item);
    if (!this.movements.has(item.id)) {
      this.movements.set(item.id, []);
    }
  }

  addMovement(movement: StockMovement): void {
    const movements = this.movements.get(movement.itemId) || [];
    movements.push(movement);
    this.movements.set(movement.itemId, movements);
  }

  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  getAllMovements(): StockMovement[] {
    const all: StockMovement[] = [];
    for (const movements of this.movements.values()) {
      all.push(...movements);
    }
    return all;
  }
}
