/**
 * In-Memory Coupon Repository
 * Test double for CouponRepository using in-memory data structures.
 */

import type {
  CouponRepository,
  Coupon,
  CouponUsage,
  CouponFilters,
} from '../container/types.js';

export class InMemoryCouponRepository implements CouponRepository {
  private coupons = new Map<string, Coupon>();
  private usages: CouponUsage[] = [];

  /** Test helper: directly insert a coupon */
  addCoupon(coupon: Coupon): void {
    this.coupons.set(coupon.id, coupon);
  }

  /** Test helper: directly insert a usage record */
  addUsage(usage: CouponUsage): void {
    this.usages.push(usage);
  }

  /** Test helper: get all usages */
  getAllUsages(): CouponUsage[] {
    return [...this.usages];
  }

  /** Test helper: get all coupons */
  getAll(): Coupon[] {
    return [...this.coupons.values()];
  }

  reset() {
    this.coupons.clear();
    this.usages = [];
  }

  async create(data: Omit<Coupon, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<Coupon> {
    const id = crypto.randomUUID();
    const coupon: Coupon = { ...data, id, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: null };
    this.coupons.set(id, coupon);
    return coupon;
  }

  async update(id: string, data: Partial<Coupon>): Promise<Coupon | null> {
    const existing = this.coupons.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.coupons.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.coupons.delete(id);
  }

  async getById(id: string): Promise<Coupon | null> {
    return this.coupons.get(id) ?? null;
  }

  async getByCode(code: string): Promise<Coupon | null> {
    for (const c of this.coupons.values()) {
      if (c.code === code) return c;
    }
    return null;
  }

  async list(filters?: CouponFilters): Promise<Coupon[]> {
    let result = [...this.coupons.values()];
    if (filters?.type) result = result.filter(c => c.type === filters.type);
    if (filters?.scope) result = result.filter(c => c.scope === filters.scope);
    if (filters?.isActive !== undefined) result = result.filter(c => c.isActive === filters.isActive);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }
    if (!filters?.includeExpired) {
      const now = new Date().toISOString();
      result = result.filter(c => !c.endDate || c.endDate >= now);
    }
    return result;
  }

  async incrementUsage(id: string): Promise<void> {
    const existing = this.coupons.get(id);
    if (existing) {
      existing.usageCount++;
      this.coupons.set(id, existing);
    }
  }

  async recordUsage(data: Omit<CouponUsage, 'id' | 'createdAt'>): Promise<CouponUsage> {
    const usage: CouponUsage = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.usages.push(usage);
    return usage;
  }

  async getUsageByUser(couponId: string, userId: string): Promise<CouponUsage[]> {
    return this.usages.filter(u => u.couponId === couponId && u.userId === userId);
  }

  async getUsageCount(couponId: string): Promise<number> {
    return this.usages.filter(u => u.couponId === couponId).length;
  }
}
