import { describe, it, expect, beforeAll } from 'vitest';
import { login, api, record } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A } from './fixtures';

/**
 * New finding (this review) — createPaymentIntent cannot resolve an existing
 * transaction because it selects transactions.total_amount and
 * transactions.payment_status, neither of which exists.
 *
 * Desired behaviour: the authoritative-record lookup succeeds, so the handler
 * must not return the "Authoritative record not found" 404 for a real order.
 * It may still fail later at the Stripe call (no key is configured in this
 * suite); that is a different error and is accepted here. Today it returns the
 * 404, so this test fails.
 */
describe('create-intent existing transaction lookup', () => {
  let token = '';

  beforeAll(async () => {
    const auth = await login(EMAILS.customerA, PASSWORD, TENANT_SLUG_A);
    token = auth.token;
  });

  it('does not report a real transaction as missing', async () => {
    const res = await api('POST', '/payments/create-intent', {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantA, 'X-Property-ID': IDS.propertyA },
      body: {
        referenceType: 'instant_transaction',
        referenceId: IDS.txnOrderA,
        amount: 100,
        currency: 'USD',
      },
    });

    record('create-intent-evidence.json', { status: res.status, body: res.body });

    expect(String(res.body?.error || '')).not.toMatch(/Authoritative record not found/i);
    expect(res.status).not.toBe(404);
  });
});
