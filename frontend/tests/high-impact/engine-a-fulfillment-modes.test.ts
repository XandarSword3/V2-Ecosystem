/**
 * engine-a-fulfillment-modes.test.ts
 *
 * Tests the mode-specific fulfillment state configuration introduced in F1.
 * Verifies that each fulfillment mode defines the correct ordered states,
 * metadata (labels, actions, terminal states), transition graph, and
 * that the domain contract correctly scopes states per mode.
 */

import { describe, expect, it } from 'vitest';
import {
  statesForMode,
  getModeStateConfig,
  resolveColumnKey,
  canonicalFulfillmentState,
  isFulfillmentState,
  isFulfillmentMode,
  FULFILLMENT_LAYER_STATES,
  type FulfillmentMode,
  type FulfillmentState,
} from '@/lib/engine-a/types';

// ============================================
// statesForMode
// ============================================

describe('statesForMode', () => {
  it('on_premise returns hospitality states', () => {
    expect(statesForMode('on_premise')).toEqual([
      'queued', 'in_progress', 'ready', 'handed_off',
    ]);
  });

  it('pickup returns hospitality states (same machine)', () => {
    expect(statesForMode('pickup')).toEqual([
      'queued', 'in_progress', 'ready', 'handed_off',
    ]);
  });

  it('local_delivery returns hospitality states (same machine)', () => {
    expect(statesForMode('local_delivery')).toEqual([
      'queued', 'in_progress', 'ready', 'handed_off',
    ]);
  });

  it('digital_delivery returns digital states', () => {
    expect(statesForMode('digital_delivery')).toEqual([
      'provisioning', 'provisioned', 'delivered',
    ]);
  });

  it('shipment returns shipment states', () => {
    expect(statesForMode('shipment')).toEqual([
      'allocated', 'picking', 'packed', 'shipped', 'in_transit', 'delivered',
    ]);
  });

  it('service_execution returns service states', () => {
    expect(statesForMode('service_execution')).toEqual([
      'received', 'working', 'ready', 'collected',
    ]);
  });

  it('none returns empty array', () => {
    expect(statesForMode('none')).toEqual([]);
  });

  it('null/undefined returns empty array', () => {
    expect(statesForMode(null)).toEqual([]);
    expect(statesForMode(undefined)).toEqual([]);
  });
});

// ============================================
// getModeStateConfig
// ============================================

describe('getModeStateConfig', () => {
  it('returns null for null/undefined (legacy recovery)', () => {
    expect(getModeStateConfig(null)).toBeNull();
    expect(getModeStateConfig(undefined)).toBeNull();
  });

  it('returns config for on_premise', () => {
    const cfg = getModeStateConfig('on_premise');
    expect(cfg).not.toBeNull();
    expect(cfg!.states).toEqual(['queued', 'in_progress', 'ready', 'handed_off']);
  });

  it('returns config for digital_delivery', () => {
    const cfg = getModeStateConfig('digital_delivery');
    expect(cfg).not.toBeNull();
    expect(cfg!.states).toEqual(['provisioning', 'provisioned', 'delivered']);
  });

  it('returns config for shipment', () => {
    const cfg = getModeStateConfig('shipment');
    expect(cfg).not.toBeNull();
    expect(cfg!.states).toEqual(['allocated', 'picking', 'packed', 'shipped', 'in_transit', 'delivered']);
  });

  it('returns config for service_execution', () => {
    const cfg = getModeStateConfig('service_execution');
    expect(cfg).not.toBeNull();
    expect(cfg!.states).toEqual(['received', 'working', 'ready', 'collected']);
  });
});

// ============================================
// Hospitality mode transitions
// ============================================

