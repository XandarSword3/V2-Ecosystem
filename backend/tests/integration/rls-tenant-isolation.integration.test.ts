/**
 * RLS tenant isolation (Engine A) — real database verification.
 *
 * Post-review, plan step 3: do not accept "policy added" as done. This test
 * connects to the real migrated database with the DATABASE_URL connection
 * (the postgres superuser) and proves the hardening actually closed the
 * holes:
 *
 *   1. ROW LEVEL SECURITY is enabled on fiscal_profiles / fiscal_documents /
 *      fiscal_submissions / fulfillments / fulfillment_events;
 *   2. anon has NO table-level SELECT on fulfillments / fulfillment_events
 *      (the baseline default privileges granted it at creation);
 *   3. the SECURITY DEFINER RPCs (transition_fulfillment, ensure_fulfillment,
 *      next_fiscal_document_number) are executable by service_role only —
 *      not by anon or authenticated;
 *   4. as SET ROLE authenticated (no JWT → auth.uid() is null → every
 *      policy denies), reads of fiscal_documents / fulfillments /
 *      fulfillment_events return ZERO rows — the tables are not
 *      world-readable;
 *   5. calling transition_fulfillment as authenticated fails with a
 *      PERMISSION error (42501), not a business-logic error.
 *
 * Requires RUN_INTEGRATION_TESTS=true and a migrated real database
 * (see vitest.integration.config.ts / .env.test). The same checks are
 * documented for the SQL editor in supabase/verify/rls-tenant-isolation.sql.
 */
import { describe, it, expect } from 'vitest';
import { Client } from 'pg';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

const RLS_TABLES = [
  'fiscal_profiles',
  'fiscal_documents',
  'fiscal_submissions',
  'fulfillments',
  'fulfillment_events',
];

const SECURITY_DEFINER_RPCS = [
  'transition_fulfillment',
  'ensure_fulfillment',
  'next_fiscal_document_number',
];

describeIntegration('RLS tenant isolation (Engine A)', () => {
  it('proves the fiscal + fulfillment tables are closed to cross-tenant reads', async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for integration tests');
    }
    const client = new Client({ connectionString });
    await client.connect();
    try {
      // 1. RLS enabled on all five tables.
      const { rows: rls } = await client.query(
        `SELECT tablename, rowsecurity FROM pg_tables
         WHERE schemaname = 'public' AND tablename = ANY($1)`,
        [RLS_TABLES],
      );
      expect(rls.length).toBe(RLS_TABLES.length);
      for (const r of rls) {
        expect(r.rowsecurity, `ROW LEVEL SECURITY must be enabled on ${r.tablename}`).toBe(true);
      }

      // 2. anon has no table-level SELECT on fulfillments / fulfillment_events.
      const { rows: anonGrants } = await client.query(
        `SELECT grantee, table_name, privilege_type
         FROM information_schema.role_table_grants
         WHERE table_schema = 'public'
           AND table_name IN ('fulfillments', 'fulfillment_events')
           AND grantee = 'anon'`,
      );
      expect(anonGrants.length).toBe(0);

      // 3. SECURITY DEFINER RPCs: service_role-only.
      const { rows: rpcRights } = await client.query(
        `SELECT p.proname AS fn,
                has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
                has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = ANY($1)`,
        [SECURITY_DEFINER_RPCS],
      );
      expect(rpcRights.length).toBe(SECURITY_DEFINER_RPCS.length);
      for (const r of rpcRights) {
        expect(r.anon_exec, `${r.fn}: anon must not EXECUTE`).toBe(false);
        expect(r.auth_exec, `${r.fn}: authenticated must not EXECUTE`).toBe(false);
        expect(r.svc_exec, `${r.fn}: service_role must EXECUTE`).toBe(true);
      }

      // 4. SET ROLE authenticated (no JWT → policies deny) → zero rows.
      await client.query('SET ROLE authenticated');
      for (const table of ['fiscal_documents', 'fulfillments', 'fulfillment_events']) {
        const { rows } = await client.query(
          `SELECT count(*)::int AS n FROM public.${table}`,
        );
        expect(
          rows[0].n,
          `authenticated (no tenant context) must see 0 rows in ${table}`,
        ).toBe(0);
      }
      await client.query('RESET ROLE');

      // 5. transition_fulfillment as authenticated → PERMISSION error (42501),
      //    never a business-logic result.
      await client.query('SET ROLE authenticated');
      let permissionError = false;
      try {
        // Pass the full 7-arg signature so the function is FOUND and the
        // EXECUTE-permission check is what fires (a missing-arg call would
        // fail earlier with "function does not exist", masking the test).
        await client.query(
          `SELECT public.transition_fulfillment(
             '00000000-0000-0000-0000-000000000000', 'ready', 'mark_ready',
             'staff', NULL, NULL, NULL)`,
        );
      } catch (err: any) {
        permissionError = String(err?.code) === '42501' || /permission denied/.test(String(err?.message));
      }
      await client.query('RESET ROLE');
      expect(permissionError, 'transition_fulfillment must fail with a permission error for authenticated').toBe(true);
    } finally {
      await client.end();
    }
  });
});
