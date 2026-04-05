/**
 * In-Memory Promotion Repository
 * Test double for PromotionRepository using in-memory data structures.
 */

import type {
  PromotionRepository,
  Promotion,
  PromotionUsage,
  PromotionStatus,
} from '../container/types.js';

export class InMemoryPromotionRepository implements PromotionRepository {
  private promotions = new Map<string, Promotion>();
  private usages: PromotionUsage[] = [];

  reset() {
    this.promotions.clear();
    this.usages = [];
  }

  async getById(id: string): Promise<Promotion | null> {
    return this.promotions.get(id) ?? null;
  }

  async getByCode(code: string): Promise<Promotion | null> {
    for (const p of this.promotions.values()) {
      if (p.code === code) return p;
    }
    return null;
  }

  async getAll(): Promise<Promotion[]> {
    return [...this.promotions.values()];
  }

  async getActive(): Promise<Promotion[]> {
    return [...this.promotions.values()].filter(p => p.status === 'active');
  }

  async create(data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<Promotion> {
    const id = crypto.randomUUID();
    const promotion: Promotion = { ...data, id, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: null };
    this.promotions.set(id, promotion);
    return promotion;
  }

  async update(id: string, data: Partial<Promotion>): Promise<Promotion> {
    const existing = this.promotions.get(id);
    if (!existing) throw new Error(`Promotion ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.promotions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.promotions.delete(id);
  }

  async getByStatus(status: PromotionStatus): Promise<Promotion[]> {
    return [...this.promotions.values()].filter(p => p.status === status);
  }

  async logUsage(data: Omit<PromotionUsage, 'id' | 'usedAt'>): Promise<PromotionUsage> {
    const usage: PromotionUsage = { ...data, id: crypto.randomUUID(), usedAt: new Date().toISOString() };
    this.usages.push(usage);
    // Increment usage count
    const promo = this.promotions.get(data.promotionId);
    if (promo) {
      promo.usageCount++;
      this.promotions.set(promo.id, promo);
    }
    return usage;
  }

  async getUsage(promotionId: string): Promise<PromotionUsage[]> {
    return this.usages.filter(u => u.promotionId === promotionId);
  }

  async getUserUsage(promotionId: string, userId: string): Promise<PromotionUsage[]> {
    return this.usages.filter(u => u.promotionId === promotionId && u.userId === userId);
  }
}
