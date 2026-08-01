/**

 * Financial Ledger Service

 * 

 * Unified, append-only financial ledger for ALL engine operations.

 * Every financial mutation (charge, refund, adjustment, void) is recorded here.

 * 

 * INVARIANT: Every financial mutation goes through this ledger — no direct table writes.

 * INVARIANT: Ledger entries are immutable — corrections are new entries (adjustments/voids).

 * INVARIANT: For any entity, SUM(charges) - SUM(refunds) = net financial position.

 * INVARIANT: totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount.

 * 

 * Architecture:

 *   - Backed by `engine_financial_ledger` table

 *   - Called by EngineService after successful pricing + state transition

 *   - Supports balance verification and reconciliation queries

 */



import { getSupabase } from '../database/connection.js';

import { logger } from '../utils/logger.js';

import type { PricingResult, EngineType } from './types.js';



// ============================================

// Types

// ============================================



export type LedgerTransactionType = 'charge' | 'refund' | 'adjustment' | 'void' | 'deposit' | 'deposit_release';



export interface LedgerEntry {

  tenantId: string;

  moduleId: string;

  propertyId?: string;

  engineType: EngineType;

  entityId: string;

  entityType: string;

  transactionType: LedgerTransactionType;

  currency?: string;

  

  // Pricing breakdown

  subtotal: number;

  taxAmount: number;

  taxRate: number;

  serviceCharge: number;

  deliveryFee: number;

  totalDiscount: number;

  totalAmount: number;

  depositAmount: number;

  

  // Discount details

  discountBreakdown?: Array<{

    type: string;

    referenceId?: string;

    label: string;

    amount: number;

    taxSavings: number;

  }>;

  

  // Loyalty

  loyaltyPointsEarned?: number;

  loyaltyPointsRedeemed?: number;

  

  // Payment

  paymentMethod?: string;

  paymentReference?: string;

  

  // Idempotency

  idempotencyKey?: string;

  

  // Actor

  actorType: 'system' | 'staff' | 'customer' | 'admin';

  actorId?: string;

  

  // Current entity state

  entityStateAtWrite?: string;

  

  // Metadata

  metadata?: Record<string, unknown>;

  notes?: string;

}



export interface LedgerBalance {

  entityId: string;

  totalCharges: number;

  totalRefunds: number;

  totalAdjustments: number;

  netBalance: number;

  entryCount: number;

}



export interface LedgerQuery {

  tenantId?: string;

  moduleId?: string;

  engineType?: EngineType;

  entityId?: string;

  transactionType?: LedgerTransactionType;

  startDate?: string;

  endDate?: string;

  limit?: number;

  offset?: number;

}



// ============================================

// Financial Ledger Service

// ============================================



export class FinancialLedgerService {

  

  /**

   * Record a financial transaction in the ledger.

   * This is the ONLY way financial data should be written.

   * 

   * @param entry - Complete ledger entry

   * @returns The created ledger entry ID

   */

  async record(entry: LedgerEntry): Promise<string> {

    const supabase = getSupabase();



    // Validate the financial invariant before writing

    this.validateInvariant(entry);



    const row = {

      tenant_id: entry.tenantId,

      module_id: entry.moduleId,

      property_id: entry.propertyId || null,

      engine_type: entry.engineType,

      entity_id: entry.entityId,

      entity_type: entry.entityType,

      transaction_type: entry.transactionType,

      currency: entry.currency || 'EUR',

      subtotal: entry.subtotal,

      tax_amount: entry.taxAmount,

      tax_rate: entry.taxRate,

      service_charge: entry.serviceCharge,

      delivery_fee: entry.deliveryFee,

      total_discount: entry.totalDiscount,

      total_amount: entry.totalAmount,

      deposit_amount: entry.depositAmount,

      discount_breakdown: entry.discountBreakdown || [],

      loyalty_points_earned: entry.loyaltyPointsEarned || 0,

      loyalty_points_redeemed: entry.loyaltyPointsRedeemed || 0,

      payment_method: entry.paymentMethod,

      payment_reference: entry.paymentReference,

      idempotency_key: entry.idempotencyKey,

      actor_type: entry.actorType,

      actor_id: entry.actorId,

      entity_state_at_write: entry.entityStateAtWrite,

      metadata: entry.metadata || {},

      notes: entry.notes,

    };



    const { data, error } = await supabase

      .from('engine_financial_ledger')

      .insert(row)

      .select('id')

      .single();



    if (error) {

      logger.error('[LEDGER] Failed to record financial transaction', {

        error: error.message,

        entry: {

          entityId: entry.entityId,

          transactionType: entry.transactionType,

          totalAmount: entry.totalAmount,

        },

      });

      throw new LedgerWriteError(

        `Failed to record ledger entry: ${error.message}`,

        entry,

      );

    }



    logger.info('[LEDGER] Financial transaction recorded', {

      ledgerId: data.id,

      entityId: entry.entityId,

      engineType: entry.engineType,

      transactionType: entry.transactionType,

      totalAmount: entry.totalAmount,

      idempotencyKey: entry.idempotencyKey,

    });



    return data.id;

  }



