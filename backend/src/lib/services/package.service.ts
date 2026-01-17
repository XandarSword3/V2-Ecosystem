/**
 * Package/Promotion Service
 *
 * Manages promotional packages and bundled offers.
 */

import type {
  Container,
  Package,
  PackageRedemption,
  PackageFilters,
  PackageType,
  PackageStatus,
} from '../container/types.js';

// Error handling
export class PackageServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PackageServiceError';
  }
}

// Input types
export interface CreatePackageInput {
  name: string;
  code: string;
  type: PackageType;
  description: string;
  shortDescription?: string;
  includes: string[];
  basePrice: number;
  discountPercentage?: number;
  minNights?: number;
  maxNights?: number;
  validFrom: string;
  validTo: string;
  maxRedemptions?: number;
  roomTypeIds?: string[];
  imageUrl?: string;
  termsAndConditions?: string;
}

export interface UpdatePackageInput {
  name?: string;
  description?: string;
  shortDescription?: string;
  includes?: string[];
  basePrice?: number;
  discountPercentage?: number;
  minNights?: number;
  maxNights?: number;
  validFrom?: string;
  validTo?: string;
  maxRedemptions?: number;
  roomTypeIds?: string[];
  imageUrl?: string;
  termsAndConditions?: string;
}

export interface RedeemPackageInput {
  packageId: string;
  bookingId: string;
  guestId: string;
}

export interface PackageStats {
  totalPackages: number;
  activePackages: number;
  totalRedemptions: number;
  totalRevenue: number;
  totalDiscounts: number;
  byType: Record<PackageType, number>;
  byStatus: Record<PackageStatus, number>;
  topPackages: { id: string; name: string; redemptions: number }[];
}

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACKAGE_TYPES: PackageType[] = ['room_only', 'bed_and_breakfast', 'half_board', 'full_board', 'all_inclusive', 'spa', 'romantic', 'family', 'adventure', 'custom'];
const PACKAGE_STATUSES: PackageStatus[] = ['draft', 'active', 'inactive', 'expired', 'sold_out'];

export interface PackageService {
  // Package operations
  createPackage(input: CreatePackageInput): Promise<Package>;
  getPackage(id: string): Promise<Package | null>;
  getPackageByCode(code: string): Promise<Package | null>;
  updatePackage(id: string, input: UpdatePackageInput): Promise<Package>;
  deletePackage(id: string): Promise<void>;
  listPackages(filters?: PackageFilters): Promise<Package[]>;
  
  // Status management
  activatePackage(id: string): Promise<Package>;
  deactivatePackage(id: string): Promise<Package>;
  publishPackage(id: string): Promise<Package>;
  
  // Availability
  checkAvailability(id: string, checkIn: string, nights: number): Promise<boolean>;
  getAvailablePackages(checkIn: string, nights: number): Promise<Package[]>;
  
  // Redemption
  redeemPackage(input: RedeemPackageInput): Promise<PackageRedemption>;
  getPackageRedemptions(packageId: string): Promise<PackageRedemption[]>;
  getGuestRedemptions(guestId: string): Promise<PackageRedemption[]>;
  
  // Pricing
  calculatePrice(id: string, nights: number): Promise<{ baseTotal: number; discount: number; finalTotal: number }>;
  applyDiscount(id: string, discountPercentage: number): Promise<Package>;
  
  // Analytics
  getStats(): Promise<PackageStats>;
  
  // Utilities
  getPackageTypes(): PackageType[];
  getPackageStatuses(): PackageStatus[];
}

