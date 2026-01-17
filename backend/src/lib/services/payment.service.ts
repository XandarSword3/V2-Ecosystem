/**
 * Payment Service with Dependency Injection
 *
 * This service handles all payment-related operations including:
 * - Recording payments for orders, bookings, tickets
 * - Processing refunds
 * - Payment statistics and reporting
 * - Stripe payment intent creation (mocked in tests)
 *
 * All dependencies are injected via the container for testability.
 */

import type {
  Container,
  Payment,
  PaymentFilters,
  PaymentMethod,
  PaymentStatus,
  ReferenceType,
} from '../container/types';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid payment methods and statuses
const VALID_METHODS: PaymentMethod[] = ['card', 'cash', 'bank_transfer', 'other'];
const VALID_STATUSES: PaymentStatus[] = ['pending', 'completed', 'failed', 'refunded', 'cancelled'];
const VALID_REFERENCE_TYPES: ReferenceType[] = ['order', 'booking', 'pool_ticket', 'snack_order'];

// Supported currencies
const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP'];
const DEFAULT_CURRENCY = 'EUR';

export interface CreatePaymentInput {
  referenceType: ReferenceType;
  referenceId: string;
  amount: number | string;
  currency?: string;
  method: PaymentMethod;
  notes?: string;
  processedBy?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
}

export interface ProcessPaymentInput {
  referenceType: ReferenceType;
  referenceId: string;
  amount: number | string;
  currency?: string;
  method: PaymentMethod;
  notes?: string;
  processedBy: string;
}

export interface RefundInput {
  paymentId: string;
  reason?: string;
  processedBy: string;
}

export interface PaymentListOptions {
  referenceType?: ReferenceType;
  referenceId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  byMethod: Record<PaymentMethod, { count: number; amount: number }>;
  byStatus: Record<PaymentStatus, number>;
  averageTransactionValue: number;
}