  /**

   * Create a ledger entry from a PricingResult.

   * Convenience method for the most common use case.

   */

  async recordFromPricing(

    pricingResult: PricingResult,

    context: {

      tenantId: string;

      moduleId: string;

      propertyId?: string;

      engineType: EngineType;

      entityId: string;

      entityType: string;

      transactionType: LedgerTransactionType;

      actorType: 'system' | 'staff' | 'customer' | 'admin';

      actorId?: string;

      entityState?: string;

      paymentMethod?: string;

      paymentReference?: string;

      idempotencyKey?: string;

      notes?: string;

      metadata?: Record<string, unknown>;

    },

  ): Promise<string> {

    const loyaltyPointsRedeemed = pricingResult.discounts

      .filter(d => d.type === 'loyalty')

      .reduce((sum, d) => sum + (d.metadata?.pointsUsed as number || 0), 0);



    return this.record({

      tenantId: context.tenantId,

      moduleId: context.moduleId,

      propertyId: context.propertyId,

      engineType: context.engineType,

      entityId: context.entityId,

      entityType: context.entityType,

      transactionType: context.transactionType,

      subtotal: pricingResult.subtotal,

      taxAmount: pricingResult.taxAmount,

      taxRate: pricingResult.taxRate,

      serviceCharge: pricingResult.serviceCharge,

      deliveryFee: pricingResult.deliveryFee,

      totalDiscount: pricingResult.totalDiscount,

      totalAmount: pricingResult.totalAmount,

      depositAmount: pricingResult.depositAmount,

      discountBreakdown: pricingResult.discounts.map(d => ({

        type: d.type,

        referenceId: d.referenceId,

        label: d.label,

        amount: d.amount,

        taxSavings: d.taxSavings,

      })),

      loyaltyPointsEarned: pricingResult.loyaltyPointsEarned,

      loyaltyPointsRedeemed,

      paymentMethod: context.paymentMethod,

      paymentReference: context.paymentReference,

      idempotencyKey: context.idempotencyKey,

      actorType: context.actorType,

      actorId: context.actorId,

      entityStateAtWrite: context.entityState,

      notes: context.notes,

      metadata: context.metadata,

    });

  }



  /**

   * Record a refund for an entity.

   * Creates a 'refund' ledger entry with the specified amount.

   */

  async recordRefund(

    originalEntityId: string,

    context: {

      tenantId: string;

      moduleId: string;

      engineType: EngineType;

      entityType: string;

      refundAmount: number;

      reason: string;

      actorType: 'system' | 'staff' | 'customer' | 'admin';

      actorId?: string;

      idempotencyKey?: string;

    },

  ): Promise<string> {

    return this.record({

      tenantId: context.tenantId,

      moduleId: context.moduleId,

      engineType: context.engineType,

      entityId: originalEntityId,

      entityType: context.entityType,

      transactionType: 'refund',

      subtotal: context.refundAmount,

      taxAmount: 0,

      taxRate: 0,

      serviceCharge: 0,

      deliveryFee: 0,

      totalDiscount: 0,

      totalAmount: context.refundAmount,

      depositAmount: 0,

      actorType: context.actorType,

      actorId: context.actorId,

      idempotencyKey: context.idempotencyKey,

      notes: context.reason,

    });

  }



  /**

   * Get the ledger balance for an entity.

   * Returns net financial position (charges - refunds).

   */