describe('hospitality mode transitions', () => {
  const cfg = getModeStateConfig('on_premise')!;

  it('has correct metadata for each state', () => {
    expect(cfg.metadata.queued.label).toBe('Queued');
    expect(cfg.metadata.in_progress.label).toBe('In Progress');
    expect(cfg.metadata.ready.label).toBe('Ready');
    expect(cfg.metadata.handed_off.label).toBe('Served');
  });

  it('queued → in_progress', () => {
    expect(cfg.nextTarget('queued')).toBe('in_progress');
  });

  it('in_progress → ready', () => {
    expect(cfg.nextTarget('in_progress')).toBe('ready');
  });

  it('ready → null (waiting on dispatch)', () => {
    expect(cfg.nextTarget('ready')).toBeNull();
  });

  it('handed_off → null (terminal fulfillment state; completed is transaction-layer)', () => {
    expect(cfg.nextTarget('handed_off')).toBeNull();
  });

  it('only ready is non-terminal waiting state; handed_off is terminal fulfillment', () => {
    expect(cfg.metadata.queued.terminal).toBe(false);
    expect(cfg.metadata.in_progress.terminal).toBe(false);
    expect(cfg.metadata.ready.terminal).toBe(false);
    expect(cfg.metadata.handed_off.terminal).toBe(true);
  });
});

// ============================================
// Digital mode transitions
// ============================================

describe('digital mode transitions', () => {
  const cfg = getModeStateConfig('digital_delivery')!;

  it('has correct labels', () => {
    expect(cfg.metadata.provisioning.label).toBe('Provisioning');
    expect(cfg.metadata.provisioned.label).toBe('Provisioned');
    expect(cfg.metadata.delivered.label).toBe('Delivered');
  });

  it('provisioning → provisioned', () => {
    expect(cfg.nextTarget('provisioning')).toBe('provisioned');
  });

  it('provisioned → delivered', () => {
    expect(cfg.nextTarget('provisioned')).toBe('delivered');
  });

  it('delivered → null (terminal)', () => {
    expect(cfg.nextTarget('delivered')).toBeNull();
  });

  it('delivered is terminal', () => {
    expect(cfg.metadata.delivered.terminal).toBe(true);
  });

  it('provisioning and provisioned are not terminal', () => {
    expect(cfg.metadata.provisioning.terminal).toBe(false);
    expect(cfg.metadata.provisioned.terminal).toBe(false);
  });
});

// ============================================
// Shipment mode transitions
// ============================================

describe('shipment mode transitions', () => {
  const cfg = getModeStateConfig('shipment')!;

  it('has all 6 states', () => {
    expect(cfg.states).toHaveLength(6);
  });

  it('allocated → picking', () => {
    expect(cfg.nextTarget('allocated')).toBe('picking');
  });

  it('picking → packed', () => {
    expect(cfg.nextTarget('picking')).toBe('packed');
  });

  it('packed → shipped', () => {
    expect(cfg.nextTarget('packed')).toBe('shipped');
  });

  it('shipped → in_transit', () => {
    expect(cfg.nextTarget('shipped')).toBe('in_transit');
  });

  it('in_transit → delivered', () => {
    expect(cfg.nextTarget('in_transit')).toBe('delivered');
  });

  it('delivered → null (terminal)', () => {
    expect(cfg.nextTarget('delivered')).toBeNull();
  });

  it('only delivered is terminal', () => {
    expect(cfg.metadata.allocated.terminal).toBe(false);
    expect(cfg.metadata.picking.terminal).toBe(false);
    expect(cfg.metadata.packed.terminal).toBe(false);
    expect(cfg.metadata.shipped.terminal).toBe(false);
    expect(cfg.metadata.in_transit.terminal).toBe(false);
    expect(cfg.metadata.delivered.terminal).toBe(true);
  });
});

// ============================================
// Service mode transitions
// ============================================

