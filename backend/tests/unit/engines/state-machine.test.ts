/**
 * State Machine Unit Tests
 * 
 * Tests the generic state machine framework against all four engine definitions.
 * Covers: valid transitions, invalid transitions, actor permissions, terminal states,
 * guards, side effects, and error conditions.
 */

import { StateMachine, StateMachineError } from '../../../src/engines/state-machine.js';
import { instantTransactionStateMachine } from '../../../src/engines/definitions/instant-transaction.js';
import { timeExclusiveReservationStateMachine } from '../../../src/engines/definitions/time-exclusive-reservation.js';
import { sharedCapacityAccessStateMachine } from '../../../src/engines/definitions/shared-capacity-access.js';
import { ongoingEntitlementStateMachine } from '../../../src/engines/definitions/ongoing-entitlement.js';

// ============================================
// Engine A: Instant Transaction State Machine
// ============================================

describe('StateMachine - Instant Transaction (Engine A)', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine(instantTransactionStateMachine);
  });

  describe('initial state', () => {
    it('should have pending as initial state', () => {
      expect(sm.getInitialState()).toBe('pending');
    });

    it('should have completed and cancelled as terminal states', () => {
      expect(sm.isTerminal('completed')).toBe(true);
      expect(sm.isTerminal('cancelled')).toBe(true);
      expect(sm.isTerminal('pending')).toBe(false);
      expect(sm.isTerminal('preparing')).toBe(false);
    });
  });

  describe('happy path: pending → confirmed → preparing → ready → delivered → completed', () => {
    it('should transition through the full lifecycle', async () => {
      let result = await sm.transition('pending', 'confirm', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('confirmed');

      result = await sm.transition('confirmed', 'start_preparation', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('preparing');

      result = await sm.transition('preparing', 'mark_ready', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('ready');

      result = await sm.transition('ready', 'deliver', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('delivered');

      result = await sm.transition('delivered', 'complete', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('completed');
    });
  });

  describe('takeaway shortcut: ready → completed (skip delivery)', () => {
    it('should allow direct completion from ready state', async () => {
      const result = await sm.transition('ready', 'complete', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('completed');
    });
  });

  describe('cancellation paths', () => {
    it('should allow customer to cancel pending orders', async () => {
      const result = await sm.transition('pending', 'cancel', 'customer');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('cancelled');
    });

    it('should allow staff to cancel confirmed orders', async () => {
      const result = await sm.transition('confirmed', 'cancel', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('cancelled');
    });

    it('should only allow admin to cancel preparing orders', async () => {
      const result = await sm.transition('preparing', 'cancel', 'admin');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('cancelled');
    });

    it('should block staff from cancelling preparing orders', async () => {
      await expect(
        sm.transition('preparing', 'cancel', 'staff'),
      ).rejects.toThrow();
    });

    it('should block cancellation from terminal states', async () => {
      await expect(
        sm.transition('completed', 'cancel', 'admin'),
      ).rejects.toThrow();
    });
  });

  describe('invalid transitions', () => {
    it('should reject skipping states (pending → preparing)', async () => {
      await expect(
        sm.transition('pending', 'start_preparation', 'staff'),
      ).rejects.toThrow();
    });

    it('should reject backwards transitions (ready → preparing)', async () => {
      await expect(
        sm.transition('ready', 'start_preparation', 'staff'),
      ).rejects.toThrow();
    });

    it('should reject unknown actions', async () => {
      await expect(
        sm.transition('pending', 'nonexistent_action', 'staff'),
      ).rejects.toThrow();
    });

    it('should reject transitions from terminal states', async () => {
      await expect(
        sm.transition('completed', 'confirm', 'staff'),
      ).rejects.toThrow();
    });
  });

  describe('actor permissions', () => {
    it('should block customer from confirming orders', async () => {
      await expect(
        sm.transition('pending', 'confirm', 'customer'),
      ).rejects.toThrow();
    });

    it('should block customer from cancelling confirmed orders', async () => {
      await expect(
        sm.transition('confirmed', 'cancel', 'customer'),
      ).rejects.toThrow();
    });
  });

  describe('available actions', () => {
    it('should show correct actions for pending state', () => {
      const staffActions = sm.getAvailableActions('pending', 'staff');
      expect(staffActions.map(a => a.action)).toContain('confirm');
      expect(staffActions.map(a => a.action)).toContain('cancel');

      const customerActions = sm.getAvailableActions('pending', 'customer');
      expect(customerActions.map(a => a.action)).toContain('cancel');
      expect(customerActions.map(a => a.action)).not.toContain('confirm');
    });

    it('should show no actions for terminal states', () => {
      const actions = sm.getAvailableActions('completed', 'admin');
      expect(actions).toHaveLength(0);
    });
  });
});

// ============================================
// Engine B: Time-Exclusive Reservation State Machine
// ============================================

describe('StateMachine - Time-Exclusive Reservation (Engine B)', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine(timeExclusiveReservationStateMachine);
  });

  describe('happy path: pending → confirmed → checked_in → checked_out', () => {
    it('should transition through the full booking lifecycle', async () => {
      let result = await sm.transition('pending', 'confirm', 'staff');
      expect(result.newState).toBe('confirmed');

      result = await sm.transition('confirmed', 'check_in', 'staff');
      expect(result.newState).toBe('checked_in');

      result = await sm.transition('checked_in', 'check_out', 'staff');
      expect(result.newState).toBe('checked_out');
    });
  });

  describe('walk-in: pending → checked_in (skip confirmation)', () => {
    it('should allow direct check-in for walk-ins', async () => {
      const result = await sm.transition('pending', 'check_in', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('checked_in');
    });
  });

  describe('no-show handling', () => {
    it('should allow marking confirmed bookings as no-show', async () => {
      const result = await sm.transition('confirmed', 'mark_no_show', 'staff');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('no_show');
    });

    it('should allow system to auto-detect no-shows', async () => {
      const result = await sm.transition('pending', 'mark_no_show', 'system');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('no_show');
    });
  });

  describe('cancellation', () => {
    it('should allow customer cancellation of pending bookings', async () => {
      const result = await sm.transition('pending', 'cancel', 'customer');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('cancelled');
    });

    it('should block cancellation of checked-in bookings', async () => {
      await expect(
        sm.transition('checked_in', 'cancel', 'staff'),
      ).rejects.toThrow();
    });

    it('should not allow transitions out of checked_out', async () => {
      expect(sm.isTerminal('checked_out')).toBe(true);
    });
  });
});

// ============================================
// Engine C: Shared Capacity Access State Machine
// ============================================

describe('StateMachine - Shared Capacity Access (Engine C)', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine(sharedCapacityAccessStateMachine);
  });

  describe('happy path: valid → active → used', () => {
    it('should transition through the full ticket lifecycle', async () => {
      let result = await sm.transition('valid', 'validate_entry', 'staff');
      expect(result.newState).toBe('active');

      result = await sm.transition('active', 'record_exit', 'staff');
      expect(result.newState).toBe('used');
    });
  });

  describe('cancellation', () => {
    it('should allow cancellation of valid tickets', async () => {
      const result = await sm.transition('valid', 'cancel', 'customer');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('cancelled');
    });

    it('should block cancellation of active tickets (already inside)', async () => {
      await expect(
        sm.transition('active', 'cancel', 'customer'),
      ).rejects.toThrow();
    });
  });

  describe('expiration', () => {
    it('should allow system to expire unused tickets', async () => {
      const result = await sm.transition('valid', 'expire', 'system');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('expired');
    });

    it('should block manual expiration by staff', async () => {
      await expect(
        sm.transition('valid', 'expire', 'staff'),
      ).rejects.toThrow();
    });
  });

  describe('exit without entry prevention', () => {
    it('should not allow exit from valid state (must validate first)', async () => {
      await expect(
        sm.transition('valid', 'record_exit', 'staff'),
      ).rejects.toThrow();
    });
  });
});

