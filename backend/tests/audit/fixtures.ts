import { Pool } from 'pg';

/**
 * Fixtures for the audit proof suite. Fixed UUIDs, idempotent reset.
 * Everything here is local-stack only: DATABASE_URL comes from .env.test.
 */

export const IDS = {
  tenantA: 'aaaaaaaa-0000-4000-8000-000000000001',
  tenantB: 'bbbbbbbb-0000-4000-8000-000000000002',
  propertyA: 'cccccccc-0000-4000-8000-000000000003',
  propertyB: 'dddddddd-0000-4000-8000-000000000004',
  moduleA: '11111111-0000-4000-8000-000000000005',
  moduleB: '22222222-0000-4000-8000-000000000006',
  locationB: '33333333-0000-4000-8000-000000000007',
  locationA: '44444444-0000-4000-8000-000000000008',
  unitB: '55555555-0000-4000-8000-000000000009',
  managerA: 'a0000000-0000-4000-8000-00000000000a',
  customerA: 'a0000000-0000-4000-8000-00000000000b',
  staffA: 'a0000000-0000-4000-8000-00000000000c',
  txnRevenueB: 'b0000000-0000-4000-8000-00000000000d',
  txnOrderA: 'b0000000-0000-4000-8000-00000000000e',
  txnOrderB: 'b0000000-0000-4000-8000-00000000000f',
  txnStayB: 'b0000000-0000-4000-8000-000000000010',
  reservationB: 'c0000000-0000-4000-8000-000000000011',
} as const;

export const TENANT_SLUG_A = 'audit-proof-a';
export const TENANT_SLUG_B = 'audit-proof-b';
export const PASSWORD = 'AuditPass123!';
// bcrypt($2a$12$) for AuditPass123!
export const PASSWORD_HASH =
  '$2a$12$Oguq8PJOheIsiJQehADCb.SHnS68nfWARbR7HfuKlLNwVeZtZIRtS';

export const EMAILS = {
  managerA: 'audit.manager.a@local.test',
  customerA: 'audit.customer.a@local.test',
  staffA: 'audit.staff.a@local.test',
} as const;

export function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL missing (expected local .env.test)');
  if (!/127\.0\.0\.1|localhost/.test(connectionString)) {
    throw new Error(`Refusing non-local DATABASE_URL: ${connectionString}`);
  }
  return new Pool({ connectionString, connectionTimeoutMillis: 5000, ssl: false });
}