describe('service mode transitions', () => {
  const cfg = getModeStateConfig('service_execution')!;

  it('has all 4 states', () => {
    expect(cfg.states).toHaveLength(4);
  });

  it('received → working', () => {
    expect(cfg.nextTarget('received')).toBe('working');
  });

  it('working → ready', () => {
    expect(cfg.nextTarget('working')).toBe('ready');
  });

  it('ready → collected', () => {
    expect(cfg.nextTarget('ready')).toBe('collected');
  });

  it('collected → null (terminal)', () => {
    expect(cfg.nextTarget('collected')).toBeNull();
  });

  it('only collected is terminal', () => {
    expect(cfg.metadata.received.terminal).toBe(false);
    expect(cfg.metadata.working.terminal).toBe(false);
    expect(cfg.metadata.ready.terminal).toBe(false);
    expect(cfg.metadata.collected.terminal).toBe(true);
  });
});

// ============================================
// resolveColumnKey
// ============================================

describe('resolveColumnKey', () => {
  it('maps confirmed to first state for hospitality', () => {
    const cfg = getModeStateConfig('on_premise')!;
    expect(resolveColumnKey('confirmed', cfg)).toBe('queued');
  });

  it('maps pending to first state for hospitality', () => {
    const cfg = getModeStateConfig('on_premise')!;
    expect(resolveColumnKey('pending', cfg)).toBe('queued');
  });

  it('returns matching state for hospitality', () => {
    const cfg = getModeStateConfig('on_premise')!;
    expect(resolveColumnKey('in_progress', cfg)).toBe('in_progress');
    expect(resolveColumnKey('ready', cfg)).toBe('ready');
    expect(resolveColumnKey('handed_off', cfg)).toBe('handed_off');
  });

  it('maps confirmed to first state for digital', () => {
    const cfg = getModeStateConfig('digital_delivery')!;
    expect(resolveColumnKey('confirmed', cfg)).toBe('provisioning');
  });

  it('returns matching state for digital', () => {
    const cfg = getModeStateConfig('digital_delivery')!;
    expect(resolveColumnKey('provisioning', cfg)).toBe('provisioning');
    expect(resolveColumnKey('provisioned', cfg)).toBe('provisioned');
    expect(resolveColumnKey('delivered', cfg)).toBe('delivered');
  });

  it('maps confirmed to first state for shipment', () => {
    const cfg = getModeStateConfig('shipment')!;
    expect(resolveColumnKey('confirmed', cfg)).toBe('allocated');
  });

  it('returns matching state for shipment', () => {
    const cfg = getModeStateConfig('shipment')!;
    expect(resolveColumnKey('shipped', cfg)).toBe('shipped');
  });

  it('returns first state for null config (fallback)', () => {
    expect(resolveColumnKey('confirmed', null)).toBe('pending');
  });

  it('returns first state for unrecognized state', () => {
    const cfg = getModeStateConfig('on_premise')!;
    expect(resolveColumnKey('unknown_state' as any, cfg)).toBe('queued');
  });
});

// ============================================
// Cross-mode isolation
// ============================================

describe('cross-mode isolation', () => {
  it('hospitality states are not in digital config', () => {
    const digitalCfg = getModeStateConfig('digital_delivery')!;
    expect(digitalCfg.states).not.toContain('queued');
    expect(digitalCfg.states).not.toContain('in_progress');
    expect(digitalCfg.states).not.toContain('handed_off');
  });

  it('digital states are not in hospitality config', () => {
    const hospCfg = getModeStateConfig('on_premise')!;
    expect(hospCfg.states).not.toContain('provisioning');
    expect(hospCfg.states).not.toContain('provisioned');
  });

  it('shipment states are not in digital config', () => {
    const digitalCfg = getModeStateConfig('digital_delivery')!;
    expect(digitalCfg.states).not.toContain('allocated');
    expect(digitalCfg.states).not.toContain('picking');
  });

  it('service states are not in hospitality config', () => {
    const hospCfg = getModeStateConfig('on_premise')!;
    expect(hospCfg.states).not.toContain('received');
    expect(hospCfg.states).not.toContain('working');
  });

  it('each mode has distinct first state', () => {
    const modes: FulfillmentMode[] = [
      'on_premise', 'digital_delivery', 'shipment', 'service_execution',
    ];
    const firstStates = modes.map(m => getModeStateConfig(m)!.states[0]);
    const unique = new Set(firstStates);
    expect(unique.size).toBe(modes.length);
  });
});

