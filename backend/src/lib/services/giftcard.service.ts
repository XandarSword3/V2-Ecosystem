/**
 * Gift Card Service
 * 
 * Provides gift card management including purchase, redemption,
 * balance checking, and transaction history.
 */

import type { 
  Container,
  GiftCardRepository,
  GiftCard,
  GiftCardTransaction,
  GiftCardStatus,
} from '../container/types';

// ============================================
// TYPES
// ============================================

export interface PurchaseGiftCardInput {
  amount: number;
  currency?: string;
  purchasedBy: string;
  purchasedFor?: string;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  expiresIn?: number; // days
}

export interface RedeemGiftCardInput {
  code: string;
  amount: number;
  reference?: string;
  description?: string;
  redeemedBy: string;
}

export interface RefundGiftCardInput {
  giftCardId: string;
  amount: number;
  reason?: string;
  refundedBy: string;
}

export interface AdjustBalanceInput {
  giftCardId: string;
  amount: number;
  reason: string;
  adjustedBy: string;
}

export interface GiftCardServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// VALIDATION
// ============================================

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GIFT_CARD_STATUSES: GiftCardStatus[] = ['active', 'redeemed', 'expired', 'cancelled', 'suspended'];

function isValidUUID(id: string): boolean {
  return UUID_PATTERN.test(id);
}

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

