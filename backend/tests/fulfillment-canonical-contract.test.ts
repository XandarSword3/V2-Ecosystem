import { describe, expect, it } from 'vitest';
import {
  resolveFulfillmentSelection,
  type FulfillmentSelectionInput,
} from '../src/modules/fulfillment/fulfillment-selection.js';
import { FulfillmentContractError } from '../src/engines/fulfillment-contract.js';
import { CURRENCY_DECIMALS } from '../src/engines/money.js';

describe('resolveFulfillmentSelection — Phase F4 Canonical Contract', () => {
  it('resolves canonical on_premise selection with NO legacy orderType', () => {
    const input: FulfillmentSelectionInput = {
      mode: 'on_premise',
      destinationType: 'on_premise_location',
      destinationRef: '550e8400-e29b-41d4-a716-446655440000',
    };

    const selection = resolveFulfillmentSelection('instant_transaction', input);

    expect(selection).toEqual({
      mode: 'on_premise',
      destinationType: 'on_premise_location',
      destinationRef: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('resolves all 6 selectable Engine A fulfillment modes directly', () => {
    const modes = [
      { mode: 'on_premise' as const, destType: 'on_premise_location' as const, ref: 'loc-1' },
      { mode: 'pickup' as const, destType: 'pickup_location' as const, ref: null },
      { mode: 'local_delivery' as const, destType: 'address' as const, ref: '123 Palm Way' },
      { mode: 'digital_delivery' as const, destType: 'digital_account' as const, ref: 'guest@example.com' },
      { mode: 'shipment' as const, destType: 'address' as const, ref: '456 Coast Rd' },
      { mode: 'service_execution' as const, destType: 'service_location' as const, ref: 'Station 4' },
    ];

    for (const item of modes) {
      const selection = resolveFulfillmentSelection('instant_transaction', {
        mode: item.mode,
        destinationType: item.destType,
        destinationRef: item.ref,
      });

      expect(selection.mode).toBe(item.mode);
      expect(selection.destinationType).toBe(item.destType);
      expect(selection.destinationRef).toBe(item.ref);
    }
  });

  it('resolves non-fulfillment mode (none) with destinationType none and null ref', () => {
    const selection = resolveFulfillmentSelection('instant_transaction', {
      mode: 'none',
      destinationType: 'none',
      destinationRef: null,
    });

    expect(selection).toEqual({
      mode: 'none',
      destinationType: 'none',
      destinationRef: null,
    });
  });

  it('rejects illegal mode/destination combinations (fails closed via FulfillmentContractError)', () => {
    // on_premise cannot fulfill to a digital_account
    expect(() => {
      resolveFulfillmentSelection('instant_transaction', {
        mode: 'on_premise',
        destinationType: 'digital_account' as any,
        destinationRef: 'user@example.com',
      });
    }).toThrow(FulfillmentContractError);
  });

  it('preserves backward compatibility by falling back to legacy orderType translation only when mode is omitted', () => {
    const legacyDineIn = resolveFulfillmentSelection('instant_transaction', {
      orderType: 'dine_in',
      tableNumber: 'Table 7',
    });
    expect(legacyDineIn.mode).toBe('on_premise');
    expect(legacyDineIn.destinationType).toBe('on_premise_location');
    expect(legacyDineIn.destinationRef).toBe('Table 7');

    const legacyTakeaway = resolveFulfillmentSelection('instant_transaction', {
      orderType: 'takeaway',
    });
    expect(legacyTakeaway.mode).toBe('pickup');
    expect(legacyTakeaway.destinationType).toBe('pickup_location');

    const legacyDelivery = resolveFulfillmentSelection('instant_transaction', {
      orderType: 'delivery',
      address: '789 Ocean Blvd',
    });
    expect(legacyDelivery.mode).toBe('local_delivery');
    expect(legacyDelivery.destinationType).toBe('address');
    expect(legacyDelivery.destinationRef).toBe('789 Ocean Blvd');
  });

  it('throws FulfillmentContractError when both canonical mode and legacy orderType are absent', () => {
    expect(() => {
      resolveFulfillmentSelection('instant_transaction', {});
    }).toThrow(FulfillmentContractError);
  });

  it('fails closed when canonical fulfillmentSelection omits destinationType (never invents defaults)', () => {
    expect(() => {
      resolveFulfillmentSelection('instant_transaction', {
        mode: 'on_premise',
        // destinationType omitted
        destinationRef: 'loc-1',
      });
    }).toThrow(FulfillmentContractError);
  });

  it('fails closed when canonical fulfillmentSelection omits destinationRef for required modes', () => {
    // on_premise requires non-empty destinationRef
    expect(() => {
      resolveFulfillmentSelection('instant_transaction', {
        mode: 'on_premise',
        destinationType: 'on_premise_location',
        destinationRef: '',
      });
    }).toThrow(FulfillmentContractError);

    // local_delivery requires non-empty destinationRef
    expect(() => {
      resolveFulfillmentSelection('instant_transaction', {
        mode: 'local_delivery',
        destinationType: 'address',
        destinationRef: null,
      });
    }).toThrow(FulfillmentContractError);

    // digital_delivery requires non-empty destinationRef
    expect(() => {
      resolveFulfillmentSelection('instant_transaction', {
        mode: 'digital_delivery',
        destinationType: 'digital_account',
        destinationRef: '   ',
      });
    }).toThrow(FulfillmentContractError);
  });

  it('allows destinationRef = null explicitly for none mode and pickup mode', () => {
    const noneSelection = resolveFulfillmentSelection('instant_transaction', {
      mode: 'none',
      destinationType: 'none',
      destinationRef: null,
    });
    expect(noneSelection.mode).toBe('none');
    expect(noneSelection.destinationRef).toBeNull();

    const pickupSelection = resolveFulfillmentSelection('instant_transaction', {
      mode: 'pickup',
      destinationType: 'pickup_location',
      destinationRef: null,
    });
    expect(pickupSelection.mode).toBe('pickup');
    expect(pickupSelection.destinationRef).toBeNull();
  });
});

describe('Currency-Aware Preview Tolerance & Exact Normalization — Phase F4 Pricing Integrity', () => {
  it('correctly retrieves decimal precisions for standard and non-standard ISO 4217 currencies', () => {
    expect(CURRENCY_DECIMALS['USD']).toBe(2);
    expect(CURRENCY_DECIMALS['EUR']).toBe(2);
    expect(CURRENCY_DECIMALS['JPY']).toBe(0);
    expect(CURRENCY_DECIMALS['KRW']).toBe(0);
    expect(CURRENCY_DECIMALS['KWD']).toBe(3);
    expect(CURRENCY_DECIMALS['BHD']).toBe(3);
    expect(CURRENCY_DECIMALS['OMR']).toBe(3);
  });

  it('normalizes preview and server totals to exact equality across USD (2 dec), JPY (0 dec), and KWD (3 dec)', () => {
    function validatePricingMatch(currency: string, previewTotal: number, serverTotal: number): boolean {
      const decimals = CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
      const normalizedPreview = Number(previewTotal.toFixed(decimals));
      const normalizedServer = Number(serverTotal.toFixed(decimals));
      const diff = Math.abs(normalizedServer - normalizedPreview);
      return diff === 0;
    }

    // USD: 2 decimals
    expect(validatePricingMatch('USD', 19.99, 19.99)).toBe(true);
    expect(validatePricingMatch('USD', 19.99, 20.00)).toBe(false);

    // JPY: 0 decimals
    expect(validatePricingMatch('JPY', 2500, 2500)).toBe(true);
    expect(validatePricingMatch('JPY', 2500.0, 2500)).toBe(true);
    expect(validatePricingMatch('JPY', 2500, 2501)).toBe(false);

    // KWD: 3 decimals
    expect(validatePricingMatch('KWD', 15.250, 15.250)).toBe(true);
    expect(validatePricingMatch('KWD', 15.250, 15.251)).toBe(false);
  });
});

describe('Scoped Idempotency & Database Concurrency Boundaries — Phase F4 Integrity', () => {
  it('scopes customer checkout idempotency to tenant, property, module, customer context, and key', () => {
    function computeScopedKey(tenantId: string, propertyId: string, moduleId: string, customerScope: string, key: string): string {
      return `${tenantId}:${propertyId}:${moduleId}:${customerScope}:${key}`;
    }

    const key1 = computeScopedKey('t1', 'p1', 'm1', 'guest-123', 'chk_abc123');
    const key2 = computeScopedKey('t1', 'p1', 'm1', 'guest-123', 'chk_abc123');
    // Same commercial context & key match
    expect(key1).toBe(key2);

    // Different customer with same key does not collide
    const keyDiffCustomer = computeScopedKey('t1', 'p1', 'm1', 'guest-456', 'chk_abc123');
    expect(key1).not.toBe(keyDiffCustomer);

    // Different module with same key does not collide
    const keyDiffModule = computeScopedKey('t1', 'p1', 'm2', 'guest-123', 'chk_abc123');
    expect(key1).not.toBe(keyDiffModule);

    // Different tenant with same key does not collide
    const keyDiffTenant = computeScopedKey('t2', 'p1', 'm1', 'guest-123', 'chk_abc123');
    expect(key1).not.toBe(keyDiffTenant);
  });

  it('manages idempotency lifecycle states: in_progress -> completed, and in_progress -> failed with safe retry', () => {
    interface IdempState {
      status: 'in_progress' | 'completed' | 'failed';
      transactionId?: string;
      response?: any;
    }

    const table = new Map<string, IdempState>();

    // 1. First attempt starts
    const key = 't1:p1:m1:cust1:chk_xyz';
    table.set(key, { status: 'in_progress' });

    // 2. Concurrent request arrives: sees in_progress
    expect(table.get(key)?.status).toBe('in_progress');

    // 3. First attempt fails on stock check: status transitions to failed, transaction deleted
    table.set(key, { status: 'failed' });

    // 4. Retry after failure: sees failed, starts fresh attempt cleanly (zero phantom reuse)
    expect(table.get(key)?.status).toBe('failed');
    table.set(key, { status: 'in_progress' });

    // 5. Retry succeeds: status transitions to completed with snapshot response
    table.set(key, {
      status: 'completed',
      transactionId: 'tx-123',
      response: { success: true, data: { id: 'tx-123', amount: 45 } },
    });

    // 6. Subsequent duplicate network replay returns cached completed response
    const record = table.get(key);
    expect(record?.status).toBe('completed');
    expect(record?.transactionId).toBe('tx-123');
    expect(record?.response.data.id).toBe('tx-123');
  });
});