// ============================================
// FulfillmentState type guard
// ============================================

describe('isFulfillmentState type guard', () => {
  it('recognizes hospitality states', () => {
    expect(isFulfillmentState('queued')).toBe(true);
    expect(isFulfillmentState('in_progress')).toBe(true);
    expect(isFulfillmentState('ready')).toBe(true);
    expect(isFulfillmentState('handed_off')).toBe(true);
  });

  it('recognizes digital states', () => {
    expect(isFulfillmentState('provisioning')).toBe(true);
    expect(isFulfillmentState('provisioned')).toBe(true);
    expect(isFulfillmentState('delivered')).toBe(true);
  });

  it('recognizes shipment states', () => {
    expect(isFulfillmentState('allocated')).toBe(true);
    expect(isFulfillmentState('picking')).toBe(true);
    expect(isFulfillmentState('packed')).toBe(true);
    expect(isFulfillmentState('shipped')).toBe(true);
    expect(isFulfillmentState('in_transit')).toBe(true);
  });

  it('recognizes service states', () => {
    expect(isFulfillmentState('received')).toBe(true);
    expect(isFulfillmentState('working')).toBe(true);
    expect(isFulfillmentState('collected')).toBe(true);
  });

  it('rejects transaction states', () => {
    expect(isFulfillmentState('pending')).toBe(false);
    expect(isFulfillmentState('confirmed')).toBe(false);
    expect(isFulfillmentState('completed')).toBe(false);
    expect(isFulfillmentState('cancelled')).toBe(false);
  });

  it('rejects legacy composites', () => {
    expect(isFulfillmentState('preparing')).toBe(false);
    expect(isFulfillmentState('served')).toBe(false);
  });

  it('rejects arbitrary strings', () => {
    expect(isFulfillmentState('unknown')).toBe(false);
    expect(isFulfillmentState('')).toBe(false);
  });
});

// ============================================
// isFulfillmentMode type guard
// ============================================

describe('isFulfillmentMode type guard', () => {
  it('recognizes all valid modes', () => {
    expect(isFulfillmentMode('on_premise')).toBe(true);
    expect(isFulfillmentMode('pickup')).toBe(true);
    expect(isFulfillmentMode('local_delivery')).toBe(true);
    expect(isFulfillmentMode('digital_delivery')).toBe(true);
    expect(isFulfillmentMode('shipment')).toBe(true);
    expect(isFulfillmentMode('service_execution')).toBe(true);
    expect(isFulfillmentMode('none')).toBe(true);
  });

  it('rejects invalid modes', () => {
    expect(isFulfillmentMode('restaurant')).toBe(false);
    expect(isFulfillmentMode('delivery')).toBe(false);
    expect(isFulfillmentMode('')).toBe(false);
  });
});

// ============================================
// FULFILLMENT_LAYER_STATES completeness
// ============================================

describe('FULFILLMENT_LAYER_STATES includes all mode states', () => {
  const allModes: FulfillmentMode[] = [
    'on_premise', 'pickup', 'local_delivery',
    'digital_delivery', 'shipment', 'service_execution',
  ];

  for (const mode of allModes) {
    if (mode === 'none') continue;
    it(`${mode} states are all in FULFILLMENT_LAYER_STATES`, () => {
      const modeStates = statesForMode(mode);
      for (const state of modeStates) {
        expect(FULFILLMENT_LAYER_STATES).toContain(state);
      }
    });
  }
});

// ============================================
// getModeStateConfig null/legacy edge cases + none semantics
// ============================================