// ============================================
// Engine D: Ongoing Entitlement State Machine
// ============================================

describe('StateMachine - Ongoing Entitlement (Engine D)', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine(ongoingEntitlementStateMachine);
  });

  describe('happy path: pending → active → renew → active', () => {
    it('should activate and renew subscriptions', async () => {
      let result = await sm.transition('pending', 'activate', 'system');
      expect(result.newState).toBe('active');

      result = await sm.transition('active', 'renew', 'system');
      expect(result.newState).toBe('active');
    });
  });

  describe('pause/resume', () => {
    it('should allow pausing and resuming', async () => {
      let result = await sm.transition('active', 'pause', 'staff');
      expect(result.newState).toBe('paused');

      result = await sm.transition('paused', 'resume', 'staff');
      expect(result.newState).toBe('active');
    });
  });

  describe('expiration', () => {
    it('should allow expiration from active but not reactivation', async () => {
      let result = await sm.transition('active', 'expire', 'system');
      expect(result.newState).toBe('expired');

      // Reactivation is not allowed from expired state
      await expect(
        sm.transition('expired', 'reactivate', 'staff')
      ).rejects.toThrow();
    });
  });

  describe('cancellation from active/paused states', () => {
    it('should allow cancellation from active', async () => {
      const result = await sm.transition('active', 'cancel', 'customer');
      expect(result.success).toBe(true);
    });

    it('should allow cancellation from paused', async () => {
      const result = await sm.transition('paused', 'cancel', 'customer');
      expect(result.success).toBe(true);
    });

    it('should block cancellation from pending', async () => {
      await expect(
        sm.transition('pending', 'cancel', 'customer'),
      ).rejects.toThrow();
    });

    it('should block cancellation from expired', async () => {
      await expect(
        sm.transition('expired', 'cancel', 'admin'),
      ).rejects.toThrow();
    });

    it('should make cancelled the only terminal state', () => {
      expect(sm.isTerminal('cancelled')).toBe(true);
      expect(sm.isTerminal('expired')).toBe(false);
      expect(sm.isTerminal('active')).toBe(false);
    });
  });
});

