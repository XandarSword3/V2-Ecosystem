import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { Pool } from 'pg';
import { BASE_URL, login, api, record } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A, makePool } from './fixtures';

/**
 * Task 7 — P0-6 checked-in rooms scoping + folio ledger alignment.
 *
 * Proofs:
 *   1. GET /staff/modules/audit-probe-a/checked-in-rooms returns 200, only
 *      tenant A / property A bookings, and the guest name comes from the
 *      hinted `users!transactions_customer_id_fkey` embed.
 *   2. A $50 ledger charge produces a $50 folio balance.
 *   3. A platform-secret, platform-signed `payment_intent.succeeded` whose
 *      metadata says referenceType=room_folio writes a 'settlement'/'completed'
 *      ledger row and drives the balance to 0.
 *   4. Tenant B's checked-in booking is absent and tenant B's folio is 404 for
 *      staff A.
 */

const PLATFORM_SECRET = 'whsec_platform_audit_task2';
const PI_FOLIO = 'pi_task7_folio_settlement';
const PI_LEGACY = 'pi_task7_legacy_success';
const EVENT_ID = 'evt_task7_folio_settlement';
const BOOKING_A = 'e0000000-0000-4000-8000-000000000021';
const UNIT_A = 'f0000000-0000-4000-8000-000000000021';
const GUEST_NAME = 'Audit Customer A';