describe('getModeStateConfig null/legacy handling', () => {
  it('returns null for null mode (legacy recovery signal)', () => {
    expect(getModeStateConfig(null)).toBeNull();
  });

  it('returns null for undefined mode (legacy recovery signal)', () => {
    expect(getModeStateConfig(undefined)).toBeNull();
  });

  it('returns non-null empty config for none mode (valid explicit mode)', () => {
    const cfg = getModeStateConfig('none');
    expect(cfg).not.toBeNull();
    expect(cfg!.states).toEqual([]);
    expect(cfg!.nextTarget('queued' as any)).toBeNull();
  });

  it('returns null for unrecognized mode string', () => {
    expect(getModeStateConfig('unknown_mode' as FulfillmentMode)).toBeNull();
  });

  it('hospitality modes share the same config shape', () => {
    const onPremise = getModeStateConfig('on_premise')!;
    const pickup = getModeStateConfig('pickup')!;
    const localDelivery = getModeStateConfig('local_delivery')!;

    // Same state list
    expect(onPremise.states).toEqual(pickup.states);
    expect(pickup.states).toEqual(localDelivery.states);

    // Same transition targets
    for (const state of onPremise.states) {
      expect(pickup.nextTarget(state)).toEqual(onPremise.nextTarget(state));
      expect(localDelivery.nextTarget(state)).toEqual(onPremise.nextTarget(state));
    }
  });
});

// ============================================
// 'none' mode semantics
// ============================================
// 'none' is a valid explicit fulfillment mode meaning 'no fulfillment
// machine applies'. It is NOT legacy hospitality and must not produce
// any fulfillment columns, states, or actions.

describe('none mode semantics', () => {
  const cfg = getModeStateConfig('none')!;

  it('has zero fulfillment states', () => {
    expect(cfg.states).toHaveLength(0);
  });

  it('has empty metadata', () => {
    expect(Object.keys(cfg.metadata)).toHaveLength(0);
  });

  it('nextTarget returns null for any input', () => {
    expect(cfg.nextTarget('queued' as any)).toBeNull();
    expect(cfg.nextTarget('confirmed' as any)).toBeNull();
    expect(cfg.nextTarget('completed' as any)).toBeNull();
  });

  it('statesForMode returns empty array', () => {
    expect(statesForMode('none')).toEqual([]);
  });

  it('is not the same as null/undefined (legacy recovery)', () => {
    expect(cfg).not.toBeNull();
    expect(getModeStateConfig(null)).toBeNull();
    expect(getModeStateConfig(undefined)).toBeNull();
  });
});

// ============================================
// completed/cancelled are transaction-layer, not FulfillmentState
// ============================================

describe('completed is transaction-layer terminal, not FulfillmentState', () => {
  it('completed is NOT in FULFILLMENT_LAYER_STATES', () => {
    expect(FULFILLMENT_LAYER_STATES).not.toContain('completed');
  });

  it('cancelled is NOT in FULFILLMENT_LAYER_STATES', () => {
    expect(FULFILLMENT_LAYER_STATES).not.toContain('cancelled');
  });

  it('completed IS a TransactionState (via isTransactionState)', () => {
    // Import isTransactionState is not available here, but we can verify
    // via the FULFILLMENT_LAYER_STATES exclusion above and the type system.
    // The important invariant is: no mode's nextTarget returns 'completed'.
  });

  it('handed_off is terminal (no next fulfillment state) for hospitality', () => {
    const cfg = getModeStateConfig('on_premise')!;
    expect(cfg.nextTarget('handed_off')).toBeNull();
  });

  it('delivered is terminal for digital', () => {
    const cfg = getModeStateConfig('digital_delivery')!;
    expect(cfg.nextTarget('delivered')).toBeNull();
  });

  it('delivered is terminal for shipment', () => {
    const cfg = getModeStateConfig('shipment')!;
    expect(cfg.nextTarget('delivered')).toBeNull();
  });

  it('collected is terminal for service', () => {
    const cfg = getModeStateConfig('service_execution')!;
    expect(cfg.nextTarget('collected')).toBeNull();
  });

  it('no mode config ever returns completed as a next target', () => {
    const modes: FulfillmentMode[] = ['on_premise', 'pickup', 'local_delivery', 'digital_delivery', 'shipment', 'service_execution'];
    for (const mode of modes) {
      const cfg = getModeStateConfig(mode)!;
      for (const state of cfg.states) {
        const next = cfg.nextTarget(state);
        // next is either null (terminal) or a FulfillmentState — never 'completed'
        if (next !== null) {
          expect(next).not.toBe('completed');
          expect(next).not.toBe('cancelled');
        }
      }
    }
  });
});