  async getEntityBalance(entityId: string): Promise<LedgerBalance> {

    const supabase = getSupabase();



    const { data, error } = await supabase

      .from('engine_financial_ledger')

      .select('transaction_type, total_amount')

      .eq('entity_id', entityId);



    if (error) {

      logger.error('[LEDGER] Failed to fetch entity balance', {

        entityId,

        error: error.message,

      });

      throw new Error(`Failed to fetch ledger balance: ${error.message}`);

    }



    const entries = data || [];

    let totalCharges = 0;

    let totalRefunds = 0;

    let totalAdjustments = 0;



    for (const entry of entries) {

      const amount = parseFloat(entry.total_amount as string) || 0;

      switch (entry.transaction_type) {

        case 'charge':
          // falls through
        case 'deposit':

          totalCharges += amount;

          break;

        case 'refund':
          // falls through
        case 'void':
          // falls through
        case 'deposit_release':

          totalRefunds += amount;

          break;

        case 'adjustment':

          totalAdjustments += amount;

          break;

      }

    }



    return {

      entityId,

      totalCharges,

      totalRefunds,

      totalAdjustments,

      netBalance: totalCharges - totalRefunds + totalAdjustments,

      entryCount: entries.length,

    };

  }



  /**

   * Get the full ledger history for an entity.

   */

  async getEntityLedger(entityId: string): Promise<Array<Record<string, unknown>>> {

    const supabase = getSupabase();



    const { data, error } = await supabase

      .from('engine_financial_ledger')

      .select('*')

      .eq('entity_id', entityId)

      .order('created_at', { ascending: true });



    if (error) {

      throw new Error(`Failed to fetch entity ledger: ${error.message}`);

    }



    return data || [];

  }



  /**

   * Query the ledger with filters.

   */

  async query(params: LedgerQuery): Promise<Array<Record<string, unknown>>> {

    const supabase = getSupabase();



    let query = supabase.from('engine_financial_ledger').select('*');



    if (params.tenantId) query = query.eq('tenant_id', params.tenantId);

    if (params.moduleId) query = query.eq('module_id', params.moduleId);

    if (params.engineType) query = query.eq('engine_type', params.engineType);

    if (params.entityId) query = query.eq('entity_id', params.entityId);

    if (params.transactionType) query = query.eq('transaction_type', params.transactionType);

    if (params.startDate) query = query.gte('created_at', params.startDate);

    if (params.endDate) query = query.lte('created_at', params.endDate);



    query = query.order('created_at', { ascending: false });



    if (params.limit) query = query.limit(params.limit);

    if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);



    const { data, error } = await query;



    if (error) {

      throw new Error(`Ledger query failed: ${error.message}`);

    }



    return data || [];

  }



  /**

   * Verify the financial invariant for a ledger entry.

   * totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount

   * (within floating-point tolerance)

   */

  private validateInvariant(entry: LedgerEntry): void {

    if (entry.transactionType === 'refund' || entry.transactionType === 'void') {

      // Refunds and voids have simplified structure

      return;

    }



    const expected = entry.subtotal + entry.taxAmount + entry.serviceCharge + entry.deliveryFee - entry.totalDiscount;

    const clamped = Math.max(0, expected);

    const diff = Math.abs(entry.totalAmount - clamped);



    if (diff > 0.02) {

      logger.error('[LEDGER] FINANCIAL INVARIANT VIOLATION detected before write', {

        entityId: entry.entityId,

        expected: clamped,

        actual: entry.totalAmount,

        diff,

        breakdown: {

          subtotal: entry.subtotal,

          taxAmount: entry.taxAmount,

          serviceCharge: entry.serviceCharge,

          deliveryFee: entry.deliveryFee,

          totalDiscount: entry.totalDiscount,

        },

      });

      throw new LedgerInvariantError(

        `Financial invariant violation: expected ${clamped}, got ${entry.totalAmount} (diff: ${diff})`,

        entry,

      );

    }



    if (entry.totalAmount < 0) {

      throw new LedgerInvariantError(

        `Financial invariant violation: totalAmount cannot be negative (${entry.totalAmount})`,

        entry,

      );

    }

  }

}



// ============================================

// Error Types

// ============================================



export class LedgerWriteError extends Error {

  public readonly code = 'LEDGER_WRITE_FAILED';

  public readonly entry: LedgerEntry;



  constructor(message: string, entry: LedgerEntry) {

    super(message);

    this.name = 'LedgerWriteError';

    this.entry = entry;

  }

}



export class LedgerInvariantError extends Error {

  public readonly code = 'LEDGER_INVARIANT_VIOLATION';

  public readonly entry: LedgerEntry;



  constructor(message: string, entry: LedgerEntry) {

    super(message);

    this.name = 'LedgerInvariantError';

    this.entry = entry;

  }

}



// ============================================

// Singleton

// ============================================



let _ledgerService: FinancialLedgerService | null = null;



export function getFinancialLedgerService(): FinancialLedgerService {

  if (!_ledgerService) {

    _ledgerService = new FinancialLedgerService();

  }

  return _ledgerService;

}



export function resetFinancialLedgerService(): void {

  _ledgerService = null;

}

