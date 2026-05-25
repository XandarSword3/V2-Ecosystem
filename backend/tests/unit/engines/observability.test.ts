/**
 * Test Suite D: Observability Tests
 * 
 * Tests EngineMetrics counters, EngineObserver event emission,
 * state transition logging, pricing event logging, and audit trail writing.
 */
import {
  EngineMetrics,
  EngineObserver,
  getEngineObserver,
  getEngineMetrics,
  resetEngineObserver,
} from '../../../src/engines/observability.js';
import type { PricingResult } from '../../../../shared/types/engines.js';

// ============================================
// Mocks
// ============================================

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockSupabase = {
  from: vi.fn().mockReturnValue({ insert: mockInsert }),
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

// ============================================
// EngineMetrics
// ============================================

describe('EngineMetrics', () => {
  let metrics: EngineMetrics;

  beforeEach(() => {
    metrics = new EngineMetrics();
  });

  it('should start with no metrics', () => {
    expect(metrics.get('anything')).toBeUndefined();
    expect(Object.keys(metrics.snapshot())).toHaveLength(0);
  });

  it('should increment a counter', () => {
    metrics.increment('transitions');
    const entry = metrics.get('transitions');
    expect(entry).toBeDefined();
    expect(entry!.count).toBe(1);
    expect(entry!.sumValue).toBe(1);
  });

  it('should increment with a custom value', () => {
    metrics.increment('revenue', 99.50);
    metrics.increment('revenue', 50.50);
    const entry = metrics.get('revenue');
    expect(entry!.count).toBe(2);
    expect(entry!.sumValue).toBe(150);
  });

  it('should track multiple metrics independently', () => {
    metrics.increment('a');
    metrics.increment('b');
    metrics.increment('a');

    expect(metrics.get('a')!.count).toBe(2);
    expect(metrics.get('b')!.count).toBe(1);
  });

  it('should return a snapshot copy', () => {
    metrics.increment('x');
    const snapshot = metrics.snapshot();
    expect(snapshot['x'].count).toBe(1);

    // Modifying snapshot should not affect the source
    snapshot['x'].count = 999;
    expect(metrics.get('x')!.count).toBe(1);
  });

  it('should reset all counters', () => {
    metrics.increment('a');
    metrics.increment('b');
    metrics.reset();
    expect(metrics.get('a')).toBeUndefined();
    expect(metrics.get('b')).toBeUndefined();
  });
});

// ============================================
// EngineObserver — Event Emission
// ============================================

describe('EngineObserver', () => {
  let observer: EngineObserver;
  let metrics: EngineMetrics;

  beforeEach(() => {
    vi.clearAllMocks();
    metrics = new EngineMetrics();
    observer = new EngineObserver(metrics, 50);
  });

  describe('State transition events', () => {
    it('should emit state_transition event', () => {
      observer.onStateTransition(
        'instant_transaction',
        'order-1',
        'pending',
        'confirmed',
        'confirm',
        'staff',
      );

      const events = observer.getEventBuffer();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('state_transition');
      expect(events[0].engineType).toBe('instant_transaction');
      expect(events[0].entityId).toBe('order-1');
      expect(events[0].data.previousState).toBe('pending');
      expect(events[0].data.newState).toBe('confirmed');
      expect(events[0].data.action).toBe('confirm');
    });

    it('should increment transition metric', () => {
      observer.onStateTransition(
        'time_exclusive_reservation',
        'bk-1',
        'pending',
        'confirmed',
        'confirm',
        'admin',
      );

      expect(metrics.get('state_transition.time_exclusive_reservation')!.count).toBe(1);
      expect(metrics.get('state_transition.time_exclusive_reservation.confirm')!.count).toBe(1);
    });

    it('should emit state_transition_rejected event', () => {
      observer.onStateTransitionRejected(
        'instant_transaction',
        'order-1',
        'completed',
        'confirm',
        'staff',
        'Cannot confirm a completed order',
      );

      const events = observer.getEventBuffer();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('state_transition_rejected');
      expect(events[0].data.reason).toBe('Cannot confirm a completed order');
    });
  });

  describe('Pricing events', () => {
    const mockPricingResult: PricingResult = {
      subtotal: 100,
      taxAmount: 11,
      taxRate: 0.11,
      serviceCharge: 10,
      serviceChargeRate: 0.10,
      deliveryFee: 3,
      preDiscountTotal: 124,
      discounts: [],
      totalDiscount: 0,
      totalAmount: 124,
      lineItems: [
        { itemId: 'i1', name: 'Item', unitPrice: 50, unitAdjustment: 0, quantity: 2, lineTotal: 100 },
      ],
      loyaltyPointsEarned: 0,
      depositAmount: 0,
    };

    it('should emit pricing_calculated event', () => {
      observer.onPricingCalculated('instant_transaction', 'order-1', mockPricingResult, 15);

      const events = observer.getEventBuffer();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('pricing_calculated');
      expect(events[0].data.totalAmount).toBe(124);
      expect(events[0].durationMs).toBe(15);
    });

    it('should track pricing invariant violations', () => {
      observer.onPricingInvariantViolation(
        'instant_transaction',
        'order-1',
        124,
        999,
        { subtotal: 100, tax: 11, service: 10, delivery: 3 },
      );

      expect(metrics.get('pricing_invariant_violation')!.count).toBe(1);
      const events = observer.getEventBuffer();
      expect(events[0].type).toBe('pricing_invariant_violation');
    });
  });

  describe('Ledger events', () => {
    it('should emit ledger_write event', () => {
      observer.onLedgerWrite('instant_transaction', 'order-1', 'charge', 124.00, 'idem-key-1');

      const events = observer.getEventBuffer();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ledger_write');
      expect(events[0].data.totalAmount).toBe(124);
      expect(events[0].data.idempotencyKey).toBe('idem-key-1');
    });

    it('should increment ledger metrics by type', () => {
      observer.onLedgerWrite('instant_transaction', 'o-1', 'charge', 100);
      observer.onLedgerWrite('instant_transaction', 'o-2', 'refund', 50);

      expect(metrics.get('ledger_write.charge')!.count).toBe(1);
      expect(metrics.get('ledger_write.refund')!.count).toBe(1);
      expect(metrics.get('ledger_write.total_amount')!.sumValue).toBe(150);
    });
  });

  describe('Idempotency events', () => {
    it('should emit idempotency_hit event', () => {
      observer.onIdempotencyHit('key-1', 'instant_transaction', 'order-1');

      expect(metrics.get('idempotency_hit')!.count).toBe(1);
      const events = observer.getEventBuffer();
      expect(events[0].type).toBe('idempotency_hit');
    });

    it('should emit idempotency_conflict event', () => {
      observer.onIdempotencyConflict('key-1', 'instant_transaction', 'order-1');

      expect(metrics.get('idempotency_conflict')!.count).toBe(1);
    });
  });

  describe('Transaction events', () => {
    it('should emit transaction lifecycle events', () => {
      observer.onTransactionStarted('tx-1', 'instant_transaction', 'order-1', 3);
      observer.onTransactionCompleted('tx-1', 'instant_transaction', 'order-1', 250);
      
      expect(metrics.get('transaction_started.instant_transaction')!.count).toBe(1);
      expect(metrics.get('transaction_completed.instant_transaction')!.count).toBe(1);
      
      const events = observer.getEventBuffer();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('transaction_started');
      expect(events[1].type).toBe('transaction_completed');
      expect(events[1].durationMs).toBe(250);
    });

    it('should emit transaction_failed with compensation info', () => {
      observer.onTransactionFailed(
        'tx-1',
        'time_exclusive_reservation',
        'bk-1',
        'charge_payment',
        'Payment failed',
        ['create_booking', 'reserve_slot'],
      );

      expect(metrics.get('transaction_failed.time_exclusive_reservation')!.count).toBe(1);
      const events = observer.getEventBuffer();
      expect(events[0].data.compensatedSteps).toEqual(['create_booking', 'reserve_slot']);
    });
  });

  describe('Anomaly events', () => {
    it('should emit capacity_violation event', () => {
      observer.onCapacityViolation('shared_capacity_access', 'pool-1', 50, 50);

      expect(metrics.get('capacity_violation')!.count).toBe(1);
      const events = observer.getEventBuffer();
      expect(events[0].data.currentOccupancy).toBe(50);
      expect(events[0].data.maxCapacity).toBe(50);
    });

    it('should emit duplicate_loyalty_prevented event', () => {
      observer.onDuplicateLoyaltyPrevented('instant_transaction', 'order-1', 'cust-1');

      expect(metrics.get('duplicate_loyalty_prevented')!.count).toBe(1);
    });

    it('should emit rpc_failure event', () => {
      observer.onRpcFailure('apply_coupon_atomic', 'instant_transaction', 'timeout');

      expect(metrics.get('rpc_failure.apply_coupon_atomic')!.count).toBe(1);
      expect(metrics.get('rpc_failure.total')!.count).toBe(1);
    });
  });

  describe('Event buffer management', () => {
    it('should clear event buffer', () => {
      observer.onIdempotencyHit('k', 'instant_transaction', 'e');
      expect(observer.getEventBuffer()).toHaveLength(1);

      observer.clearEventBuffer();
      expect(observer.getEventBuffer()).toHaveLength(0);
    });

    it('should auto-flush when buffer reaches max size', () => {
      const smallObserver = new EngineObserver(metrics, 3);
      
      smallObserver.onIdempotencyHit('k1', 'instant_transaction', 'e');
      smallObserver.onIdempotencyHit('k2', 'instant_transaction', 'e');
      expect(smallObserver.getEventBuffer()).toHaveLength(2);

      // 3rd event triggers auto-flush
      smallObserver.onIdempotencyHit('k3', 'instant_transaction', 'e');
      expect(smallObserver.getEventBuffer()).toHaveLength(0);
    });

    it('should return a copy of the buffer', () => {
      observer.onIdempotencyHit('k', 'instant_transaction', 'e');
      const buf = observer.getEventBuffer();
      buf.push({} as any);
      expect(observer.getEventBuffer()).toHaveLength(1);
    });
  });

  describe('Audit trail writer', () => {
    it('should write state transition to DB', async () => {
      await observer.writeAuditTrail(
        'tenant-1',
        'module-1',
        'instant_transaction',
        'order-1',
        'pending',
        'confirmed',
        'confirm',
        'staff',
        'staff-123',
        { note: 'test' },
        'tx-1',
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('engine_state_transitions');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 'tenant-1',
        entity_id: 'order-1',
        previous_state: 'pending',
        new_state: 'confirmed',
        action: 'confirm',
      }));
    });

    it('should not throw if audit write fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('DB down'));

      await expect(
        observer.writeAuditTrail(
          't', 'm', 'instant_transaction', 'e',
          'a', 'b', 'c', 'staff',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Singleton management', () => {
    beforeEach(() => {
      resetEngineObserver();
    });

    it('should return the same observer instance', () => {
      const obs1 = getEngineObserver();
      const obs2 = getEngineObserver();
      expect(obs1).toBe(obs2);
    });

    it('should return associated metrics from getEngineMetrics', () => {
      const obs = getEngineObserver();
      const m = getEngineMetrics();
      expect(m).toBe(obs.getMetrics());
    });

    it('should reset singleton on resetEngineObserver', () => {
      const obs1 = getEngineObserver();
      resetEngineObserver();
      const obs2 = getEngineObserver();
      expect(obs1).not.toBe(obs2);
    });
  });
});