function generateGiftCardCode(): string {
  // Generate a 16-character alphanumeric code in groups of 4
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createGiftCardService(container: Container) {
  const { giftCardRepository } = container;

  // ============================================
  // GIFT CARD OPERATIONS
  // ============================================

  async function purchaseGiftCard(input: PurchaseGiftCardInput): Promise<GiftCardServiceResult<GiftCard>> {
    // Validate amount
    if (typeof input.amount !== 'number' || input.amount <= 0) {
      return { success: false, error: 'Amount must be a positive number' };
    }

    // Validate minimum/maximum amounts
    if (input.amount < 10) {
      return { success: false, error: 'Minimum gift card amount is 10' };
    }

    if (input.amount > 10000) {
      return { success: false, error: 'Maximum gift card amount is 10000' };
    }

    // Validate purchaser
    if (!input.purchasedBy || !isValidUUID(input.purchasedBy)) {
      return { success: false, error: 'Invalid purchaser ID' };
    }

    // Validate recipient email if provided
    if (input.recipientEmail && !isValidEmail(input.recipientEmail)) {
      return { success: false, error: 'Invalid recipient email' };
    }

    // Calculate expiry (default 1 year)
    const expiresIn = input.expiresIn ?? 365;
    if (expiresIn <= 0) {
      return { success: false, error: 'Expiration days must be positive' };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateGiftCardCode();
      const existing = await giftCardRepository.getByCode(code);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return { success: false, error: 'Failed to generate unique code' };
    }

    const giftCard = await giftCardRepository.create({
      code,
      initialBalance: input.amount,
      currentBalance: input.amount,
      currency: input.currency || 'USD',
      status: 'active',
      purchasedBy: input.purchasedBy,
      purchasedFor: input.purchasedFor,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      message: input.message,
      expiresAt: expiresAt.toISOString(),
      activatedAt: new Date().toISOString(),
      redeemedAt: null,
    });

    // Log purchase transaction
    await giftCardRepository.logTransaction({
      giftCardId: giftCard.id,
      type: 'purchase',
      amount: input.amount,
      balanceBefore: 0,
      balanceAfter: input.amount,
      description: 'Gift card purchased',
      createdBy: input.purchasedBy,
    });

    return { success: true, data: giftCard };
  }

  async function getGiftCard(id: string): Promise<GiftCardServiceResult<GiftCard>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    const giftCard = await giftCardRepository.getById(id);
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    return { success: true, data: giftCard };
  }

  async function getGiftCardByCode(code: string): Promise<GiftCardServiceResult<GiftCard>> {
    if (!code || code.trim() === '') {
      return { success: false, error: 'Gift card code is required' };
    }

    const giftCard = await giftCardRepository.getByCode(code.toUpperCase());
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    return { success: true, data: giftCard };
  }

  async function checkBalance(code: string): Promise<GiftCardServiceResult<{ balance: number; currency: string; status: GiftCardStatus }>> {
    if (!code || code.trim() === '') {
      return { success: false, error: 'Gift card code is required' };
    }

    const giftCard = await giftCardRepository.getByCode(code.toUpperCase());
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    return { 
      success: true, 
      data: { 
        balance: giftCard.currentBalance, 
        currency: giftCard.currency,
        status: giftCard.status,
      } 
    };
  }

  async function redeemGiftCard(input: RedeemGiftCardInput): Promise<GiftCardServiceResult<{ giftCard: GiftCard; transaction: GiftCardTransaction }>> {
    // Validate code
    if (!input.code || input.code.trim() === '') {
      return { success: false, error: 'Gift card code is required' };
    }

    // Validate amount
    if (typeof input.amount !== 'number' || input.amount <= 0) {
      return { success: false, error: 'Redemption amount must be positive' };
    }

    // Validate redeemer
    if (!input.redeemedBy || !isValidUUID(input.redeemedBy)) {
      return { success: false, error: 'Invalid redeemer ID' };
    }

    // Get gift card
    const giftCard = await giftCardRepository.getByCode(input.code.toUpperCase());
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    // Check status
    if (giftCard.status !== 'active') {
      return { success: false, error: `Gift card is ${giftCard.status}` };
    }

    // Check expiry
    if (new Date(giftCard.expiresAt) < new Date()) {
      // Update status to expired
      await giftCardRepository.update(giftCard.id, { status: 'expired' });
      return { success: false, error: 'Gift card has expired' };
    }

    // Check balance
    if (input.amount > giftCard.currentBalance) {
      return { success: false, error: `Insufficient balance. Available: ${giftCard.currentBalance}` };
    }

    const balanceBefore = giftCard.currentBalance;
    const balanceAfter = balanceBefore - input.amount;
    const isFullyRedeemed = balanceAfter === 0;

    // Update gift card
    const updatedCard = await giftCardRepository.update(giftCard.id, {
      currentBalance: balanceAfter,
      status: isFullyRedeemed ? 'redeemed' : 'active',
      redeemedAt: isFullyRedeemed ? new Date().toISOString() : giftCard.redeemedAt,
    });

    // Log transaction
    const transaction = await giftCardRepository.logTransaction({
      giftCardId: giftCard.id,
      type: 'redemption',
      amount: input.amount,
      balanceBefore,
      balanceAfter,
      reference: input.reference,
      description: input.description || 'Gift card redemption',
      createdBy: input.redeemedBy,
    });

    return { success: true, data: { giftCard: updatedCard, transaction } };
  }

  async function refundToGiftCard(input: RefundGiftCardInput): Promise<GiftCardServiceResult<{ giftCard: GiftCard; transaction: GiftCardTransaction }>> {
    // Validate gift card ID
    if (!isValidUUID(input.giftCardId)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    // Validate amount
    if (typeof input.amount !== 'number' || input.amount <= 0) {
      return { success: false, error: 'Refund amount must be positive' };
    }

    // Validate refunder
    if (!input.refundedBy || !isValidUUID(input.refundedBy)) {
      return { success: false, error: 'Invalid refunder ID' };
    }

    // Get gift card
    const giftCard = await giftCardRepository.getById(input.giftCardId);
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    // Cannot refund to cancelled card
    if (giftCard.status === 'cancelled') {
      return { success: false, error: 'Cannot refund to cancelled gift card' };
    }

    // Cannot exceed initial balance
    if (giftCard.currentBalance + input.amount > giftCard.initialBalance) {
      return { success: false, error: 'Refund would exceed initial balance' };
    }

    const balanceBefore = giftCard.currentBalance;
    const balanceAfter = balanceBefore + input.amount;

    // Update gift card
    const updatedCard = await giftCardRepository.update(giftCard.id, {
      currentBalance: balanceAfter,
      status: 'active', // Reactivate if was redeemed
    });

    // Log transaction
    const transaction = await giftCardRepository.logTransaction({
      giftCardId: giftCard.id,
      type: 'refund',
      amount: input.amount,
      balanceBefore,
      balanceAfter,
      description: input.reason || 'Refund to gift card',
      createdBy: input.refundedBy,
    });

    return { success: true, data: { giftCard: updatedCard, transaction } };
  }

  async function adjustBalance(input: AdjustBalanceInput): Promise<GiftCardServiceResult<{ giftCard: GiftCard; transaction: GiftCardTransaction }>> {
    // Validate gift card ID
    if (!isValidUUID(input.giftCardId)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    // Validate amount (can be negative for deductions)
    if (typeof input.amount !== 'number' || input.amount === 0) {
      return { success: false, error: 'Adjustment amount cannot be zero' };
    }

    // Validate reason
    if (!input.reason || input.reason.trim() === '') {
      return { success: false, error: 'Reason is required for adjustments' };
    }

    // Validate adjuster
    if (!input.adjustedBy || !isValidUUID(input.adjustedBy)) {
      return { success: false, error: 'Invalid adjuster ID' };
    }

    // Get gift card
    const giftCard = await giftCardRepository.getById(input.giftCardId);
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    // Check result would be valid
    const newBalance = giftCard.currentBalance + input.amount;
    if (newBalance < 0) {
      return { success: false, error: 'Adjustment would result in negative balance' };
    }

    const balanceBefore = giftCard.currentBalance;
    const balanceAfter = newBalance;

    // Update gift card
    const updatedCard = await giftCardRepository.update(giftCard.id, {
      currentBalance: balanceAfter,
      status: balanceAfter === 0 ? 'redeemed' : 'active',
    });

    // Log transaction
    const transaction = await giftCardRepository.logTransaction({
      giftCardId: giftCard.id,
      type: 'adjustment',
      amount: Math.abs(input.amount),
      balanceBefore,
      balanceAfter,
      description: `${input.amount > 0 ? 'Credit' : 'Debit'}: ${input.reason}`,
      createdBy: input.adjustedBy,
    });

    return { success: true, data: { giftCard: updatedCard, transaction } };
  }

  async function cancelGiftCard(id: string, cancelledBy: string): Promise<GiftCardServiceResult<GiftCard>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    if (!isValidUUID(cancelledBy)) {
      return { success: false, error: 'Invalid canceller ID' };
    }

    const giftCard = await giftCardRepository.getById(id);
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    if (giftCard.status === 'cancelled') {
      return { success: false, error: 'Gift card is already cancelled' };
    }

    if (giftCard.status === 'redeemed') {
      return { success: false, error: 'Cannot cancel fully redeemed gift card' };
    }

    const updated = await giftCardRepository.update(id, { status: 'cancelled' });

    // Log the cancellation
    await giftCardRepository.logTransaction({
      giftCardId: id,
      type: 'adjustment',
      amount: 0,
      balanceBefore: giftCard.currentBalance,
      balanceAfter: giftCard.currentBalance,
      description: 'Gift card cancelled',
      createdBy: cancelledBy,
    });

    return { success: true, data: updated };
  }

  async function suspendGiftCard(id: string, suspendedBy: string): Promise<GiftCardServiceResult<GiftCard>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    if (!isValidUUID(suspendedBy)) {
      return { success: false, error: 'Invalid suspender ID' };
    }

    const giftCard = await giftCardRepository.getById(id);
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    if (giftCard.status !== 'active') {
      return { success: false, error: `Cannot suspend ${giftCard.status} gift card` };
    }

    const updated = await giftCardRepository.update(id, { status: 'suspended' });

    return { success: true, data: updated };
  }

  async function reactivateGiftCard(id: string, reactivatedBy: string): Promise<GiftCardServiceResult<GiftCard>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    if (!isValidUUID(reactivatedBy)) {
      return { success: false, error: 'Invalid reactivator ID' };
    }

    const giftCard = await giftCardRepository.getById(id);
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    if (giftCard.status !== 'suspended') {
      return { success: false, error: 'Only suspended gift cards can be reactivated' };
    }

    // Check if expired
    if (new Date(giftCard.expiresAt) < new Date()) {
      return { success: false, error: 'Cannot reactivate expired gift card' };
    }

    const updated = await giftCardRepository.update(id, { status: 'active' });

    return { success: true, data: updated };
  }

  async function extendExpiry(id: string, additionalDays: number, extendedBy: string): Promise<GiftCardServiceResult<GiftCard>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    if (!isValidUUID(extendedBy)) {
      return { success: false, error: 'Invalid extender ID' };
    }

    if (typeof additionalDays !== 'number' || additionalDays <= 0) {
      return { success: false, error: 'Additional days must be positive' };
    }

    const giftCard = await giftCardRepository.getById(id);
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' };
    }

    if (giftCard.status === 'cancelled' || giftCard.status === 'redeemed') {
      return { success: false, error: `Cannot extend ${giftCard.status} gift card` };
    }

    const currentExpiry = new Date(giftCard.expiresAt);
    const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
    newExpiry.setDate(newExpiry.getDate() + additionalDays);

    // Also reactivate if expired
    const updated = await giftCardRepository.update(id, { 
      expiresAt: newExpiry.toISOString(),
      status: giftCard.status === 'expired' ? 'active' : giftCard.status,
    });

    return { success: true, data: updated };
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  async function getByPurchaser(purchaserId: string): Promise<GiftCardServiceResult<GiftCard[]>> {
    if (!isValidUUID(purchaserId)) {
      return { success: false, error: 'Invalid purchaser ID' };
    }

    const cards = await giftCardRepository.getByPurchaser(purchaserId);
    return { success: true, data: cards };
  }

  async function getByRecipient(recipientEmail: string): Promise<GiftCardServiceResult<GiftCard[]>> {
    if (!isValidEmail(recipientEmail)) {
      return { success: false, error: 'Invalid email address' };
    }

    const cards = await giftCardRepository.getByRecipient(recipientEmail);
    return { success: true, data: cards };
  }

  async function getExpiringCards(withinDays: number = 30): Promise<GiftCardServiceResult<GiftCard[]>> {
    if (withinDays <= 0) {
      return { success: false, error: 'Days must be positive' };
    }

    const beforeDate = new Date();
    beforeDate.setDate(beforeDate.getDate() + withinDays);
    
    const cards = await giftCardRepository.getExpiring(beforeDate.toISOString());
    return { success: true, data: cards };
  }

  async function getTransactions(giftCardId: string): Promise<GiftCardServiceResult<GiftCardTransaction[]>> {
    if (!isValidUUID(giftCardId)) {
      return { success: false, error: 'Invalid gift card ID' };
    }

    const transactions = await giftCardRepository.getTransactions(giftCardId);
    return { success: true, data: transactions };
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function isExpired(giftCard: GiftCard): boolean {
    return new Date(giftCard.expiresAt) < new Date();
  }

  function isRedeemable(giftCard: GiftCard): boolean {
    return (
      giftCard.status === 'active' &&
      giftCard.currentBalance > 0 &&
      !isExpired(giftCard)
    );
  }

  function getUsagePercentage(giftCard: GiftCard): number {
    if (giftCard.initialBalance === 0) return 0;
    return Math.round((1 - giftCard.currentBalance / giftCard.initialBalance) * 100);
  }

  function formatGiftCardCode(code: string): string {
    // Format as XXXX-XXXX-XXXX-XXXX
    const clean = code.replace(/-/g, '').toUpperCase();
    return clean.match(/.{1,4}/g)?.join('-') || code;
  }

  function maskGiftCardCode(code: string): string {
    // Show only last 4 characters
    const clean = code.replace(/-/g, '');
    const masked = '*'.repeat(clean.length - 4) + clean.slice(-4);
    return masked.match(/.{1,4}/g)?.join('-') || masked;
  }

  function getGiftCardStatuses(): GiftCardStatus[] {
    return [...GIFT_CARD_STATUSES];
  }

  // ============================================
  // RETURN SERVICE
  // ============================================

  return {
    // Gift card operations
    purchaseGiftCard,
    getGiftCard,
    getGiftCardByCode,
    checkBalance,
    redeemGiftCard,
    refundToGiftCard,
    adjustBalance,
    cancelGiftCard,
    suspendGiftCard,
    reactivateGiftCard,
    extendExpiry,
    
    // Query operations
    getByPurchaser,
    getByRecipient,
    getExpiringCards,
    getTransactions,
    
    // Utilities
    isExpired,
    isRedeemable,
    getUsagePercentage,
    formatGiftCardCode,
    maskGiftCardCode,
    getGiftCardStatuses,
  };
}
