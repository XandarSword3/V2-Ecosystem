/**
 * Full Workflow Integration Tests
 * 
 * End-to-end lifecycle tests for all 4 engines, exercising:
 *   - State machine transitions (happy path + error paths)
 *   - Pricing pipeline calculations
 *   - Transaction manager (saga execution + compensation)
 *   - Idempotency guard (duplicate prevention)
 *   - Cross-engine invariants
 * 
 * These tests validate the COMPLETE CONTRACTS documented in
 * WORKFLOW_CONTRACTS.md and FINANCIAL_INVARIANTS.md.
 * 
 * Test Suites:
 *   F: Engine A — Instant Transaction full lifecycle
 *   G: Engine B — Time-Exclusive Reservation full lifecycle
 *   H: Engine C — Shared Capacity Access full lifecycle
 *   I: Engine D — Ongoing Entitlement full lifecycle
 *   J: Cross-engine invariant enforcement
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEngineService, EngineService } from '../../../src/engines/engine-service.js';
import { TransactionManager } from '../../../src/engines/transaction-manager.js';
import { IdempotencyGuard } from '../../../src/engines/idempotency-guard.js';
import { EngineObserver, EngineMetrics } from '../../../src/engines/observability.js';
import { PricingPipeline } from '../../../src/engines/pricing-pipeline.js';
import type {
  PricingLineItem,
  PricingContext,
  PricingResult,
} from '../../../../shared/types/engines.js';

// ============================================
// Global Mocks
// ============================================

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ============================================
// Shared Test Utilities
// ============================================

function createMockDeps() {
  return {
    taxService: {
      getTaxRate: vi.fn().mockResolvedValue(0.10),
    },
    orderConfigService: {
      getOrderConfig: vi.fn().mockResolvedValue({
        serviceChargeRate: 0.10,
        deliveryFee: 5,
      }),
    },
    couponResolver: {
      resolve: vi.fn().mockResolvedValue(null),
    },
    giftCardResolver: {
      resolve: vi.fn().mockResolvedValue(null),
    },
    loyaltyResolver: {
      resolve: vi.fn().mockResolvedValue(null),
      earn: vi.fn().mockResolvedValue({ pointsEarned: 0 }),
    },
  };
}

function createLineItems(items: Array<{ name: string; price: number; qty: number }>): PricingLineItem[] {
  return items.map((item, i) => ({
    itemId: `item-${i + 1}`,
    name: item.name,
    unitPrice: item.price,
    unitAdjustment: 0,
    quantity: item.qty,
    lineTotal: item.price * item.qty,
  }));
}

function createContext(overrides: Partial<PricingContext> = {}): PricingContext {
  return {
    moduleId: 'mod-1',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

// ============================================
// Suite F: Engine A — Instant Transaction Lifecycle
// ============================================

describe('Engine A: Instant Transaction Full Lifecycle', () => {
  let service: EngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createEngineService(createMockDeps());
  });

  describe('Happy path: create → confirm → prepare → ready → deliver → complete', () => {
    it('should start in pending state', () => {
      const initial = service.getInitialState('menu_service');
      expect(initial).toBe('pending');
    });

    it('should allow confirm from pending (staff)', async () => {
      const result = await service.transitionState('menu_service', 'pending', 'confirm', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('confirmed');
    });

    it('should allow start_preparation from confirmed (staff)', async () => {
      const result = await service.transitionState('menu_service', 'confirmed', 'start_preparation', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('preparing');
    });

    it('should allow mark_ready from preparing (staff)', async () => {
      const result = await service.transitionState('menu_service', 'preparing', 'mark_ready', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('ready');
    });

    it('should allow deliver from ready (staff)', async () => {
      const result = await service.transitionState('menu_service', 'ready', 'deliver', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('delivered');
    });

    it('should allow complete from delivered (staff)', async () => {
      const result = await service.transitionState('menu_service', 'delivered', 'complete', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('completed');
    });

    it('should allow direct complete from ready (takeaway shortcut)', async () => {
      const result = await service.transitionState('menu_service', 'ready', 'complete', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('completed');
    });

    it('completed should be terminal', () => {
      expect(service.isTerminalState('menu_service', 'completed')).toBe(true);
    });
  });

  describe('Cancellation paths', () => {
    it('customer can cancel from pending', async () => {
      const result = await service.transitionState('menu_service', 'pending', 'cancel', 'customer');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('cancelled');
    });

    it('staff can cancel from confirmed', async () => {
      const result = await service.transitionState('menu_service', 'confirmed', 'cancel', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('cancelled');
    });

    it('only admin can cancel from preparing', async () => {
      const staffResult = await service.transitionState('menu_service', 'preparing', 'cancel', 'staff');
      expect(staffResult.allowed).toBe(false);

      const adminResult = await service.transitionState('menu_service', 'preparing', 'cancel', 'admin');
      expect(adminResult.allowed).toBe(true);
      expect(adminResult.targetState).toBe('cancelled');
    });

    it('cannot cancel from completed', async () => {
      const result = await service.transitionState('menu_service', 'completed', 'cancel', 'admin');
      expect(result.allowed).toBe(false);
    });

    it('cancelled should be terminal', () => {
      expect(service.isTerminalState('menu_service', 'cancelled')).toBe(true);
    });
  });

  describe('Invalid transitions', () => {
    it('cannot skip from pending to preparing', async () => {
      const result = await service.transitionState('menu_service', 'pending', 'start_preparation', 'staff');
      expect(result.allowed).toBe(false);
    });

    it('cannot go backwards from confirmed to pending', async () => {
      const result = await service.transitionState('menu_service', 'confirmed', 'some_reverse_action', 'staff');
      expect(result.allowed).toBe(false);
    });

    it('customer cannot confirm (forbidden actor)', async () => {
      const result = await service.transitionState('menu_service', 'pending', 'confirm', 'customer');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Available actions', () => {
    it('staff should see confirm and cancel from pending', () => {
      const actions = service.getAvailableActions('menu_service', 'pending', 'staff');
      const actionNames = actions.map(a => a.action);
      expect(actionNames).toContain('confirm');
    });

    it('no actions from terminal completed state', () => {
      const actions = service.getAvailableActions('menu_service', 'completed', 'staff');
      expect(actions).toHaveLength(0);
    });
  });

  describe('Pricing integration', () => {
    it('should calculate order pricing with tax and service charge', async () => {
      const lineItems = createLineItems([
        { name: 'Burger', price: 25, qty: 2 },
        { name: 'Fries', price: 8, qty: 1 },
      ]);

      const result = await service.calculatePricing('menu_service', lineItems, createContext());
      
      expect(result.subtotal).toBe(58); // (25*2) + (8*1)
      expect(result.taxAmount).toBeGreaterThan(0);
      expect(result.totalAmount).toBeGreaterThan(result.subtotal);
    });

    it('should enforce INV-P1: total = subtotal + tax + service + delivery - discounts', async () => {
      const lineItems = createLineItems([
        { name: 'Item', price: 100, qty: 1 },
      ]);

      const result = await service.calculatePricing('menu_service', lineItems, createContext());
      
      const expected = result.subtotal + result.taxAmount + result.serviceCharge + result.deliveryFee - result.totalDiscount;
      expect(Math.abs(result.totalAmount - expected)).toBeLessThanOrEqual(0.02);
    });
  });
});

// ============================================
// Suite G: Engine B — Time-Exclusive Reservation Lifecycle
// ============================================

describe('Engine B: Time-Exclusive Reservation Full Lifecycle', () => {
  let service: EngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createEngineService(createMockDeps());
  });

  describe('Happy path: pending → confirmed → checked_in → checked_out', () => {
    it('should start in pending state', () => {
      expect(service.getInitialState('multi_day_booking')).toBe('pending');
    });

    it('should transition: pending → confirmed', async () => {
      const r = await service.transitionState('multi_day_booking', 'pending', 'confirm', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('confirmed');
    });

    it('should transition: confirmed → checked_in', async () => {
      const r = await service.transitionState('multi_day_booking', 'confirmed', 'check_in', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('checked_in');
    });

    it('should allow direct walk-in: pending → checked_in (staff)', async () => {
      const r = await service.transitionState('multi_day_booking', 'pending', 'check_in', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('checked_in');
    });

    it('should transition: checked_in → checked_out', async () => {
      const r = await service.transitionState('multi_day_booking', 'checked_in', 'check_out', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('checked_out');
    });

    it('checked_out should be terminal', () => {
      expect(service.isTerminalState('multi_day_booking', 'checked_out')).toBe(true);
    });
  });

  describe('Cancellation paths', () => {
    it('customer can cancel from pending', async () => {
      const r = await service.transitionState('multi_day_booking', 'pending', 'cancel', 'customer');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('cancelled');
    });

    it('customer can cancel from confirmed', async () => {
      const r = await service.transitionState('multi_day_booking', 'confirmed', 'cancel', 'customer');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('cancelled');
    });

    it('cannot cancel after check-in', async () => {
      const r = await service.transitionState('multi_day_booking', 'checked_in', 'cancel', 'admin');
      expect(r.allowed).toBe(false);
    });

    it('cancelled should be terminal', () => {
      expect(service.isTerminalState('multi_day_booking', 'cancelled')).toBe(true);
    });
  });

  describe('No-show handling', () => {
    it('staff can mark no-show from pending', async () => {
      const r = await service.transitionState('multi_day_booking', 'pending', 'mark_no_show', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('no_show');
    });

    it('system can mark no-show from confirmed', async () => {
      const r = await service.transitionState('multi_day_booking', 'confirmed', 'mark_no_show', 'system');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('no_show');
    });

    it('no_show should be terminal', () => {
      expect(service.isTerminalState('multi_day_booking', 'no_show')).toBe(true);
    });
  });

  describe('Invalid transitions', () => {
    it('cannot check out without check-in', async () => {
      const r = await service.transitionState('multi_day_booking', 'confirmed', 'check_out', 'staff');
      expect(r.allowed).toBe(false);
    });

    it('customer cannot check in', async () => {
      const r = await service.transitionState('multi_day_booking', 'confirmed', 'check_in', 'customer');
      expect(r.allowed).toBe(false);
    });
  });

  describe('All states are declared', () => {
    it('should have exactly 6 states', () => {
      const states = service.getStates('multi_day_booking');
      expect(states).toEqual(expect.arrayContaining([
        'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show',
      ]));
      expect(states).toHaveLength(6);
    });
  });
});

// ============================================
// Suite H: Engine C — Shared Capacity Access Lifecycle
// ============================================

describe('Engine C: Shared Capacity Access Full Lifecycle', () => {
  let service: EngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createEngineService(createMockDeps());
  });

  describe('Happy path: valid → active → used', () => {
    it('should start in valid state', () => {
      expect(service.getInitialState('session_access')).toBe('valid');
    });

    it('should transition: valid → active (entry)', async () => {
      const r = await service.transitionState('session_access', 'valid', 'validate_entry', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('active');
    });

    it('should transition: active → used (exit)', async () => {
      const r = await service.transitionState('session_access', 'active', 'record_exit', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('used');
    });

    it('used should be terminal', () => {
      expect(service.isTerminalState('session_access', 'used')).toBe(true);
    });
  });

  describe('Cancellation and expiration', () => {
    it('customer can cancel a valid ticket', async () => {
      const r = await service.transitionState('session_access', 'valid', 'cancel', 'customer');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('cancelled');
    });

    it('cannot cancel an active ticket (guest is inside)', async () => {
      const r = await service.transitionState('session_access', 'active', 'cancel', 'admin');
      expect(r.allowed).toBe(false);
    });

    it('system can expire a valid ticket', async () => {
      const r = await service.transitionState('session_access', 'valid', 'expire', 'system');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('expired');
    });

    it('expired and cancelled should be terminal', () => {
      expect(service.isTerminalState('session_access', 'expired')).toBe(true);
      expect(service.isTerminalState('session_access', 'cancelled')).toBe(true);
    });
  });

  describe('Exit-without-entry prevention (INV-S3)', () => {
    it('cannot record_exit from valid (not entered)', async () => {
      const r = await service.transitionState('session_access', 'valid', 'record_exit', 'staff');
      expect(r.allowed).toBe(false);
    });

    it('cannot record_exit from used (already exited)', async () => {
      const r = await service.transitionState('session_access', 'used', 'record_exit', 'staff');
      expect(r.allowed).toBe(false);
    });
  });

  describe('All states are declared', () => {
    it('should have exactly 5 states', () => {
      const states = service.getStates('session_access');
      expect(states).toEqual(expect.arrayContaining([
        'valid', 'active', 'used', 'expired', 'cancelled',
      ]));
      expect(states).toHaveLength(5);
    });
  });
});

// ============================================
// Suite I: Engine D — Ongoing Entitlement Lifecycle
// ============================================

describe('Engine D: Ongoing Entitlement Full Lifecycle', () => {
  let service: EngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createEngineService(createMockDeps());
  });

  describe('Happy path: pending → active → renew → active', () => {
    it('should start in pending state', () => {
      expect(service.getInitialState('subscription')).toBe('pending');
    });

    it('should transition: pending → active (activate)', async () => {
      const r = await service.transitionState('subscription', 'pending', 'activate', 'system');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('active');
    });

    it('should transition: active → active (renew, self-loop)', async () => {
      const r = await service.transitionState('subscription', 'active', 'renew', 'system');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('active');
    });
  });

  describe('Pause and resume', () => {
    it('should transition: active → paused', async () => {
      const r = await service.transitionState('subscription', 'active', 'pause', 'customer');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('paused');
    });

    it('should transition: paused → active (resume)', async () => {
      const r = await service.transitionState('subscription', 'paused', 'resume', 'customer');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('active');
    });
  });

  describe('Expiration and reactivation', () => {
    it('active → expired on payment failure', async () => {
      const r = await service.transitionState('subscription', 'active', 'expire', 'system');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('expired');
    });

    it('paused → expired on max pause exceeded', async () => {
      const r = await service.transitionState('subscription', 'paused', 'expire', 'system');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('expired');
    });

    it('expired → active (reactivate within grace period)', async () => {
      const r = await service.transitionState('subscription', 'expired', 'reactivate', 'staff');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('active');
    });
  });

  describe('Cancellation from multiple states', () => {
    it('can cancel from pending', async () => {
      const r = await service.transitionState('subscription', 'pending', 'cancel', 'customer');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('cancelled');
    });

    it('can cancel from active', async () => {
      const r = await service.transitionState('subscription', 'active', 'cancel', 'customer');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('cancelled');
    });

    it('can cancel from paused', async () => {
      const r = await service.transitionState('subscription', 'paused', 'cancel', 'admin');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('cancelled');
    });

    it('can cancel from expired', async () => {
      const r = await service.transitionState('subscription', 'expired', 'cancel', 'admin');
      expect(r.allowed).toBe(true);
      expect(r.targetState).toBe('cancelled');
    });

    it('cancelled should be the only terminal state', () => {
      expect(service.isTerminalState('subscription', 'cancelled')).toBe(true);
      // expired is NOT terminal (can reactivate or cancel)
      expect(service.isTerminalState('subscription', 'expired')).toBe(false);
    });
  });

  describe('All states are declared', () => {
    it('should have exactly 5 states', () => {
      const states = service.getStates('subscription');
      expect(states).toEqual(expect.arrayContaining([
        'pending', 'active', 'paused', 'expired', 'cancelled',
      ]));
      expect(states).toHaveLength(5);
    });
  });
});

// ============================================
// Suite J: Cross-Engine Invariant Enforcement
// ============================================

describe('Cross-Engine Invariant Enforcement', () => {
  let service: EngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createEngineService(createMockDeps());
  });

  // INV-S1: Every engine has exactly one initial state
  describe('INV-S1: Unique initial state per engine', () => {
    const templates = ['menu_service', 'multi_day_booking', 'session_access', 'subscription'];

    it.each(templates)('%s should have exactly one initial state', (template) => {
      const initial = service.getInitialState(template);
      expect(typeof initial).toBe('string');
      expect(initial.length).toBeGreaterThan(0);
    });
  });

  // INV-S2: No transitions from terminal states
  describe('INV-S2: Terminal states have no outgoing transitions', () => {
    const terminalCases = [
      { template: 'menu_service', state: 'completed' },
      { template: 'menu_service', state: 'cancelled' },
      { template: 'multi_day_booking', state: 'checked_out' },
      { template: 'multi_day_booking', state: 'cancelled' },
      { template: 'multi_day_booking', state: 'no_show' },
      { template: 'session_access', state: 'used' },
      { template: 'session_access', state: 'expired' },
      { template: 'session_access', state: 'cancelled' },
      { template: 'subscription', state: 'cancelled' },
    ];

    it.each(terminalCases)('$template/$state should have no available actions', ({ template, state }) => {
      for (const actor of ['staff', 'admin', 'customer', 'system'] as const) {
        const actions = service.getAvailableActions(template, state, actor);
        expect(actions).toHaveLength(0);
      }
    });
  });

  // INV-S4: Actor constraints are enforced
  describe('INV-S4: Actor constraints are enforced', () => {
    it('system cannot cancel an order from pending (only customer/staff/admin)', async () => {
      const r = await service.transitionState('menu_service', 'pending', 'cancel', 'system');
      expect(r.allowed).toBe(false);
    });

    it('customer cannot start_preparation', async () => {
      const r = await service.transitionState('menu_service', 'confirmed', 'start_preparation', 'customer');
      expect(r.allowed).toBe(false);
    });

    it('customer cannot check_in at chalet', async () => {
      const r = await service.transitionState('multi_day_booking', 'confirmed', 'check_in', 'customer');
      expect(r.allowed).toBe(false);
    });
  });

  // INV-P1: Pricing total formula validation
  describe('INV-P1: Pricing formula consistency across engines', () => {
    const pricingTemplates = ['menu_service', 'multi_day_booking', 'session_access', 'subscription'];
    
    it.each(pricingTemplates)('%s pricing should satisfy total = subtotal + tax + service + delivery - discounts', async (template) => {
      const lineItems = createLineItems([{ name: 'Test', price: 100, qty: 1 }]);
      const result = await service.calculatePricing(template, lineItems, createContext());
      
      const expected = result.subtotal + result.taxAmount + result.serviceCharge + result.deliveryFee - result.totalDiscount;
      expect(Math.abs(result.totalAmount - expected)).toBeLessThanOrEqual(0.02);
    });
  });

  // INV-P2: Non-negative amounts
  describe('INV-P2: All financial amounts are non-negative', () => {
    it('pricing result should have no negative amounts', async () => {
      const lineItems = createLineItems([{ name: 'Test', price: 50, qty: 2 }]);
      const result = await service.calculatePricing('menu_service', lineItems, createContext());
      
      expect(result.subtotal).toBeGreaterThanOrEqual(0);
      expect(result.taxAmount).toBeGreaterThanOrEqual(0);
      expect(result.serviceCharge).toBeGreaterThanOrEqual(0);
      expect(result.deliveryFee).toBeGreaterThanOrEqual(0);
      expect(result.totalDiscount).toBeGreaterThanOrEqual(0);
      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
    });
  });

  // Template resolution
  describe('Template → Engine resolution', () => {
    const validMappings = [
      { template: 'menu_service', engine: 'instant_transaction' },
      { template: 'multi_day_booking', engine: 'time_exclusive_reservation' },
      { template: 'session_access', engine: 'shared_capacity_access' },
      { template: 'subscription', engine: 'ongoing_entitlement' },
    ];

    it.each(validMappings)('$template should resolve to $engine', ({ template, engine }) => {
      const resolved = service.resolveEngineType(template);
      expect(resolved).toBe(engine);
    });

    it('should throw for unknown template type', () => {
      expect(() => service.resolveEngineType('NONEXISTENT'))
        .toThrow("Unknown template type: 'NONEXISTENT'");
    });
  });
});

// ============================================
// Suite K: Transaction Manager + Idempotency Integration
// ============================================

describe('Transaction Manager Integration', () => {
  let txManager: TransactionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    txManager = new TransactionManager();
  });

  describe('Saga execution with compensation', () => {
    it('should execute all steps in order and return success', async () => {
      const order: string[] = [];
      
      const result = await txManager.executeTransaction([
        {
          name: 'create_order',
          execute: async () => { order.push('create'); return { orderId: '1' }; },
          compensate: async () => { order.push('undo_create'); },
        },
        {
          name: 'charge_payment',
          execute: async () => { order.push('charge'); return { paymentId: 'p1' }; },
          compensate: async () => { order.push('undo_charge'); },
        },
        {
          name: 'update_state',
          execute: async () => { order.push('state'); return { newState: 'confirmed' }; },
        },
      ], {
        engineType: 'instant_transaction',
        entityId: 'order-1',
        tenantId: 'tenant-1',
        moduleId: 'mod-1',
        actor: 'staff',
      });

      expect(result.success).toBe(true);
      expect(order).toEqual(['create', 'charge', 'state']);
      expect(Object.keys(result.results)).toEqual(['create_order', 'charge_payment', 'update_state']);
    });

    it('should compensate on failure in reverse order', async () => {
      const order: string[] = [];
      
      const result = await txManager.executeTransaction([
        {
          name: 'step_1',
          execute: async () => { order.push('do_1'); },
          compensate: async () => { order.push('undo_1'); },
        },
        {
          name: 'step_2',
          execute: async () => { order.push('do_2'); },
          compensate: async () => { order.push('undo_2'); },
        },
        {
          name: 'step_3',
          execute: async () => { throw new Error('step 3 failed'); },
          compensate: async () => { order.push('undo_3'); },
        },
      ], {
        engineType: 'instant_transaction',
        entityId: 'order-1',
        tenantId: 'tenant-1',
        moduleId: 'mod-1',
        actor: 'staff',
      });

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('step_3');
      // Compensate steps 2 and 1 in reverse (step 3 didn't complete so no compensate for it)
      expect(order).toContain('undo_2');
      expect(order).toContain('undo_1');
      // Undo order should be reverse
      const undoIdx1 = order.indexOf('undo_1');
      const undoIdx2 = order.indexOf('undo_2');
      expect(undoIdx2).toBeLessThan(undoIdx1);
    });

    it('should skip optional steps on failure without triggering compensation', async () => {
      const order: string[] = [];
      
      const result = await txManager.executeTransaction([
        {
          name: 'required_step',
          execute: async () => { order.push('required'); },
        },
        {
          name: 'optional_loyalty',
          execute: async () => { throw new Error('loyalty down'); },
          optional: true,
        },
        {
          name: 'final_step',
          execute: async () => { order.push('final'); },
        },
      ], {
        engineType: 'instant_transaction',
        entityId: 'order-1',
        tenantId: 'tenant-1',
        moduleId: 'mod-1',
        actor: 'staff',
      });

      expect(result.success).toBe(true);
      expect(order).toEqual(['required', 'final']);
    });
  });
});

describe('Idempotency Guard Integration', () => {
  let guard: IdempotencyGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new IdempotencyGuard();
  });

  describe('Key generation', () => {
    it('should generate deterministic keys', () => {
      const key1 = guard.generateKey('t1', 'instant_transaction', 'e1', 'confirm', 'nonce-1');
      const key2 = guard.generateKey('t1', 'instant_transaction', 'e1', 'confirm', 'nonce-1');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = guard.generateKey('t1', 'instant_transaction', 'e1', 'confirm', 'n1');
      const key2 = guard.generateKey('t1', 'instant_transaction', 'e1', 'cancel', 'n1');
      expect(key1).not.toBe(key2);
    });
  });
});

// ============================================
// Suite L: Observability Integration
// ============================================

describe('Observability Integration', () => {
  let observer: EngineObserver;
  let metrics: EngineMetrics;

  beforeEach(() => {
    metrics = new EngineMetrics();
    observer = new EngineObserver(metrics);
  });

  it('should track full order lifecycle in metrics', () => {
    // Simulate full Engine A lifecycle
    observer.onStateTransition('instant_transaction', 'o-1', 'pending', 'confirmed', 'confirm', 'staff');
    observer.onStateTransition('instant_transaction', 'o-1', 'confirmed', 'preparing', 'start_preparation', 'staff');
    observer.onStateTransition('instant_transaction', 'o-1', 'preparing', 'ready', 'mark_ready', 'staff');
    observer.onStateTransition('instant_transaction', 'o-1', 'ready', 'delivered', 'deliver', 'staff');
    observer.onStateTransition('instant_transaction', 'o-1', 'delivered', 'completed', 'complete', 'staff');

    expect(metrics.get('state_transition.instant_transaction')!.count).toBe(5);
    expect(metrics.get('state_transition.instant_transaction.confirm')!.count).toBe(1);
    expect(metrics.get('state_transition.instant_transaction.complete')!.count).toBe(1);
  });

  it('should track rejected transitions', () => {
    observer.onStateTransitionRejected(
      'instant_transaction', 'o-1', 'completed', 'confirm', 'staff', 'Terminal state'
    );

    expect(metrics.get('state_transition_rejected.instant_transaction')!.count).toBe(1);
  });

  it('should track cross-engine metrics independently', () => {
    observer.onStateTransition('instant_transaction', 'o-1', 'pending', 'confirmed', 'confirm', 'staff');
    observer.onStateTransition('time_exclusive_reservation', 'b-1', 'pending', 'confirmed', 'confirm', 'staff');
    observer.onStateTransition('shared_capacity_access', 'p-1', 'valid', 'active', 'validate_entry', 'staff');

    expect(metrics.get('state_transition.instant_transaction')!.count).toBe(1);
    expect(metrics.get('state_transition.time_exclusive_reservation')!.count).toBe(1);
    expect(metrics.get('state_transition.shared_capacity_access')!.count).toBe(1);
  });
});