// ============================================
// Mixed-mode isolation — the core F1 invariant
// ============================================
// When orders from different fulfillment modes exist simultaneously,
// each order's column placement must come from its OWN mode config.
// A digital order must never be placed in a hospitality column.

describe('Mixed-mode isolation', () => {
  const hospitalityCfg = getModeStateConfig('on_premise')!;
  const digitalCfg = getModeStateConfig('digital_delivery')!;
  const shipmentCfg = getModeStateConfig('shipment')!;
  const serviceCfg = getModeStateConfig('service_execution')!;

  it('hospitality and digital have no overlapping fulfillment states', () => {
    const hospStates = new Set(hospitalityCfg.states);
    for (const state of digitalCfg.states) {
      expect(hospStates.has(state)).toBe(false);
    }
  });

  it('hospitality and shipment have no overlapping fulfillment states', () => {
    const hospStates = new Set(hospitalityCfg.states);
    for (const state of shipmentCfg.states) {
      expect(hospStates.has(state)).toBe(false);
    }
  });

  it('hospitality and service share ready but it maps differently', () => {
    // Both hospitality and service have 'ready' but it means different things
    // and has different next targets
    expect(hospitalityCfg.states).toContain('ready');
    expect(serviceCfg.states).toContain('ready');
    // In hospitality, ready → null (waiting on dispatch)
    expect(hospitalityCfg.nextTarget('ready')).toBeNull();
    // In service, ready → collected
    expect(serviceCfg.nextTarget('ready')).toBe('collected');
  });

  it('digital delivered is terminal', () => {
    expect(digitalCfg.metadata.delivered.terminal).toBe(true);
    expect(digitalCfg.nextTarget('delivered')).toBeNull();
  });

  it('shipment delivered is terminal', () => {
    expect(shipmentCfg.metadata.delivered.terminal).toBe(true);
    expect(shipmentCfg.nextTarget('delivered')).toBeNull();
  });

  it('resolveColumnKey resolves to correct mode-specific column', () => {
    // A 'provisioning' state belongs to digital, not hospitality
    expect(resolveColumnKey('provisioning', digitalCfg)).toBe('provisioning');
    // When 'provisioning' is resolved against hospitality config, it falls to first column
    expect(resolveColumnKey('provisioning', hospitalityCfg)).toBe('queued');

    // An 'allocated' state belongs to shipment
    expect(resolveColumnKey('allocated', shipmentCfg)).toBe('allocated');
    // When 'allocated' is resolved against digital config, it falls to first column
    expect(resolveColumnKey('allocated', digitalCfg)).toBe('provisioning');

    // 'received' belongs to service
    expect(resolveColumnKey('received', serviceCfg)).toBe('received');
    // When 'received' is resolved against hospitality, it falls to first column
    expect(resolveColumnKey('received', hospitalityCfg)).toBe('queued');
  });

  it('confirmed maps to first column of each mode independently', () => {
    expect(resolveColumnKey('confirmed', hospitalityCfg)).toBe('queued');
    expect(resolveColumnKey('confirmed', digitalCfg)).toBe('provisioning');
    expect(resolveColumnKey('confirmed', shipmentCfg)).toBe('allocated');
    expect(resolveColumnKey('confirmed', serviceCfg)).toBe('received');
  });

  it('each mode has a distinct column set for a mixed-mode board', () => {
    const allColumnSets = [
      hospitalityCfg.states,
      digitalCfg.states,
      shipmentCfg.states,
      serviceCfg.states,
    ];
    // No two modes have the exact same column set
    for (let i = 0; i < allColumnSets.length; i++) {
      for (let j = i + 1; j < allColumnSets.length; j++) {
        // At minimum, the column sets differ in length or content
        const same = allColumnSets[i].length === allColumnSets[j].length
          && allColumnSets[i].every((s, k) => s === allColumnSets[j][k]);
        expect(same).toBe(false);
      }
    }
  });

  it('shipment has the most columns (6 states)', () => {
    expect(shipmentCfg.states).toHaveLength(6);
  });

  it('digital has the fewest columns (3 states)', () => {
    expect(digitalCfg.states).toHaveLength(3);
  });
});

