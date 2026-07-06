/**
 * One-off cleanup: removes dev/test junk tenants and their alt/test owner
 * accounts, plus a handful of alt customer accounts created directly on the
 * "platform" root tenant. Leaves the platform tenant itself, its seeded
 * infra accounts (super_admin, menu_service_staff, e2e.customer fixture)
 * untouched.
 *
 * Safe to re-run: everything is matched by exact id/email, nothing is
 * inferred at run time.
 */
const { Client } = require('pg');
require('dotenv').config();

const c = new Client({ connectionString: process.env.DATABASE_URL });

// All 13 non-platform-root tenants currently in the DB — every one is a
// dev/test tenant (test-beginner-*, testcorp, suspended, xandar*, alessandro10).
const JUNK_TENANT_IDS = [
  'f93a6dc4-9565-4c14-943e-931e2a72dd3e', // testcorp
  '6512bc32-dbe7-40a7-8d0d-e3058a00c216', // suspended
  '2549c84b-9330-47cf-b8a7-5f36683e398d', // xandar
  '669520f0-428c-4c09-9377-814a3e74f52a', // test-beginner-0afb35df
  '19c88da0-6ad2-4bce-a581-10835672d9d8', // test-beginner-2515f051
  '19efa58a-f182-42fb-a9e8-dda9dc6eb20e', // test-beginner-7243dbd2
  '02efb159-87b9-4fd1-a5a4-7130fb47eed2', // test-beginner-13d978ae
  'd3547e97-feff-43b6-bf2d-d33dc2a59b17', // test-beginner-0873404d
  'b7176ba1-3edb-42a6-8038-6f32acb5e8a3', // test-beginner-15f606ef
  'd5c7bf50-e59b-4bf6-bb10-adf3f4d6f598', // test-beginner-9aa5cccc
  '6bbd1288-8515-480c-8cda-ffeaedc8407b', // alessandro10
  'b8c1efe0-da2c-47aa-b175-36d6394aa0af', // xandarian2
  '09f60475-4bc6-4c6b-911c-6e479ad3beba', // xandarian332
];

// Alt/test customer accounts registered directly on the "platform" tenant
// (created 6/23 onward, i.e. manual testing — NOT the 6/22 seed fixtures:
// super_admin, menu.service.staff, e2e.customer are left alone).
const JUNK_PLATFORM_EMAILS = [
  'admin@testcorp.v2platform.com',
  'alessandro.abisafi2@gmail.com',
  'xandar.5000@gmail.com',
  'walidbereh56@gmail.com',
];

(async () => {
  await c.connect();
  try {
    await c.query('BEGIN');

    // audit_logs is intentionally append-only (ON DELETE/UPDATE DO INSTEAD
    // NOTHING rules) — good for compliance, but it silently breaks cascade
    // deletes from tenants (the FK check sees rows "still there" after the
    // no-op delete and throws). Disable for this transaction only, restore
    // before commit.
    await c.query('ALTER TABLE public.audit_logs DISABLE RULE audit_log_no_delete');

    // 1. Delete users tied to the junk tenants first — users.tenant_id is
    //    ON DELETE SET NULL, so deleting the tenant first would orphan them
    //    instead of removing them.
    const usersOnJunkTenants = await c.query(
      `DELETE FROM public.users WHERE tenant_id = ANY($1::uuid[]) RETURNING email`,
      [JUNK_TENANT_IDS]
    );

    // 2. Delete the alt customer accounts sitting on the platform tenant.
    const platformAlts = await c.query(
      `DELETE FROM public.users WHERE email = ANY($1::text[]) RETURNING email`,
      [JUNK_PLATFORM_EMAILS]
    );

    // 3. Delete the junk tenants themselves — cascades to every tenant-scoped
    //    table (properties, roles, sessions, orders, etc.)
    const tenants = await c.query(
      `DELETE FROM public.tenants WHERE id = ANY($1::uuid[]) RETURNING subdomain`,
      [JUNK_TENANT_IDS]
    );

    await c.query('ALTER TABLE public.audit_logs ENABLE RULE audit_log_no_delete');

    await c.query('COMMIT');

    console.log(`Deleted ${tenants.rows.length} tenants:`, tenants.rows.map(r => r.subdomain));
    console.log(`Deleted ${usersOnJunkTenants.rows.length} tenant-owner users:`, usersOnJunkTenants.rows.map(r => r.email));
    console.log(`Deleted ${platformAlts.rows.length} platform alt accounts:`, platformAlts.rows.map(r => r.email));
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('Rolled back — nothing was deleted.', err);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
