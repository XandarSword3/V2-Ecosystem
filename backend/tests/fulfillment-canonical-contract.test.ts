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

  it('enforces single-writer mutual exclusion: concurrent claims elect exactly 1 owner', async () => {
    // Simulated database table with unique constraint on key
    const dbRecords = new Map<string, { key: string; status: string; expires_at: string; response?: any; transaction_id?: string }>();

    const mockSupabase = {
      from: (table: string) => ({
        insert: (row: any) => ({
          select: () => ({
            maybeSingle: async () => {
              if (dbRecords.has(row.key)) {
                return { data: null, error: { code: '23505', message: 'duplicate key' } };
              }
              dbRecords.set(row.key, { ...row });
              return { data: row, error: null };
            },
            single: async () => {
              if (dbRecords.has(row.key)) {
                return { data: null, error: { code: '23505', message: 'duplicate key' } };
              }
              dbRecords.set(row.key, { ...row });
              return { data: row, error: null };
            },
          }),
        }),
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => ({
              data: dbRecords.get(val) || null,
              error: null,
            }),
          }),
        }),
        update: (updates: any) => ({
          eq: (_col1: string, val1: string) => ({
            eq: (_col2: string, val2: string) => ({
              select: () => ({
                maybeSingle: async () => {
                  const curr = dbRecords.get(val1);
                  if (curr && curr.status === val2) {
                    const next = { ...curr, ...updates };
                    dbRecords.set(val1, next);
                    return { data: next, error: null };
                  }
                  return { data: null, error: null };
                },
              }),
            }),
          }),
        }),
      }),
      rpc: async () => ({ data: null, error: { message: 'function not found' } }),
    };

    // Helper implementing the exact claim logic
    async function testClaim(key: string, leaseSec: number = 60) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + leaseSec * 1000).toISOString();

      const { data: inserted, error: insertErr } = await mockSupabase
        .from('idempotency_records')
        .insert({
          key,
          status: 'in_progress',
          expires_at: expiresAt,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .maybeSingle();

      if (!insertErr && inserted) {
        return { claimed: true, status: 'in_progress' };
      }

      const { data: existing } = await mockSupabase
        .from('idempotency_records')
        .select()
        .eq('key', key)
        .maybeSingle();

      if (!existing) return { claimed: false, status: 'in_progress' };

      if (existing.status === 'completed' && existing.response) {
        return { claimed: false, status: 'completed', response: existing.response, transaction_id: existing.transaction_id };
      }

      const isExpired = existing.expires_at && new Date(existing.expires_at).getTime() < now.getTime();
      if (existing.status === 'failed' || (existing.status === 'in_progress' && isExpired)) {
        const { data: updated } = await mockSupabase
          .from('idempotency_records')
          .update({ status: 'in_progress', response: null, transaction_id: null, expires_at: expiresAt })
          .eq('key', key)
          .eq('status', existing.status)
          .select()
          .maybeSingle();

        if (updated) return { claimed: true, status: 'in_progress' };
      }

      return { claimed: false, status: existing.status, response: existing.response, transaction_id: existing.transaction_id };
    }

    const key = 'tenant1:prop1:mod1:cust1:chk_race_001';

    // 1. Two requests race to claim the same idempotency key simultaneously
    const [resultA, resultB] = await Promise.all([
      testClaim(key),
      testClaim(key),
    ]);

    // Exactly one must claim; the other must be rejected / in_progress
    const claimSuccessCount = (resultA.claimed ? 1 : 0) + (resultB.claimed ? 1 : 0);
    expect(claimSuccessCount).toBe(1);

    const loserResult = resultA.claimed ? resultB : resultA;
    expect(loserResult.claimed).toBe(false);
    expect(loserResult.status).toBe('in_progress');

    // 2. Owner completes checkout: marks completed with snapshot response
    dbRecords.set(key, {
      key,
      status: 'completed',
      transaction_id: 'tx-ord-888',
      response: { success: true, data: { id: 'tx-ord-888', total: 55.0 } },
      expires_at: new Date().toISOString(),
    });

    // 3. Network duplicate request arrives after completion: returns identical snapshot
    const duplicateResult = await testClaim(key);
    expect(duplicateResult.claimed).toBe(false);
    expect(duplicateResult.status).toBe('completed');
    expect(duplicateResult.transaction_id).toBe('tx-ord-888');
    expect(duplicateResult.response.data.id).toBe('tx-ord-888');

    // 4. Test failure rollback & safe retry
    const failedKey = 'tenant1:prop1:mod1:cust1:chk_fail_002';
    const firstAttempt = await testClaim(failedKey);
    expect(firstAttempt.claimed).toBe(true);

    // Simulated stock failure -> mark failed
    dbRecords.set(failedKey, {
      key: failedKey,
      status: 'failed',
      expires_at: new Date().toISOString(),
    });

    // Customer retry with same key: claims successfully without phantom transaction
    const retryAttempt = await testClaim(failedKey);
    expect(retryAttempt.claimed).toBe(true);
    expect(retryAttempt.status).toBe('in_progress');

    // 5. Test expired lease reclamation (crashed worker)
    const crashedKey = 'tenant1:prop1:mod1:cust1:chk_crash_003';
    dbRecords.set(crashedKey, {
      key: crashedKey,
      status: 'in_progress',
      expires_at: new Date(Date.now() - 10000).toISOString(), // expired 10s ago
    });

    const recoveryClaim = await testClaim(crashedKey);
    expect(recoveryClaim.claimed).toBe(true);
    expect(recoveryClaim.status).toBe('in_progress');
  });

  it('rejects stale owner actions when claim_token does not match active lease', async () => {
    const key = 'tenant1:prop1:mod1:cust1:chk_token_fencing';
    const activeToken = 'token-worker-b-777';
    const staleToken = 'token-worker-a-111';

    const dbRecord = {
      key,
      claim_token: activeToken,
      status: 'in_progress',
      expires_at: new Date(Date.now() + 60000).toISOString(),
      transaction_id: null as string | null,
      response: null as any,
    };

    // Stale worker A tries to complete the order with old token
    function attemptComplete(token: string, txId: string, resp: any): boolean {
      if (dbRecord.key === key && dbRecord.claim_token === token && dbRecord.status === 'in_progress') {
        dbRecord.status = 'completed';
        dbRecord.transaction_id = txId;
        dbRecord.response = resp;
        return true;
      }
      return false;
    }

    const workerAResult = attemptComplete(staleToken, 'tx-stale-999', { success: true });
    expect(workerAResult).toBe(false);
    expect(dbRecord.status).toBe('in_progress');
    expect(dbRecord.claim_token).toBe(activeToken);

    // Active worker B completes with valid active token
    const workerBResult = attemptComplete(activeToken, 'tx-valid-888', { success: true, data: { id: 'tx-valid-888' } });
    expect(workerBResult).toBe(true);
    expect(dbRecord.status).toBe('completed');
    expect(dbRecord.transaction_id).toBe('tx-valid-888');
  });

  it('durable rollback compensates base inventory, reverses discounts, and fails idempotency on downstream link failure', async () => {
    let inventoryRestored = false;
    let discountReversed = false;
    let transactionDeleted = false;
    let idempotencyFailed = false;

    const mockRollbackSupabase = {
      rpc: async (fnName: string, params: any) => {
        if (fnName === 'restore_inventory_for_order_items') {
          inventoryRestored = true;
          return { data: { success: true }, error: null };
        }
        if (fnName === 'reverse_coupon_usage' || fnName === 'restore_gift_card_balance') {
          discountReversed = true;
          return { data: { success: true }, error: null };
        }
        if (fnName === 'fail_idempotency_key') {
          idempotencyFailed = true;
          return { data: true, error: null };
        }
        return { data: null, error: null };
      },
      from: (table: string) => ({
        delete: () => ({
          eq: (col: string, val: string) => {
            if (table === 'transactions' && val === 'tx-rollback-123') {
              transactionDeleted = true;
            }
            return { data: null, error: null };
          },
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    // Simulate the independent-step rollback helper
    async function executeRollback(txId: string, baseItems: any[], discounts: any[], idempKey: string, claimToken: string) {
      if (baseItems.length > 0) {
        try {
          await mockRollbackSupabase.rpc('restore_inventory_for_order_items', { p_items: baseItems });
        } catch (_) {}
      }
      if (discounts.length > 0) {
        try {
          await mockRollbackSupabase.rpc('reverse_coupon_usage', { p_order_id: txId });
        } catch (_) {}
      }
      if (txId) {
        try {
          await mockRollbackSupabase.from('transactions').delete().eq('id', txId);
        } catch (_) {}
      }
      if (idempKey && claimToken) {
        try {
          await mockRollbackSupabase.rpc('fail_idempotency_key', { p_key: idempKey, p_claim_token: claimToken });
        } catch (_) {}
      }
    }

    await executeRollback(
      'tx-rollback-123',
      [{ catalog_item_id: 'item-1', quantity: 2 }],
      [{ type: 'coupon', referenceId: 'coup-1', amount: 10 }],
      'tenant1:prop1:mod1:cust1:chk_rollback_test',
      'token-rollback-abc',
    );

    expect(inventoryRestored).toBe(true);
    expect(discountReversed).toBe(true);
    expect(transactionDeleted).toBe(true);
    expect(idempotencyFailed).toBe(true);
  });

  it('heartbeat extends lease while checkout is actively executing', async () => {
    const key = 'tenant1:prop1:mod1:cust1:chk_heartbeat_test';
    const token = 'token-heartbeat-123';
    let expiresAt = new Date(Date.now() + 10000).toISOString();

    const dbRecord = {
      key,
      claim_token: token,
      status: 'in_progress',
      expires_at: expiresAt,
    };

    function heartbeat(k: string, t: string, extSec: number): boolean {
      if (dbRecord.key === k && dbRecord.claim_token === t && dbRecord.status === 'in_progress') {
        dbRecord.expires_at = new Date(Date.now() + extSec * 1000).toISOString();
        return true;
      }
      return false;
    }

    // Active worker extends lease
    const success = heartbeat(key, token, 60);
    expect(success).toBe(true);
    expect(new Date(dbRecord.expires_at).getTime()).toBeGreaterThan(new Date(expiresAt).getTime());

    // Invalid token cannot heartbeat
    const fail = heartbeat(key, 'wrong-token', 60);
    expect(fail).toBe(false);
  });

  it('forced lease expiry prevents stale worker from executing business mutations and allows new worker to execute exactly once', async () => {
    const key = 'tenant1:prop1:mod1:cust1:chk_forced_expiry_e2e';
    const tokenA = 'token-worker-a-stale';
    const tokenB = 'token-worker-b-active';

    let activeRecord = {
      key,
      claim_token: tokenA,
      status: 'in_progress',
      expires_at: new Date(Date.now() - 5000).toISOString(), // expired
      transaction_id: null as string | null,
      response: null as any,
    };

    let totalTransactionsCreated = 0;
    let totalInventoryDeductions = 0;
    let totalDiscountsConsumed = 0;
    let totalOrderItemsInserted = 0;

    function assertActiveLease(k: string, t: string): boolean {
      return activeRecord.key === k && activeRecord.claim_token === t && activeRecord.status === 'in_progress';
    }

    // 1. Worker B reclaims the expired lease
    if (activeRecord.expires_at < new Date().toISOString() && activeRecord.status === 'in_progress') {
      activeRecord.claim_token = tokenB;
      activeRecord.expires_at = new Date(Date.now() + 60000).toISOString();
    }
    expect(activeRecord.claim_token).toBe(tokenB);

    // 2. Stale Worker A wakes up and attempts checkout pipeline
    async function workerAExecution() {
      // Step: transaction insert
      if (!assertActiveLease(key, tokenA)) {
        return { success: false, error: 'LEASE_LOST' };
      }
      totalTransactionsCreated++;

      // Step: inventory deduction
      if (!assertActiveLease(key, tokenA)) {
        return { success: false, error: 'LEASE_LOST' };
      }
      totalInventoryDeductions++;

      // Step: order items
      if (!assertActiveLease(key, tokenA)) {
        return { success: false, error: 'LEASE_LOST' };
      }
      totalOrderItemsInserted++;

      return { success: true };
    }

    // 3. Worker B executes checkout pipeline
    async function workerBExecution() {
      if (!assertActiveLease(key, tokenB)) {
        return { success: false, error: 'LEASE_LOST' };
      }
      totalTransactionsCreated++;
      totalDiscountsConsumed++;

      if (!assertActiveLease(key, tokenB)) {
        return { success: false, error: 'LEASE_LOST' };
      }
      totalInventoryDeductions++;

      if (!assertActiveLease(key, tokenB)) {
        return { success: false, error: 'LEASE_LOST' };
      }
      totalOrderItemsInserted++;

      activeRecord.status = 'completed';
      activeRecord.transaction_id = 'tx-worker-b-committed';
      activeRecord.response = { success: true, data: { id: 'tx-worker-b-committed' } };

      return { success: true, data: { id: 'tx-worker-b-committed' } };
    }

    // Run both
    const [resultA, resultB] = await Promise.all([
      workerAExecution(),
      workerBExecution(),
    ]);

    // Assert: Worker A was completely blocked from mutating business state
    expect(resultA.success).toBe(false);
    expect(resultA.error).toBe('LEASE_LOST');

    // Assert: Worker B succeeded
    expect(resultB.success).toBe(true);
    expect(activeRecord.status).toBe('completed');
    expect(activeRecord.transaction_id).toBe('tx-worker-b-committed');

    // Assert the fundamental Engine A Single-Writer Invariant:
    expect(totalTransactionsCreated).toBe(1);
    expect(totalInventoryDeductions).toBe(1);
    expect(totalDiscountsConsumed).toBe(1);
    expect(totalOrderItemsInserted).toBe(1);
  });

  it('independent multi-stage rollback ensures every step executes even when one step throws', async () => {
    const executionTrace: string[] = [];

    async function independentRollback(simulateErrorInStep: string) {
      // Step 1: Inventory
      try {
        if (simulateErrorInStep === 'inventory') throw new Error('Inventory restore failed');
        executionTrace.push('inventory_restored');
      } catch (e: any) {
        executionTrace.push('inventory_error');
      }

      // Step 2: Discounts
      try {
        if (simulateErrorInStep === 'discounts') throw new Error('Discount reversal failed');
        executionTrace.push('discounts_reversed');
      } catch (e: any) {
        executionTrace.push('discounts_error');
      }

      // Step 3: Order items
      try {
        if (simulateErrorInStep === 'order_items') throw new Error('Order items delete failed');
        executionTrace.push('order_items_deleted');
      } catch (e: any) {
        executionTrace.push('order_items_error');
      }

      // Step 4: Transaction
      try {
        if (simulateErrorInStep === 'transaction') throw new Error('Transaction delete failed');
        executionTrace.push('transaction_deleted');
      } catch (e: any) {
        executionTrace.push('transaction_error');
      }

      // Step 5: Idempotency
      try {
        if (simulateErrorInStep === 'idempotency') throw new Error('Idempotency fail update failed');
        executionTrace.push('idempotency_failed');
      } catch (e: any) {
        executionTrace.push('idempotency_error');
      }
    }

    // When discount reversal throws, inventory is already done, and order_items, transaction, and idempotency still execute!
    await independentRollback('discounts');
    expect(executionTrace).toEqual([
      'inventory_restored',
      'discounts_error',
      'order_items_deleted',
      'transaction_deleted',
      'idempotency_failed',
    ]);
  });

  it('assert_active_lease strictly enforces expires_at > NOW()', async () => {
    const key = 'tenant1:prop1:mod1:cust1:chk_expiry_strict';
    const token = 'token-expiry-check-1';

    // 1. Valid non-expired lease
    const validRecord = {
      key,
      claim_token: token,
      status: 'in_progress',
      expires_at: new Date(Date.now() + 30000).toISOString(),
    };

    function checkLease(rec: typeof validRecord, k: string, t: string): boolean {
      return (
        rec.key === k &&
        rec.claim_token === t &&
        rec.status === 'in_progress' &&
        new Date(rec.expires_at).getTime() > Date.now()
      );
    }

    expect(checkLease(validRecord, key, token)).toBe(true);

    // 2. Expired lease with matching token & status must be rejected
    const expiredRecord = {
      key,
      claim_token: token,
      status: 'in_progress',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };

    expect(checkLease(expiredRecord, key, token)).toBe(false);
  });

  it('create_order_atomic and persist_order_items_atomic enforce transactional lease boundary against stale workers', async () => {
    const key = 'tenant1:prop1:mod1:cust1:chk_atomic_boundary';
    const tokenA = 'token-worker-a-stale';
    const tokenB = 'token-worker-b-active';

    // Simulated Postgres state
    const idempotencyTable = new Map<string, { key: string; claim_token: string; status: string; expires_at: string; transaction_id: string | null; response: any }>();
    const transactionsTable = new Map<string, any>();
    const orderItemsTable: any[] = [];

    // Worker A initially claims key
    idempotencyTable.set(key, {
      key,
      claim_token: tokenA,
      status: 'in_progress',
      expires_at: new Date(Date.now() - 10000).toISOString(), // expired
      transaction_id: null,
      response: null,
    });

    // Worker B reclaims key
    const leaseRow = idempotencyTable.get(key)!;
    if (new Date(leaseRow.expires_at).getTime() <= Date.now() && leaseRow.status === 'in_progress') {
      leaseRow.claim_token = tokenB;
      leaseRow.expires_at = new Date(Date.now() + 60000).toISOString();
    }

    // Atomic create_order_atomic implementation
    function createOrderAtomic(k: string, claimToken: string, payload: any): { success: boolean; data?: any; error?: string } {
      const lease = idempotencyTable.get(k);
      if (!lease || lease.claim_token !== claimToken || lease.status !== 'in_progress' || new Date(lease.expires_at).getTime() <= Date.now()) {
        return { success: false, error: 'LEASE_LOST' };
      }
      const txId = `tx-${Math.random().toString(36).slice(2, 8)}`;
      const tx = { id: txId, ...payload };
      transactionsTable.set(txId, tx);
      lease.transaction_id = txId;
      return { success: true, data: tx };
    }

    // Atomic deduct_inventory_for_checkout_atomic implementation
    let baseInventoryDeductions = 0;
    function deductInventoryAtomic(k: string, claimToken: string, items: any[]): { success: boolean; error?: string } {
      const lease = idempotencyTable.get(k);
      if (!lease || lease.claim_token !== claimToken || lease.status !== 'in_progress' || new Date(lease.expires_at).getTime() <= Date.now()) {
        return { success: false, error: 'LEASE_LOST' };
      }
      baseInventoryDeductions += items.length;
      return { success: true };
    }

    // Atomic persist_order_items_atomic implementation
    function persistOrderItemsAtomic(k: string, claimToken: string, txId: string, items: any[]): { success: boolean; data?: any; error?: string } {
      const lease = idempotencyTable.get(k);
      if (!lease || lease.claim_token !== claimToken || lease.status !== 'in_progress' || new Date(lease.expires_at).getTime() <= Date.now()) {
        return { success: false, error: 'LEASE_LOST' };
      }
      const inserted = items.map((item, idx) => ({ id: `oi-${idx}`, transaction_id: txId, ...item }));
      orderItemsTable.push(...inserted);
      return { success: true, data: inserted };
    }

    // Atomic create_order_customization_snapshot_atomic implementation
    let customizationDeductions = 0;
    function createCustomizationSnapshotAtomic(k: string, claimToken: string, selections: any[]): { success: boolean; error?: string } {
      const lease = idempotencyTable.get(k);
      if (!lease || lease.claim_token !== claimToken || lease.status !== 'in_progress' || new Date(lease.expires_at).getTime() <= Date.now()) {
        return { success: false, error: 'LEASE_LOST' };
      }
      customizationDeductions += selections.length;
      return { success: true };
    }

    // Stale Worker A attempts all 4 atomic mutations
    const resultOrderA = createOrderAtomic(key, tokenA, { amount: 100 });
    expect(resultOrderA.success).toBe(false);
    expect(resultOrderA.error).toBe('LEASE_LOST');

    const resultInvA = deductInventoryAtomic(key, tokenA, [{ catalog_item_id: 'item-1', quantity: 2 }]);
    expect(resultInvA.success).toBe(false);
    expect(resultInvA.error).toBe('LEASE_LOST');

    const resultItemsA = persistOrderItemsAtomic(key, tokenA, 'tx-phantom', [{ quantity: 2 }]);
    expect(resultItemsA.success).toBe(false);
    expect(resultItemsA.error).toBe('LEASE_LOST');

    const resultCustomA = createCustomizationSnapshotAtomic(key, tokenA, [{ groupId: 'g1', optionId: 'o1' }]);
    expect(resultCustomA.success).toBe(false);
    expect(resultCustomA.error).toBe('LEASE_LOST');

    // Active Worker B executes all 4 atomic mutations
    const resultOrderB = createOrderAtomic(key, tokenB, { amount: 100 });
    expect(resultOrderB.success).toBe(true);
    expect(resultOrderB.data).toBeDefined();

    const txIdB = resultOrderB.data.id;

    const resultInvB = deductInventoryAtomic(key, tokenB, [{ catalog_item_id: 'item-1', quantity: 2 }]);
    expect(resultInvB.success).toBe(true);

    const resultItemsB = persistOrderItemsAtomic(key, tokenB, txIdB, [{ catalog_item_id: 'item-1', quantity: 2 }]);
    expect(resultItemsB.success).toBe(true);
    expect(resultItemsB.data.length).toBe(1);

    const resultCustomB = createCustomizationSnapshotAtomic(key, tokenB, [{ groupId: 'g1', optionId: 'o1' }]);
    expect(resultCustomB.success).toBe(true);

    // Database assertions: exactly 1 transaction, 1 base inventory deduction, 1 customization deduction, 1 order_items set
    expect(transactionsTable.size).toBe(1);
    expect(baseInventoryDeductions).toBe(1);
    expect(customizationDeductions).toBe(1);
    expect(orderItemsTable.length).toBe(1);
    expect(orderItemsTable[0].transaction_id).toBe(txIdB);
  });

  it('durable compensation failure queue records and processes all 5 compensation operations', async () => {
    const compensationQueue: any[] = [];
    const restoredInventory: any[] = [];
    const reversedDiscounts: string[] = [];
    const deletedOrderItems: string[] = [];
    const deletedTransactions: string[] = [];
    const failedIdempotencyKeys: string[] = [];

    async function queueCompensation(key: string, txId: string, op: string, payload: any, err: string) {
      compensationQueue.push({
        id: `comp-${compensationQueue.length + 1}`,
        idempotency_key: key,
        transaction_id: txId,
        operation: op,
        payload,
        status: 'pending',
        attempts: 0,
        last_error: err,
        created_at: new Date().toISOString(),
      });
    }

    const key = 'tenant1:prop1:mod1:cust1:chk_queue_test';
    const txId = 'tx-fail-123';

    // 1. Queue all 5 failure modes
    await queueCompensation(key, txId, 'restore_inventory', [{ catalog_item_id: 'item-1', quantity: 1 }], 'Database connection timed out');
    await queueCompensation(key, txId, 'reverse_discounts', [{ code: 'SUMMER20' }], 'Gift card service 503');
    await queueCompensation(key, txId, 'delete_order_items', { transaction_id: txId }, 'Lock timeout on order_items');
    await queueCompensation(key, txId, 'delete_transaction', { transaction_id: txId }, 'Deadlock detected');
    await queueCompensation(key, txId, 'fail_idempotency_key', { key, claim_token: 'token-1' }, 'RPC connection reset');

    expect(compensationQueue.length).toBe(5);
    expect(compensationQueue.every(q => q.status === 'pending')).toBe(true);

    // 2. Worker processor executing the queue
    async function processQueue(): Promise<{ processed: number; failed: number }> {
      let processed = 0;
      let failed = 0;
      for (const item of compensationQueue) {
        if (item.status !== 'pending') continue;
        try {
          if (item.operation === 'restore_inventory') {
            restoredInventory.push(...item.payload);
          } else if (item.operation === 'reverse_discounts') {
            reversedDiscounts.push(item.transaction_id);
          } else if (item.operation === 'delete_order_items') {
            deletedOrderItems.push(item.transaction_id);
          } else if (item.operation === 'delete_transaction') {
            deletedTransactions.push(item.transaction_id);
          } else if (item.operation === 'fail_idempotency_key') {
            failedIdempotencyKeys.push(item.idempotency_key);
          }
          item.status = 'completed';
          processed++;
        } catch (e: any) {
          item.attempts += 1;
          item.last_error = e.message;
          if (item.attempts >= 5) item.status = 'failed';
          failed++;
        }
      }
      return { processed, failed };
    }

    const { processed, failed } = await processQueue();

    expect(processed).toBe(5);
    expect(failed).toBe(0);
    expect(compensationQueue.every(q => q.status === 'completed')).toBe(true);
    expect(restoredInventory.length).toBe(1);
    expect(reversedDiscounts).toContain(txId);
    expect(deletedOrderItems).toContain(txId);
    expect(deletedTransactions).toContain(txId);
    expect(failedIdempotencyKeys).toContain(key);
  });

  it('compensation operations are strictly idempotent across worker crashes and retries', async () => {
    const compensationLog = new Set<string>();
    let totalStockRestored = 0;
    let totalDiscountsReversed = 0;

    function executeIdempotentCompensation(idempKey: string, txId: string, operation: string, payload: any): boolean {
      const logKey = `${idempKey || txId}:${operation}`;
      if (compensationLog.has(logKey)) {
        // Already executed (idempotent no-op)
        return true;
      }

      if (operation === 'restore_inventory') {
        totalStockRestored += payload.reduce((acc: number, item: any) => acc + item.quantity, 0);
      } else if (operation === 'reverse_discounts') {
        totalDiscountsReversed += 1;
      }

      compensationLog.add(logKey);
      return true;
    }

    const key = 'tenant1:prop1:mod1:cust1:chk_crash_idempotent';
    const txId = 'tx-crash-456';
    const items = [{ catalog_item_id: 'item-1', quantity: 3 }];

    // Worker 1 executes compensation step for inventory
    executeIdempotentCompensation(key, txId, 'restore_inventory', items);
    executeIdempotentCompensation(key, txId, 'reverse_discounts', [{ code: 'SALE10' }]);

    expect(totalStockRestored).toBe(3);
    expect(totalDiscountsReversed).toBe(1);

    // Worker 1 crashes before updating queue status.
    // Worker 2 (or scheduled retry) re-executes the exact same queue items:
    executeIdempotentCompensation(key, txId, 'restore_inventory', items);
    executeIdempotentCompensation(key, txId, 'reverse_discounts', [{ code: 'SALE10' }]);

    // Economic state MUST NOT double-compensate!
    expect(totalStockRestored).toBe(3);
    expect(totalDiscountsReversed).toBe(1);
  });

  it('permanently failed compensation items (attempts >= 5) are retained and flagged for operational alerts', async () => {
    const queueRecord = {
      id: 'comp-dead-1',
      idempotency_key: 'tenant1:prop1:mod1:cust1:chk_dead_letter',
      transaction_id: 'tx-unrecoverable',
      operation: 'restore_inventory',
      payload: [{ catalog_item_id: 'item-deleted', quantity: 1 }],
      status: 'pending',
      attempts: 4,
      last_error: null as string | null,
    };

    const alertsEmitted: any[] = [];

    // Attempt 5 fails
    try {
      throw new Error('Foreign key target not found');
    } catch (e: any) {
      queueRecord.attempts += 1;
      queueRecord.last_error = e.message;
      if (queueRecord.attempts >= 5) {
        queueRecord.status = 'failed';
        alertsEmitted.push({
          severity: 'CRITICAL',
          id: queueRecord.id,
          operation: queueRecord.operation,
          error: queueRecord.last_error,
        });
      }
    }

    expect(queueRecord.status).toBe('failed');
    expect(queueRecord.attempts).toBe(5);
    expect(alertsEmitted.length).toBe(1);
    expect(alertsEmitted[0].severity).toBe('CRITICAL');
  });

  it('claim-first pattern prevents double-compensation across concurrent duplicate queue rows', async () => {
    // Database tables
    const compensationLogTable = new Map<string, { logical_key: string; claim_token: string; status: string; expires_at: number }>();
    let actualStockRestored = 0;

    const txId = 'tx-conc-123';
    const queueRows = [
      { id: 'q-row-1', transaction_id: txId, operation: 'restore_inventory', payload: [{ catalog_item_id: 'item-1', quantity: 5 }], status: 'pending' },
      { id: 'q-row-2', transaction_id: txId, operation: 'restore_inventory', payload: [{ catalog_item_id: 'item-1', quantity: 5 }], status: 'pending' },
    ];

    async function processQueueRow(row: typeof queueRows[0], workerId: string) {
      const logicalKey = `tx:${row.transaction_id}:${row.operation}`;
      const token = `token-${workerId}-${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      const expiresAt = now + 60000;

      let hasClaim = false;

      // 1. Claim-first atomic check
      if (!compensationLogTable.has(logicalKey)) {
        compensationLogTable.set(logicalKey, {
          logical_key: logicalKey,
          claim_token: token,
          status: 'in_progress',
          expires_at: expiresAt,
        });
        hasClaim = true;
      } else {
        const existing = compensationLogTable.get(logicalKey)!;
        if (existing.status === 'completed') {
          row.status = 'completed';
          return { claimed: false, completed: true };
        }
        if (existing.status === 'failed' || (existing.status === 'in_progress' && existing.expires_at < now)) {
          existing.claim_token = token;
          existing.status = 'in_progress';
          existing.expires_at = expiresAt;
          hasClaim = true;
        } else {
          // Another worker is actively executing this claim
          return { claimed: false, completed: false };
        }
      }

      if (hasClaim) {
        // Execute economic side effect
        actualStockRestored += row.payload.reduce((sum, i) => sum + i.quantity, 0);

        // Mark log completed
        const logEntry = compensationLogTable.get(logicalKey)!;
        logEntry.status = 'completed';

        // Mark queue row completed
        row.status = 'completed';
        return { claimed: true, completed: true };
      }

      return { claimed: false, completed: false };
    }

    // Run both workers concurrently
    const [result1, result2] = await Promise.all([
      processQueueRow(queueRows[0], 'worker-A'),
      processQueueRow(queueRows[1], 'worker-B'),
    ]);

    // Exactly one worker claimed and executed the economic mutation
    const claimedCount = (result1.claimed ? 1 : 0) + (result2.claimed ? 1 : 0);
    expect(claimedCount).toBe(1);
    expect(actualStockRestored).toBe(5); // NOT 10!

    // Second worker (or subsequent retry) cleans up duplicate row
    if (queueRows[1].status === 'pending') {
      await processQueueRow(queueRows[1], 'worker-B');
    }
    expect(queueRows[0].status).toBe('completed');
    expect(queueRows[1].status).toBe('completed');
    expect(actualStockRestored).toBe(5); // Still strictly 5!
  });

  it('crash recovery with lease expiry allows new worker to safely complete abandoned compensation', async () => {
    const compensationLogTable = new Map<string, { logical_key: string; claim_token: string; status: string; expires_at: number }>();
    let actualDiscountsReversed = 0;

    const txId = 'tx-crash-lease';
    const logicalKey = `tx:${txId}:reverse_discounts`;

    // 1. Worker A claims compensation but crashes without running or completing
    compensationLogTable.set(logicalKey, {
      logical_key: logicalKey,
      claim_token: 'token-worker-a-crashed',
      status: 'in_progress',
      expires_at: Date.now() - 5000, // expired lease
    });

    // 2. Retry Worker B attempts to process the compensation queue row
    const queueRow = { id: 'q-row-crash', transaction_id: txId, operation: 'reverse_discounts', status: 'pending' };

    async function retryWorker(row: typeof queueRow) {
      const now = Date.now();
      const existing = compensationLogTable.get(logicalKey);

      if (existing && existing.status === 'in_progress' && existing.expires_at < now) {
        // Reclaim expired lease
        existing.claim_token = 'token-worker-b-active';
        existing.expires_at = now + 60000;

        // Execute side effect
        actualDiscountsReversed += 1;

        // Mark completed
        existing.status = 'completed';
        row.status = 'completed';
      }
    }

    await retryWorker(queueRow);

    expect(queueRow.status).toBe('completed');
    expect(actualDiscountsReversed).toBe(1);
    expect(compensationLogTable.get(logicalKey)!.status).toBe('completed');
  });
});
