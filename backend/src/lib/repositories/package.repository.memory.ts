/**
 * In-Memory Package Repository
 * Test double for PackageRepository using in-memory data structures.
 */

import type {
  PackageRepository,
  Package,
  PackageRedemption,
  PackageFilters,
} from '../container/types.js';

export class InMemoryPackageRepository implements PackageRepository {
  private packages = new Map<string, Package>();
  private redemptions: PackageRedemption[] = [];

  reset() {
    this.packages.clear();
    this.redemptions = [];
  }

  async create(data: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<Package> {
    const id = crypto.randomUUID();
    const pkg: Package = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.packages.set(id, pkg);
    return pkg;
  }

  async update(id: string, data: Partial<Package>): Promise<Package> {
    const existing = this.packages.get(id);
    if (!existing) throw new Error(`Package ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.packages.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.packages.delete(id);
  }

  async getById(id: string): Promise<Package | null> {
    return this.packages.get(id) ?? null;
  }

  async getByCode(code: string): Promise<Package | null> {
    for (const p of this.packages.values()) {
      if (p.code === code) return p;
    }
    return null;
  }

  async list(filters?: PackageFilters): Promise<Package[]> {
    let result = [...this.packages.values()];
    if (filters?.type) result = result.filter(p => p.type === filters.type);
    if (filters?.status) result = result.filter(p => p.status === filters.status);
    if (filters?.minPrice !== undefined) result = result.filter(p => p.finalPrice >= filters.minPrice!);
    if (filters?.maxPrice !== undefined) result = result.filter(p => p.finalPrice <= filters.maxPrice!);
    if (filters?.validOn) {
      const date = filters.validOn;
      result = result.filter(p => p.validFrom <= date && p.validTo >= date);
    }
    return result;
  }

  async createRedemption(data: Omit<PackageRedemption, 'id'>): Promise<PackageRedemption> {
    const redemption: PackageRedemption = { ...data, id: crypto.randomUUID() };
    this.redemptions.push(redemption);
    return redemption;
  }

  async getRedemptionsForPackage(packageId: string): Promise<PackageRedemption[]> {
    return this.redemptions.filter(r => r.packageId === packageId);
  }

  async getRedemptionsForGuest(guestId: string): Promise<PackageRedemption[]> {
    return this.redemptions.filter(r => r.guestId === guestId);
  }
}
