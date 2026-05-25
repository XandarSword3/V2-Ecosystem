/**
 * Test Suite C: Financial Ledger Tests
 * 
 * Tests the unified financial ledger:
 *   - Recording financial transactions
 *   - Creating entries from PricingResult
 *   - Recording refunds
 *   - Invariant validation
 *   - Balance calculation
 *   - Query functionality
 */
import { 
  FinancialLedgerService,
  LedgerInvariantError,
  LedgerWriteError,
} from '../../../src/engines/financial-ledger.js';
import type { LedgerEntry } from '../../../src/engines/financial-ledger.js';
import type { PricingResult } from '../../../../shared/types/engines.js';

// ============================================
// Mock Setup
// ============================================

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createValidEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    tenantId: 'tenant-1',
    moduleId: 'module-1',
    engineType: 'instant_transaction',
    entityId: 'entity-1',
    entityType: 'order',
    transactionType: 'charge',
    subtotal: 100,
    taxAmount: 11,
    taxRate: 0.11,
    serviceCharge: 10,
    deliveryFee: 3,
    totalDiscount: 0,
    totalAmount: 124, // 100 + 11 + 10 + 3 - 0 = 124
    depositAmount: 0,
    actorType: 'staff',
    ...overrides,
  };
}

describe('FinancialLedgerService', () => {
  let ledger: FinancialLedgerService;

  beforeEach(() => {
    vi.clearAllMocks();
    ledger = new FinancialLedgerService();
  });

  // ============================================
  // Invariant Validation (pre-write)
  // ============================================

  describe('Invariant validation', () => {
    it('should reject entries where totalAmount violates the formula', async () => {
      const badEntry = createValidEntry({
        subtotal: 100,
        taxAmount: 11,
        serviceCharge: 10,
        deliveryFee: 3,
        totalDiscount: 0,
        totalAmount: 999, // Wrong! Should be 124
      });

      await expect(ledger.record(badEntry)).rejects.toThrow(LedgerInvariantError);
    });

    it('should reject negative totalAmount', async () => {
      const badEntry = createValidEntry({
        subtotal: 10,
        taxAmount: 0,
        serviceCharge: 0,
        deliveryFee: 0,
        totalDiscount: 20,
        totalAmount: -10, // Negative!
      });

      await expect(ledger.record(badEntry)).rejects.toThrow(LedgerInvariantError);
    });

    it('should accept valid entries within rounding tolerance', async () => {
      const entry = createValidEntry({
        subtotal: 100,
        taxAmount: 11,
        serviceCharge: 10,
        deliveryFee: 3,
        totalDiscount: 0,
        totalAmount: 124.01, // Within 0.02 tolerance
      });

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'ledger-1' },
              error: null,
            }),
          }),
        }),
      });

      const id = await ledger.record(entry);
      expect(id).toBe('ledger-1');
    });

    it('should skip formula validation for refunds', async () => {
      const refundEntry = createValidEntry({
        transactionType: 'refund',
        subtotal: 50,
        taxAmount: 0,
        serviceCharge: 0,
        deliveryFee: 0,
        totalDiscount: 0,
        totalAmount: 50, // Refund — simplified structure
      });

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'refund-1' },
              error: null,
            }),
          }),
        }),
      });

      const id = await ledger.record(refundEntry);
      expect(id).toBe('refund-1');
    });

    it('should skip formula validation for voids', async () => {
      const voidEntry = createValidEntry({
        transactionType: 'void',
        totalAmount: 100,
      });

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'void-1' },
              error: null,
            }),
          }),
        }),
      });

      const id = await ledger.record(voidEntry);
      expect(id).toBe('void-1');
    });
  });

  // ============================================
  // Recording Transactions
  // ============================================

  describe('record', () => {
    it('should insert a valid entry and return the ledger ID', async () => {
      const entry = createValidEntry();

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'ledger-123' },
              error: null,
            }),
          }),
        }),
      });

      const id = await ledger.record(entry);
      expect(id).toBe('ledger-123');
    });

    it('should throw LedgerWriteError on database failure', async () => {
      const entry = createValidEntry();

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
            }),
          }),
        }),
      });

      await expect(ledger.record(entry)).rejects.toThrow(LedgerWriteError);
    });
  });

  // ============================================
  // Recording from PricingResult
  // ============================================

  describe('recordFromPricing', () => {
    it('should create a ledger entry from a PricingResult', async () => {
      const pricingResult: PricingResult = {
        subtotal: 100,
        taxAmount: 11,
        taxRate: 0.11,
        serviceCharge: 10,
        serviceChargeRate: 0.10,
        deliveryFee: 3,
        preDiscountTotal: 124,
        discounts: [
          { type: 'coupon', referenceId: 'coupon-1', label: 'SAVE10', amount: 10, taxSavings: 1.1 },
        ],
        totalDiscount: 11.1,
        totalAmount: 112.9,
        lineItems: [
          { itemId: 'item-1', name: 'Burger', unitPrice: 50, unitAdjustment: 0, quantity: 2, lineTotal: 100 },
        ],
        loyaltyPointsEarned: 0,
        depositAmount: 0,
      };

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'from-pricing-1' },
              error: null,
            }),
          }),
        }),
      });

      const id = await ledger.recordFromPricing(pricingResult, {
        tenantId: 'tenant-1',
        moduleId: 'module-1',
        engineType: 'instant_transaction',
        entityId: 'order-1',
        entityType: 'order',
        transactionType: 'charge',
        actorType: 'staff',
        entityState: 'confirmed',
      });

      expect(id).toBe('from-pricing-1');
    });
  });

  // ============================================
  // Recording Refunds
  // ============================================

  describe('recordRefund', () => {
    it('should create a refund entry', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'refund-1' },
              error: null,
            }),
          }),
        }),
      });

      const id = await ledger.recordRefund('order-1', {
        tenantId: 'tenant-1',
        moduleId: 'module-1',
        engineType: 'instant_transaction',
        entityType: 'order',
        refundAmount: 50,
        reason: 'Customer request',
        actorType: 'admin',
      });

      expect(id).toBe('refund-1');
    });
  });

  // ============================================
  // Balance Calculation
  // ============================================

  describe('getEntityBalance', () => {
    it('should calculate net balance from charges and refunds', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { transaction_type: 'charge', total_amount: '100.00' },
              { transaction_type: 'charge', total_amount: '50.00' },
              { transaction_type: 'refund', total_amount: '30.00' },
            ],
            error: null,
          }),
        }),
      });

      const balance = await ledger.getEntityBalance('entity-1');

      expect(balance.entityId).toBe('entity-1');
      expect(balance.totalCharges).toBe(150);
      expect(balance.totalRefunds).toBe(30);
      expect(balance.netBalance).toBe(120);
      expect(balance.entryCount).toBe(3);
    });

    it('should handle empty ledger', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const balance = await ledger.getEntityBalance('empty-entity');

      expect(balance.netBalance).toBe(0);
      expect(balance.entryCount).toBe(0);
    });

    it('should classify deposits as charges and voids as refunds', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { transaction_type: 'deposit', total_amount: '200.00' },
              { transaction_type: 'deposit_release', total_amount: '200.00' },
            ],
            error: null,
          }),
        }),
      });

      const balance = await ledger.getEntityBalance('booking-1');

      expect(balance.totalCharges).toBe(200);
      expect(balance.totalRefunds).toBe(200);
      expect(balance.netBalance).toBe(0);
    });
  });

  // ============================================
  // Error Types
  // ============================================

  describe('Error types', () => {
    it('LedgerInvariantError should have correct properties', () => {
      const entry = createValidEntry();
      const error = new LedgerInvariantError('invariant failed', entry);
      
      expect(error.name).toBe('LedgerInvariantError');
      expect(error.code).toBe('LEDGER_INVARIANT_VIOLATION');
      expect(error.entry).toBe(entry);
    });

    it('LedgerWriteError should have correct properties', () => {
      const entry = createValidEntry();
      const error = new LedgerWriteError('write failed', entry);
      
      expect(error.name).toBe('LedgerWriteError');
      expect(error.code).toBe('LEDGER_WRITE_FAILED');
      expect(error.entry).toBe(entry);
    });
  });
});
