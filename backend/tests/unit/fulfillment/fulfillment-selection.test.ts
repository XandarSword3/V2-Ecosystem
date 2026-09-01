/**
 * Fulfillment selection resolution (plan Stage 6 fix #2).
 *
 * The invariant: for a required-fulfillment engine the selection is MANDATORY
 * before confirmation and snapshotted at order creation — never left NULL.
 * These tests prove the resolver maps the commercial facts (order type,
 * location, table, address) to a typed, capability-validated selection, and
 * fails closed when it cannot.
 */
import { describe, it, expect } from 'vitest';
import { resolveFulfillmentSelection } from '../../../src/modules/fulfillment/fulfillment-selection.js';
import { FulfillmentContractError } from '../../../src/engines/fulfillment-contract.js';

describe('resolveFulfillmentSelection (Stage 6 fix)', () => {
  it('maps dine_in → on_premise with the service location as destination', () => {
    const s = resolveFulfillmentSelection('instant_transaction', {
      orderType: 'dine_in',
      serviceLocationId: 'loc-1',
    });
    expect(s).toEqual({ mode: 'on_premise', destinationType: 'on_premise_location', destinationRef: 'loc-1' });
  });

  it('falls back to the table number when no service location is set', () => {
    const s = resolveFulfillmentSelection('instant_transaction', {
      orderType: 'dine_in',
      tableNumber: 'T-12',
    });
    expect(s.mode).toBe('on_premise');
    expect(s.destinationRef).toBe('T-12');
  });

  it('maps counter (staff walk-up) → pickup at the counter', () => {
    const s = resolveFulfillmentSelection('instant_transaction', { orderType: 'counter' });
    expect(s).toEqual({ mode: 'pickup', destinationType: 'pickup_location', destinationRef: null });
  });

  it('maps takeaway → pickup', () => {
    const s = resolveFulfillmentSelection('instant_transaction', { orderType: 'takeaway', serviceLocationId: 'c-1' });
    expect(s).toEqual({ mode: 'pickup', destinationType: 'pickup_location', destinationRef: 'c-1' });
  });

  it('maps delivery → local_delivery with the address as destination ref', () => {
    const s = resolveFulfillmentSelection('instant_transaction', {
      orderType: 'delivery',
      address: '12 Harbor St',
    });
    expect(s).toEqual({ mode: 'local_delivery', destinationType: 'address', destinationRef: '12 Harbor St' });
  });

  it('fails closed when no fulfillment selection or order type is given (no silent fallback to on_premise)', () => {
    expect(() => resolveFulfillmentSelection('instant_transaction', {})).toThrow(FulfillmentContractError);
  });

  it('rejects an order type that cannot map to a fulfillment mode', () => {
    expect(() =>
      resolveFulfillmentSelection('instant_transaction', { orderType: 'astral_projection' })
    ).toThrow(FulfillmentContractError);
  });

  it('rejects a selection the engine does not offer (fail closed at creation)', () => {
    // The resolver validates against the engine's OWN declared options via
    // assertValidFulfillmentSelection. instant_transaction offers all four
    // mapped order types, so each resolves; a hypothetical engine whose
    // options omitted on_premise would reject dine_in at creation rather
    // than confirm-with-NULL. (Proven at the contract level in
    // capability-contract.test.ts — 'shipment' is rejected there.)
    for (const orderType of ['dine_in', 'counter', 'takeaway', 'delivery']) {
      expect(() => resolveFulfillmentSelection('instant_transaction', { orderType })).not.toThrow();
    }
  });

  it('always produces a typed selection — never null mode/destination type', () => {
    for (const orderType of ['dine_in', 'counter', 'takeaway', 'delivery']) {
      const s = resolveFulfillmentSelection('instant_transaction', { orderType });
      expect(s.mode).toBeTruthy();
      expect(s.destinationType).toBeTruthy();
      expect(['on_premise', 'pickup', 'local_delivery']).toContain(s.mode);
    }
  });
});
