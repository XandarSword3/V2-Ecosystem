/**
 * Loyalty Service Tests
 *
 * Unit tests for the Loyalty Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createLoyaltyService, LoyaltyServiceError } from '../../src/lib/services/loyalty.service';
import { InMemoryLoyaltyRepository } from '../../src/lib/repositories/loyalty.repository.memory';
import type { Container, LoyaltyTier } from '../../src/lib/container/types';

// Test UUIDs
const USER_1 = '11111111-1111-1111-1111-111111111111';
const USER_2 = '22222222-2222-2222-2222-222222222222';
const USER_3 = '33333333-3333-3333-3333-333333333333';
const ORDER_ID = '44444444-4444-4444-4444-444444444444';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(loyaltyRepository: InMemoryLoyaltyRepository): Container {
  return {
    loyaltyRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

describe('LoyaltyService', () => {
  let repository: InMemoryLoyaltyRepository;
  let container: Container;
  let service: ReturnType<typeof createLoyaltyService>;

  beforeEach(() => {
    repository = new InMemoryLoyaltyRepository();
    container = createMockContainer(repository);
    service = createLoyaltyService(container);
  });

  // ============================================
  // ACCOUNT CREATION TESTS
  // ============================================
  describe('createAccount', () => {
    it('should create a new loyalty account', async () => {
      const account = await service.createAccount(USER_1);

      expect(account).toBeDefined();
      expect(account.userId).toBe(USER_1);
      expect(account.totalPoints).toBe(0);
      expect(account.availablePoints).toBe(0);
      expect(account.lifetimePoints).toBe(0);
      expect(account.tier).toBe('bronze');
    });

    it('should reject invalid user ID', async () => {
      await expect(service.createAccount(INVALID_UUID)).rejects.toThrow(LoyaltyServiceError);
      await expect(service.createAccount(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_USER_ID',
      });
    });

    it('should reject empty user ID', async () => {
      await expect(service.createAccount('')).rejects.toThrow(LoyaltyServiceError);
    });

    it('should reject duplicate account creation', async () => {
      await service.createAccount(USER_1);

      await expect(service.createAccount(USER_1)).rejects.toThrow(LoyaltyServiceError);
      await expect(service.createAccount(USER_1)).rejects.toMatchObject({
        code: 'ACCOUNT_EXISTS',
      });
    });

    it('should create separate accounts for different users', async () => {
      const account1 = await service.createAccount(USER_1);
      const account2 = await service.createAccount(USER_2);

      expect(account1.id).not.toBe(account2.id);
      expect(account1.userId).toBe(USER_1);
      expect(account2.userId).toBe(USER_2);
    });

    it('should initialize account with bronze tier', async () => {
      const account = await service.createAccount(USER_1);
      expect(account.tier).toBe('bronze');
    });
  });

  // ============================================
  // ACCOUNT RETRIEVAL TESTS
  // ============================================
  describe('getAccount', () => {
    it('should retrieve existing account', async () => {
      await service.createAccount(USER_1);
      const account = await service.getAccount(USER_1);

      expect(account).toBeDefined();
      expect(account?.userId).toBe(USER_1);
    });

    it('should return null for non-existent account', async () => {
      const account = await service.getAccount(USER_1);
      expect(account).toBeNull();
    });

    it('should reject invalid user ID', async () => {
      await expect(service.getAccount(INVALID_UUID)).rejects.toThrow(LoyaltyServiceError);
    });
  });

  describe('getAccountById', () => {
    it('should retrieve account by ID', async () => {
      const created = await service.createAccount(USER_1);
      const found = await service.getAccountById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const account = await service.getAccountById(USER_1);
      expect(account).toBeNull();
    });

    it('should reject invalid account ID', async () => {
      await expect(service.getAccountById(INVALID_UUID)).rejects.toThrow(LoyaltyServiceError);
    });
  });

  // ============================================
  // EARNING POINTS TESTS
  // ============================================
  describe('earnPoints', () => {
    it('should earn points for a purchase', async () => {
      await service.createAccount(USER_1);

      const txn = await service.earnPoints({
        userId: USER_1,
        amount: 100, // $100 = 1000 points (10 per dollar)
      });

      expect(txn).toBeDefined();
      expect(txn.type).toBe('earn');
      expect(txn.points).toBe(1000);
    });

    it('should auto-create account if not exists', async () => {
      const txn = await service.earnPoints({
        userId: USER_1,
        amount: 50,
      });

      expect(txn.points).toBe(500);

      const account = await service.getAccount(USER_1);
      expect(account).toBeDefined();
    });

    it('should update account balance after earning', async () => {
      await service.createAccount(USER_1);

      await service.earnPoints({
        userId: USER_1,
        amount: 100,
      });

      const account = await service.getAccount(USER_1);
      expect(account?.totalPoints).toBe(1000);
      expect(account?.availablePoints).toBe(1000);
      expect(account?.lifetimePoints).toBe(1000);
    });

    it('should accumulate multiple earnings', async () => {
      await service.createAccount(USER_1);

      await service.earnPoints({ userId: USER_1, amount: 50 });
      await service.earnPoints({ userId: USER_1, amount: 30 });

      const account = await service.getAccount(USER_1);
      expect(account?.availablePoints).toBe(800); // 500 + 300
    });

    it('should reject zero amount', async () => {
      await service.createAccount(USER_1);

      await expect(
        service.earnPoints({
          userId: USER_1,
          amount: 0,
        })
      ).rejects.toThrow(LoyaltyServiceError);
    });

    it('should reject negative amount', async () => {
      await expect(
        service.earnPoints({
          userId: USER_1,
          amount: -50,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_AMOUNT',
      });
    });

    it('should reject invalid user ID', async () => {
      await expect(
        service.earnPoints({
          userId: INVALID_UUID,
          amount: 100,
        })
      ).rejects.toThrow(LoyaltyServiceError);
    });

    it('should reject invalid reference ID', async () => {
      await service.createAccount(USER_1);

      await expect(
        service.earnPoints({
          userId: USER_1,
          amount: 100,
          referenceId: INVALID_UUID,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_REFERENCE_ID',
      });
    });

    it('should record reference type and ID', async () => {
      await service.createAccount(USER_1);

      const txn = await service.earnPoints({
        userId: USER_1,
        amount: 100,
        referenceType: 'order',
        referenceId: ORDER_ID,
      });

      expect(txn.referenceType).toBe('order');
      expect(txn.referenceId).toBe(ORDER_ID);
    });

    it('should record custom description', async () => {
      await service.createAccount(USER_1);

      const txn = await service.earnPoints({
        userId: USER_1,
        amount: 50,
        description: 'Welcome bonus!',
      });

      expect(txn.description).toBe('Welcome bonus!');
    });

    it('should set expiration date on earned points', async () => {
      await service.createAccount(USER_1);

      const txn = await service.earnPoints({
        userId: USER_1,
        amount: 100,
      });

      expect(txn.expiresAt).toBeDefined();
    });

    it('should apply tier multiplier to earnings', async () => {
      // Create silver tier account
      repository.addAccount({
        id: '99999999-9999-9999-9999-999999999999',
        userId: USER_2,
        totalPoints: 1500,
        availablePoints: 1500,
        lifetimePoints: 1500, // Silver tier: 1000+ points
        tier: 'silver',
        tierExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const txn = await service.earnPoints({
        userId: USER_2,
        amount: 100,
      });

      // Silver multiplier is 1.25: 1000 * 1.25 = 1250
      expect(txn.points).toBe(1250);
    });
  });

  // ============================================
  // REDEEMING POINTS TESTS
  // ============================================
  describe('redeemPoints', () => {
    beforeEach(async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 100 }); // 1000 points
    });

    it('should redeem points successfully', async () => {
      const txn = await service.redeemPoints({
        userId: USER_1,
        points: 500,
      });

      expect(txn).toBeDefined();
      expect(txn.type).toBe('redeem');
      expect(txn.points).toBe(-500); // Negative for redemption
    });

    it('should update balance after redemption', async () => {
      await service.redeemPoints({
        userId: USER_1,
        points: 300,
      });

      const account = await service.getAccount(USER_1);
      expect(account?.availablePoints).toBe(700); // 1000 - 300
    });

    it('should reject redemption exceeding balance', async () => {
      await expect(
        service.redeemPoints({
          userId: USER_1,
          points: 1500,
        })
      ).rejects.toMatchObject({
        code: 'INSUFFICIENT_POINTS',
      });
    });

    it('should reject zero points', async () => {
      await expect(
        service.redeemPoints({
          userId: USER_1,
          points: 0,
        })
      ).rejects.toThrow(LoyaltyServiceError);
    });

    it('should reject negative points', async () => {
      await expect(
        service.redeemPoints({
          userId: USER_1,
          points: -100,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_POINTS',
      });
    });

    it('should reject non-integer points', async () => {
      await expect(
        service.redeemPoints({
          userId: USER_1,
          points: 99.5,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_POINTS',
      });
    });

    it('should reject for non-existent account', async () => {
      await expect(
        service.redeemPoints({
          userId: USER_2,
          points: 100,
        })
      ).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });

    it('should reject invalid user ID', async () => {
      await expect(
        service.redeemPoints({
          userId: INVALID_UUID,
          points: 100,
        })
      ).rejects.toThrow(LoyaltyServiceError);
    });

    it('should reject invalid reference ID', async () => {
      await expect(
        service.redeemPoints({
          userId: USER_1,
          points: 100,
          referenceId: INVALID_UUID,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_REFERENCE_ID',
      });
    });

    it('should record redemption with reference', async () => {
      const txn = await service.redeemPoints({
        userId: USER_1,
        points: 200,
        referenceType: 'discount',
        referenceId: ORDER_ID,
      });

      expect(txn.referenceType).toBe('discount');
      expect(txn.referenceId).toBe(ORDER_ID);
    });

    it('should allow redemption of exact balance', async () => {
      await service.redeemPoints({
        userId: USER_1,
        points: 1000,
      });

      const account = await service.getAccount(USER_1);
      expect(account?.availablePoints).toBe(0);
    });
  });

  // ============================================
  // BONUS POINTS TESTS
  // ============================================
  describe('addBonusPoints', () => {
    beforeEach(async () => {
      await service.createAccount(USER_1);
    });

    it('should add bonus points', async () => {
      const txn = await service.addBonusPoints({
        userId: USER_1,
        points: 500,
        description: 'Birthday bonus!',
      });

      expect(txn).toBeDefined();
      expect(txn.type).toBe('bonus');
      expect(txn.points).toBe(500);
      expect(txn.description).toBe('Birthday bonus!');
    });

    it('should update account with bonus', async () => {
      await service.addBonusPoints({
        userId: USER_1,
        points: 250,
        description: 'Referral bonus',
      });

      const account = await service.getAccount(USER_1);
      expect(account?.availablePoints).toBe(250);
      expect(account?.lifetimePoints).toBe(250);
    });

    it('should auto-create account for new user', async () => {
      const txn = await service.addBonusPoints({
        userId: USER_2,
        points: 100,
        description: 'Sign-up bonus',
      });

      expect(txn.points).toBe(100);

      const account = await service.getAccount(USER_2);
      expect(account).toBeDefined();
    });

    it('should reject zero points', async () => {
      await expect(
        service.addBonusPoints({
          userId: USER_1,
          points: 0,
          description: 'No bonus',
        })
      ).rejects.toThrow(LoyaltyServiceError);
    });

    it('should reject negative points', async () => {
      await expect(
        service.addBonusPoints({
          userId: USER_1,
          points: -100,
          description: 'Negative bonus',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_POINTS',
      });
    });

    it('should reject empty description', async () => {
      await expect(
        service.addBonusPoints({
          userId: USER_1,
          points: 100,
          description: '',
        })
      ).rejects.toMatchObject({
        code: 'MISSING_DESCRIPTION',
      });
    });

    it('should reject whitespace-only description', async () => {
      await expect(
        service.addBonusPoints({
          userId: USER_1,
          points: 100,
          description: '   ',
        })
      ).rejects.toMatchObject({
        code: 'MISSING_DESCRIPTION',
      });
    });

    it('should set custom expiration days', async () => {
      const txn = await service.addBonusPoints({
        userId: USER_1,
        points: 100,
        description: 'Limited time bonus',
        expiresInDays: 30,
      });

      expect(txn.expiresAt).toBeDefined();
      // Expiration should be within 31 days
      const expiresAt = new Date(txn.expiresAt!);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });
  });

  // ============================================
  // ADJUST POINTS TESTS
  // ============================================
  describe('adjustPoints', () => {
    beforeEach(async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 100 }); // 1000 points
    });

    it('should add positive adjustment', async () => {
      const txn = await service.adjustPoints(USER_1, 200, 'Correction');

      expect(txn.type).toBe('adjust');
      expect(txn.points).toBe(200);
    });

    it('should subtract negative adjustment', async () => {
      const txn = await service.adjustPoints(USER_1, -300, 'Deduction');

      expect(txn.points).toBe(-300);
    });

    it('should update balance with adjustment', async () => {
      await service.adjustPoints(USER_1, 150, 'Adjustment');

      const account = await service.getAccount(USER_1);
      expect(account?.availablePoints).toBe(1150); // 1000 + 150
    });

    it('should reject zero adjustment', async () => {
      await expect(service.adjustPoints(USER_1, 0, 'No change')).rejects.toMatchObject({
        code: 'INVALID_POINTS',
      });
    });

    it('should reject adjustment causing negative balance', async () => {
      await expect(service.adjustPoints(USER_1, -1500, 'Too much')).rejects.toMatchObject({
        code: 'NEGATIVE_BALANCE',
      });
    });

    it('should reject empty reason', async () => {
      await expect(service.adjustPoints(USER_1, 100, '')).rejects.toMatchObject({
        code: 'MISSING_REASON',
      });
    });

    it('should reject whitespace reason', async () => {
      await expect(service.adjustPoints(USER_1, 100, '   ')).rejects.toMatchObject({
        code: 'MISSING_REASON',
      });
    });

    it('should reject for non-existent account', async () => {
      await expect(service.adjustPoints(USER_2, 100, 'Reason')).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });

    it('should update lifetime points only for positive adjustments', async () => {
      const before = await service.getAccount(USER_1);
      expect(before?.lifetimePoints).toBe(1000);

      await service.adjustPoints(USER_1, 200, 'Positive');
      const afterPositive = await service.getAccount(USER_1);
      expect(afterPositive?.lifetimePoints).toBe(1200);

      await service.adjustPoints(USER_1, -100, 'Negative');
      const afterNegative = await service.getAccount(USER_1);
      expect(afterNegative?.lifetimePoints).toBe(1200); // Unchanged
    });
  });

  // ============================================
  // BALANCE TESTS
  // ============================================
  describe('getBalance', () => {
    it('should return 0 for non-existent account', async () => {
      const balance = await service.getBalance(USER_1);
      expect(balance).toBe(0);
    });

    it('should return current available points', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 50 });

      const balance = await service.getBalance(USER_1);
      expect(balance).toBe(500);
    });

    it('should reflect redemptions', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 100 });
      await service.redeemPoints({ userId: USER_1, points: 300 });

      const balance = await service.getBalance(USER_1);
      expect(balance).toBe(700);
    });

    it('should reject invalid user ID', async () => {
      await expect(service.getBalance(INVALID_UUID)).rejects.toThrow(LoyaltyServiceError);
    });
  });

  // ============================================
  // TRANSACTION HISTORY TESTS
  // ============================================
  describe('getTransactions', () => {
    beforeEach(async () => {
      await service.createAccount(USER_1);
    });

    it('should return empty array for new account', async () => {
      const account = await service.createAccount(USER_2);
      const txns = await service.getTransactions(USER_2);
      expect(txns).toEqual([]);
    });

    it('should return all transactions', async () => {
      await service.earnPoints({ userId: USER_1, amount: 50 });
      await service.earnPoints({ userId: USER_1, amount: 30 });
      await service.redeemPoints({ userId: USER_1, points: 200 });

      const txns = await service.getTransactions(USER_1);
      expect(txns.length).toBe(3);
    });

    it('should respect limit parameter', async () => {
      await service.earnPoints({ userId: USER_1, amount: 50 });
      await service.earnPoints({ userId: USER_1, amount: 30 });
      await service.earnPoints({ userId: USER_1, amount: 20 });

      const txns = await service.getTransactions(USER_1, 2);
      expect(txns.length).toBe(2);
    });

    it('should return empty for non-existent user', async () => {
      const txns = await service.getTransactions(USER_2);
      expect(txns).toEqual([]);
    });

    it('should reject invalid user ID', async () => {
      await expect(service.getTransactions(INVALID_UUID)).rejects.toThrow(LoyaltyServiceError);
    });

    it('should reject invalid limit', async () => {
      await expect(service.getTransactions(USER_1, 0)).rejects.toMatchObject({
        code: 'INVALID_LIMIT',
      });

      await expect(service.getTransactions(USER_1, 1001)).rejects.toMatchObject({
        code: 'INVALID_LIMIT',
      });
    });
  });

  // ============================================
  // TIER CALCULATION TESTS
  // ============================================
  describe('getTierForPoints', () => {
    it('should return bronze for 0 points', () => {
      expect(service.getTierForPoints(0)).toBe('bronze');
    });

    it('should return bronze for < 1000 points', () => {
      expect(service.getTierForPoints(999)).toBe('bronze');
    });

    it('should return silver for 1000+ points', () => {
      expect(service.getTierForPoints(1000)).toBe('silver');
      expect(service.getTierForPoints(4999)).toBe('silver');
    });

    it('should return gold for 5000+ points', () => {
      expect(service.getTierForPoints(5000)).toBe('gold');
      expect(service.getTierForPoints(14999)).toBe('gold');
    });

    it('should return platinum for 15000+ points', () => {
      expect(service.getTierForPoints(15000)).toBe('platinum');
      expect(service.getTierForPoints(100000)).toBe('platinum');
    });
  });

  describe('upgradeTierIfNeeded', () => {
    it('should return null for non-existent account', async () => {
      const result = await service.upgradeTierIfNeeded(USER_1);
      expect(result).toBeNull();
    });

    it('should upgrade to silver at 1000 lifetime points', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 100 }); // 1000 points

      const account = await service.getAccount(USER_1);
      expect(account?.tier).toBe('silver');
    });

    it('should upgrade to gold at 5000 lifetime points', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 500 }); // 5000 points

      const account = await service.getAccount(USER_1);
      expect(account?.tier).toBe('gold');
    });

    it('should upgrade to platinum at 15000 lifetime points', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 1500 }); // 15000 points

      const account = await service.getAccount(USER_1);
      expect(account?.tier).toBe('platinum');
    });

    it('should not downgrade tier', async () => {
      // Set up gold tier account with lower current points
      repository.addAccount({
        id: '99999999-9999-9999-9999-999999999999',
        userId: USER_3,
        totalPoints: 500,
        availablePoints: 500,
        lifetimePoints: 2000, // Not enough for gold anymore, but...
        tier: 'gold', // Already gold
        tierExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const account = await service.upgradeTierIfNeeded(USER_3);
      expect(account?.tier).toBe('gold'); // Should stay gold
    });

    it('should set tier expiration on upgrade', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 100 }); // Silver

      const account = await service.getAccount(USER_1);
      expect(account?.tierExpiresAt).toBeDefined();
    });
  });

  // ============================================
  // POINTS CALCULATION TESTS
  // ============================================
  describe('calculatePointsForPurchase', () => {
    it('should calculate base points (10 per dollar)', () => {
      expect(service.calculatePointsForPurchase(100)).toBe(1000);
      expect(service.calculatePointsForPurchase(50)).toBe(500);
      expect(service.calculatePointsForPurchase(1)).toBe(10);
    });

    it('should return 0 for zero or negative amounts', () => {
      expect(service.calculatePointsForPurchase(0)).toBe(0);
      expect(service.calculatePointsForPurchase(-50)).toBe(0);
    });

    it('should floor partial points', () => {
      expect(service.calculatePointsForPurchase(10.99)).toBe(109);
    });

    it('should apply bronze multiplier (1.0)', () => {
      expect(service.calculatePointsForPurchase(100, 'bronze')).toBe(1000);
    });

    it('should apply silver multiplier (1.25)', () => {
      expect(service.calculatePointsForPurchase(100, 'silver')).toBe(1250);
    });

    it('should apply gold multiplier (1.5)', () => {
      expect(service.calculatePointsForPurchase(100, 'gold')).toBe(1500);
    });

    it('should apply platinum multiplier (2.0)', () => {
      expect(service.calculatePointsForPurchase(100, 'platinum')).toBe(2000);
    });
  });

  describe('calculateRedemptionValue', () => {
    it('should convert points to dollars (100 points = $1)', () => {
      expect(service.calculateRedemptionValue(100)).toBe(1);
      expect(service.calculateRedemptionValue(500)).toBe(5);
      expect(service.calculateRedemptionValue(1000)).toBe(10);
    });

    it('should floor partial dollars', () => {
      expect(service.calculateRedemptionValue(150)).toBe(1);
      expect(service.calculateRedemptionValue(99)).toBe(0);
    });
  });

  // ============================================
  // POINT EXPIRATION TESTS
  // ============================================
  describe('expireOldPoints', () => {
    it('should return 0 for non-existent account', async () => {
      const expired = await service.expireOldPoints(USER_1);
      expect(expired).toBe(0);
    });

    it('should return 0 when no points have expired', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 100 });

      const expired = await service.expireOldPoints(USER_1);
      expect(expired).toBe(0);
    });

    it('should expire old points', async () => {
      const account = await service.createAccount(USER_1);

      // Add an expired transaction directly
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      repository.addTestTransaction({
        id: '88888888-8888-8888-8888-888888888888',
        accountId: account.id,
        type: 'earn',
        points: 500,
        description: 'Old points',
        referenceType: null,
        referenceId: null,
        expiresAt: expiredDate.toISOString(),
        createdAt: expiredDate.toISOString(),
      });

      // Update account balance
      await repository.updateAccount(account.id, {
        totalPoints: 500,
        availablePoints: 500,
        lifetimePoints: 500,
      });

      const expired = await service.expireOldPoints(USER_1);
      expect(expired).toBe(500);

      const updatedAccount = await service.getAccount(USER_1);
      expect(updatedAccount?.availablePoints).toBe(0);
    });

    it('should reject invalid user ID', async () => {
      await expect(service.expireOldPoints(INVALID_UUID)).rejects.toThrow(LoyaltyServiceError);
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no accounts', async () => {
      const stats = await service.getStats();

      expect(stats.totalAccounts).toBe(0);
      expect(stats.totalPointsIssued).toBe(0);
      expect(stats.totalPointsRedeemed).toBe(0);
      expect(stats.accountsByTier.bronze).toBe(0);
    });

    it('should count accounts and points', async () => {
      await service.createAccount(USER_1);
      await service.earnPoints({ userId: USER_1, amount: 100 });
      await service.redeemPoints({ userId: USER_1, points: 200 });

      await service.createAccount(USER_2);
      await service.earnPoints({ userId: USER_2, amount: 50 });

      const stats = await service.getStats();

      expect(stats.totalAccounts).toBe(2);
      expect(stats.totalPointsIssued).toBe(1500); // 1000 + 500 lifetime
    });

    it('should count accounts by tier', async () => {
      // Bronze account
      await service.createAccount(USER_1);

      // Silver account
      await service.createAccount(USER_2);
      await service.earnPoints({ userId: USER_2, amount: 100 });

      const stats = await service.getStats();
      expect(stats.accountsByTier.bronze).toBe(1);
      expect(stats.accountsByTier.silver).toBe(1);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getTierConfig', () => {
    it('should return all tier configurations', () => {
      const config = service.getTierConfig();

      expect(config).toHaveLength(4);
      expect(config.map((t) => t.tier)).toEqual(['bronze', 'silver', 'gold', 'platinum']);
    });

    it('should include min points for each tier', () => {
      const config = service.getTierConfig();

      expect(config[0].minPoints).toBe(0); // Bronze
      expect(config[1].minPoints).toBe(1000); // Silver
      expect(config[2].minPoints).toBe(5000); // Gold
      expect(config[3].minPoints).toBe(15000); // Platinum
    });

    it('should include multipliers', () => {
      const config = service.getTierConfig();

      expect(config[0].multiplier).toBe(1.0);
      expect(config[1].multiplier).toBe(1.25);
      expect(config[2].multiplier).toBe(1.5);
      expect(config[3].multiplier).toBe(2.0);
    });

    it('should include benefits', () => {
      const config = service.getTierConfig();

      expect(config[0].benefits).toBeDefined();
      expect(config[0].benefits.length).toBeGreaterThan(0);
    });
  });

  describe('getTiers', () => {
    it('should return all tiers', () => {
      const tiers = service.getTiers();

      expect(tiers).toHaveLength(4);
      expect(tiers).toContain('bronze');
      expect(tiers).toContain('silver');
      expect(tiers).toContain('gold');
      expect(tiers).toContain('platinum');
    });
  });

  describe('getTransactionTypes', () => {
    it('should return all transaction types', () => {
      const types = service.getTransactionTypes();

      expect(types).toHaveLength(5);
      expect(types).toContain('earn');
      expect(types).toContain('redeem');
      expect(types).toContain('expire');
      expect(types).toContain('adjust');
      expect(types).toContain('bonus');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe('Edge Cases', () => {
    it('should handle very large point amounts', async () => {
      await service.createAccount(USER_1);

      const txn = await service.earnPoints({
        userId: USER_1,
        amount: 1000000, // $1M
      });

      expect(txn.points).toBe(10000000);
    });

    it('should handle fractional dollar amounts', async () => {
      await service.createAccount(USER_1);

      const txn = await service.earnPoints({
        userId: USER_1,
        amount: 99.99,
      });

      expect(txn.points).toBe(999);
    });

    it('should handle rapid consecutive operations', async () => {
      await service.createAccount(USER_1);

      // Sequential earnings (parallel causes race condition in in-memory repo)
      await service.earnPoints({ userId: USER_1, amount: 10 });
      await service.earnPoints({ userId: USER_1, amount: 20 });
      await service.earnPoints({ userId: USER_1, amount: 30 });

      const balance = await service.getBalance(USER_1);
      expect(balance).toBe(600); // 100 + 200 + 300
    });
  });
});
