import { randomUUID } from 'crypto';
import type {
  Container, Package, PackageRedemption, PackageType, PackageStatus,
} from '../container/types';
import type { InMemoryPackageRepository } from '../repositories/package.repository.memory';

const PACKAGE_TYPES: PackageType[] = ['room_only', 'bed_and_breakfast', 'half_board', 'full_board', 'all_inclusive', 'romantic', 'family', 'honeymoon', 'adventure', 'spa', 'golf', 'business'];
const PACKAGE_STATUSES: PackageStatus[] = ['draft', 'active', 'inactive', 'expired', 'sold_out'];

function isUUID(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

export class PackageServiceError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

function calcFinal(base: number, discount: number): number {
  return Math.round(base * (1 - discount / 100) * 100) / 100;
}

export function createPackageService(container: Container) {
  const repo = container.packageRepository as InMemoryPackageRepository;

  async function getOrThrow(id: string): Promise<Package> {
    if (!isUUID(id)) throw new PackageServiceError('INVALID_PACKAGE_ID', 'Invalid package ID format');
    const p = await repo.findById(id);
    if (!p) throw new PackageServiceError('PACKAGE_NOT_FOUND', 'Package not found');
    return p;
  }

  return {
    async createPackage(input: {
      name: string; code: string; type: string; description: string;
      includes: string[]; basePrice: number; discountPercentage?: number;
      validFrom: string; validTo: string; currency?: string;
      minNights?: number; maxNights?: number; maxRedemptions?: number;
      eligibleRoomTypes?: string[]; blackoutDates?: string[];
    }): Promise<Package> {
      if (!input.name?.trim()) throw new PackageServiceError('INVALID_NAME', 'Name is required');
      if (!input.code?.trim()) throw new PackageServiceError('INVALID_CODE', 'Code is required');
      if (!PACKAGE_TYPES.includes(input.type as PackageType)) throw new PackageServiceError('INVALID_TYPE', `Invalid package type: ${input.type}`);
      if (!input.description || input.description.trim().length < 10) throw new PackageServiceError('INVALID_DESCRIPTION', 'Description must be at least 10 characters');
      if (!input.includes || input.includes.length === 0) throw new PackageServiceError('INVALID_INCLUDES', 'At least one item must be included');
      if (!input.basePrice || input.basePrice <= 0) throw new PackageServiceError('INVALID_PRICE', 'Price must be positive');
      const discount = input.discountPercentage ?? 0;
      if (discount < 0 || discount > 100) throw new PackageServiceError('INVALID_DISCOUNT', 'Discount must be between 0 and 100');
      if (input.validFrom > input.validTo) throw new PackageServiceError('INVALID_DATE_RANGE', 'validFrom must be before validTo');

      // Duplicate code check
      const code = input.code.trim().toUpperCase();
      const existing = await repo.findByCode(code);
      if (existing) throw new PackageServiceError('DUPLICATE_CODE', `Package code ${code} already exists`);

      const pkg: Package = {
        id: randomUUID(),
        name: input.name.trim(),
        code,
        type: input.type as PackageType,
        description: input.description.trim(),
        includes: input.includes,
        basePrice: input.basePrice,
        discountPercentage: discount,
        finalPrice: calcFinal(input.basePrice, discount),
        currency: input.currency ?? 'USD',
        minNights: input.minNights ?? null,
        maxNights: input.maxNights ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        currentRedemptions: 0,
        validFrom: input.validFrom,
        validTo: input.validTo,
        status: 'draft',
        eligibleRoomTypes: input.eligibleRoomTypes ?? [],
        blackoutDates: input.blackoutDates ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return repo.save(pkg);
    },

    async getPackage(id: string): Promise<Package | null> {
      if (!isUUID(id)) throw new PackageServiceError('INVALID_PACKAGE_ID', 'Invalid package ID format');
      return repo.findById(id);
    },

    async getPackageByCode(code: string): Promise<Package | null> {
      return repo.findByCode(code);
    },

    async updatePackage(id: string, updates: Partial<{ name: string; description: string; basePrice: number; discountPercentage: number; includes: string[] }>): Promise<Package> {
      const p = await getOrThrow(id);
      if (updates.discountPercentage !== undefined && (updates.discountPercentage < 0 || updates.discountPercentage > 100)) {
        throw new PackageServiceError('INVALID_DISCOUNT', 'Discount must be between 0 and 100');
      }
      const newBase = updates.basePrice ?? p.basePrice;
      const newDiscount = updates.discountPercentage ?? p.discountPercentage;
      const updated: Package = { ...p, ...updates, basePrice: newBase, discountPercentage: newDiscount, finalPrice: calcFinal(newBase, newDiscount), updatedAt: new Date().toISOString() };
      return repo.save(updated);
    },

    async deletePackage(id: string): Promise<void> {
      const p = await getOrThrow(id);
      if (p.status === 'active') throw new PackageServiceError('CANNOT_DELETE_ACTIVE', 'Cannot delete an active package');
      await repo.delete(id);
    },

    async activatePackage(id: string): Promise<Package> {
      const p = await getOrThrow(id);
      if (p.status === 'active') throw new PackageServiceError('ALREADY_ACTIVE', 'Package is already active');
      const today = new Date().toISOString().slice(0, 10);
      if (p.validTo < today) throw new PackageServiceError('PACKAGE_EXPIRED', 'Cannot activate an expired package');
      return repo.save({ ...p, status: 'active', updatedAt: new Date().toISOString() });
    },

    async deactivatePackage(id: string): Promise<Package> {
      const p = await getOrThrow(id);
      return repo.save({ ...p, status: 'inactive', updatedAt: new Date().toISOString() });
    },

    async publishPackage(id: string): Promise<Package> {
      const p = await getOrThrow(id);
      if (p.status !== 'draft') throw new PackageServiceError('INVALID_STATUS', 'Only draft packages can be published');
      const today = new Date().toISOString().slice(0, 10);
      if (p.validTo < today) throw new PackageServiceError('PACKAGE_EXPIRED', 'Cannot publish an expired package');
      return repo.save({ ...p, status: 'active', updatedAt: new Date().toISOString() });
    },

    async checkAvailability(id: string, date: string, nights: number): Promise<boolean> {
      const p = await repo.findById(id);
      if (!p || p.status !== 'active') return false;
      if (date < p.validFrom || date > p.validTo) return false;
      if (p.minNights !== null && nights < p.minNights) return false;
      if (p.maxNights !== null && nights > p.maxNights) return false;
      if (p.maxRedemptions !== null && p.currentRedemptions >= p.maxRedemptions) return false;
      return true;
    },

    async redeemPackage(input: { packageId: string; bookingId: string; guestId: string; nights?: number }): Promise<PackageRedemption> {
      if (!isUUID(input.packageId)) throw new PackageServiceError('INVALID_PACKAGE_ID', 'Invalid package ID format');
      if (!isUUID(input.bookingId)) throw new PackageServiceError('INVALID_BOOKING_ID', 'Invalid booking ID format');
      if (!isUUID(input.guestId)) throw new PackageServiceError('INVALID_GUEST_ID', 'Invalid guest ID format');
      const p = await repo.findById(input.packageId);
      if (!p) throw new PackageServiceError('PACKAGE_NOT_FOUND', 'Package not found');
      if (p.status !== 'active') throw new PackageServiceError('PACKAGE_NOT_ACTIVE', 'Package is not active');
      if (p.maxRedemptions !== null && p.currentRedemptions >= p.maxRedemptions) {
        throw new PackageServiceError('MAX_REDEMPTIONS_REACHED', 'Package has reached maximum redemptions');
      }

      const nights = input.nights ?? 1;
      const baseAmount = p.finalPrice * nights;
      const discountAmount = Math.round((p.basePrice * nights * p.discountPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((baseAmount) * 100) / 100;

      const redemption: PackageRedemption = {
        id: randomUUID(),
        packageId: input.packageId,
        bookingId: input.bookingId,
        guestId: input.guestId,
        nights,
        baseAmount: p.basePrice * nights,
        discountAmount,
        totalAmount,
        redeemedAt: new Date().toISOString(),
      };
      await repo.saveRedemption(redemption);
      await repo.save({ ...p, currentRedemptions: p.currentRedemptions + 1, updatedAt: new Date().toISOString() });
      return redemption;
    },

    async calculatePrice(id: string, nights: number): Promise<{ baseTotal: number; discount: number; finalTotal: number }> {
      const p = await getOrThrow(id);
      if (p.minNights !== null && nights < p.minNights) throw new PackageServiceError('BELOW_MIN_NIGHTS', `Minimum ${p.minNights} nights required`);
      if (p.maxNights !== null && nights > p.maxNights) throw new PackageServiceError('ABOVE_MAX_NIGHTS', `Maximum ${p.maxNights} nights allowed`);
      const baseTotal = p.basePrice * nights;
      const discount = Math.round(baseTotal * p.discountPercentage / 100 * 100) / 100;
      const finalTotal = Math.round((baseTotal - discount) * 100) / 100;
      return { baseTotal, discount, finalTotal };
    },

    async applyDiscount(id: string, discountPercentage: number): Promise<Package> {
      const p = await getOrThrow(id);
      if (discountPercentage < 0 || discountPercentage > 100) throw new PackageServiceError('INVALID_DISCOUNT', 'Discount must be between 0 and 100');
      return repo.save({ ...p, discountPercentage, finalPrice: calcFinal(p.basePrice, discountPercentage), updatedAt: new Date().toISOString() });
    },

    async getStats() {
      const all = await repo.findAll();
      const redemptions = await repo.findAllRedemptions();
      const active = all.filter(p => p.status === 'active');
      const totalRevenue = redemptions.reduce((s, r) => s + r.totalAmount, 0);
      const totalDiscounts = redemptions.reduce((s, r) => s + r.discountAmount, 0);
      const byType = PACKAGE_TYPES.reduce((acc, t) => ({ ...acc, [t]: all.filter(p => p.type === t).length }), {} as Record<PackageType, number>);
      return {
        totalPackages: all.length,
        activePackages: active.length,
        totalRedemptions: redemptions.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        byType,
      };
    },

    getPackageTypes(): PackageType[] { return [...PACKAGE_TYPES]; },
    getPackageStatuses(): PackageStatus[] { return [...PACKAGE_STATUSES]; },
  };
}
