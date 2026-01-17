/**
 * Promotion Service
 * 
 * Manages promotions, discounts, flash sales, and usage tracking.
 */

import type { 
  Container, 
  Promotion, 
  PromotionUsage,
  PromotionType,
  PromotionStatus,
} from '../container/types.js';

// ============================================
// INPUT TYPES
// ============================================

export interface CreatePromotionInput {
  name: string;
  code: string;
  type: PromotionType;
  value: number;
  description: string;
  startDate: string;
  endDate: string;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  applicableTo?: string[];
  excludedItems?: string[];
  isStackable?: boolean;
  priority?: number;
  createdBy: string;
}

export interface UpdatePromotionInput {
  name?: string;
  description?: string;
  value?: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  applicableTo?: string[];
  excludedItems?: string[];
  isStackable?: boolean;
  priority?: number;
}

export interface ApplyPromotionInput {
  code: string;
  userId: string;
  purchaseAmount: number;
  itemIds?: string[];
  orderId?: string;
}

export interface CalculateDiscountInput {
  promotionId: string;
  purchaseAmount: number;
  itemIds?: string[];
}

// ============================================
// RESULT TYPES
// ============================================

export interface PromotionServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DiscountResult {
  promotion: Promotion;
  discountAmount: number;
  finalAmount: number;
}

// ============================================
// CONSTANTS
// ============================================

