/**
 * In-Memory Coupon Repository
 *
 * Test double implementation for coupon/discount operations.
 * Stores data in memory for fast, isolated testing.
 */

import type {
  Coupon,
  CouponUsage,
  CouponFilters,
  CouponRepository,
} from '../container/types';

export class InMemoryCouponRepository implements CouponRepository {
  private coupons: Map<string, Coupon> = new Map();
  private usages: Map<string, CouponUsage> = new Map();
  private usageIdCounter = 1;

  // ============================================
  // COUPON CRUD
  // ============================================

  async create(
    coupon: Omit<Coupon, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ): Promise<Coupon> {
    const id = crypto.randomUUID();
    const newCoupon: Coupon = {
      ...coupon,
      id,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.coupons.set(id, newCoupon);
    return { ...newCoupon };
  }

  async update(id: string, data: Partial<Coupon>): Promise<Coupon | null> {
    const existing = this.coupons.get(id);
    if (!existing) return null;

    const updated: Coupon = {
      ...existing,
      ...data,
      id, // Ensure ID is not changed
      updatedAt: new Date().toISOString(),
    };
    this.coupons.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.coupons.delete(id);
  }

  async getById(id: string): Promise<Coupon | null> {
    const coupon = this.coupons.get(id);
    return coupon ? { ...coupon } : null;
  }

  async getByCode(code: string): Promise<Coupon | null> {
    const upperCode = code.toUpperCase();
    for (const coupon of this.coupons.values()) {
      if (coupon.code.toUpperCase() === upperCode) {
        return { ...coupon };
      }
    }
    return null;
  }

  async list(filters?: CouponFilters): Promise<Coupon[]> {
    let results = Array.from(this.coupons.values());

    if (filters?.type) {
      results = results.filter((c) => c.type === filters.type);
    }

    if (filters?.scope) {
      results = results.filter((c) => c.scope === filters.scope);
    }

    if (filters?.isActive !== undefined) {
      results = results.filter((c) => c.isActive === filters.isActive);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(
        (c) =>
          c.code.toLowerCase().includes(search) ||
          c.name.toLowerCase().includes(search)
      );
    }

    if (!filters?.includeExpired) {
      const now = new Date().toISOString();
      results = results.filter(
        (c) => !c.endDate || c.endDate >= now
      );
    }

    return results.map((c) => ({ ...c }));
  }

  // ============================================
  // USAGE TRACKING
  // ============================================

  async incrementUsage(id: string): Promise<void> {
    const coupon = this.coupons.get(id);
    if (coupon) {
      coupon.usageCount += 1;
    }
  }

  async recordUsage(
    usage: Omit<CouponUsage, 'id' | 'createdAt'>
  ): Promise<CouponUsage> {
    const id = `usage-${this.usageIdCounter++}`;
    const newUsage: CouponUsage = {
      ...usage,
      id,
      createdAt: new Date().toISOString(),
    };
    this.usages.set(id, newUsage);
    return { ...newUsage };
  }

  async getUsageByUser(couponId: string, userId: string): Promise<CouponUsage[]> {
    const results: CouponUsage[] = [];
    for (const usage of this.usages.values()) {
      if (usage.couponId === couponId && usage.userId === userId) {
        results.push({ ...usage });
      }
    }
    return results;
  }

  async getUsageCount(couponId: string): Promise<number> {
    let count = 0;
    for (const usage of this.usages.values()) {
      if (usage.couponId === couponId) {
        count++;
      }
    }
    return count;
  }

  // ============================================
  // TEST HELPERS
  // ============================================

  addCoupon(coupon: Coupon): void {
    this.coupons.set(coupon.id, { ...coupon });
  }

  addUsage(usage: CouponUsage): void {
    this.usages.set(usage.id, { ...usage });
  }

  clear(): void {
    this.coupons.clear();
    this.usages.clear();
    this.usageIdCounter = 1;
  }

  getAll(): Coupon[] {
    return Array.from(this.coupons.values()).map((c) => ({ ...c }));
  }

  getAllUsages(): CouponUsage[] {
    return Array.from(this.usages.values()).map((u) => ({ ...u }));
  }
}