export function createPaymentService(container: Container) {
  const { paymentRepository, logger } = container;

  /**
   * Validates a UUID format
   */
  function isValidUUID(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  /**
   * Validates amount - must be positive number
   */
  function validateAmount(amount: number | string): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    return numAmount;
  }

  /**
   * Validates currency code
   */
  function validateCurrency(currency?: string): string {
    const cur = currency?.toUpperCase() || DEFAULT_CURRENCY;
    if (!SUPPORTED_CURRENCIES.includes(cur)) {
      throw new Error(`Unsupported currency: ${currency}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }
    return cur;
  }

  /**
   * Record a new payment
   */
  async function recordPayment(input: CreatePaymentInput): Promise<Payment> {
    // Validate reference type
    if (!input.referenceType || !VALID_REFERENCE_TYPES.includes(input.referenceType)) {
      throw new Error(`Invalid reference type. Must be one of: ${VALID_REFERENCE_TYPES.join(', ')}`);
    }

    // Validate reference ID
    if (!input.referenceId || !isValidUUID(input.referenceId)) {
      throw new Error('Invalid reference ID format');
    }

    // Validate amount
    const amount = validateAmount(input.amount);

    // Validate currency
    const currency = validateCurrency(input.currency);

    // Validate payment method
    if (!input.method || !VALID_METHODS.includes(input.method)) {
      throw new Error(`Invalid payment method. Must be one of: ${VALID_METHODS.join(', ')}`);
    }

    // Validate processedBy if provided
    if (input.processedBy && !isValidUUID(input.processedBy)) {
      throw new Error('Invalid processedBy user ID format');
    }

    const payment = await paymentRepository.create({
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      amount: amount.toFixed(2),
      currency,
      method: input.method,
      status: 'pending',
      notes: input.notes || null,
      processed_by: input.processedBy || null,
      stripe_payment_intent_id: input.stripePaymentIntentId || null,
      stripe_charge_id: input.stripeChargeId || null,
    });

    logger.info(`Payment recorded: ${payment.id} for ${input.referenceType}:${input.referenceId}`);
    return payment;
  }

  /**
   * Process a payment (record and complete it)
   */
  async function processPayment(input: ProcessPaymentInput): Promise<Payment> {
    // First record the payment
    const payment = await recordPayment({
      ...input,
      processedBy: input.processedBy,
    });

    // Then mark it as completed
    const completed = await completePayment(payment.id, input.processedBy);
    logger.info(`Payment processed: ${completed.id}`);
    return completed;
  }

  /**
   * Get payment by ID
   */
  async function getPaymentById(paymentId: string): Promise<Payment | null> {
    if (!paymentId || !isValidUUID(paymentId)) {
      throw new Error('Invalid payment ID format');
    }
    return paymentRepository.getById(paymentId);
  }

  /**
   * Get payments for a specific reference
   */
  async function getPaymentsForReference(
    referenceType: ReferenceType,
    referenceId: string
  ): Promise<Payment[]> {
    if (!VALID_REFERENCE_TYPES.includes(referenceType)) {
      throw new Error(`Invalid reference type. Must be one of: ${VALID_REFERENCE_TYPES.join(', ')}`);
    }
    if (!referenceId || !isValidUUID(referenceId)) {
      throw new Error('Invalid reference ID format');
    }
    return paymentRepository.getByReferenceId(referenceType, referenceId);
  }

  /**
   * List payments with filtering and pagination
   */
  async function listPayments(
    options: PaymentListOptions = {}
  ): Promise<{ payments: Payment[]; total: number; hasMore: boolean }> {
    const {
      referenceType,
      referenceId,
      method,
      status,
      startDate,
      endDate,
      limit = 20,
      offset = 0,
    } = options;

    // Validate filters if provided
    if (referenceType && !VALID_REFERENCE_TYPES.includes(referenceType)) {
      throw new Error(`Invalid reference type filter`);
    }
    if (referenceId && !isValidUUID(referenceId)) {
      throw new Error('Invalid reference ID filter format');
    }
    if (method && !VALID_METHODS.includes(method)) {
      throw new Error('Invalid payment method filter');
    }
    if (status && !VALID_STATUSES.includes(status)) {
      throw new Error('Invalid payment status filter');
    }

    // Validate dates
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new Error('Invalid start date format');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new Error('Invalid end date format');
    }
    if (startDate && endDate && startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    // Validate pagination
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    if (offset < 0) {
      throw new Error('Offset must be non-negative');
    }

    const filters: PaymentFilters = {};
    if (referenceType) filters.referenceType = referenceType;
    if (referenceId) filters.referenceId = referenceId;
    if (method) filters.method = method;
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const result = await paymentRepository.getAll(filters, { limit, offset });
    return {
      ...result,
      hasMore: offset + result.payments.length < result.total,
    };
  }

  /**
   * Complete a pending payment
   */
  async function completePayment(paymentId: string, processedBy?: string): Promise<Payment> {
    if (!paymentId || !isValidUUID(paymentId)) {
      throw new Error('Invalid payment ID format');
    }

    const payment = await paymentRepository.getById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending') {
      throw new Error(`Cannot complete payment with status: ${payment.status}`);
    }

    const updated = await paymentRepository.updateStatus(paymentId, 'completed');
    
    // Update processed_by and processed_at if not already set
    if (processedBy) {
      // In a real implementation, we'd update these fields too
      logger.info(`Payment ${paymentId} completed by ${processedBy}`);
    }

    return updated;
  }

  /**
   * Mark payment as failed
   */
  async function failPayment(paymentId: string, reason?: string): Promise<Payment> {
    if (!paymentId || !isValidUUID(paymentId)) {
      throw new Error('Invalid payment ID format');
    }

    const payment = await paymentRepository.getById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending') {
      throw new Error(`Cannot fail payment with status: ${payment.status}`);
    }

    const updated = await paymentRepository.updateStatus(paymentId, 'failed', reason);
    logger.info(`Payment ${paymentId} failed: ${reason || 'No reason provided'}`);
    return updated;
  }

  /**
   * Cancel a pending payment
   */
  async function cancelPayment(paymentId: string, reason?: string): Promise<Payment> {
    if (!paymentId || !isValidUUID(paymentId)) {
      throw new Error('Invalid payment ID format');
    }

    const payment = await paymentRepository.getById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending') {
      throw new Error(`Cannot cancel payment with status: ${payment.status}`);
    }

    const updated = await paymentRepository.updateStatus(paymentId, 'cancelled', reason);
    logger.info(`Payment ${paymentId} cancelled: ${reason || 'No reason provided'}`);
    return updated;
  }

  /**
   * Process a refund for a completed payment
   */
  async function refundPayment(input: RefundInput): Promise<Payment> {
    if (!input.paymentId || !isValidUUID(input.paymentId)) {
      throw new Error('Invalid payment ID format');
    }

    if (!input.processedBy || !isValidUUID(input.processedBy)) {
      throw new Error('Invalid processedBy user ID format');
    }

    const payment = await paymentRepository.getById(input.paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'completed') {
      throw new Error('Only completed payments can be refunded');
    }

    const refundNote = input.reason
      ? `Refund: ${input.reason}. Processed by: ${input.processedBy}`
      : `Refund processed by: ${input.processedBy}`;

    const updated = await paymentRepository.updateStatus(input.paymentId, 'refunded', refundNote);
    logger.info(`Payment ${input.paymentId} refunded by ${input.processedBy}`);
    return updated;
  }

  /**
   * Get total paid amount for a reference
   */
  async function getTotalPaidForReference(
    referenceType: ReferenceType,
    referenceId: string
  ): Promise<number> {
    const payments = await getPaymentsForReference(referenceType, referenceId);
    return payments
      .filter((p) => p.status === 'completed')
      .reduce((total, p) => total + parseFloat(p.amount), 0);
  }

  /**
   * Check if a reference is fully paid
   */
  async function isFullyPaid(
    referenceType: ReferenceType,
    referenceId: string,
    expectedAmount: number
  ): Promise<boolean> {
    const totalPaid = await getTotalPaidForReference(referenceType, referenceId);
    // Allow for small floating point differences
    return Math.abs(totalPaid - expectedAmount) < 0.01;
  }

  /**
   * Get payment statistics
   */
  async function getPaymentStats(startDate?: string, endDate?: string): Promise<PaymentStats> {
    // Validate dates if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new Error('Invalid start date format');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new Error('Invalid end date format');
    }
    if (startDate && endDate && startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    const stats = await paymentRepository.getPaymentStats(startDate, endDate);

    // Get detailed stats by method with amounts
    const { payments } = await paymentRepository.getAll(
      { startDate, endDate },
      { limit: 10000, offset: 0 }
    );

    const byMethodWithAmount: Record<PaymentMethod, { count: number; amount: number }> = {
      card: { count: 0, amount: 0 },
      cash: { count: 0, amount: 0 },
      bank_transfer: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };

    let completedTotal = 0;
    let completedCount = 0;

    for (const payment of payments) {
      byMethodWithAmount[payment.method].count++;
      byMethodWithAmount[payment.method].amount += parseFloat(payment.amount);
      
      if (payment.status === 'completed') {
        completedTotal += parseFloat(payment.amount);
        completedCount++;
      }
    }

    return {
      totalRevenue: completedTotal,
      totalTransactions: stats.totalCount,
      byMethod: byMethodWithAmount,
      byStatus: stats.byStatus,
      averageTransactionValue: completedCount > 0 ? completedTotal / completedCount : 0,
    };
  }

  /**
   * Get daily revenue for a date range
   */
  async function getDailyRevenue(
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; amount: number; count: number }>> {
    if (!startDate || isNaN(Date.parse(startDate))) {
      throw new Error('Invalid start date');
    }
    if (!endDate || isNaN(Date.parse(endDate))) {
      throw new Error('Invalid end date');
    }
    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    const { payments } = await paymentRepository.getAll(
      { startDate, endDate, status: 'completed' },
      { limit: 10000, offset: 0 }
    );

    const dailyData: Map<string, { amount: number; count: number }> = new Map();

    for (const payment of payments) {
      const date = payment.created_at.split('T')[0];
      const existing = dailyData.get(date) || { amount: 0, count: 0 };
      existing.amount += parseFloat(payment.amount);
      existing.count++;
      dailyData.set(date, existing);
    }

    // Fill in missing dates
    const result: Array<{ date: string; amount: number; count: number }> = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const data = dailyData.get(dateStr) || { amount: 0, count: 0 };
      result.push({ date: dateStr, ...data });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  /**
   * Validate payment method
   */
  function isValidPaymentMethod(method: string): method is PaymentMethod {
    return VALID_METHODS.includes(method as PaymentMethod);
  }

  /**
   * Validate payment status
   */
  function isValidPaymentStatus(status: string): status is PaymentStatus {
    return VALID_STATUSES.includes(status as PaymentStatus);
  }

  /**
   * Get pending payments older than a threshold
   */
  async function getPendingPaymentsOlderThan(hours: number): Promise<Payment[]> {
    if (hours < 0) {
      throw new Error('Hours must be non-negative');
    }

    const threshold = new Date();
    threshold.setHours(threshold.getHours() - hours);

    const { payments } = await paymentRepository.getAll(
      { status: 'pending', endDate: threshold.toISOString() },
      { limit: 1000, offset: 0 }
    );

    return payments;
  }

  /**
   * Expire old pending payments
   */
  async function expireOldPendingPayments(hours: number = 24): Promise<number> {
    const oldPayments = await getPendingPaymentsOlderThan(hours);
    let expiredCount = 0;

    for (const payment of oldPayments) {
      try {
        await paymentRepository.updateStatus(payment.id, 'cancelled', 'Expired - auto cancelled');
        expiredCount++;
      } catch (error) {
        logger.error(`Failed to expire payment ${payment.id}: ${error}`);
      }
    }

    if (expiredCount > 0) {
      logger.info(`Expired ${expiredCount} old pending payments`);
    }

    return expiredCount;
  }

  return {
    // Core payment operations
    recordPayment,
    processPayment,
    getPaymentById,
    getPaymentsForReference,
    listPayments,

    // Status updates
    completePayment,
    failPayment,
    cancelPayment,
    refundPayment,

    // Calculations
    getTotalPaidForReference,
    isFullyPaid,

    // Statistics
    getPaymentStats,
    getDailyRevenue,

    // Utilities
    isValidPaymentMethod,
    isValidPaymentStatus,

    // Maintenance
    getPendingPaymentsOlderThan,
    expireOldPendingPayments,
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