export async function cleanupFixtures(pool: Pool): Promise<void> {
  const tenants = [IDS.tenantA, IDS.tenantB];
  const properties = [IDS.propertyA, IDS.propertyB];
  const users = [IDS.managerA, IDS.customerA, IDS.staffA];

  const client = await pool.connect();
  try {
    // audit_logs carries INSTEAD OF rules on UPDATE, so the FK's ON DELETE SET NULL
    // action aborts property deletes with "referential integrity query ... gave
    // unexpected result". Replica mode skips FK triggers for this cleanup only.
    await client.query(`SET session_replication_role = 'replica'`);

    // SET NULL referrers are removed explicitly for the same reason.
    for (const table of [
      'audit_logs',
      'notifications',
      'notification_broadcasts',
      'notification_templates',
      'manager_approvals',
    ]) {
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name IN ('tenant_id','property_id')`,
        [table],
      );
      const hasTenant = cols.rows.some((r: any) => r.column_name === 'tenant_id');
      const hasProperty = cols.rows.some((r: any) => r.column_name === 'property_id');
      const clauses: string[] = [];
      const params: any[] = [];
      if (hasTenant) {
        params.push(tenants);
        clauses.push(`tenant_id = ANY($${params.length}::uuid[])`);
      }
      if (hasProperty) {
        params.push(properties);
        clauses.push(`property_id = ANY($${params.length}::uuid[])`);
      }
      if (clauses.length) {
        await client.query(`DELETE FROM ${table} WHERE ${clauses.join(' OR ')}`, params);
      }
    }
    await client.query('DELETE FROM payment_ledger WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM payments WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query(
      'DELETE FROM fulfillment_events WHERE fulfillment_id IN (SELECT id FROM fulfillments WHERE tenant_id = ANY($1::uuid[]))',
      [tenants],
    );
    await client.query('DELETE FROM fulfillments WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM price_history WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM reservations WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM transactions WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM user_property_access WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM sessions WHERE user_id = ANY($1::uuid[])', [users]);
    await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]);
    await client.query('DELETE FROM service_locations WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM accommodation_units WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM modules WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM properties WHERE tenant_id = ANY($1::uuid[])', [tenants]);
    await client.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [tenants]);
  } finally {
    try {
      await client.query(`SET session_replication_role = 'origin'`);
    } catch {
      /* connection already broken */
    }
    client.release();
  }
}

export async function ensureFixtures(pool: Pool): Promise<void> {
  await cleanupFixtures(pool);

  await pool.query(
    `INSERT INTO tenants (id, subdomain, subscription_tier, billing_status, feature_limits, is_platform_root, stripe_customer_id)
     VALUES ($1, $2, 'starter', 'active', '{}'::jsonb, false, NULL),
            ($3, $4, 'starter', 'active', '{}'::jsonb, false, NULL)`,
    [IDS.tenantA, TENANT_SLUG_A, IDS.tenantB, TENANT_SLUG_B],
  );

  await pool.query(
    `INSERT INTO properties (id, name, tenant_id, public_slug, currency, is_active)
     VALUES ($1, 'Audit Property A', $2, 'audit-property-a', 'USD', true),
            ($3, 'Audit Property B', $4, 'audit-property-b', 'USD', true)`,
    [IDS.propertyA, IDS.tenantA, IDS.propertyB, IDS.tenantB],
  );

  await pool.query(
    `INSERT INTO modules (id, name, slug, property_id, tenant_id, engine_type, is_active)
     VALUES ($1, 'Audit Module A', 'audit-probe-a', $2, $3, 'instant_transaction', true),
            ($4, 'Audit Module B', 'audit-probe-b', $5, $6, 'instant_transaction', true)`,
    [IDS.moduleA, IDS.propertyA, IDS.tenantA, IDS.moduleB, IDS.propertyB, IDS.tenantB],
  );

  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, scope, roles, tenant_id, is_active, email_verified, two_factor_enabled, token_version)
     VALUES
      ($1, $2, $8, 'Audit Manager A', 'property_manager', ARRAY['manager'], $5, true, true, false, 0),
      ($3, $4, $8, 'Audit Customer A', 'customer', ARRAY['customer'], $5, true, true, false, 0),
      ($6, $7, $8, 'Audit Staff A', 'property_staff', ARRAY['staff'], $5, true, true, false, 0)`,
    [
      IDS.managerA,
      EMAILS.managerA,
      IDS.customerA,
      EMAILS.customerA,
      IDS.tenantA,
      IDS.staffA,
      EMAILS.staffA,
      PASSWORD_HASH,
    ],
  );

  await pool.query(
    `INSERT INTO user_property_access (user_id, property_id, access_level, tenant_id)
     VALUES ($1, $2, 'write', $3)`,
    [IDS.staffA, IDS.propertyA, IDS.tenantA],
  );

  await pool.query(
    `INSERT INTO service_locations (id, module_id, tenant_id, property_id, name, assigned_staff_id)
     VALUES ($1, $2, $3, $4, 'Audit Table B', $5),
            ($6, $7, $8, $9, 'Audit Table A', NULL)`,
    [
      IDS.locationB,
      IDS.moduleB,
      IDS.tenantB,
      IDS.propertyB,
      IDS.staffA,
      IDS.locationA,
      IDS.moduleA,
      IDS.tenantA,
      IDS.propertyA,
    ],
  );

  await pool.query(
    `INSERT INTO accommodation_units (id, name, metadata, tenant_id, property_id, unit_number)
     VALUES ($1, 'Audit Unit B', '{}'::jsonb, $2, $3, 'AUDIT-B-101')`,
    [IDS.unitB, IDS.tenantB, IDS.propertyB],
  );

  await pool.query(
    `INSERT INTO transactions (id, engine_type, property_id, tenant_id, module_id, service_location_id, status, amount, currency, metadata)
     VALUES
      ($1, 'instant_transaction', $2, $3, NULL, NULL, 'completed', 4242.42, 'USD', '{"audit_fixture":true}'::jsonb),
      ($4, 'instant_transaction', $5, $6, $7, $8, 'open', 100.00, 'USD', '{"audit_fixture":true}'::jsonb),
      ($9, 'instant_transaction', $2, $3, $10, $11, 'open', 100.00, 'USD', '{"audit_fixture":true}'::jsonb),
      ($12, 'time_exclusive_reservation', $2, $3, NULL, $11, 'checked_in', 0, 'USD',
       '{"audit_fixture":true,"unit_id":"55555555-0000-4000-8000-000000000009","unit_number":"AUDIT-B-101","guest_name":"AUDIT VICTIM GUEST","guest_phone":"+15550001111","check_in_date":"2026-11-17","check_out_date":"2026-11-19"}'::jsonb)`,
    [
      IDS.txnRevenueB,
      IDS.propertyB,
      IDS.tenantB,
      IDS.txnOrderA,
      IDS.propertyA,
      IDS.tenantA,
      IDS.moduleA,
      IDS.locationA,
      IDS.txnOrderB,
      IDS.moduleB,
      IDS.locationB,
      IDS.txnStayB,
    ],
  );

  await pool.query(
    `INSERT INTO reservations (id, tenant_id, property_id, module_id, service_location_id, party_size, reserved_for, status, guest_name)
     VALUES ($1, $2, $3, $4, $5, 2, now(), 'booked', 'AUDIT VICTIM RESERVATION')`,
    [IDS.reservationB, IDS.tenantB, IDS.propertyB, IDS.moduleB, IDS.locationB],
  );
}
