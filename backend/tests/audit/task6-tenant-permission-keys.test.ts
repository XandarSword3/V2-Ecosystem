import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { IDS } from './fixtures';

/**
 * Task 6 — two tenants must be able to own the same module slug's permission
 * keys independently.
 *
 * Schema under test:
 *   app_permissions      PK (tenant_id, property_id, slug)
 *   app_role_permissions PK (tenant_id, property_id, role_name, permission_slug)
 *   composite FK (tenant_id, property_id, permission_slug) -> app_permissions
 *
 * On the old schema (PK slug / PK role_name,permission_slug) the second
 * tenant's upsert either overwrote the first tenant's row or, with plain
 * inserts, failed 23505.
 */

const SLUG_VIEW = 'module:task6-probe:view';
const SLUG_MANAGE = 'module:task6-probe:manage';
const ROLE = 'admin';

describe('Task 6 — tenant-scoped permission keys', () => {
  let pool: Pool;

  async function cleanup() {
    await pool.query('DELETE FROM app_role_permissions WHERE permission_slug = ANY($1::text[])', [
      [SLUG_VIEW, SLUG_MANAGE],
    ]);
    await pool.query('DELETE FROM app_permissions WHERE slug = ANY($1::text[])', [[SLUG_VIEW, SLUG_MANAGE]]);
  }

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL missing (expected local .env.test)');
    if (!/127\.0\.0\.1|localhost/.test(connectionString)) {
      throw new Error(`Refusing non-local DATABASE_URL: ${connectionString}`);
    }
    pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000, ssl: false });
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  async function upsertPermission(tenantId: string, propertyId: string, description: string) {
    return pool.query(
      `INSERT INTO app_permissions (slug, description, module_slug, tenant_id, property_id)
       VALUES ($1, $2, 'task6-probe', $3, $4)
       ON CONFLICT (tenant_id, property_id, slug)
       DO UPDATE SET description = EXCLUDED.description`,
      [SLUG_VIEW, description, tenantId, propertyId],
    );
  }

  async function grant(tenantId: string, propertyId: string, slug: string) {
    return pool.query(
      `INSERT INTO app_role_permissions (role_name, permission_slug, tenant_id, property_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, property_id, role_name, permission_slug) DO NOTHING`,
      [ROLE, slug, tenantId, propertyId],
    );
  }

  it('stores independent permission rows for the same slug in two tenants', async () => {
    await upsertPermission(IDS.tenantA, IDS.propertyA, 'tenant A');
    await upsertPermission(IDS.tenantB, IDS.propertyB, 'tenant B');

    const rows = await pool.query(
      `SELECT tenant_id, property_id, description
         FROM app_permissions
        WHERE slug = $1
        ORDER BY tenant_id`,
      [SLUG_VIEW],
    );

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ case: 'permission-rows', rows: rows.rows }));

    expect(rows.rowCount).toBe(2);
    const byTenant = new Map(rows.rows.map((r) => [r.tenant_id, r]));
    expect(byTenant.get(IDS.tenantA)?.description).toBe('tenant A');
    expect(byTenant.get(IDS.tenantA)?.property_id).toBe(IDS.propertyA);
    expect(byTenant.get(IDS.tenantB)?.description).toBe('tenant B');
    expect(byTenant.get(IDS.tenantB)?.property_id).toBe(IDS.propertyB);
  });

  it("an upsert for one tenant cannot overwrite the other tenant's row", async () => {
    await upsertPermission(IDS.tenantA, IDS.propertyA, 'tenant A updated');
    await upsertPermission(IDS.tenantB, IDS.propertyB, 'tenant B updated');

    const rows = await pool.query(
      `SELECT tenant_id, description FROM app_permissions WHERE slug = $1 ORDER BY tenant_id`,
      [SLUG_VIEW],
    );

    const byTenant = new Map(rows.rows.map((r) => [r.tenant_id, r.description]));
    expect(rows.rowCount).toBe(2);
    expect(byTenant.get(IDS.tenantA)).toBe('tenant A updated');
    expect(byTenant.get(IDS.tenantB)).toBe('tenant B updated');
  });

  it('stores independent role grants and each tenant reads only its own', async () => {
    await grant(IDS.tenantA, IDS.propertyA, SLUG_VIEW);
    await grant(IDS.tenantB, IDS.propertyB, SLUG_VIEW);

    const grants = await pool.query(
      `SELECT tenant_id, property_id FROM app_role_permissions
        WHERE permission_slug = $1 AND role_name = $2
        ORDER BY tenant_id`,
      [SLUG_VIEW, ROLE],
    );

    // This is the exact reader shape updateModule/deleteModule now use.
    const tenantA = await pool.query(
      `SELECT permission_slug FROM app_role_permissions
        WHERE permission_slug = $1 AND role_name = $2 AND tenant_id = $3`,
      [SLUG_VIEW, ROLE, IDS.tenantA],
    );
    const tenantB = await pool.query(
      `SELECT permission_slug FROM app_role_permissions
        WHERE permission_slug = $1 AND role_name = $2 AND tenant_id = $3`,
      [SLUG_VIEW, ROLE, IDS.tenantB],
    );

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      case: 'role-grants',
      grants: grants.rows,
      tenantA: tenantA.rowCount,
      tenantB: tenantB.rowCount,
    }));

    expect(grants.rowCount).toBe(2);
    expect(tenantA.rowCount).toBe(1);
    expect(tenantB.rowCount).toBe(1);
  });

  it('the composite FK rejects a grant pointing at another tenant permission row', async () => {
    // SLUG_MANAGE exists only for tenant B.
    await pool.query(
      `INSERT INTO app_permissions (slug, description, module_slug, tenant_id, property_id)
       VALUES ($1, 'tenant B only', 'task6-probe', $2, $3)`,
      [SLUG_MANAGE, IDS.tenantB, IDS.propertyB],
    );

    await expect(
      pool.query(
        `INSERT INTO app_role_permissions (role_name, permission_slug, tenant_id, property_id)
         VALUES ($1, $2, $3, $4)`,
        [ROLE, SLUG_MANAGE, IDS.tenantA, IDS.propertyA],
      ),
    ).rejects.toThrow(/violates foreign key constraint/);

    const crossTenant = await pool.query(
      `SELECT COUNT(*)::int AS n FROM app_role_permissions
        WHERE permission_slug = $1 AND tenant_id = $2`,
      [SLUG_MANAGE, IDS.tenantA],
    );
    expect(crossTenant.rows[0].n).toBe(0);
  });

  it('the legacy global key no longer exists', async () => {
    const indexes = await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'app_permissions'::regclass AND contype = 'p'`,
    );
    const def = indexes.rows[0]?.def as string;
    expect(def).toBe('PRIMARY KEY (tenant_id, property_id, slug)');
  });
});