const VALID_TYPES: PromotionType[] = ['percentage', 'fixed', 'bogo', 'bundle', 'flash_sale'];
const VALID_STATUSES: PromotionStatus[] = ['draft', 'scheduled', 'active', 'paused', 'expired', 'cancelled'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_REGEX = /^[A-Z0-9_-]{3,20}$/;

// ============================================
// SERVICE FACTORY
// ============================================

export function createPromotionService(container: Container) {
  const { promotionRepository } = container;

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  function isValidUUID(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  function isValidCode(code: string): boolean {
    return CODE_REGEX.test(code);
  }

  function isValidType(type: string): type is PromotionType {
    return VALID_TYPES.includes(type as PromotionType);
  }

  function isValidStatus(status: string): status is PromotionStatus {
    return VALID_STATUSES.includes(status as PromotionStatus);
  }

  // ============================================
  // PROMOTION MANAGEMENT
  // ============================================

  async function createPromotion(input: CreatePromotionInput): Promise<PromotionServiceResult<Promotion>> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: 'Promotion name is required' };
    }

    // Validate code
    if (!isValidCode(input.code)) {
      return { success: false, error: 'Invalid promotion code format' };
    }

    // Check code uniqueness
    const existing = await promotionRepository.getByCode(input.code);
    if (existing) {
      return { success: false, error: 'Promotion code already exists' };
    }

    // Validate type
    if (!isValidType(input.type)) {
      return { success: false, error: 'Invalid promotion type' };
    }

    // Validate value
    if (input.value <= 0) {
      return { success: false, error: 'Value must be positive' };
    }

    // Validate percentage
    if (input.type === 'percentage' && input.value > 100) {
      return { success: false, error: 'Percentage cannot exceed 100' };
    }

    // Validate description
    if (!input.description || input.description.trim().length === 0) {
      return { success: false, error: 'Description is required' };
    }

    // Validate dates
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (isNaN(startDate.getTime())) {
      return { success: false, error: 'Invalid start date' };
    }
    if (isNaN(endDate.getTime())) {
      return { success: false, error: 'Invalid end date' };
    }
    if (endDate <= startDate) {
      return { success: false, error: 'End date must be after start date' };
    }

    // Validate creator
    if (!isValidUUID(input.createdBy)) {
      return { success: false, error: 'Invalid creator ID' };
    }

    // Determine initial status
    const now = new Date();
    let status: PromotionStatus = 'draft';
    if (startDate <= now && endDate > now) {
      status = 'active';
    } else if (startDate > now) {
      status = 'scheduled';
    }

    const promotion = await promotionRepository.create({
      name: input.name.trim(),
      code: input.code.toUpperCase(),
      type: input.type,
      value: input.value,
      description: input.description.trim(),
      status,
      startDate: input.startDate,
      endDate: input.endDate,
      minPurchase: input.minPurchase,
      maxDiscount: input.maxDiscount,
      usageLimit: input.usageLimit,
      perUserLimit: input.perUserLimit,
      applicableTo: input.applicableTo || [],
      excludedItems: input.excludedItems || [],
      isStackable: input.isStackable ?? false,
      priority: input.priority ?? 0,
      createdBy: input.createdBy,
    });

    return { success: true, data: promotion };
  }

  async function getPromotion(id: string): Promise<PromotionServiceResult<Promotion>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    const promotion = await promotionRepository.getById(id);
    if (!promotion) {
      return { success: false, error: 'Promotion not found' };
    }

    return { success: true, data: promotion };
  }

  async function getPromotionByCode(code: string): Promise<PromotionServiceResult<Promotion>> {
    if (!code || code.trim().length === 0) {
      return { success: false, error: 'Promotion code is required' };
    }

    const promotion = await promotionRepository.getByCode(code.toUpperCase());
    if (!promotion) {
      return { success: false, error: 'Promotion not found' };
    }

    return { success: true, data: promotion };
  }

  async function getPromotions(): Promise<PromotionServiceResult<Promotion[]>> {
    const promotions = await promotionRepository.getAll();
    return { success: true, data: promotions };
  }

  async function getActivePromotions(): Promise<PromotionServiceResult<Promotion[]>> {
    const promotions = await promotionRepository.getActive();
    return { success: true, data: promotions };
  }

  async function updatePromotion(id: string, input: UpdatePromotionInput): Promise<PromotionServiceResult<Promotion>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    const existing = await promotionRepository.getById(id);
    if (!existing) {
      return { success: false, error: 'Promotion not found' };
    }

    // Validate value if provided
    if (input.value !== undefined && input.value <= 0) {
      return { success: false, error: 'Value must be positive' };
    }

    const updated = await promotionRepository.update(id, input);
    return { success: true, data: updated };
  }

  async function activatePromotion(id: string): Promise<PromotionServiceResult<Promotion>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    const existing = await promotionRepository.getById(id);
    if (!existing) {
      return { success: false, error: 'Promotion not found' };
    }

    if (existing.status === 'active') {
      return { success: false, error: 'Promotion is already active' };
    }

    if (existing.status === 'cancelled') {
      return { success: false, error: 'Cannot activate cancelled promotion' };
    }

    const updated = await promotionRepository.update(id, { status: 'active' });
    return { success: true, data: updated };
  }

  async function pausePromotion(id: string): Promise<PromotionServiceResult<Promotion>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    const existing = await promotionRepository.getById(id);
    if (!existing) {
      return { success: false, error: 'Promotion not found' };
    }

    if (existing.status !== 'active') {
      return { success: false, error: 'Only active promotions can be paused' };
    }

    const updated = await promotionRepository.update(id, { status: 'paused' });
    return { success: true, data: updated };
  }

  async function cancelPromotion(id: string): Promise<PromotionServiceResult<Promotion>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    const existing = await promotionRepository.getById(id);
    if (!existing) {
      return { success: false, error: 'Promotion not found' };
    }

    if (existing.status === 'cancelled') {
      return { success: false, error: 'Promotion is already cancelled' };
    }

    const updated = await promotionRepository.update(id, { status: 'cancelled' });
    return { success: true, data: updated };
  }

  // ============================================
  // DISCOUNT CALCULATION
  // ============================================

  async function calculateDiscount(input: CalculateDiscountInput): Promise<PromotionServiceResult<DiscountResult>> {
    if (!isValidUUID(input.promotionId)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    const promotion = await promotionRepository.getById(input.promotionId);
    if (!promotion) {
      return { success: false, error: 'Promotion not found' };
    }

    if (promotion.status !== 'active') {
      return { success: false, error: 'Promotion is not active' };
    }

    // Check minimum purchase
    if (promotion.minPurchase && input.purchaseAmount < promotion.minPurchase) {
      return { success: false, error: `Minimum purchase of ${promotion.minPurchase} required` };
    }

    let discountAmount = 0;

    switch (promotion.type) {
      case 'percentage':
        discountAmount = input.purchaseAmount * (promotion.value / 100);
        break;
      case 'fixed':
        discountAmount = promotion.value;
        break;
      case 'bogo':
        // Buy one get one - assume 50% off
        discountAmount = input.purchaseAmount * 0.5;
        break;
      case 'bundle':
        discountAmount = promotion.value;
        break;
      case 'flash_sale':
        discountAmount = input.purchaseAmount * (promotion.value / 100);
        break;
    }

    // Apply max discount cap
    if (promotion.maxDiscount && discountAmount > promotion.maxDiscount) {
      discountAmount = promotion.maxDiscount;
    }

    // Ensure discount doesn't exceed purchase amount
    if (discountAmount > input.purchaseAmount) {
      discountAmount = input.purchaseAmount;
    }

    const finalAmount = input.purchaseAmount - discountAmount;

    return { 
      success: true, 
      data: { 
        promotion, 
        discountAmount: Math.round(discountAmount * 100) / 100, 
        finalAmount: Math.round(finalAmount * 100) / 100,
      },
    };
  }

  async function applyPromotion(input: ApplyPromotionInput): Promise<PromotionServiceResult<DiscountResult>> {
    if (!input.code || input.code.trim().length === 0) {
      return { success: false, error: 'Promotion code is required' };
    }

    if (!isValidUUID(input.userId)) {
      return { success: false, error: 'Invalid user ID' };
    }

    if (input.purchaseAmount <= 0) {
      return { success: false, error: 'Purchase amount must be positive' };
    }

    const promotion = await promotionRepository.getByCode(input.code.toUpperCase());
    if (!promotion) {
      return { success: false, error: 'Invalid promotion code' };
    }

    if (promotion.status !== 'active') {
      return { success: false, error: 'Promotion is not active' };
    }

    // Check date validity
    const now = new Date();
    if (new Date(promotion.startDate) > now) {
      return { success: false, error: 'Promotion has not started yet' };
    }
    if (new Date(promotion.endDate) < now) {
      return { success: false, error: 'Promotion has expired' };
    }

    // Check usage limit
    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      return { success: false, error: 'Promotion usage limit reached' };
    }

    // Check per user limit
    if (promotion.perUserLimit) {
      const userUsage = await promotionRepository.getUserUsage(promotion.id, input.userId);
      if (userUsage.length >= promotion.perUserLimit) {
        return { success: false, error: 'You have already used this promotion' };
      }
    }

    // Calculate discount
    const discountResult = await calculateDiscount({
      promotionId: promotion.id,
      purchaseAmount: input.purchaseAmount,
      itemIds: input.itemIds,
    });

    if (!discountResult.success) {
      return discountResult;
    }

    // Log usage
    await promotionRepository.logUsage({
      promotionId: promotion.id,
      userId: input.userId,
      orderId: input.orderId,
      discountAmount: discountResult.data!.discountAmount,
    });

    return discountResult;
  }

  // ============================================
  // QUERIES
  // ============================================

  async function getPromotionsByStatus(status: PromotionStatus): Promise<PromotionServiceResult<Promotion[]>> {
    if (!isValidStatus(status)) {
      return { success: false, error: 'Invalid status' };
    }

    const promotions = await promotionRepository.getByStatus(status);
    return { success: true, data: promotions };
  }

  async function getUsage(promotionId: string): Promise<PromotionServiceResult<PromotionUsage[]>> {
    if (!isValidUUID(promotionId)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    const existing = await promotionRepository.getById(promotionId);
    if (!existing) {
      return { success: false, error: 'Promotion not found' };
    }

    const usage = await promotionRepository.getUsage(promotionId);
    return { success: true, data: usage };
  }

  async function getUserUsage(promotionId: string, userId: string): Promise<PromotionServiceResult<PromotionUsage[]>> {
    if (!isValidUUID(promotionId)) {
      return { success: false, error: 'Invalid promotion ID' };
    }

    if (!isValidUUID(userId)) {
      return { success: false, error: 'Invalid user ID' };
    }

    const usage = await promotionRepository.getUserUsage(promotionId, userId);
    return { success: true, data: usage };
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function isExpired(promotion: Promotion): boolean {
    return new Date(promotion.endDate) < new Date();
  }

  function isCurrentlyActive(promotion: Promotion): boolean {
    const now = new Date();
    return promotion.status === 'active' && 
           new Date(promotion.startDate) <= now && 
           new Date(promotion.endDate) > now;
  }

  function hasUsageRemaining(promotion: Promotion): boolean {
    if (!promotion.usageLimit) return true;
    return promotion.usageCount < promotion.usageLimit;
  }

  function getUsagePercentage(promotion: Promotion): number {
    if (!promotion.usageLimit) return 0;
    return Math.round((promotion.usageCount / promotion.usageLimit) * 100);
  }

  function getTimeRemaining(promotion: Promotion): number {
    const endDate = new Date(promotion.endDate);
    const now = new Date();
    return Math.max(0, endDate.getTime() - now.getTime());
  }

  function formatCode(code: string): string {
    return code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  function getTypes(): PromotionType[] {
    return [...VALID_TYPES];
  }

  function getStatuses(): PromotionStatus[] {
    return [...VALID_STATUSES];
  }

  return {
    // Promotion management
    createPromotion,
    getPromotion,
    getPromotionByCode,
    getPromotions,
    getActivePromotions,
    updatePromotion,
    activatePromotion,
    pausePromotion,
    cancelPromotion,
    
    // Discount operations
    calculateDiscount,
    applyPromotion,
    
    // Queries
    getPromotionsByStatus,
    getUsage,
    getUserUsage,
    
    // Utility functions
    isExpired,
    isCurrentlyActive,
    hasUsageRemaining,
    getUsagePercentage,
    getTimeRemaining,
    formatCode,
    getTypes,
    getStatuses,
  };
}
