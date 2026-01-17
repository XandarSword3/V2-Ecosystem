/**
 * In-Memory Promotion Repository
 * 
 * Test double for promotion operations.
 */

import type { PromotionRepository, Promotion, PromotionUsage, PromotionStatus } from '../container/types.js';

export class InMemoryPromotionRepository implements PromotionRepository {
  private promotions: Map<string, Promotion> = new Map();
  private usage: Map<string, PromotionUsage[]> = new Map();

  async getById(id: string): Promise<Promotion | null> {
    return this.promotions.get(id) || null;
  }

  async getByCode(code: string): Promise<Promotion | null> {
    return Array.from(this.promotions.values()).find(p => p.code === code) || null;
  }

  async getAll(): Promise<Promotion[]> {
    return Array.from(this.promotions.values());
  }

  async getActive(): Promise<Promotion[]> {
    const now = new Date().toISOString();
    return Array.from(this.promotions.values())
      .filter(p => p.status === 'active' && p.startDate <= now && p.endDate >= now);
  }

  async create(data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<Promotion> {
    const promotion: Promotion = {
      ...data,
      id: crypto.randomUUID(),
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.promotions.set(promotion.id, promotion);
    this.usage.set(promotion.id, []);
    return promotion;
  }

  async update(id: string, data: Partial<Promotion>): Promise<Promotion> {
    const existing = this.promotions.get(id);
    if (!existing) throw new Error('Promotion not found');
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.promotions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.promotions.delete(id);
    this.usage.delete(id);
  }

  async getByStatus(status: PromotionStatus): Promise<Promotion[]> {
    return Array.from(this.promotions.values()).filter(p => p.status === status);
  }

  async logUsage(data: Omit<PromotionUsage, 'id' | 'usedAt'>): Promise<PromotionUsage> {
    const usage: PromotionUsage = {
      ...data,
      id: crypto.randomUUID(),
      usedAt: new Date().toISOString(),
    };
    const list = this.usage.get(data.promotionId) || [];
    list.push(usage);
    this.usage.set(data.promotionId, list);
    
    // Increment usage count
    const promotion = this.promotions.get(data.promotionId);
    if (promotion) {
      promotion.usageCount++;
      this.promotions.set(data.promotionId, promotion);
    }
    
    return usage;
  }

  async getUsage(promotionId: string): Promise<PromotionUsage[]> {
    return this.usage.get(promotionId) || [];
  }

  async getUserUsage(promotionId: string, userId: string): Promise<PromotionUsage[]> {
    const list = this.usage.get(promotionId) || [];
    return list.filter(u => u.userId === userId);
  }
}
