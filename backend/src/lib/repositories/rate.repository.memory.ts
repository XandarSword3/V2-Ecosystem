/**
 * In-Memory Rate Repository
 *
 * Test implementation of the rate repository for unit testing.
 */

import type { Rate, RateModifier, RateFilters, RateRepository } from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryRateRepository implements RateRepository {
  private rates: Map<string, Rate> = new Map();
  private modifiers: Map<string, RateModifier> = new Map();

  async create(data: Omit<Rate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rate> {
    const rate: Rate = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.rates.set(rate.id, rate);
    return { ...rate };
  }

  async update(id: string, data: Partial<Rate>): Promise<Rate> {
    const rate = this.rates.get(id);
    if (!rate) {
      throw new Error('Rate not found');
    }
    const updated: Rate = {
      ...rate,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.rates.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.rates.delete(id);
    // Delete associated modifiers
    for (const [modId, mod] of this.modifiers) {
      if (mod.rateId === id) {
        this.modifiers.delete(modId);
      }
    }
  }

  async getById(id: string): Promise<Rate | null> {
    const rate = this.rates.get(id);
    return rate ? { ...rate } : null;
  }

  async list(filters?: RateFilters): Promise<Rate[]> {
    let result = Array.from(this.rates.values());

    if (filters) {
      if (filters.rateType) {
        result = result.filter((r) => r.rateType === filters.rateType);
      }
      if (filters.itemType) {
        result = result.filter((r) => r.applicableItemType === filters.itemType);
      }
      if (filters.itemId) {
        result = result.filter(
          (r) => r.applicableItemId === filters.itemId || r.applicableItemId === null
        );
      }
      if (filters.activeOnly) {
        result = result.filter((r) => r.isActive);
      }
      if (filters.dateRange) {
        const { start, end } = filters.dateRange;
        result = result.filter((r) => {
          if (!r.startDate && !r.endDate) return true;
          if (r.startDate && new Date(r.startDate) > new Date(end)) return false;
          if (r.endDate && new Date(r.endDate) < new Date(start)) return false;
          return true;
        });
      }
    }

    return result.map((r) => ({ ...r })).sort((a, b) => b.priority - a.priority);
  }

  async getApplicableRates(
    itemType: string,
    itemId: string | null,
    date: string
  ): Promise<Rate[]> {
    const targetDate = new Date(date);
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      targetDate.getDay()
    ];

    return Array.from(this.rates.values())
      .filter((r) => {
        if (!r.isActive) return false;
        if (r.applicableItemType !== itemType) return false;
        if (r.applicableItemId !== null && r.applicableItemId !== itemId) return false;
        if (r.startDate && new Date(r.startDate) > targetDate) return false;
        if (r.endDate && new Date(r.endDate) < targetDate) return false;
        if (r.daysOfWeek.length > 0 && !r.daysOfWeek.includes(dayName as any)) return false;
        return true;
      })
      .map((r) => ({ ...r }))
      .sort((a, b) => b.priority - a.priority);
  }

  async addModifier(data: Omit<RateModifier, 'id' | 'createdAt'>): Promise<RateModifier> {
    const modifier: RateModifier = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.modifiers.set(modifier.id, modifier);
    return { ...modifier };
  }

  async getModifiers(rateId: string): Promise<RateModifier[]> {
    return Array.from(this.modifiers.values())
      .filter((m) => m.rateId === rateId)
      .map((m) => ({ ...m }));
  }

  async deleteModifier(id: string): Promise<void> {
    this.modifiers.delete(id);
  }

  // Test helpers
  addRate(rate: Rate): void {
    this.rates.set(rate.id, { ...rate });
  }

  addModifierDirect(modifier: RateModifier): void {
    this.modifiers.set(modifier.id, { ...modifier });
  }

  clear(): void {
    this.rates.clear();
    this.modifiers.clear();
  }

  getAll(): Rate[] {
    return Array.from(this.rates.values()).map((r) => ({ ...r }));
  }

  getAllModifiers(): RateModifier[] {
    return Array.from(this.modifiers.values()).map((m) => ({ ...m }));
  }
}

export function createInMemoryRateRepository(): InMemoryRateRepository {
  return new InMemoryRateRepository();
}