function sign(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

async function postWebhook(payload: string, secret: string) {
  const res = await fetch(`${BASE_URL}/payments/webhook/stripe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sign(payload, secret),
    },
    body: payload,
  });
  const raw = await res.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body, raw };
}

describe('Task 7 — checked-in rooms + folio ledger', () => {
  let pool: Pool;
  let token = '';

  async function cleanup() {
    // payment_ledger has an immutability trigger that forbids DELETE. Fixture
    // cleanup bypasses triggers with session_replication_role=replica; do the
    // same for the rows this file creates.
    const client = await pool.connect();
    try {
      await client.query(`SET session_replication_role = 'replica'`);
      await client.query(
        'DELETE FROM payment_ledger WHERE reference_id = $1 OR gateway_reference_id = ANY($2::text[])',
        [BOOKING_A, [PI_FOLIO, PI_LEGACY]],
      );
      await client.query(`SET session_replication_role = 'origin'`);
    } finally {
      client.release();
    }
    await pool.query('DELETE FROM payments WHERE reference_id = $1 OR stripe_payment_intent_id = $2', [
      BOOKING_A,
      PI_FOLIO,
    ]);
    await pool.query('DELETE FROM transactions WHERE id = $1', [BOOKING_A]);
    await pool.query('DELETE FROM accommodation_units WHERE id = $1', [UNIT_A]);
  }

  beforeAll(async () => {
    pool = makePool();
    await cleanup();

    // Tenant A / property A room and checked-in booking. The booking has no
    // metadata.guest_name: the returned name must come from customer_id's FK
    // embed, which is the relationship P0-6 could not resolve.
    await pool.query(
      `INSERT INTO accommodation_units (id, name, metadata, tenant_id, property_id, unit_number)
       VALUES ($1, 'Task 7 Suite', '{}'::jsonb, $2, $3, 'T7-101')`,
      [UNIT_A, IDS.tenantA, IDS.propertyA],
    );

    await pool.query(
      `INSERT INTO transactions
         (id, engine_type, property_id, tenant_id, module_id, status, amount, currency,
          customer_id, metadata)
       VALUES ($1, 'time_exclusive_reservation', $2, $3, $4, 'checked_in', 0, 'USD', $5, $6::jsonb)`,
      [
        BOOKING_A,
        IDS.propertyA,
        IDS.tenantA,
        IDS.moduleA,
        IDS.customerA,
        JSON.stringify({
          audit_fixture: true,
          booking_number: 'T7-0001',
          unit_id: UNIT_A,
          unit_number: 'T7-101',
          check_in_date: '2026-11-17',
          check_out_date: '2026-11-21',
        }),
      ],
    );

    const auth = await login(EMAILS.staffA, PASSWORD, TENANT_SLUG_A);
    token = auth.token;
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  const staffHeaders = () => ({ 'X-Tenant-ID': IDS.tenantA, 'X-Property-ID': IDS.propertyA });

  it('returns only the caller tenant/property booking and resolves the guest through the hinted FK', async () => {
    const res = await api('GET', '/staff/modules/audit-probe-a/checked-in-rooms', {
      token,
      headers: staffHeaders(),
    });

    record('task7-folio-ledger.json', {
      case: 'checked-in-rooms-tenant-scope',
      status: res.status,
      body: res.body,
    });

    expect(res.status).toBe(200);
    expect(res.raw).not.toContain('AUDIT VICTIM GUEST');

    const rows: any[] = res.body?.data ?? [];
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(BOOKING_A);
    expect(ids).not.toContain(IDS.txnStayB);

    const ownRow = rows.find((r) => r.id === BOOKING_A);
    expect(ownRow?.guestName).toBe(GUEST_NAME);
    expect(ownRow?.unitNumber).toBe('T7-101');
  });

  it('charges $50, counts a legacy success-status settlement, and settles the folio through the Stripe webhook', async () => {
    await pool.query(
      `INSERT INTO payment_ledger
         (reference_type, reference_id, event_type, amount, currency, status, tenant_id, property_id, metadata)
       VALUES ('room_folio', $1, 'charge', 50.00, 'USD', 'completed', $2, $3, '{"audit_fixture":true}'::jsonb)`,
      [BOOKING_A, IDS.tenantA, IDS.propertyA],
    );

    // Legacy Stripe-webhook rows used status='success'. Folio readers must
    // count them, otherwise a guest who already paid through Stripe still
    // shows the full balance.
    await pool.query(
      `INSERT INTO payment_ledger
         (reference_type, reference_id, event_type, amount, currency, status,
          tenant_id, property_id, gateway_reference_id, metadata)
       VALUES ('room_folio', $1, 'settlement', 10.00, 'USD', 'success', $2, $3, $4, '{"audit_fixture":true}'::jsonb)`,
      [BOOKING_A, IDS.tenantA, IDS.propertyA, PI_LEGACY],
    );

    const afterCharge = await api('GET', `/payments/folio-balance/${BOOKING_A}`, {
      token,
      headers: staffHeaders(),
    });
    expect(afterCharge.status).toBe(200);
    expect(afterCharge.body?.data?.totalCharges).toBe(50);
    expect(afterCharge.body?.data?.totalSettlements).toBe(10);
    expect(afterCharge.body?.data?.balance).toBe(40);

    const payload = JSON.stringify({
      id: EVENT_ID,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: PI_FOLIO,
          object: 'payment_intent',
          amount: 4000,
          currency: 'usd',
          latest_charge: 'ch_task7_folio',
          metadata: {
            referenceId: BOOKING_A,
            referenceType: 'room_folio',
            tenantId: IDS.tenantA,
          },
        },
      },
    });

    const webhook = await postWebhook(payload, PLATFORM_SECRET);

    const ledger = await pool.query(
      `SELECT reference_type, event_type, status, amount, tenant_id, property_id
         FROM payment_ledger WHERE gateway_reference_id = $1`,
      [PI_FOLIO],
    );
    const payment = await pool.query(
      `SELECT reference_type, status, tenant_id, property_id
         FROM payments WHERE stripe_payment_intent_id = $1`,
      [PI_FOLIO],
    );

    record('task7-folio-ledger.json', {
      case: 'webhook-room-folio-settlement',
      status: webhook.status,
      body: webhook.body,
      beforeBalance: afterCharge.body?.data?.balance,
      ledgerRows: ledger.rows,
      paymentRows: payment.rows,
    });

    expect(webhook.status).toBe(200);
    expect(webhook.body).toEqual({ received: true });

    expect(ledger.rowCount).toBe(1);
    expect(ledger.rows[0]).toMatchObject({
      reference_type: 'room_folio',
      event_type: 'settlement',
      status: 'completed',
      tenant_id: IDS.tenantA,
      property_id: IDS.propertyA,
    });

    expect(payment.rowCount).toBe(1);
    expect(payment.rows[0]).toMatchObject({
      reference_type: 'room_folio',
      status: 'completed',
      tenant_id: IDS.tenantA,
      property_id: IDS.propertyA,
    });

    const after = await api('GET', `/payments/folio-balance/${BOOKING_A}`, {
      token,
      headers: staffHeaders(),
    });
    expect(after.status).toBe(200);
    expect(after.body?.data?.totalCharges).toBe(50);
    expect(after.body?.data?.totalSettlements).toBe(50);
    expect(after.body?.data?.balance).toBe(0);

    const rooms = await api('GET', '/staff/modules/audit-probe-a/checked-in-rooms', {
      token,
      headers: staffHeaders(),
    });
    const ownRow = (rooms.body?.data ?? []).find((r: any) => r.id === BOOKING_A);
    expect(ownRow?.balance).toBe(0);
  });

  it('does not expose tenant B folio to tenant A staff', async () => {
    const res = await api('GET', `/payments/folio-balance/${IDS.txnStayB}`, {
      token,
      headers: staffHeaders(),
    });

    record('task7-folio-ledger.json', {
      case: 'tenant-b-folio-denied',
      status: res.status,
      body: res.body,
    });

    expect(res.status).toBe(404);
  });
});
