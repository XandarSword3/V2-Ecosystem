/**
 * Engine Registry Unit Tests
 * 
 * Tests the engine registry lookups, template→engine mappings,
 * and all engine definition validations.
 */

import {
  getEngine,
  getEngineByTemplate,
  createStateMachine,
  createStateMachineByTemplate,
  getAllEngineTypes,
  getAllEngines,
  isValidTemplateType,
  resolveEngineType,
} from '../../../src/engines/registry.js';
import { LEGAL_FULFILLMENT_COMBINATIONS } from '../../../src/engines/fulfillment-contract.js';
import type { EngineType } from '../../../../shared/types/engines.js';

describe('Engine Registry', () => {
  describe('getEngine', () => {
    it('should return engine A for instant_transaction', () => {
      const engine = getEngine('instant_transaction');
      expect(engine.type).toBe('instant_transaction');
      expect(engine.name).toBe('Instant Transaction');
      expect(engine.commercialEntity).toBe('order');
    });

    it('should return engine B for time_exclusive_reservation', () => {
      const engine = getEngine('time_exclusive_reservation');
      expect(engine.type).toBe('time_exclusive_reservation');
      expect(engine.name).toBe('Time-Exclusive Reservation');
      expect(engine.commercialEntity).toBe('booking');
    });

    it('should return engine C for shared_capacity_access', () => {
      const engine = getEngine('shared_capacity_access');
      expect(engine.type).toBe('shared_capacity_access');
      expect(engine.name).toBe('Shared Capacity Access');
      expect(engine.commercialEntity).toBe('ticket');
    });

    it('should return engine D for ongoing_entitlement', () => {
      const engine = getEngine('ongoing_entitlement');
      expect(engine.type).toBe('ongoing_entitlement');
      expect(engine.name).toBe('Ongoing Entitlement');
      expect(engine.commercialEntity).toBe('subscription');
    });

    it('should throw for unknown engine type', () => {
      expect(() => getEngine('nonexistent' as EngineType)).toThrow('Unknown engine type');
    });
  });

  describe('getEngineByTemplate', () => {
    it('should map menu_service → instant_transaction', () => {
      const engine = getEngineByTemplate('menu_service');
      expect(engine.type).toBe('instant_transaction');
    });

    it('should map multi_day_booking → time_exclusive_reservation', () => {
      const engine = getEngineByTemplate('multi_day_booking');
      expect(engine.type).toBe('time_exclusive_reservation');
    });

    it('should map session_access → shared_capacity_access', () => {
      const engine = getEngineByTemplate('session_access');
      expect(engine.type).toBe('shared_capacity_access');
    });

    it('should map subscription → ongoing_entitlement', () => {
      const engine = getEngineByTemplate('subscription');
      expect(engine.type).toBe('ongoing_entitlement');
    });

    it('should throw for unknown template type', () => {
      expect(() => getEngineByTemplate('unknown_template')).toThrow('Unknown template type');
    });
  });

  describe('createStateMachine', () => {
    it('should create a working state machine for each engine', () => {
      const engines: EngineType[] = [
        'instant_transaction',
        'time_exclusive_reservation',
        'shared_capacity_access',
        'ongoing_entitlement',
        'platform_entitlement',
      ];

      for (const engineType of engines) {
        const sm = createStateMachine(engineType);
        expect(sm.getInitialState()).toBeDefined();
        expect(sm.getStates().length).toBeGreaterThan(0);
      }
    });
  });

  describe('createStateMachineByTemplate', () => {
    it('should create state machine from template type', () => {
      const sm = createStateMachineByTemplate('menu_service');
      expect(sm.getInitialState()).toBe('pending');
    });
  });

  describe('getAllEngineTypes', () => {
    it('should return the canonical five registered engine types (digital delivery is a MODE of Engine A, not an engine)', () => {
      const types = getAllEngineTypes();
      expect(types).toHaveLength(5);
      expect(types).toContain('instant_transaction');
      expect(types).toContain('time_exclusive_reservation');
      expect(types).toContain('shared_capacity_access');
      expect(types).toContain('ongoing_entitlement');
      expect(types).toContain('platform_entitlement');
      expect(types).not.toContain('digital_delivery');
    });
  });

  describe('Architecture invariant — fulfillment modes are never engine types', () => {
    it('the engine registry contains EXACTLY the canonical five engines (no additions during Engine A work)', () => {
      expect(getAllEngineTypes().sort()).toEqual([
        'instant_transaction',
        'ongoing_entitlement',
        'platform_entitlement',
        'shared_capacity_access',
        'time_exclusive_reservation',
      ]);
    });

    it('no fulfillment MODE — including future ones — may ever be an EngineType', () => {
      // Every value in the generic mode registry (pickup, on_premise,
      // local_delivery, shipment, digital_delivery, service_execution, …) is
      // a FULFILLMENT MODE. If one ever appears as an engine type, that is
      // the exact mistake this phase removed — fail the suite. This is what
      // prevents a future 'shipment' or 'service_execution' engine from
      // sneaking in.
      const engineTypes = new Set(getAllEngineTypes());
      for (const mode of Object.keys(LEGAL_FULFILLMENT_COMBINATIONS)) {
        expect(
          engineTypes.has(mode as EngineType),
          `fulfillment mode '${mode}' must never be an engine type`,
        ).toBe(false);
      }
    });
  });

  describe('getAllEngines', () => {
    it('should return all registered engine definitions', () => {
      const engines = getAllEngines();
      expect(engines).toHaveLength(5);
      expect(engines.map(e => e.type)).not.toContain('digital_delivery');
    });

    it('should have complete definitions (state machine + pricing + interactions)', () => {
      const engines = getAllEngines();
      for (const engine of engines) {
        expect(engine.stateMachine).toBeDefined();
        expect(engine.stateMachine.states.length).toBeGreaterThan(0);
        expect(engine.stateMachine.transitions.length).toBeGreaterThan(0);
        expect(engine.pricing).toBeDefined();
        expect(engine.interactions).toBeDefined();
        expect(engine.interactions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isValidTemplateType', () => {
    it('should return true for valid template types', () => {
      expect(isValidTemplateType('menu_service')).toBe(true);
      expect(isValidTemplateType('multi_day_booking')).toBe(true);
      expect(isValidTemplateType('session_access')).toBe(true);
      expect(isValidTemplateType('subscription')).toBe(true);
    });

    it('should return false for invalid template types', () => {
      expect(isValidTemplateType('custom')).toBe(false);
      expect(isValidTemplateType('unknown')).toBe(false);
      expect(isValidTemplateType('')).toBe(false);
    });
  });

  describe('resolveEngineType', () => {
    it('should return engine type for valid template', () => {
      expect(resolveEngineType('menu_service')).toBe('instant_transaction');
    });

    it('should return undefined for invalid template', () => {
      expect(resolveEngineType('unknown')).toBeUndefined();
    });
  });
});

// ============================================
// Engine Definition Consistency Checks
// ============================================

describe('Engine Definition Consistency', () => {
  it('should have all engine types referenced in TEMPLATE_TO_ENGINE', () => {
    const allTypes = getAllEngineTypes();
    const engines = getAllEngines();

    for (const engine of engines) {
      expect(allTypes).toContain(engine.type);
    }
  });

  it('should have unique commercial entities per engine', () => {
    const engines = getAllEngines();
    const entities = engines.map(e => e.commercialEntity);
    const unique = [...new Set(entities)];
    expect(entities.length).toBe(unique.length);
  });

  it('should have valid state machine definitions (no terminal states with outgoing transitions)', () => {
    const engines = getAllEngines();
    for (const engine of engines) {
      const { terminalStates, transitions } = engine.stateMachine;
      for (const t of transitions) {
        expect(terminalStates).not.toContain(t.from);
      }
    }
  });

  it('should have all transition states in the states list', () => {
    const engines = getAllEngines();
    for (const engine of engines) {
      const { states, transitions } = engine.stateMachine;
      for (const t of transitions) {
        expect(states).toContain(t.from);
        expect(states).toContain(t.to);
      }
    }
  });
});
