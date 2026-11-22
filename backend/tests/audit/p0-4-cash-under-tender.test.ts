import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, api, record } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A, makePool } from './fixtures';
import type { Pool } from 'pg';

/**
 * P0-4 — cash settlement accepts an under-tender.
 *
 * Desired behaviour: $0.01 against a $100 order must be rejected (4xx) and must
 * not create a completed payment row. Today it returns 201 with
 * payments.status='completed', so this test fails.
 */
describe('P0-4 cash under-tender', () => {
  let token = '';
  let pool: Pool;

  beforeAll(async () => {
    const auth = await login(EMAILS.staffA, PASSWORD, TENANT_SLUG_A);
    token = auth.token;
    pool = makePool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('does not accept $0.01 for a $100 order', async () => {
    const res = await api('POST', '/payments/record-cash', {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantA, 'X-Property-ID': IDS.propertyA },
      body: {
        referenceType: 'instant_transaction',
        referenceId: IDS.txnOrderA,
        amount: 0.01,
        notes: 'audit under-tender proof',
      },
    });

    const rows = await pool.query(
      `SELECT id, amount, status, method FROM payments WHERE reference_id = $1`,
      [IDS.txnOrderA],
    );

    record('p0-4-evidence.json', {
      status: res.status,
      body: res.body,
      paymentRows: rows.rows,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(rows.rowCount).toBe(0);
  });

  it('accepts the exact amount and marks the order paid (control)', async () => {
    const res = await api('POST', '/payments/record-cash', {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantA, 'X-Property-ID': IDS.propertyA },
      body: {
        referenceType: 'instant_transaction',
        referenceId: IDS.txnOrderA,
        amount: 100,
        notes: 'audit exact-tender control',
      },
    });

    const payments = await pool.query(
      `SELECT amount, status, method FROM payments WHERE reference_id = $1`,
      [IDS.txnOrderA],
    );
    const order = await pool.query(
      `SELECT metadata->>'payment_status' AS payment_status FROM transactions WHERE id = $1`,
      [IDS.txnOrderA],
    );

    record('p0-4-evidence.json', {
      case: 'exact-tender-control',
      status: res.status,
      body: res.body,
      paymentRows: payments.rows,
      orderPaymentStatus: order.rows[0]?.payment_status,
    });

    expect(res.status).toBe(201);
    expect(payments.rowCount).toBe(1);
    expect(payments.rows[0].status).toBe('completed');
    // `transactions` has no payment_status column; the canonical flag is in
    // metadata, and this is the check that used to be silently discarded.
    expect(order.rows[0]?.payment_status).toBe('paid');
  });
});
