import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, api, record } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A, makePool } from './fixtures';
import type { Pool } from 'pg';

/**
 * P0-5 — freeServiceLocation has no tenant/property scope.
 *
 * Desired behaviour: staff from tenant A may not free tenant B's service
 * location (403/404), and tenant B's reservation must stay 'booked'. Today the
 * call returns 200 and completes the reservation, so this test fails.
 */
describe('P0-5 cross-tenant free service location', () => {
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

  it('does not free tenant B table or complete tenant B reservation', async () => {
    const res = await api('POST', `/staff/service-locations/${IDS.locationB}/free`, {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantA },
    });

    const reservation = await pool.query(`SELECT status FROM reservations WHERE id = $1`, [
      IDS.reservationB,
    ]);
    const location = await pool.query(`SELECT assigned_staff_id FROM service_locations WHERE id = $1`, [
      IDS.locationB,
    ]);

    record('p0-5-evidence.json', {
      status: res.status,
      body: res.body,
      reservationStatus: reservation.rows[0]?.status,
      assignedStaffId: location.rows[0]?.assigned_staff_id,
    });

    expect([401, 403, 404]).toContain(res.status);
    expect(reservation.rows[0]?.status).toBe('booked');
    expect(location.rows[0]?.assigned_staff_id).toBe(IDS.staffA);
  });

  it('still frees a location owned by the caller tenant (control)', async () => {
    const res = await api('POST', `/staff/service-locations/${IDS.locationA}/free`, {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantA },
    });

    record('p0-5-evidence.json', {
      case: 'same-tenant-control',
      status: res.status,
      body: res.body,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
