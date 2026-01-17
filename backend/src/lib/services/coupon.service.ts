/**
 * Coupon Service with Dependency Injection
 *
 * This service handles all coupon/discount operations including:
 * - Coupon CRUD operations
 * - Coupon validation and application
 * - Usage tracking and limits
 * - Statistics
 *
 * All dependencies are injected via the container for testability.
 */

import type {
  Container,
  Coupon,
  CouponType,
  CouponScope,
  CouponFilters,
  CouponValidationResult,
} from '../container/types';

// Custom error class
export class CouponServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'CouponServiceError';
  }
}

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Coupon code validation (alphanumeric, 4-20 chars)
const COUPON_CODE_REGEX = /^[A-Z0-9]{4,20}$/;

// Valid types and scopes
const VALID_TYPES: CouponType[] = ['percentage', 'fixed_amount', 'free_shipping'];
const VALID_SCOPES: CouponScope[] = ['order', 'product', 'category', 'booking', 'pool'];

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  type: CouponType;
  value: number;
  scope: CouponScope;
  scopeIds?: string[];
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startDate?: string;
  endDate?: string;
  createdBy: string;
}

export interface UpdateCouponInput {
  name?: string;
  description?: string;
  value?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  endDate?: string;
  isActive?: boolean;
}

export interface ApplyCouponInput {
  code: string;
  userId: string;
  orderAmount: number;
  orderId?: string;
  bookingId?: string;
  productIds?: string[];
  categoryIds?: string[];
}

export interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  expiredCoupons: number;
  totalUsageCount: number;
  totalDiscountGiven: number;
  byType: Record<CouponType, number>;
  byScope: Record<CouponScope, number>;
}

export interface CouponService {
  createCoupon(input: CreateCouponInput): Promise<Coupon>;
  getCouponById(id: string): Promise<Coupon | null>;
  getCouponByCode(code: string): Promise<Coupon | null>;
  listCoupons(filters?: CouponFilters): Promise<Coupon[]>;
  updateCoupon(id: string, input: UpdateCouponInput): Promise<Coupon>;
  deleteCoupon(id: string): Promise<void>;
  deactivateCoupon(id: string): Promise<Coupon>;
  validateCoupon(input: ApplyCouponInput): Promise<CouponValidationResult>;
  applyCoupon(input: ApplyCouponInput): Promise<CouponValidationResult>;
  calculateDiscount(coupon: Coupon, orderAmount: number): number;
  getUserUsageCount(couponId: string, userId: string): Promise<number>;
  getStats(): Promise<CouponStats>;
  isCodeAvailable(code: string): Promise<boolean>;
  generateCode(prefix?: string): string;
  getTypes(): CouponType[];
  getScopes(): CouponScope[];
}

/**
 * Creates a CouponService instance with injected dependencies.
 */