export function createPackageService(container: Container): PackageService {
  const { packageRepository, logger } = container;

  // ============================================
  // PACKAGE OPERATIONS
  // ============================================
  async function createPackage(input: CreatePackageInput): Promise<Package> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new PackageServiceError('Package name is required', 'INVALID_NAME');
    }

    // Validate code
    if (!input.code || input.code.trim().length === 0) {
      throw new PackageServiceError('Package code is required', 'INVALID_CODE');
    }

    // Check for duplicate code
    const existing = await packageRepository.getByCode(input.code.toUpperCase());
    if (existing) {
      throw new PackageServiceError('Package code already exists', 'DUPLICATE_CODE');
    }

    // Validate type
    if (!PACKAGE_TYPES.includes(input.type)) {
      throw new PackageServiceError('Invalid package type', 'INVALID_TYPE');
    }

    // Validate description
    if (!input.description || input.description.trim().length < 10) {
      throw new PackageServiceError('Description must be at least 10 characters', 'INVALID_DESCRIPTION');
    }

    // Validate includes
    if (!input.includes || input.includes.length === 0) {
      throw new PackageServiceError('Package must include at least one item', 'INVALID_INCLUDES');
    }

    // Validate base price
    if (input.basePrice <= 0) {
      throw new PackageServiceError('Base price must be positive', 'INVALID_PRICE');
    }

    // Validate discount
    if (input.discountPercentage !== undefined && (input.discountPercentage < 0 || input.discountPercentage > 100)) {
      throw new PackageServiceError('Discount must be between 0 and 100', 'INVALID_DISCOUNT');
    }

    // Validate dates
    const validFrom = new Date(input.validFrom);
    const validTo = new Date(input.validTo);
    if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
      throw new PackageServiceError('Invalid validity dates', 'INVALID_DATES');
    }
    if (validTo <= validFrom) {
      throw new PackageServiceError('End date must be after start date', 'INVALID_DATE_RANGE');
    }

    // Validate nights
    const minNights = input.minNights ?? 1;
    const maxNights = input.maxNights ?? 30;
    if (minNights < 1) {
      throw new PackageServiceError('Minimum nights must be at least 1', 'INVALID_MIN_NIGHTS');
    }
    if (maxNights < minNights) {
      throw new PackageServiceError('Maximum nights must be at least minimum nights', 'INVALID_MAX_NIGHTS');
    }

    // Calculate final price
    const discountPercentage = input.discountPercentage ?? 0;
    const finalPrice = input.basePrice * (1 - discountPercentage / 100);

    const pkg = await packageRepository.create({
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      type: input.type,
      status: 'draft',
      description: input.description.trim(),
      shortDescription: input.shortDescription || null,
      includes: input.includes,
      basePrice: input.basePrice,
      discountPercentage,
      finalPrice: Math.round(finalPrice * 100) / 100,
      minNights,
      maxNights,
      validFrom: input.validFrom,
      validTo: input.validTo,
      maxRedemptions: input.maxRedemptions ?? null,
      currentRedemptions: 0,
      roomTypeIds: input.roomTypeIds || [],
      imageUrl: input.imageUrl || null,
      termsAndConditions: input.termsAndConditions || null,
    });

    logger?.info?.(`Package created: ${pkg.name} (${pkg.code})`);
    return pkg;
  }

  async function getPackage(id: string): Promise<Package | null> {
    if (!UUID_REGEX.test(id)) {
      throw new PackageServiceError('Invalid package ID format', 'INVALID_PACKAGE_ID');
    }
    return packageRepository.getById(id);
  }

  async function getPackageByCode(code: string): Promise<Package | null> {
    return packageRepository.getByCode(code.toUpperCase());
  }

  async function updatePackage(id: string, input: UpdatePackageInput): Promise<Package> {
    const pkg = await getPackageOrThrow(id);

    // Validate discount if provided
    if (input.discountPercentage !== undefined && (input.discountPercentage < 0 || input.discountPercentage > 100)) {
      throw new PackageServiceError('Discount must be between 0 and 100', 'INVALID_DISCOUNT');
    }

    // Recalculate final price if base price or discount changed
    let updates: Partial<Package> = { ...input };
    const basePrice = input.basePrice ?? pkg.basePrice;
    const discount = input.discountPercentage ?? pkg.discountPercentage;
    updates.finalPrice = Math.round(basePrice * (1 - discount / 100) * 100) / 100;

    return packageRepository.update(id, updates);
  }

  async function deletePackage(id: string): Promise<void> {
    const pkg = await getPackageOrThrow(id);

    if (pkg.status === 'active') {
      throw new PackageServiceError('Cannot delete active package', 'CANNOT_DELETE_ACTIVE');
    }

    // Check for redemptions
    const redemptions = await packageRepository.getRedemptionsForPackage(id);
    if (redemptions.length > 0) {
      throw new PackageServiceError('Cannot delete package with redemptions', 'HAS_REDEMPTIONS');
    }

    await packageRepository.delete(id);
    logger?.info?.(`Package deleted: ${pkg.name} (${pkg.code})`);
  }

  async function listPackages(filters?: PackageFilters): Promise<Package[]> {
    return packageRepository.list(filters);
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================
  async function activatePackage(id: string): Promise<Package> {
    const pkg = await getPackageOrThrow(id);

    if (pkg.status === 'active') {
      throw new PackageServiceError('Package is already active', 'ALREADY_ACTIVE');
    }

    // Check if package is valid
    const now = new Date();
    const validTo = new Date(pkg.validTo);
    if (validTo < now) {
      throw new PackageServiceError('Cannot activate expired package', 'PACKAGE_EXPIRED');
    }

    return packageRepository.update(id, { status: 'active' });
  }

  async function deactivatePackage(id: string): Promise<Package> {
    const pkg = await getPackageOrThrow(id);

    if (pkg.status === 'inactive') {
      throw new PackageServiceError('Package is already inactive', 'ALREADY_INACTIVE');
    }

    return packageRepository.update(id, { status: 'inactive' });
  }

  async function publishPackage(id: string): Promise<Package> {
    const pkg = await getPackageOrThrow(id);

    if (pkg.status !== 'draft') {
      throw new PackageServiceError('Only draft packages can be published', 'INVALID_STATUS');
    }

    return packageRepository.update(id, { status: 'active' });
  }

  // ============================================
  // AVAILABILITY
  // ============================================
  async function checkAvailability(id: string, checkIn: string, nights: number): Promise<boolean> {
    const pkg = await getPackageOrThrow(id);

    // Check status
    if (pkg.status !== 'active') {
      return false;
    }

    // Check date range
    const checkInDate = new Date(checkIn);
    const validFrom = new Date(pkg.validFrom);
    const validTo = new Date(pkg.validTo);
    if (checkInDate < validFrom || checkInDate > validTo) {
      return false;
    }

    // Check nights
    if (nights < pkg.minNights || nights > pkg.maxNights) {
      return false;
    }

    // Check redemption limit
    if (pkg.maxRedemptions !== null && pkg.currentRedemptions >= pkg.maxRedemptions) {
      return false;
    }

    return true;
  }

  async function getAvailablePackages(checkIn: string, nights: number): Promise<Package[]> {
    const allPackages = await packageRepository.list({ status: 'active' });
    const available: Package[] = [];

    for (const pkg of allPackages) {
      const isAvailable = await checkAvailability(pkg.id, checkIn, nights);
      if (isAvailable) {
        available.push(pkg);
      }
    }

    return available;
  }

  // ============================================
  // REDEMPTION
  // ============================================
  async function redeemPackage(input: RedeemPackageInput): Promise<PackageRedemption> {
    if (!UUID_REGEX.test(input.packageId)) {
      throw new PackageServiceError('Invalid package ID format', 'INVALID_PACKAGE_ID');
    }

    if (!UUID_REGEX.test(input.bookingId)) {
      throw new PackageServiceError('Invalid booking ID format', 'INVALID_BOOKING_ID');
    }

    if (!UUID_REGEX.test(input.guestId)) {
      throw new PackageServiceError('Invalid guest ID format', 'INVALID_GUEST_ID');
    }

    const pkg = await getPackageOrThrow(input.packageId);

    if (pkg.status !== 'active') {
      throw new PackageServiceError('Package is not active', 'PACKAGE_NOT_ACTIVE');
    }

    // Check redemption limit
    if (pkg.maxRedemptions !== null && pkg.currentRedemptions >= pkg.maxRedemptions) {
      throw new PackageServiceError('Package redemption limit reached', 'REDEMPTION_LIMIT_REACHED');
    }

    const discountAmount = pkg.basePrice - pkg.finalPrice;

    const redemption = await packageRepository.createRedemption({
      packageId: input.packageId,
      bookingId: input.bookingId,
      guestId: input.guestId,
      redeemedAt: new Date().toISOString(),
      totalAmount: pkg.finalPrice,
      discountAmount,
    });

    // Update redemption count
    await packageRepository.update(input.packageId, {
      currentRedemptions: pkg.currentRedemptions + 1,
    });

    // Mark as sold out if limit reached
    if (pkg.maxRedemptions !== null && pkg.currentRedemptions + 1 >= pkg.maxRedemptions) {
      await packageRepository.update(input.packageId, { status: 'sold_out' });
    }

    logger?.info?.(`Package redeemed: ${pkg.name} for booking ${input.bookingId}`);
    return redemption;
  }

  async function getPackageRedemptions(packageId: string): Promise<PackageRedemption[]> {
    if (!UUID_REGEX.test(packageId)) {
      throw new PackageServiceError('Invalid package ID format', 'INVALID_PACKAGE_ID');
    }
    return packageRepository.getRedemptionsForPackage(packageId);
  }

  async function getGuestRedemptions(guestId: string): Promise<PackageRedemption[]> {
    if (!UUID_REGEX.test(guestId)) {
      throw new PackageServiceError('Invalid guest ID format', 'INVALID_GUEST_ID');
    }
    return packageRepository.getRedemptionsForGuest(guestId);
  }

  // ============================================
  // PRICING
  // ============================================
  async function calculatePrice(id: string, nights: number): Promise<{ baseTotal: number; discount: number; finalTotal: number }> {
    const pkg = await getPackageOrThrow(id);

    if (nights < pkg.minNights) {
      throw new PackageServiceError(`Minimum ${pkg.minNights} nights required`, 'BELOW_MIN_NIGHTS');
    }

    if (nights > pkg.maxNights) {
      throw new PackageServiceError(`Maximum ${pkg.maxNights} nights allowed`, 'ABOVE_MAX_NIGHTS');
    }

    const baseTotal = pkg.basePrice * nights;
    const discount = baseTotal * (pkg.discountPercentage / 100);
    const finalTotal = baseTotal - discount;

    return {
      baseTotal: Math.round(baseTotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
    };
  }

  async function applyDiscount(id: string, discountPercentage: number): Promise<Package> {
    await getPackageOrThrow(id);

    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new PackageServiceError('Discount must be between 0 and 100', 'INVALID_DISCOUNT');
    }

    return updatePackage(id, { discountPercentage });
  }

  // ============================================
  // ANALYTICS
  // ============================================
  async function getStats(): Promise<PackageStats> {
    const packages = await packageRepository.list();

    const byType: Record<PackageType, number> = {
      room_only: 0,
      bed_and_breakfast: 0,
      half_board: 0,
      full_board: 0,
      all_inclusive: 0,
      spa: 0,
      romantic: 0,
      family: 0,
      adventure: 0,
      custom: 0,
    };

    const byStatus: Record<PackageStatus, number> = {
      draft: 0,
      active: 0,
      inactive: 0,
      expired: 0,
      sold_out: 0,
    };

    let totalRevenue = 0;
    let totalDiscounts = 0;
    let totalRedemptions = 0;

    const packageRedemptionCounts: { id: string; name: string; redemptions: number }[] = [];

    for (const pkg of packages) {
      byType[pkg.type]++;
      byStatus[pkg.status]++;

      const redemptions = await packageRepository.getRedemptionsForPackage(pkg.id);
      totalRedemptions += redemptions.length;

      packageRedemptionCounts.push({
        id: pkg.id,
        name: pkg.name,
        redemptions: redemptions.length,
      });

      for (const r of redemptions) {
        totalRevenue += r.totalAmount;
        totalDiscounts += r.discountAmount;
      }
    }

    // Top packages by redemptions
    const topPackages = packageRedemptionCounts
      .sort((a, b) => b.redemptions - a.redemptions)
      .slice(0, 5);

    return {
      totalPackages: packages.length,
      activePackages: byStatus.active,
      totalRedemptions,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      byType,
      byStatus,
      topPackages,
    };
  }

  // ============================================
  // UTILITIES
  // ============================================
  function getPackageTypes(): PackageType[] {
    return [...PACKAGE_TYPES];
  }

  function getPackageStatuses(): PackageStatus[] {
    return [...PACKAGE_STATUSES];
  }

  // Helper
  async function getPackageOrThrow(id: string): Promise<Package> {
    if (!UUID_REGEX.test(id)) {
      throw new PackageServiceError('Invalid package ID format', 'INVALID_PACKAGE_ID');
    }

    const pkg = await packageRepository.getById(id);
    if (!pkg) {
      throw new PackageServiceError('Package not found', 'PACKAGE_NOT_FOUND', 404);
    }

    return pkg;
  }

  return {
    createPackage,
    getPackage,
    getPackageByCode,
    updatePackage,
    deletePackage,
    listPackages,
    activatePackage,
    deactivatePackage,
    publishPackage,
    checkAvailability,
    getAvailablePackages,
    redeemPackage,
    getPackageRedemptions,
    getGuestRedemptions,
    calculatePrice,
    applyDiscount,
    getStats,
    getPackageTypes,
    getPackageStatuses,
  };
}
