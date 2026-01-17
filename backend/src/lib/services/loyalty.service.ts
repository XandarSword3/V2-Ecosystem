/**
 * Loyalty Service with Dependency Injection
 *
 * This service handles all loyalty/rewards operations including:
 * - Account management
 * - Points earning and redemption
 * - Tier management
 * - Transaction history
 * - Expiration handling
 *
 * All dependencies are injected via the container for testability.
 */

import type {
  Container,
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyTransactionType,
  LoyaltyTier,
  LoyaltyTierConfig,
  LoyaltyFilters,
} from '../container/types';

// Custom error class
export class LoyaltyServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'LoyaltyServiceError';
  }
}

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid types and tiers
const VALID_TRANSACTION_TYPES: LoyaltyTransactionType[] = ['earn', 'redeem', 'expire', 'adjust', 'bonus'];
const VALID_TIERS: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

// Tier configuration
const TIER_CONFIG: LoyaltyTierConfig[] = [
  { tier: 'bronze', minPoints: 0, multiplier: 1.0, benefits: ['Basic member discounts'] },
  { tier: 'silver', minPoints: 1000, multiplier: 1.25, benefits: ['5% extra on orders', 'Priority support'] },
  { tier: 'gold', minPoints: 5000, multiplier: 1.5, benefits: ['10% extra on orders', 'Free upgrades', 'Early access'] },
  { tier: 'platinum', minPoints: 15000, multiplier: 2.0, benefits: ['15% extra on orders', 'VIP support', 'Exclusive events'] },
];

// Points per dollar spent
const POINTS_PER_DOLLAR = 10;

// Points expiration (days)
const POINTS_EXPIRATION_DAYS = 365;

export interface EarnPointsInput {
  userId: string;
  amount: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}

export interface RedeemPointsInput {
  userId: string;
  points: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}

export interface BonusPointsInput {
  userId: string;
  points: number;
  description: string;
  expiresInDays?: number;
}

export interface LoyaltyStats {
  totalAccounts: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  accountsByTier: Record<LoyaltyTier, number>;
}

export interface LoyaltyService {
  createAccount(userId: string): Promise<LoyaltyAccount>;
  getAccount(userId: string): Promise<LoyaltyAccount | null>;
  getAccountById(id: string): Promise<LoyaltyAccount | null>;
  earnPoints(input: EarnPointsInput): Promise<LoyaltyTransaction>;
  redeemPoints(input: RedeemPointsInput): Promise<LoyaltyTransaction>;
  addBonusPoints(input: BonusPointsInput): Promise<LoyaltyTransaction>;
  adjustPoints(userId: string, points: number, reason: string): Promise<LoyaltyTransaction>;
  getTransactions(userId: string, limit?: number): Promise<LoyaltyTransaction[]>;
  getBalance(userId: string): Promise<number>;
  calculatePointsForPurchase(amount: number, tier?: LoyaltyTier): number;
  calculateRedemptionValue(points: number): number;
  getTierForPoints(lifetimePoints: number): LoyaltyTier;
  upgradeTierIfNeeded(userId: string): Promise<LoyaltyAccount | null>;
  expireOldPoints(userId: string): Promise<number>;
  getStats(): Promise<LoyaltyStats>;
  getTierConfig(): LoyaltyTierConfig[];
  getTiers(): LoyaltyTier[];
  getTransactionTypes(): LoyaltyTransactionType[];
}

/**
 * Creates a LoyaltyService instance with injected dependencies.
 */