// ============================================
// Generic State Machine Features
// ============================================

describe('StateMachine - Generic Features', () => {
  describe('guards', () => {
    it('should block transitions when guard returns an error string', async () => {
      const sm = new StateMachine(instantTransactionStateMachine);
      
      sm.addGuard('confirm', (_transition, context) => {
        if (!context.paymentVerified) {
          return 'Payment must be verified before confirming';
        }
        return true;
      });

      await expect(
        sm.transition('pending', 'confirm', 'staff', { paymentVerified: false }),
      ).rejects.toThrow('Payment must be verified before confirming');

      const result = await sm.transition('pending', 'confirm', 'staff', { paymentVerified: true });
      expect(result.success).toBe(true);
    });

    it('should evaluate multiple guards in order', async () => {
      const sm = new StateMachine(instantTransactionStateMachine);
      
      sm.addGuard('confirm', () => true);
      sm.addGuard('confirm', (_t, ctx) => {
        if (!ctx.hasItems) return 'Order must have at least one item';
        return true;
      });

      await expect(
        sm.transition('pending', 'confirm', 'staff', { hasItems: false }),
      ).rejects.toThrow('Order must have at least one item');
    });
  });

  describe('side effects', () => {
    it('should execute side effects after successful transition', async () => {
      const sm = new StateMachine(instantTransactionStateMachine);
      const sideEffect = vi.fn().mockResolvedValue(undefined);

      sm.addSideEffect('confirm', sideEffect);

      await sm.transition('pending', 'confirm', 'staff');
      expect(sideEffect).toHaveBeenCalledTimes(1);
    });

    it('should not block transitions if side effect fails', async () => {
      const sm = new StateMachine(instantTransactionStateMachine);
      const failingSideEffect = vi.fn().mockRejectedValue(new Error('Side effect failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      sm.addSideEffect('confirm', failingSideEffect);

      const result = await sm.transition('pending', 'confirm', 'staff');
      expect(result.success).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('canTransition', () => {
    it('should return allowed=true for valid transitions', () => {
      const sm = new StateMachine(instantTransactionStateMachine);
      const check = sm.canTransition('pending', 'confirm', 'staff');
      expect(check.allowed).toBe(true);
      expect(check.targetState).toBe('confirmed');
    });

    it('should return allowed=false with error for invalid transitions', () => {
      const sm = new StateMachine(instantTransactionStateMachine);
      const check = sm.canTransition('pending', 'start_preparation', 'staff');
      expect(check.allowed).toBe(false);
      expect(check.error).toBeDefined();
    });
  });

  describe('definition validation', () => {
    it('should reject empty states list', () => {
      expect(
        () => new StateMachine({ states: [], initialState: 'x' as any, terminalStates: [], transitions: [] }),
      ).toThrow('State machine must have at least one state');
    });

    it('should reject initial state not in states list', () => {
      expect(
        () => new StateMachine({ states: ['a'], initialState: 'b' as any, terminalStates: [], transitions: [] }),
      ).toThrow("Initial state 'b' is not in the states list");
    });

    it('should reject transitions from terminal states', () => {
      expect(
        () =>
          new StateMachine({
            states: ['a', 'b'],
            initialState: 'a',
            terminalStates: ['b'],
            transitions: [{ from: 'b', to: 'a', action: 'revert', allowedActors: ['staff'] }],
          }),
      ).toThrow("Terminal state 'b' cannot have outgoing transitions");
    });
  });
});
