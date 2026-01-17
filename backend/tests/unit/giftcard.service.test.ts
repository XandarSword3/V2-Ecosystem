/**
 * Gift Card Service Tests
 * 
 * Unit tests for gift card purchase, redemption, refunds, and management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGiftCardService } from '../../src/lib/services/giftcard.service';
import { InMemoryGiftCardRepository } from '../../src/lib/repositories/giftcard.repository.memory';
import type { Container, GiftCard } from '../../src/lib/container/types';

describe('GiftCardService', () => {
  let service: ReturnType<typeof createGiftCardService>;
  let giftCardRepository: InMemoryGiftCardRepository;

  const validUserId = '11111111-1111-1111-1111-111111111111';
  const validUserId2 = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    giftCardRepository = new InMemoryGiftCardRepository();
    
    const container = {
      giftCardRepository,
    } as unknown as Container;
    
    service = createGiftCardService(container);
  });

  // ============================================
  // PURCHASE GIFT CARD TESTS
  // ============================================

  describe('purchaseGiftCard', () => {
    it('should purchase gift card with required fields', async () => {
      const result = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.initialBalance).toBe(100);
      expect(result.data!.currentBalance).toBe(100);
      expect(result.data!.status).toBe('active');
      expect(result.data!.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should set optional fields', async () => {
      const result = await service.purchaseGiftCard({
        amount: 250,
        currency: 'EUR',
        purchasedBy: validUserId,
        purchasedFor: validUserId2,
        recipientEmail: 'recipient@example.com',
        recipientName: 'John Doe',
        message: 'Happy Birthday!',
        expiresIn: 180,
      });

      expect(result.success).toBe(true);
      expect(result.data!.currency).toBe('EUR');
      expect(result.data!.recipientEmail).toBe('recipient@example.com');
      expect(result.data!.recipientName).toBe('John Doe');
      expect(result.data!.message).toBe('Happy Birthday!');
    });

    it('should reject non-positive amount', async () => {
      const result = await service.purchaseGiftCard({
        amount: 0,
        purchasedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount must be a positive number');
    });

    it('should reject amount below minimum', async () => {
      const result = await service.purchaseGiftCard({
        amount: 5,
        purchasedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Minimum gift card amount is 10');
    });

    it('should reject amount above maximum', async () => {
      const result = await service.purchaseGiftCard({
        amount: 15000,
        purchasedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum gift card amount is 10000');
    });

    it('should reject invalid purchaser ID', async () => {
      const result = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid purchaser ID');
    });

    it('should reject invalid recipient email', async () => {
      const result = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
        recipientEmail: 'not-an-email',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recipient email');
    });

    it('should reject non-positive expiration days', async () => {
      const result = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
        expiresIn: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Expiration days must be positive');
    });
  });

  // ============================================
  // GET GIFT CARD TESTS
  // ============================================

  describe('getGiftCard', () => {
    it('should get gift card by ID', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.getGiftCard(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe(created.data!.id);
    });

    it('should reject invalid ID', async () => {
      const result = await service.getGiftCard('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid gift card ID');
    });

    it('should return error for non-existent', async () => {
      const result = await service.getGiftCard('00000000-0000-0000-0000-000000000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gift card not found');
    });
  });

  describe('getGiftCardByCode', () => {
    it('should get gift card by code', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.getGiftCardByCode(created.data!.code);

      expect(result.success).toBe(true);
      expect(result.data!.code).toBe(created.data!.code);
    });

    it('should reject empty code', async () => {
      const result = await service.getGiftCardByCode('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gift card code is required');
    });

    it('should return error for unknown code', async () => {
      const result = await service.getGiftCardByCode('XXXX-XXXX-XXXX-XXXX');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gift card not found');
    });
  });

  describe('checkBalance', () => {
    it('should check balance', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.checkBalance(created.data!.code);

      expect(result.success).toBe(true);
      expect(result.data!.balance).toBe(100);
      expect(result.data!.status).toBe('active');
    });

    it('should reject empty code', async () => {
      const result = await service.checkBalance('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gift card code is required');
    });
  });

  // ============================================
  // REDEEM GIFT CARD TESTS
  // ============================================

  describe('redeemGiftCard', () => {
    it('should redeem partial amount', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.redeemGiftCard({
        code: created.data!.code,
        amount: 30,
        redeemedBy: validUserId2,
      });

      expect(result.success).toBe(true);
      expect(result.data!.giftCard.currentBalance).toBe(70);
      expect(result.data!.giftCard.status).toBe('active');
      expect(result.data!.transaction.type).toBe('redemption');
      expect(result.data!.transaction.amount).toBe(30);
    });

    it('should fully redeem gift card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.redeemGiftCard({
        code: created.data!.code,
        amount: 100,
        redeemedBy: validUserId2,
      });

      expect(result.success).toBe(true);
      expect(result.data!.giftCard.currentBalance).toBe(0);
      expect(result.data!.giftCard.status).toBe('redeemed');
    });

    it('should set reference and description', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.redeemGiftCard({
        code: created.data!.code,
        amount: 50,
        redeemedBy: validUserId2,
        reference: 'ORDER-123',
        description: 'Payment for room booking',
      });

      expect(result.success).toBe(true);
      expect(result.data!.transaction.reference).toBe('ORDER-123');
      expect(result.data!.transaction.description).toBe('Payment for room booking');
    });

    it('should reject empty code', async () => {
      const result = await service.redeemGiftCard({
        code: '',
        amount: 50,
        redeemedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gift card code is required');
    });

    it('should reject non-positive amount', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.redeemGiftCard({
        code: created.data!.code,
        amount: 0,
        redeemedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redemption amount must be positive');
    });

    it('should reject invalid redeemer ID', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.redeemGiftCard({
        code: created.data!.code,
        amount: 50,
        redeemedBy: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid redeemer ID');
    });

    it('should reject insufficient balance', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.redeemGiftCard({
        code: created.data!.code,
        amount: 150,
        redeemedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });

    it('should reject cancelled gift card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.cancelGiftCard(created.data!.id, validUserId);

      const result = await service.redeemGiftCard({
        code: created.data!.code,
        amount: 50,
        redeemedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gift card is cancelled');
    });
  });

  // ============================================
  // REFUND TESTS
  // ============================================

  describe('refundToGiftCard', () => {
    it('should refund to gift card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.redeemGiftCard({
        code: created.data!.code,
        amount: 50,
        redeemedBy: validUserId,
      });

      const result = await service.refundToGiftCard({
        giftCardId: created.data!.id,
        amount: 30,
        refundedBy: validUserId,
      });

      expect(result.success).toBe(true);
      expect(result.data!.giftCard.currentBalance).toBe(80);
      expect(result.data!.transaction.type).toBe('refund');
    });

    it('should reject invalid gift card ID', async () => {
      const result = await service.refundToGiftCard({
        giftCardId: 'invalid',
        amount: 30,
        refundedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid gift card ID');
    });

    it('should reject non-positive amount', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.refundToGiftCard({
        giftCardId: created.data!.id,
        amount: 0,
        refundedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refund amount must be positive');
    });

    it('should reject refund exceeding initial balance', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.refundToGiftCard({
        giftCardId: created.data!.id,
        amount: 50,
        refundedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refund would exceed initial balance');
    });

    it('should reject refund to cancelled card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.cancelGiftCard(created.data!.id, validUserId);

      const result = await service.refundToGiftCard({
        giftCardId: created.data!.id,
        amount: 10,
        refundedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot refund to cancelled gift card');
    });
  });

  // ============================================
  // ADJUST BALANCE TESTS
  // ============================================

  describe('adjustBalance', () => {
    it('should add credit', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.redeemGiftCard({
        code: created.data!.code,
        amount: 50,
        redeemedBy: validUserId,
      });

      const result = await service.adjustBalance({
        giftCardId: created.data!.id,
        amount: 20,
        reason: 'Customer service credit',
        adjustedBy: validUserId,
      });

      expect(result.success).toBe(true);
      expect(result.data!.giftCard.currentBalance).toBe(70);
    });

    it('should debit balance', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.adjustBalance({
        giftCardId: created.data!.id,
        amount: -30,
        reason: 'Correction',
        adjustedBy: validUserId,
      });

      expect(result.success).toBe(true);
      expect(result.data!.giftCard.currentBalance).toBe(70);
    });

    it('should reject zero amount', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.adjustBalance({
        giftCardId: created.data!.id,
        amount: 0,
        reason: 'No adjustment',
        adjustedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Adjustment amount cannot be zero');
    });

    it('should reject empty reason', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.adjustBalance({
        giftCardId: created.data!.id,
        amount: 10,
        reason: '',
        adjustedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Reason is required for adjustments');
    });

    it('should reject adjustment resulting in negative balance', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.adjustBalance({
        giftCardId: created.data!.id,
        amount: -150,
        reason: 'Over-debit',
        adjustedBy: validUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Adjustment would result in negative balance');
    });
  });

  // ============================================
  // CANCEL / SUSPEND / REACTIVATE TESTS
  // ============================================

  describe('cancelGiftCard', () => {
    it('should cancel gift card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.cancelGiftCard(created.data!.id, validUserId);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('cancelled');
    });

    it('should reject invalid ID', async () => {
      const result = await service.cancelGiftCard('invalid', validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid gift card ID');
    });

    it('should reject already cancelled', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.cancelGiftCard(created.data!.id, validUserId);

      const result = await service.cancelGiftCard(created.data!.id, validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gift card is already cancelled');
    });

    it('should reject cancelling fully redeemed', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.redeemGiftCard({
        code: created.data!.code,
        amount: 100,
        redeemedBy: validUserId,
      });

      const result = await service.cancelGiftCard(created.data!.id, validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot cancel fully redeemed gift card');
    });
  });

  describe('suspendGiftCard', () => {
    it('should suspend gift card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.suspendGiftCard(created.data!.id, validUserId);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('suspended');
    });

    it('should reject invalid ID', async () => {
      const result = await service.suspendGiftCard('invalid', validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid gift card ID');
    });

    it('should reject non-active card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.cancelGiftCard(created.data!.id, validUserId);

      const result = await service.suspendGiftCard(created.data!.id, validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot suspend cancelled gift card');
    });
  });

  describe('reactivateGiftCard', () => {
    it('should reactivate suspended gift card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.suspendGiftCard(created.data!.id, validUserId);

      const result = await service.reactivateGiftCard(created.data!.id, validUserId);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('active');
    });

    it('should reject non-suspended card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.reactivateGiftCard(created.data!.id, validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only suspended gift cards can be reactivated');
    });
  });

  describe('extendExpiry', () => {
    it('should extend expiry', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
        expiresIn: 30,
      });

      const result = await service.extendExpiry(created.data!.id, 60, validUserId);

      expect(result.success).toBe(true);
      const newExpiry = new Date(result.data!.expiresAt);
      const originalExpiry = new Date(created.data!.expiresAt);
      expect(newExpiry.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should reject invalid ID', async () => {
      const result = await service.extendExpiry('invalid', 30, validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid gift card ID');
    });

    it('should reject non-positive days', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      const result = await service.extendExpiry(created.data!.id, 0, validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Additional days must be positive');
    });

    it('should reject extending cancelled card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.cancelGiftCard(created.data!.id, validUserId);

      const result = await service.extendExpiry(created.data!.id, 30, validUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot extend cancelled gift card');
    });
  });

  // ============================================
  // QUERY TESTS
  // ============================================

  describe('getByPurchaser', () => {
    it('should get cards by purchaser', async () => {
      await service.purchaseGiftCard({ amount: 100, purchasedBy: validUserId });
      await service.purchaseGiftCard({ amount: 200, purchasedBy: validUserId });
      await service.purchaseGiftCard({ amount: 300, purchasedBy: validUserId2 });

      const result = await service.getByPurchaser(validUserId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should reject invalid ID', async () => {
      const result = await service.getByPurchaser('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid purchaser ID');
    });
  });

  describe('getByRecipient', () => {
    it('should get cards by recipient email', async () => {
      await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
        recipientEmail: 'test@example.com',
      });
      await service.purchaseGiftCard({
        amount: 200,
        purchasedBy: validUserId,
        recipientEmail: 'test@example.com',
      });

      const result = await service.getByRecipient('test@example.com');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should reject invalid email', async () => {
      const result = await service.getByRecipient('not-an-email');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });
  });

  describe('getExpiringCards', () => {
    it('should get expiring cards', async () => {
      await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
        expiresIn: 10,
      });

      const result = await service.getExpiringCards(30);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should reject non-positive days', async () => {
      const result = await service.getExpiringCards(0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Days must be positive');
    });
  });

  describe('getTransactions', () => {
    it('should get transactions', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.redeemGiftCard({
        code: created.data!.code,
        amount: 30,
        redeemedBy: validUserId,
      });

      const result = await service.getTransactions(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should reject invalid ID', async () => {
      const result = await service.getTransactions('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid gift card ID');
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================

  describe('isExpired', () => {
    it('should return false for active card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
        expiresIn: 365,
      });

      expect(service.isExpired(created.data!)).toBe(false);
    });
  });

  describe('isRedeemable', () => {
    it('should return true for active card with balance', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });

      expect(service.isRedeemable(created.data!)).toBe(true);
    });

    it('should return false for cancelled card', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      const cancelled = await service.cancelGiftCard(created.data!.id, validUserId);

      expect(service.isRedeemable(cancelled.data!)).toBe(false);
    });
  });

  describe('getUsagePercentage', () => {
    it('should calculate usage percentage', async () => {
      const created = await service.purchaseGiftCard({
        amount: 100,
        purchasedBy: validUserId,
      });
      await service.redeemGiftCard({
        code: created.data!.code,
        amount: 25,
        redeemedBy: validUserId,
      });

      const updated = await service.getGiftCard(created.data!.id);
      expect(service.getUsagePercentage(updated.data!)).toBe(25);
    });
  });

  describe('formatGiftCardCode', () => {
    it('should format code', () => {
      expect(service.formatGiftCardCode('ABCD1234EFGH5678')).toBe('ABCD-1234-EFGH-5678');
    });
  });

  describe('maskGiftCardCode', () => {
    it('should mask code', () => {
      const masked = service.maskGiftCardCode('ABCD-1234-EFGH-5678');
      expect(masked).toContain('****');
      expect(masked).toContain('5678');
    });
  });

  describe('getGiftCardStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getGiftCardStatuses();
      expect(statuses).toContain('active');
      expect(statuses).toContain('redeemed');
      expect(statuses).toContain('expired');
      expect(statuses).toContain('cancelled');
      expect(statuses).toContain('suspended');
    });
  });
});