export function createLoyaltyService(container: Container): LoyaltyService {
  const { loyaltyRepository, logger } = container;

  // ----------------------------------------
  // VALIDATION HELPERS
  // ----------------------------------------

  function isValidUuid(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  // ----------------------------------------
  // SERVICE METHODS
  // ----------------------------------------

  async function createAccount(userId: string): Promise<LoyaltyAccount> {
    if (!isValidUuid(userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    // Check if account already exists
    const existing = await loyaltyRepository.getAccountByUserId(userId);
    if (existing) {
      throw new LoyaltyServiceError('Loyalty account already exists for this user', 'ACCOUNT_EXISTS');
    }

    const account = await loyaltyRepository.createAccount(userId);
    logger.info(`Loyalty account created for user ${userId}`);
    return account;
  }

  async function getAccount(userId: string): Promise<LoyaltyAccount | null> {
    if (!isValidUuid(userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }
    return loyaltyRepository.getAccountByUserId(userId);
  }

  async function getAccountById(id: string): Promise<LoyaltyAccount | null> {
    if (!isValidUuid(id)) {
      throw new LoyaltyServiceError('Invalid account ID format', 'INVALID_ACCOUNT_ID');
    }
    return loyaltyRepository.getAccountById(id);
  }

  async function earnPoints(input: EarnPointsInput): Promise<LoyaltyTransaction> {
    if (!isValidUuid(input.userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    if (input.amount <= 0) {
      throw new LoyaltyServiceError('Amount must be positive', 'INVALID_AMOUNT');
    }

    if (input.referenceId && !isValidUuid(input.referenceId)) {
      throw new LoyaltyServiceError('Invalid reference ID format', 'INVALID_REFERENCE_ID');
    }

    let account = await loyaltyRepository.getAccountByUserId(input.userId);
    if (!account) {
      // Auto-create account if it doesn't exist
      account = await createAccount(input.userId);
    }

    // Calculate points based on tier
    const points = calculatePointsForPurchase(input.amount, account.tier);

    // Create expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + POINTS_EXPIRATION_DAYS);

    // Record transaction
    const transaction = await loyaltyRepository.addTransaction({
      accountId: account.id,
      type: 'earn',
      points,
      description: input.description || `Earned ${points} points for $${input.amount.toFixed(2)} purchase`,
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
      expiresAt: expiresAt.toISOString(),
    });

    // Update account
    await loyaltyRepository.updateAccount(account.id, {
      totalPoints: account.totalPoints + points,
      availablePoints: account.availablePoints + points,
      lifetimePoints: account.lifetimePoints + points,
    });

    // Check for tier upgrade
    await upgradeTierIfNeeded(input.userId);

    logger.info(`User ${input.userId} earned ${points} points`);
    return transaction;
  }

  async function redeemPoints(input: RedeemPointsInput): Promise<LoyaltyTransaction> {
    if (!isValidUuid(input.userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    if (input.points <= 0) {
      throw new LoyaltyServiceError('Points must be positive', 'INVALID_POINTS');
    }

    if (!Number.isInteger(input.points)) {
      throw new LoyaltyServiceError('Points must be a whole number', 'INVALID_POINTS');
    }

    if (input.referenceId && !isValidUuid(input.referenceId)) {
      throw new LoyaltyServiceError('Invalid reference ID format', 'INVALID_REFERENCE_ID');
    }

    const account = await loyaltyRepository.getAccountByUserId(input.userId);
    if (!account) {
      throw new LoyaltyServiceError('Loyalty account not found', 'ACCOUNT_NOT_FOUND');
    }

    if (account.availablePoints < input.points) {
      throw new LoyaltyServiceError(
        `Insufficient points. Available: ${account.availablePoints}, Requested: ${input.points}`,
        'INSUFFICIENT_POINTS'
      );
    }

    // Record transaction
    const transaction = await loyaltyRepository.addTransaction({
      accountId: account.id,
      type: 'redeem',
      points: -input.points, // Negative for redemption
      description: input.description || `Redeemed ${input.points} points`,
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
      expiresAt: null,
    });

    // Update account
    await loyaltyRepository.updateAccount(account.id, {
      totalPoints: account.totalPoints - input.points,
      availablePoints: account.availablePoints - input.points,
    });

    logger.info(`User ${input.userId} redeemed ${input.points} points`);
    return transaction;
  }

  async function addBonusPoints(input: BonusPointsInput): Promise<LoyaltyTransaction> {
    if (!isValidUuid(input.userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    if (input.points <= 0) {
      throw new LoyaltyServiceError('Points must be positive', 'INVALID_POINTS');
    }

    if (!input.description.trim()) {
      throw new LoyaltyServiceError('Description is required for bonus points', 'MISSING_DESCRIPTION');
    }

    let account = await loyaltyRepository.getAccountByUserId(input.userId);
    if (!account) {
      account = await createAccount(input.userId);
    }

    // Create expiration date
    const expirationDays = input.expiresInDays || POINTS_EXPIRATION_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // Record transaction
    const transaction = await loyaltyRepository.addTransaction({
      accountId: account.id,
      type: 'bonus',
      points: input.points,
      description: input.description.trim(),
      referenceType: null,
      referenceId: null,
      expiresAt: expiresAt.toISOString(),
    });

    // Update account
    await loyaltyRepository.updateAccount(account.id, {
      totalPoints: account.totalPoints + input.points,
      availablePoints: account.availablePoints + input.points,
      lifetimePoints: account.lifetimePoints + input.points,
    });

    logger.info(`User ${input.userId} received ${input.points} bonus points`);
    return transaction;
  }

  async function adjustPoints(userId: string, points: number, reason: string): Promise<LoyaltyTransaction> {
    if (!isValidUuid(userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    if (points === 0) {
      throw new LoyaltyServiceError('Adjustment points cannot be zero', 'INVALID_POINTS');
    }

    if (!reason.trim()) {
      throw new LoyaltyServiceError('Reason is required for adjustments', 'MISSING_REASON');
    }

    const account = await loyaltyRepository.getAccountByUserId(userId);
    if (!account) {
      throw new LoyaltyServiceError('Loyalty account not found', 'ACCOUNT_NOT_FOUND');
    }

    // Ensure we don't go negative
    const newAvailable = account.availablePoints + points;
    if (newAvailable < 0) {
      throw new LoyaltyServiceError(
        `Adjustment would result in negative balance`,
        'NEGATIVE_BALANCE'
      );
    }

    // Record transaction
    const transaction = await loyaltyRepository.addTransaction({
      accountId: account.id,
      type: 'adjust',
      points,
      description: reason.trim(),
      referenceType: null,
      referenceId: null,
      expiresAt: null,
    });

    // Update account
    await loyaltyRepository.updateAccount(account.id, {
      totalPoints: account.totalPoints + points,
      availablePoints: newAvailable,
      lifetimePoints: points > 0 ? account.lifetimePoints + points : account.lifetimePoints,
    });

    logger.info(`User ${userId} points adjusted by ${points}: ${reason}`);
    return transaction;
  }

  async function getTransactions(userId: string, limit?: number): Promise<LoyaltyTransaction[]> {
    if (!isValidUuid(userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    const account = await loyaltyRepository.getAccountByUserId(userId);
    if (!account) {
      return [];
    }

    if (limit !== undefined && (limit < 1 || limit > 1000)) {
      throw new LoyaltyServiceError('Limit must be between 1 and 1000', 'INVALID_LIMIT');
    }

    return loyaltyRepository.getTransactions(account.id, limit);
  }

  async function getBalance(userId: string): Promise<number> {
    if (!isValidUuid(userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    const account = await loyaltyRepository.getAccountByUserId(userId);
    return account?.availablePoints || 0;
  }

  function calculatePointsForPurchase(amount: number, tier?: LoyaltyTier): number {
    if (amount <= 0) return 0;

    const basePoints = Math.floor(amount * POINTS_PER_DOLLAR);
    const tierConfig = TIER_CONFIG.find((t) => t.tier === tier) || TIER_CONFIG[0];
    return Math.floor(basePoints * tierConfig.multiplier);
  }

  function calculateRedemptionValue(points: number): number {
    // 100 points = $1
    return Math.floor(points / 100);
  }

  function getTierForPoints(lifetimePoints: number): LoyaltyTier {
    // Find highest tier that matches
    for (let i = TIER_CONFIG.length - 1; i >= 0; i--) {
      if (lifetimePoints >= TIER_CONFIG[i].minPoints) {
        return TIER_CONFIG[i].tier;
      }
    }
    return 'bronze';
  }

  async function upgradeTierIfNeeded(userId: string): Promise<LoyaltyAccount | null> {
    const account = await loyaltyRepository.getAccountByUserId(userId);
    if (!account) return null;

    const newTier = getTierForPoints(account.lifetimePoints);
    if (newTier !== account.tier) {
      const tierOrder = VALID_TIERS.indexOf(newTier);
      const currentOrder = VALID_TIERS.indexOf(account.tier);

      if (tierOrder > currentOrder) {
        // Tier upgrade
        const tierExpiresAt = new Date();
        tierExpiresAt.setFullYear(tierExpiresAt.getFullYear() + 1);

        const updated = await loyaltyRepository.updateAccount(account.id, {
          tier: newTier,
          tierExpiresAt: tierExpiresAt.toISOString(),
        });

        logger.info(`User ${userId} upgraded to ${newTier} tier`);
        return updated;
      }
    }

    return account;
  }

  async function expireOldPoints(userId: string): Promise<number> {
    if (!isValidUuid(userId)) {
      throw new LoyaltyServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    const account = await loyaltyRepository.getAccountByUserId(userId);
    if (!account) {
      return 0;
    }

    const now = new Date().toISOString();
    const expiring = await loyaltyRepository.getExpiringPoints(account.id, now);

    if (expiring.length === 0) {
      return 0;
    }

    let totalExpired = 0;
    for (const txn of expiring) {
      if (txn.points > 0) {
        totalExpired += txn.points;

        // Record expiration transaction
        await loyaltyRepository.addTransaction({
          accountId: account.id,
          type: 'expire',
          points: -txn.points,
          description: `Points expired from: ${txn.description}`,
          referenceType: null,
          referenceId: null,
          expiresAt: null,
        });
      }
    }

    if (totalExpired > 0) {
      await loyaltyRepository.updateAccount(account.id, {
        totalPoints: account.totalPoints - totalExpired,
        availablePoints: Math.max(0, account.availablePoints - totalExpired),
      });

      logger.info(`User ${userId} had ${totalExpired} points expired`);
    }

    return totalExpired;
  }

  async function getStats(): Promise<LoyaltyStats> {
    const allAccounts = await loyaltyRepository.listAccounts();

    const stats: LoyaltyStats = {
      totalAccounts: allAccounts.length,
      totalPointsIssued: 0,
      totalPointsRedeemed: 0,
      accountsByTier: {
        bronze: 0,
        silver: 0,
        gold: 0,
        platinum: 0,
      },
    };

    for (const account of allAccounts) {
      stats.totalPointsIssued += account.lifetimePoints;
      stats.totalPointsRedeemed += account.lifetimePoints - account.availablePoints;
      stats.accountsByTier[account.tier]++;
    }

    return stats;
  }

  function getTierConfig(): LoyaltyTierConfig[] {
    return [...TIER_CONFIG];
  }

  function getTiers(): LoyaltyTier[] {
    return [...VALID_TIERS];
  }

  function getTransactionTypes(): LoyaltyTransactionType[] {
    return [...VALID_TRANSACTION_TYPES];
  }

  return {
    createAccount,
    getAccount,
    getAccountById,
    earnPoints,
    redeemPoints,
    addBonusPoints,
    adjustPoints,
    getTransactions,
    getBalance,
    calculatePointsForPurchase,
    calculateRedemptionValue,
    getTierForPoints,
    upgradeTierIfNeeded,
    expireOldPoints,
    getStats,
    getTierConfig,
    getTiers,
    getTransactionTypes,
  };
}
