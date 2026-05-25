import type { Package, PackageRedemption } from '../container/types';

export class InMemoryPackageRepository {
  private packages: Map<string, Package> = new Map();
  private redemptions: Map<string, PackageRedemption[]> = new Map();

  async save(p: Package): Promise<Package> { this.packages.set(p.id, { ...p }); return p; }
  async findById(id: string): Promise<Package | null> { return this.packages.get(id) ?? null; }
  async findByCode(code: string): Promise<Package | null> {
    for (const p of this.packages.values()) {
      if (p.code === code.toUpperCase()) return p;
    }
    return null;
  }
  async findAll(): Promise<Package[]> { return Array.from(this.packages.values()); }
  async delete(id: string): Promise<void> { this.packages.delete(id); }

  async saveRedemption(r: PackageRedemption): Promise<PackageRedemption> {
    const list = this.redemptions.get(r.packageId) ?? [];
    list.push({ ...r });
    this.redemptions.set(r.packageId, list);
    return r;
  }
  async findRedemptions(packageId: string): Promise<PackageRedemption[]> {
    return this.redemptions.get(packageId) ?? [];
  }
  async findAllRedemptions(): Promise<PackageRedemption[]> {
    return Array.from(this.redemptions.values()).flat();
  }
}
