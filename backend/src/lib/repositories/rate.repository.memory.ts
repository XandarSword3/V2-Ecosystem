/**
 * In-Memory Rate Repository
 * Test double for RateRepository using in-memory data structures.
 */

import type {
  RateRepository,
  Rate,
  RateModifier,
  RateFilters,
} from '../container/types.js';

export class InMemoryRateRepository implements RateRepository {
  private rates = new Map<string, Rate>();
  private modifiers = new Map<string, RateModifier>();

  reset() {
    this.rates.clear();
    this.modifiers.clear();
  }

  async create(data: Omit<Rate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rate> {
    const id = crypto.randomUUID();
    const rate: Rate = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.rates.set(id, rate);
    return rate;
  }

  async update(id: string, data: Partial<Rate>): Promise<Rate> {
    const existing = this.rates.get(id);
    if (!existing) throw new Error(`Rate ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.rates.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rates.delete(id);
  }

  async getById(id: string): Promise<Rate | null> {
    return this.rates.get(id) ?? null;
  }

  async list(filters?: RateFilters): Promise<Rate[]> {
    let result = [...this.rates.values()];
    if (filters?.rateType) result = result.filter(r => r.rateType === filters.rateType);
    if (filters?.itemType) result = result.filter(r => r.applicableItemType === filters.itemType);
    if (filters?.itemId) result = result.filter(r => r.applicableItemId === filters.itemId);
    if (filters?.activeOnly) result = result.filter(r => r.isActive);
    return result;
  }

  async getApplicableRates(itemType: string, itemId: string | null, date: string): Promise<Rate[]> {
    return [...this.rates.values()].filter(r =>
      r.isActive &&
      r.applicableItemType === itemType &&
      (r.applicableItemId === null || r.applicableItemId === itemId) &&
      (!r.startDate || r.startDate <= date) &&
      (!r.endDate || r.endDate >= date)
    ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  async addModifier(data: Omit<RateModifier, 'id' | 'createdAt'>): Promise<RateModifier> {
    const id = crypto.randomUUID();
    const modifier: RateModifier = { ...data, id, createdAt: new Date().toISOString() };
    this.modifiers.set(id, modifier);
    return modifier;
  }

  async getModifiers(rateId: string): Promise<RateModifier[]> {
    return [...this.modifiers.values()].filter(m => m.rateId === rateId);
  }

  async deleteModifier(id: string): Promise<void> {
    this.modifiers.delete(id);
  }
}
