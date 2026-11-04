/**
 * Ledger write durability policy (Main Plan Phase 16)
 *
 * "Never create a financial mutation without ledger entry."
 *
 * engineService.recordToLedger / recordRefundToLedger are the single choke
 * point for ALL financial-ledger writes. This suite pins the durability
 * contract the router layers on top of them:
 *
 *   1. Transient infrastructure failures (the insert path wraps them as
 *      LedgerWriteError('Failed to record ledger entry: ...')) are retried
 *      with bounded backoff.
 *   2. Deterministic validation failures (missing currency, invariant
 *      violations) surface as LedgerWriteError with a different message
 *      prefix and propagate IMMEDIATELY — retrying a parseable programming
 *      error would just re-fail and mask the root cause.
 *   3. When retries exhaust, the error propagates so callers can compensate
 *      (order creation rolls back; nothing is committed untraceable).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockLedger = vi.hoisted(() => ({
  recordFromPricing: vi.fn(),
  recordRefund: vi.fn(),
}));

// Partial mock: keep the real LedgerWriteError/LedgerInvariantError classes
// (they are what the retry classifier inspects), swap only the service getter.
vi.mock('../../../src/engines/financial-ledger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/engines/financial-ledger.js')>();
  return {
    ...actual,
    getFinancialLedgerService: () => mockLedger,
  };
});

import {
  createEngineService,
  resetEngineService,
} from '../../../src/engines/engine-service.js';
import { LedgerWriteError } from '../../../src/engines/financial-ledger.js';

const TRANSIENT_ERROR = 'Failed to record ledger entry: connection reset by peer';
const DETERMINISTIC_ERROR = "Ledger entry requires an explicit ISO 4217 currency; got 'undefined'";

const pricingResult = {
  lineItems: [],
  subtotal: 100,
  tax: 11,
  fee: {},
  totalAmount: 111,
} as any;

const ledgerContext = {
  tenantId: 'tenant-1',
  moduleId: 'mod-1',
  templateType: 'instant_transaction',
  entityId: 'order-1',
  entityType: 'order',
  transactionType: 'charge' as const,
  actorType: 'system' as const,
};

function createService() {
  return createEngineService({} as any);
}

describe('financial ledger write durability (Phase 16 invariant)', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLedger.recordFromPricing.mockReset();
    mockLedger.recordRefund.mockReset();
    service = createService();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetEngineService();
  });

  it('retries transient insert failures with backoff until they succeed', async () => {
    mockLedger.recordFromPricing
      .mockRejectedValueOnce(new LedgerWriteError(TRANSIENT_ERROR, {} as any))
      .mockRejectedValueOnce(new LedgerWriteError(TRANSIENT_ERROR, {} as any))
      .mockResolvedValueOnce('ledger-entry-1');

    const pending = service.recordToLedger(pricingResult, ledgerContext);

    // Backoff delays are [150, 400, 900] — advance past them all.
    await vi.advanceTimersByTimeAsync(1500);

    await expect(pending).resolves.toBe('ledger-entry-1');
    expect(mockLedger.recordFromPricing).toHaveBeenCalledTimes(3);
  });

  it('propagates deterministic validation errors without retrying', async () => {
    mockLedger.recordFromPricing.mockRejectedValue(
      new LedgerWriteError(DETERMINISTIC_ERROR, {} as any),
    );

    await expect(service.recordToLedger(pricingResult, ledgerContext)).rejects.toThrow(
      /explicit ISO 4217 currency/,
    );
    expect(mockLedger.recordFromPricing).toHaveBeenCalledTimes(1);
  });

  it('gives up after the bounded attempt budget and surfaces the last transient error', async () => {
    mockLedger.recordFromPricing
      .mockRejectedValue(new LedgerWriteError(TRANSIENT_ERROR, {} as any));

    const pending = service.recordToLedger(pricingResult, ledgerContext);
    // Attach a no-op handler up front: the rejection fires while timers are
    // still advancing, before the assertion below awaits it.
    pending.catch(() => {});

    await vi.advanceTimersByTimeAsync(2000);

    await expect(pending).rejects.toThrow(TRANSIENT_ERROR);
    // MAX_ATTEMPTS = delay budget [150, 400, 900] → 4 total attempts.
    expect(mockLedger.recordFromPricing).toHaveBeenCalledTimes(4);
  });

  it('applies the same retry policy to refund ledger writes', async () => {
    mockLedger.recordRefund.mockRejectedValueOnce(
      new LedgerWriteError(TRANSIENT_ERROR, {} as any),
    );
    mockLedger.recordRefund.mockResolvedValueOnce('refund-ledger-1');

    const pending = service.recordRefundToLedger('order-1', {
      tenantId: 'tenant-1',
      moduleId: 'mod-1',
      templateType: 'instant_transaction',
      entityType: 'order',
      currency: 'USD',
      refundAmount: 25,
      reason: 'Order refunded',
      actorType: 'system',
    });

    await vi.advanceTimersByTimeAsync(1500);

    await expect(pending).resolves.toBe('refund-ledger-1');
    expect(mockLedger.recordRefund).toHaveBeenCalledTimes(2);
  });
});