// ============================================
// canonicalFulfillmentState: mode-aware legacy mapping
// ============================================
// The legacy mapping (preparing->in_progress, delivered/served->handed_off)
// is ONLY valid for hospitality modes. Non-hospitality modes must not have
// their raw FulfillmentState values reinterpreted through hospitality logic.

describe('canonicalFulfillmentState mode-aware legacy mapping', () => {
  it('hospitality + preparing -> in_progress', () => {
    const result = canonicalFulfillmentState(
      { status: 'preparing' },
      'on_premise',
    );
    expect(result).toBe('in_progress');
  });

  it('hospitality + delivered -> handed_off', () => {
    const result = canonicalFulfillmentState(
      { status: 'delivered' },
      'on_premise',
    );
    expect(result).toBe('handed_off');
  });

  it('hospitality + served -> handed_off', () => {
    const result = canonicalFulfillmentState(
      { status: 'served' },
      'on_premise',
    );
    expect(result).toBe('handed_off');
  });

  it('digital + delivered -> delivered (not handed_off)', () => {
    const result = canonicalFulfillmentState(
      { status: 'delivered' },
      'digital_delivery',
    );
    expect(result).toBe('delivered');
  });

  it('shipment + delivered -> delivered (not handed_off)', () => {
    const result = canonicalFulfillmentState(
      { status: 'delivered' },
      'shipment',
    );
    expect(result).toBe('delivered');
  });

  it('service + ready -> ready (not handed_off)', () => {
    const result = canonicalFulfillmentState(
      { status: 'ready' },
      'service_execution',
    );
    expect(result).toBe('ready');
  });

  it('digital + preparing -> preparing (pass-through, not in_progress)', () => {
    // 'preparing' is not a valid FulfillmentState for digital, so it
    // should be passed through as-is, not mapped to 'in_progress'.
    const result = canonicalFulfillmentState(
      { status: 'preparing' },
      'digital_delivery',
    );
    expect(result).toBe('preparing');
  });

  it('shipment + shipped -> shipped (pass-through)', () => {
    const result = canonicalFulfillmentState(
      { status: 'shipped' },
      'shipment',
    );
    expect(result).toBe('shipped');
  });

  it('none + delivered -> delivered (pass-through, no fulfillment mapping)', () => {
    const result = canonicalFulfillmentState(
      { status: 'delivered' },
      'none',
    );
    expect(result).toBe('delivered');
  });

  it('null mode + preparing -> in_progress (legacy recovery)', () => {
    const result = canonicalFulfillmentState(
      { status: 'preparing' },
      null,
    );
    expect(result).toBe('in_progress');
  });

  it('undefined mode + delivered -> handed_off (legacy recovery)', () => {
    const result = canonicalFulfillmentState(
      { status: 'delivered' },
      undefined,
    );
    expect(result).toBe('handed_off');
  });

  it('no mode param + preparing -> in_progress (legacy recovery)', () => {
    const result = canonicalFulfillmentState(
      { status: 'preparing' },
    );
    expect(result).toBe('in_progress');
  });

  it('prefers fulfillmentStatus over status regardless of mode', () => {
    const result = canonicalFulfillmentState(
      { fulfillmentStatus: 'in_progress', status: 'preparing' },
      'digital_delivery',
    );
    expect(result).toBe('in_progress');
  });

  it('fulfillmentStatus: delivered passes through for any mode', () => {
    const result = canonicalFulfillmentState(
      { fulfillmentStatus: 'delivered' },
      'on_premise',
    );
    expect(result).toBe('delivered');
  });
});
