/**
 * Promotion Service Tests
 * 
 * Unit tests for promotions, discounts, flash sales, and usage tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPromotionService } from '../../src/lib/services/promotion.service';
import { InMemoryPromotionRepository } from '../../src/lib/repositories/promotion.repository.memory';
import type { Container } from '../../src/lib/container/types';

describe('PromotionService', () => {
  let service: ReturnType<typeof createPromotionService>;
  let promotionRepository: InMemoryPromotionRepository;

  const validUserId = '11111111-1111-1111-1111-111111111111';
  const validUserId2 = '22222222-2222-2222-2222-222222222222';

  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 1);

  const pastDate = new Date();
  pastDate.setMonth(pastDate.getMonth() - 1);

  beforeEach(() => {
    promotionRepository = new InMemoryPromotionRepository();
    
    const container = {
      promotionRepository,
    } as unknown as Container;
    
    service = createPromotionService(container);
  });

  // ============================================
  // CREATE PROMOTION TESTS
  // ============================================

  describe('createPromotion', () => {
    it('should create promotion with required fields', async () => {
      const result = await service.createPromotion({
        name: 'Summer Sale',
        code: 'SUMMER20',
        type: 'percentage',
        value: 20,
        description: '20% off summer items',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Summer Sale');
      expect(result.data!.code).toBe('SUMMER20');
      expect(result.data!.type).toBe('percentage');
      expect(result.data!.value).toBe(20);
      expect(result.data!.usageCount).toBe(0);
    });

    it('should set optional fields', async () => {
      const result = await service.createPromotion({
        name: 'VIP Sale',
        code: 'VIP50',
        type: 'fixed',
        value: 50,
        description: '$50 off',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        minPurchase: 100,
        maxDiscount: 50,
        usageLimit: 100,
        perUserLimit: 2,
        applicableTo: ['item1', 'item2'],
        excludedItems: ['item3'],
        isStackable: true,
        priority: 10,
        createdBy: validUserId,
      });

      expect(result.success).toBe(true);
      expect(result.data!.minPurchase).toBe(100);
      expect(result.data!.maxDiscount).toBe(50);
      expect(result.data!.usageLimit).toBe(100);
      expect(result.data!.perUserLimit).toBe(2);
      expect(result.data!.isStackable).toBe(true);
      expect(result.data!.priority).toBe(10);
    });

    it('should reject empty name', async () => {
      const result = await service.createPromotion({
        name: '',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion name is required');
    });

    it('should reject invalid code format', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'ab', // Too short
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promotion code format');
    });

    it('should reject duplicate code', async () => {
      await service.createPromotion({
        name: 'Test 1',
        code: 'SAME_CODE',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.createPromotion({
        name: 'Test 2',
        code: 'SAME_CODE',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion code already exists');
    });

    it('should reject invalid type', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'invalid' as any,
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promotion type');
    });

    it('should reject non-positive value', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 0,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Value must be positive');
    });

    it('should reject percentage over 100', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 150,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Percentage cannot exceed 100');
    });

    it('should reject empty description', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: '',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Description is required');
    });

    it('should reject invalid start date', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: 'invalid',
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid start date');
    });

    it('should reject end date before start date', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: futureDate.toISOString(),
        endDate: new Date().toISOString(),
        createdBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('End date must be after start date');
    });

    it('should reject invalid creator ID', async () => {
      const result = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid creator ID');
    });
  });

  // ============================================
  // GET PROMOTION TESTS
  // ============================================

  describe('getPromotion', () => {
    it('should get promotion by ID', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.getPromotion(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe(created.data!.id);
    });

    it('should reject invalid ID', async () => {
      const result = await service.getPromotion('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promotion ID');
    });

    it('should return error for non-existent', async () => {
      const result = await service.getPromotion('00000000-0000-0000-0000-000000000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion not found');
    });
  });

  describe('getPromotionByCode', () => {
    it('should get promotion by code', async () => {
      await service.createPromotion({
        name: 'Test',
        code: 'MYCODE',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.getPromotionByCode('MYCODE');

      expect(result.success).toBe(true);
      expect(result.data!.code).toBe('MYCODE');
    });

    it('should be case insensitive', async () => {
      await service.createPromotion({
        name: 'Test',
        code: 'MYCODE',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.getPromotionByCode('mycode');

      expect(result.success).toBe(true);
    });

    it('should reject empty code', async () => {
      const result = await service.getPromotionByCode('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion code is required');
    });
  });

  describe('getPromotions', () => {
    it('should get all promotions', async () => {
      await service.createPromotion({
        name: 'Test 1',
        code: 'CODE1',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.createPromotion({
        name: 'Test 2',
        code: 'CODE2',
        type: 'fixed',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.getPromotions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getActivePromotions', () => {
    it('should get only active promotions', async () => {
      const promo1 = await service.createPromotion({
        name: 'Active',
        code: 'ACTIVE1',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.pausePromotion(promo1.data!.id);

      await service.createPromotion({
        name: 'Active 2',
        code: 'ACTIVE2',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.getActivePromotions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ============================================
  // UPDATE PROMOTION TESTS
  // ============================================

  describe('updatePromotion', () => {
    it('should update promotion fields', async () => {
      const created = await service.createPromotion({
        name: 'Original',
        code: 'ORIG123',
        type: 'percentage',
        value: 10,
        description: 'Original description',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.updatePromotion(created.data!.id, {
        name: 'Updated',
        value: 15,
      });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Updated');
      expect(result.data!.value).toBe(15);
    });

    it('should reject non-positive value', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.updatePromotion(created.data!.id, { value: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Value must be positive');
    });
  });

  // ============================================
  // STATUS MANAGEMENT TESTS
  // ============================================

  describe('activatePromotion', () => {
    it('should activate promotion', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.pausePromotion(created.data!.id);

      const result = await service.activatePromotion(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('active');
    });

    it('should reject already active', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.activatePromotion(created.data!.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion is already active');
    });

    it('should reject cancelled promotion', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.cancelPromotion(created.data!.id);

      const result = await service.activatePromotion(created.data!.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot activate cancelled promotion');
    });
  });

  describe('pausePromotion', () => {
    it('should pause active promotion', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.pausePromotion(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('paused');
    });

    it('should reject non-active', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.pausePromotion(created.data!.id);

      const result = await service.pausePromotion(created.data!.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only active promotions can be paused');
    });
  });

  describe('cancelPromotion', () => {
    it('should cancel promotion', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.cancelPromotion(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('cancelled');
    });

    it('should reject already cancelled', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.cancelPromotion(created.data!.id);

      const result = await service.cancelPromotion(created.data!.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion is already cancelled');
    });
  });

  // ============================================
  // DISCOUNT CALCULATION TESTS
  // ============================================

  describe('calculateDiscount', () => {
    it('should calculate percentage discount', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.calculateDiscount({
        promotionId: created.data!.id,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.discountAmount).toBe(20);
      expect(result.data!.finalAmount).toBe(80);
    });

    it('should calculate fixed discount', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'fixed',
        value: 15,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.calculateDiscount({
        promotionId: created.data!.id,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.discountAmount).toBe(15);
      expect(result.data!.finalAmount).toBe(85);
    });

    it('should apply max discount cap', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 50,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        maxDiscount: 30,
        createdBy: validUserId,
      });

      const result = await service.calculateDiscount({
        promotionId: created.data!.id,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.discountAmount).toBe(30);
      expect(result.data!.finalAmount).toBe(70);
    });

    it('should reject below minimum purchase', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        minPurchase: 50,
        createdBy: validUserId,
      });

      const result = await service.calculateDiscount({
        promotionId: created.data!.id,
        purchaseAmount: 30,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Minimum purchase of 50 required');
    });

    it('should reject inactive promotion', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.pausePromotion(created.data!.id);

      const result = await service.calculateDiscount({
        promotionId: created.data!.id,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion is not active');
    });
  });

  // ============================================
  // APPLY PROMOTION TESTS
  // ============================================

  describe('applyPromotion', () => {
    it('should apply promotion and log usage', async () => {
      await service.createPromotion({
        name: 'Test',
        code: 'APPLY20',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.applyPromotion({
        code: 'APPLY20',
        userId: validUserId2,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.discountAmount).toBe(20);
    });

    it('should reject empty code', async () => {
      const result = await service.applyPromotion({
        code: '',
        userId: validUserId,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Promotion code is required');
    });

    it('should reject invalid user ID', async () => {
      await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.applyPromotion({
        code: 'TEST123',
        userId: 'invalid',
        purchaseAmount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should reject non-positive purchase amount', async () => {
      await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      const result = await service.applyPromotion({
        code: 'TEST123',
        userId: validUserId,
        purchaseAmount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Purchase amount must be positive');
    });

    it('should reject invalid code', async () => {
      const result = await service.applyPromotion({
        code: 'INVALID',
        userId: validUserId,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promotion code');
    });

    it('should respect per user limit', async () => {
      await service.createPromotion({
        name: 'Test',
        code: 'ONCE123',
        type: 'percentage',
        value: 20,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        perUserLimit: 1,
        createdBy: validUserId,
      });

      await service.applyPromotion({
        code: 'ONCE123',
        userId: validUserId2,
        purchaseAmount: 100,
      });

      const result = await service.applyPromotion({
        code: 'ONCE123',
        userId: validUserId2,
        purchaseAmount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already used this promotion');
    });
  });

  // ============================================
  // QUERY TESTS
  // ============================================

  describe('getPromotionsByStatus', () => {
    it('should get promotions by status', async () => {
      const promo = await service.createPromotion({
        name: 'Test',
        code: 'TEST123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });
      await service.pausePromotion(promo.data!.id);

      const result = await service.getPromotionsByStatus('paused');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should reject invalid status', async () => {
      const result = await service.getPromotionsByStatus('invalid' as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid status');
    });
  });

  describe('getUsage', () => {
    it('should get usage history', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'USAGE123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      await service.applyPromotion({
        code: 'USAGE123',
        userId: validUserId2,
        purchaseAmount: 100,
      });

      const result = await service.getUsage(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should reject invalid ID', async () => {
      const result = await service.getUsage('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promotion ID');
    });
  });

  describe('getUserUsage', () => {
    it('should get user-specific usage', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'USER123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      await service.applyPromotion({
        code: 'USER123',
        userId: validUserId2,
        purchaseAmount: 100,
      });

      const result = await service.getUserUsage(created.data!.id, validUserId2);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should reject invalid user ID', async () => {
      const result = await service.getUserUsage('00000000-0000-0000-0000-000000000000', 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================

  describe('isExpired', () => {
    it('should return false for future end date', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'EXP123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(service.isExpired(created.data!)).toBe(false);
    });
  });

  describe('isCurrentlyActive', () => {
    it('should return true for active promotion in valid date range', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'ACT123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(service.isCurrentlyActive(created.data!)).toBe(true);
    });
  });

  describe('hasUsageRemaining', () => {
    it('should return true when no limit', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'REM123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(service.hasUsageRemaining(created.data!)).toBe(true);
    });
  });

  describe('getUsagePercentage', () => {
    it('should return 0 when no limit', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'PCT123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(service.getUsagePercentage(created.data!)).toBe(0);
    });
  });

  describe('getTimeRemaining', () => {
    it('should return positive for future end date', async () => {
      const created = await service.createPromotion({
        name: 'Test',
        code: 'TIME123',
        type: 'percentage',
        value: 10,
        description: 'Test',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
        createdBy: validUserId,
      });

      expect(service.getTimeRemaining(created.data!)).toBeGreaterThan(0);
    });
  });

  describe('formatCode', () => {
    it('should uppercase and clean code', () => {
      expect(service.formatCode('my code')).toBe('MYCODE');
      expect(service.formatCode('my-code_123')).toBe('MY-CODE_123');
    });
  });

  describe('getTypes', () => {
    it('should return all types', () => {
      const types = service.getTypes();
      expect(types).toContain('percentage');
      expect(types).toContain('fixed');
      expect(types).toContain('bogo');
      expect(types).toContain('bundle');
      expect(types).toContain('flash_sale');
    });
  });

  describe('getStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getStatuses();
      expect(statuses).toContain('draft');
      expect(statuses).toContain('scheduled');
      expect(statuses).toContain('active');
      expect(statuses).toContain('paused');
      expect(statuses).toContain('expired');
      expect(statuses).toContain('cancelled');
    });
  });
});
