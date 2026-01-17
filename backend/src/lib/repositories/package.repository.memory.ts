/**
 * In-Memory Package Repository
 *
 * Test double for the Package repository.
 */

import type {
  Package,
  PackageRedemption,
  PackageFilters,
  PackageRepository,
} from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryPackageRepository implements PackageRepository {
  private packages: Map<string, Package> = new Map();
  private redemptions: Map<string, PackageRedemption> = new Map();

  // Package Operations
  async create(data: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<Package> {
    const pkg: Package = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.packages.set(pkg.id, pkg);
    return pkg;
  }

  async update(id: string, data: Partial<Package>): Promise<Package> {
    const pkg = this.packages.get(id);
    if (!pkg) {
      throw new Error(`Package not found: ${id}`);
    }
    const updated: Package = {
      ...pkg,
      ...data,
      id: pkg.id,
      createdAt: pkg.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.packages.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.packages.delete(id);
  }

  async getById(id: string): Promise<Package | null> {
    return this.packages.get(id) || null;
  }

  async getByCode(code: string): Promise<Package | null> {
    for (const pkg of this.packages.values()) {
      if (pkg.code === code) {
        return pkg;
      }
    }
    return null;
  }

  async list(filters?: PackageFilters): Promise<Package[]> {
    let result = Array.from(this.packages.values());

    if (filters?.type) {
      result = result.filter(p => p.type === filters.type);
    }
    if (filters?.status) {
      result = result.filter(p => p.status === filters.status);
    }
    if (filters?.minPrice !== undefined) {
      result = result.filter(p => p.finalPrice >= filters.minPrice!);
    }
    if (filters?.maxPrice !== undefined) {
      result = result.filter(p => p.finalPrice <= filters.maxPrice!);
    }
    if (filters?.validOn) {
      const date = new Date(filters.validOn);
      result = result.filter(p => {
        const from = new Date(p.validFrom);
        const to = new Date(p.validTo);
        return date >= from && date <= to;
      });
    }

    return result;
  }

  // Redemption Operations
  async createRedemption(data: Omit<PackageRedemption, 'id'>): Promise<PackageRedemption> {
    const redemption: PackageRedemption = {
      ...data,
      id: randomUUID(),
    };
    this.redemptions.set(redemption.id, redemption);
    return redemption;
  }

  async getRedemptionsForPackage(packageId: string): Promise<PackageRedemption[]> {
    return Array.from(this.redemptions.values()).filter(r => r.packageId === packageId);
  }

  async getRedemptionsForGuest(guestId: string): Promise<PackageRedemption[]> {
    return Array.from(this.redemptions.values()).filter(r => r.guestId === guestId);
  }

  // Test helpers
  addPackage(pkg: Package): void {
    this.packages.set(pkg.id, pkg);
  }

  addRedemption(redemption: PackageRedemption): void {
    this.redemptions.set(redemption.id, redemption);
  }

  clear(): void {
    this.packages.clear();
    this.redemptions.clear();
  }

  getAllPackages(): Package[] {
    return Array.from(this.packages.values());
  }

  getAllRedemptions(): PackageRedemption[] {
    return Array.from(this.redemptions.values());
  }
}