export function createCouponService(container: Container): CouponService {
  const { couponRepository, logger } = container;

  // ----------------------------------------
  // VALIDATION HELPERS
  // ----------------------------------------

  function isValidUuid(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  function isValidCouponCode(code: string): boolean {
    return COUPON_CODE_REGEX.test(code.toUpperCase());
  }

  function normalizeCode(code: string): string {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // ----------------------------------------
  // SERVICE METHODS
  // ----------------------------------------

  async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
    // Validate code
    const normalizedCode = normalizeCode(input.code);
    if (!isValidCouponCode(normalizedCode)) {
      throw new CouponServiceError(
        'Coupon code must be 4-20 alphanumeric characters',
        'INVALID_CODE'
      );
    }

    // Check if code already exists
    const existing = await couponRepository.getByCode(normalizedCode);
    if (existing) {
      throw new CouponServiceError(
        'A coupon with this code already exists',
        'DUPLICATE_CODE'
      );
    }

    // Validate name
    const trimmedName = input.name.trim();
    if (trimmedName.length < 2) {
      throw new CouponServiceError(
        'Name must be at least 2 characters',
        'INVALID_NAME'
      );
    }
    if (trimmedName.length > 100) {
      throw new CouponServiceError(
        'Name cannot exceed 100 characters',
        'INVALID_NAME'
      );
    }

    // Validate type
    if (!VALID_TYPES.includes(input.type)) {
      throw new CouponServiceError(
        `Invalid coupon type. Must be one of: ${VALID_TYPES.join(', ')}`,
        'INVALID_TYPE'
      );
    }

    // Validate scope
    if (!VALID_SCOPES.includes(input.scope)) {
      throw new CouponServiceError(
        `Invalid coupon scope. Must be one of: ${VALID_SCOPES.join(', ')}`,
        'INVALID_SCOPE'
      );
    }

    // Validate value
    if (input.value <= 0) {
      throw new CouponServiceError(
        'Discount value must be positive',
        'INVALID_VALUE'
      );
    }

    if (input.type === 'percentage' && input.value > 100) {
      throw new CouponServiceError(
        'Percentage discount cannot exceed 100%',
        'INVALID_VALUE'
      );
    }

    // Validate min order amount
    if (input.minOrderAmount !== undefined && input.minOrderAmount < 0) {
      throw new CouponServiceError(
        'Minimum order amount cannot be negative',
        'INVALID_MIN_AMOUNT'
      );
    }

    // Validate max discount amount
    if (input.maxDiscountAmount !== undefined && input.maxDiscountAmount <= 0) {
      throw new CouponServiceError(
        'Maximum discount amount must be positive',
        'INVALID_MAX_DISCOUNT'
      );
    }

    // Validate usage limits
    if (input.usageLimit !== undefined && input.usageLimit < 1) {
      throw new CouponServiceError(
        'Usage limit must be at least 1',
        'INVALID_USAGE_LIMIT'
      );
    }

    if (input.perUserLimit !== undefined && input.perUserLimit < 1) {
      throw new CouponServiceError(
        'Per-user limit must be at least 1',
        'INVALID_PER_USER_LIMIT'
      );
    }

    // Validate dates
    const startDate = input.startDate || new Date().toISOString();
    if (input.endDate && input.endDate < startDate) {
      throw new CouponServiceError(
        'End date must be after start date',
        'INVALID_DATES'
      );
    }

    // Validate creator ID
    if (!isValidUuid(input.createdBy)) {
      throw new CouponServiceError(
        'Invalid creator ID format',
        'INVALID_CREATOR_ID'
      );
    }

    // Validate scope IDs if provided
    if (input.scopeIds?.length) {
      for (const scopeId of input.scopeIds) {
        if (!isValidUuid(scopeId)) {
          throw new CouponServiceError(
            'Invalid scope ID format',
            'INVALID_SCOPE_ID'
          );
        }
      }
    }

    const coupon = await couponRepository.create({
      code: normalizedCode,
      name: trimmedName,
      description: input.description?.trim() || null,
      type: input.type,
      value: input.value,
      scope: input.scope,
      scopeIds: input.scopeIds || null,
      minOrderAmount: input.minOrderAmount ?? null,
      maxDiscountAmount: input.maxDiscountAmount ?? null,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      startDate,
      endDate: input.endDate ?? null,
      isActive: true,
      createdBy: input.createdBy,
    });

    logger.info(`Coupon created: ${coupon.code} (${coupon.id})`);
    return coupon;
  }

  async function getCouponById(id: string): Promise<Coupon | null> {
    if (!isValidUuid(id)) {
      throw new CouponServiceError('Invalid coupon ID format', 'INVALID_COUPON_ID');
    }
    return couponRepository.getById(id);
  }

  async function getCouponByCode(code: string): Promise<Coupon | null> {
    if (!code.trim()) {
      throw new CouponServiceError('Coupon code is required', 'MISSING_CODE');
    }
    return couponRepository.getByCode(code);
  }

  async function listCoupons(filters?: CouponFilters): Promise<Coupon[]> {
    if (filters?.type && !VALID_TYPES.includes(filters.type)) {
      throw new CouponServiceError('Invalid type filter', 'INVALID_TYPE_FILTER');
    }
    if (filters?.scope && !VALID_SCOPES.includes(filters.scope)) {
      throw new CouponServiceError('Invalid scope filter', 'INVALID_SCOPE_FILTER');
    }
    return couponRepository.list(filters);
  }

  async function updateCoupon(id: string, input: UpdateCouponInput): Promise<Coupon> {
    if (!isValidUuid(id)) {
      throw new CouponServiceError('Invalid coupon ID format', 'INVALID_COUPON_ID');
    }

    const existing = await couponRepository.getById(id);
    if (!existing) {
      throw new CouponServiceError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    // Validate name if provided
    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName.length < 2) {
        throw new CouponServiceError('Name must be at least 2 characters', 'INVALID_NAME');
      }
      if (trimmedName.length > 100) {
        throw new CouponServiceError('Name cannot exceed 100 characters', 'INVALID_NAME');
      }
    }

    // Validate value if provided
    if (input.value !== undefined) {
      if (input.value <= 0) {
        throw new CouponServiceError('Discount value must be positive', 'INVALID_VALUE');
      }
      if (existing.type === 'percentage' && input.value > 100) {
        throw new CouponServiceError('Percentage discount cannot exceed 100%', 'INVALID_VALUE');
      }
    }

    // Validate min order amount
    if (input.minOrderAmount !== undefined && input.minOrderAmount < 0) {
      throw new CouponServiceError('Minimum order amount cannot be negative', 'INVALID_MIN_AMOUNT');
    }

    // Validate max discount
    if (input.maxDiscountAmount !== undefined && input.maxDiscountAmount <= 0) {
      throw new CouponServiceError('Maximum discount amount must be positive', 'INVALID_MAX_DISCOUNT');
    }

    // Validate usage limits
    if (input.usageLimit !== undefined && input.usageLimit < 1) {
      throw new CouponServiceError('Usage limit must be at least 1', 'INVALID_USAGE_LIMIT');
    }

    if (input.perUserLimit !== undefined && input.perUserLimit < 1) {
      throw new CouponServiceError('Per-user limit must be at least 1', 'INVALID_PER_USER_LIMIT');
    }

    // Validate end date
    if (input.endDate && input.endDate < existing.startDate) {
      throw new CouponServiceError('End date must be after start date', 'INVALID_DATES');
    }

    const updated = await couponRepository.update(id, {
      ...input,
      name: input.name?.trim(),
      description: input.description?.trim(),
    });

    logger.info(`Coupon updated: ${existing.code} (${id})`);
    return updated!;
  }

  async function deleteCoupon(id: string): Promise<void> {
    if (!isValidUuid(id)) {
      throw new CouponServiceError('Invalid coupon ID format', 'INVALID_COUPON_ID');
    }

    const existing = await couponRepository.getById(id);
    if (!existing) {
      throw new CouponServiceError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    // Check if coupon has been used
    if (existing.usageCount > 0) {
      throw new CouponServiceError(
        'Cannot delete a coupon that has been used. Deactivate it instead.',
        'COUPON_HAS_USAGE'
      );
    }

    await couponRepository.delete(id);
    logger.info(`Coupon deleted: ${existing.code} (${id})`);
  }

  async function deactivateCoupon(id: string): Promise<Coupon> {
    if (!isValidUuid(id)) {
      throw new CouponServiceError('Invalid coupon ID format', 'INVALID_COUPON_ID');
    }

    const updated = await couponRepository.update(id, { isActive: false });
    if (!updated) {
      throw new CouponServiceError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    logger.info(`Coupon deactivated: ${updated.code} (${id})`);
    return updated;
  }

  async function validateCoupon(input: ApplyCouponInput): Promise<CouponValidationResult> {
    // Get coupon by code
    const coupon = await couponRepository.getByCode(input.code);
    if (!coupon) {
      return {
        isValid: false,
        coupon: null,
        errorCode: 'COUPON_NOT_FOUND',
        errorMessage: 'Coupon not found',
      };
    }

    // Check if active
    if (!coupon.isActive) {
      return {
        isValid: false,
        coupon,
        errorCode: 'COUPON_INACTIVE',
        errorMessage: 'This coupon is no longer active',
      };
    }

    // Check start date
    const now = new Date().toISOString();
    if (coupon.startDate > now) {
      return {
        isValid: false,
        coupon,
        errorCode: 'COUPON_NOT_STARTED',
        errorMessage: 'This coupon is not yet valid',
      };
    }

    // Check end date
    if (coupon.endDate && coupon.endDate < now) {
      return {
        isValid: false,
        coupon,
        errorCode: 'COUPON_EXPIRED',
        errorMessage: 'This coupon has expired',
      };
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return {
        isValid: false,
        coupon,
        errorCode: 'COUPON_DEPLETED',
        errorMessage: 'This coupon has reached its usage limit',
      };
    }

    // Check per-user limit
    if (coupon.perUserLimit !== null) {
      const userUsages = await couponRepository.getUsageByUser(coupon.id, input.userId);
      if (userUsages.length >= coupon.perUserLimit) {
        return {
          isValid: false,
          coupon,
          errorCode: 'USER_LIMIT_EXCEEDED',
          errorMessage: 'You have already used this coupon the maximum number of times',
        };
      }
    }

    // Check minimum order amount
    if (coupon.minOrderAmount !== null && input.orderAmount < coupon.minOrderAmount) {
      return {
        isValid: false,
        coupon,
        errorCode: 'MIN_AMOUNT_NOT_MET',
        errorMessage: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required`,
      };
    }

    // Check scope restrictions
    if (coupon.scopeIds?.length) {
      let scopeMatch = false;
      if (coupon.scope === 'product' && input.productIds?.length) {
        scopeMatch = input.productIds.some((id) => coupon.scopeIds!.includes(id));
      } else if (coupon.scope === 'category' && input.categoryIds?.length) {
        scopeMatch = input.categoryIds.some((id) => coupon.scopeIds!.includes(id));
      }
      
      if (!scopeMatch && (coupon.scope === 'product' || coupon.scope === 'category')) {
        return {
          isValid: false,
          coupon,
          errorCode: 'SCOPE_NOT_APPLICABLE',
          errorMessage: 'This coupon is not applicable to your order items',
        };
      }
    }

    // Calculate discount
    const discountAmount = calculateDiscount(coupon, input.orderAmount);

    return {
      isValid: true,
      coupon,
      discountAmount,
    };
  }

  async function applyCoupon(input: ApplyCouponInput): Promise<CouponValidationResult> {
    const validation = await validateCoupon(input);

    if (!validation.isValid || !validation.coupon) {
      return validation;
    }

    // Record usage
    await couponRepository.recordUsage({
      couponId: validation.coupon.id,
      userId: input.userId,
      orderId: input.orderId || null,
      bookingId: input.bookingId || null,
      discountAmount: validation.discountAmount!,
    });

    // Increment usage count
    await couponRepository.incrementUsage(validation.coupon.id);

    logger.info(`Coupon applied: ${validation.coupon.code} for user ${input.userId}, discount: $${validation.discountAmount}`);

    return validation;
  }

  function calculateDiscount(coupon: Coupon, orderAmount: number): number {
    let discount = 0;

    switch (coupon.type) {
      case 'percentage':
        discount = (orderAmount * coupon.value) / 100;
        break;
      case 'fixed_amount':
        discount = coupon.value;
        break;
      case 'free_shipping':
        // Free shipping handled separately, return 0 for now
        discount = 0;
        break;
    }

    // Apply max discount cap
    if (coupon.maxDiscountAmount !== null && discount > coupon.maxDiscountAmount) {
      discount = coupon.maxDiscountAmount;
    }

    // Cannot exceed order amount
    if (discount > orderAmount) {
      discount = orderAmount;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }

  async function getUserUsageCount(couponId: string, userId: string): Promise<number> {
    if (!isValidUuid(couponId)) {
      throw new CouponServiceError('Invalid coupon ID format', 'INVALID_COUPON_ID');
    }
    if (!isValidUuid(userId)) {
      throw new CouponServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    const usages = await couponRepository.getUsageByUser(couponId, userId);
    return usages.length;
  }

  async function getStats(): Promise<CouponStats> {
    const allCoupons = await couponRepository.list({ includeExpired: true });
    const now = new Date().toISOString();

    const stats: CouponStats = {
      totalCoupons: allCoupons.length,
      activeCoupons: 0,
      expiredCoupons: 0,
      totalUsageCount: 0,
      totalDiscountGiven: 0,
      byType: {
        percentage: 0,
        fixed_amount: 0,
        free_shipping: 0,
      },
      byScope: {
        order: 0,
        product: 0,
        category: 0,
        booking: 0,
        pool: 0,
      },
    };

    for (const coupon of allCoupons) {
      // Count by status
      if (coupon.isActive && (!coupon.endDate || coupon.endDate >= now)) {
        stats.activeCoupons++;
      } else if (coupon.endDate && coupon.endDate < now) {
        stats.expiredCoupons++;
      }

      // Count usage
      stats.totalUsageCount += coupon.usageCount;

      // Count by type and scope
      stats.byType[coupon.type]++;
      stats.byScope[coupon.scope]++;
    }

    return stats;
  }

  async function isCodeAvailable(code: string): Promise<boolean> {
    const normalized = normalizeCode(code);
    if (!isValidCouponCode(normalized)) {
      return false;
    }
    const existing = await couponRepository.getByCode(normalized);
    return !existing;
  }

  function generateCode(prefix?: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding ambiguous chars
    let code = prefix ? prefix.toUpperCase() : '';
    const targetLength = 8;
    const remaining = targetLength - code.length;

    for (let i = 0; i < remaining; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }

  function getTypes(): CouponType[] {
    return [...VALID_TYPES];
  }

  function getScopes(): CouponScope[] {
    return [...VALID_SCOPES];
  }

  return {
    createCoupon,
    getCouponById,
    getCouponByCode,
    listCoupons,
    updateCoupon,
    deleteCoupon,
    deactivateCoupon,
    validateCoupon,
    applyCoupon,
    calculateDiscount,
    getUserUsageCount,
    getStats,
    isCodeAvailable,
    generateCode,
    getTypes,
    getScopes,
  };
}
