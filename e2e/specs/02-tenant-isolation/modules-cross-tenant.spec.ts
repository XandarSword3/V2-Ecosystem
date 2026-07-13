/**
 * e2e/specs/02-tenant-isolation/modules-cross-tenant.spec.ts
 *
 * Layer 2 — Tenant isolation: admin/manager cross-tenant tampering.
 *
 * Regression test for remediation-plan Phase 0, item 0.1
 * (backend/src/modules/admin/modules.controller.ts: updateModule, deleteModule).
 *
 * The bug: these handlers resolved "the caller's tenant" from req.tenant /
 * the X-Tenant-ID header instead of the authenticated caller's own tenant
 * (req.user.tenantId, from the verified JWT). resolveTenant() (see
 * tenantAccess.middleware.ts) will happily attach ANY existing tenant to
 * req.tenant based on a client-supplied X-Tenant-ID header, with no check
 * that the header matches who the caller actually is. So an authenticated
 * admin of one tenant could act on another tenant's modules just by sending
 * X-Tenant-ID: <other tenant's id> alongside their own valid Bearer token.
 *
 * What this proves:
 *   - A testcorp admin, authenticated with their own valid token, sending
 *     X-Tenant-ID: <othercorp's id> cannot update an othercorp module (404).
 *   - Same for delete.
 *   - The othercorp module is provably untouched afterwards.
 *
 * Out of scope here: the matching fix on the CREATE path (modules.controller.ts
 * createModule, lines ~129/189) uses the same shared helper
 * (security/tenant-scope.ts getCallerTenantId) and is covered by the
 * TypeScript build + code review — not repeated here as a live API test,
 * since exercising it end-to-end also requires satisfying
 * propertyAccess.middleware's separate tenant/property ownership guard,
 * which would make this test fragile without adding isolation signal beyond
 * what update/delete already prove.
 *
 * All calls are Node.js API calls — localhost:3005 + explicit headers.
 * See fixtures/base.ts for why *.localhost URLs are not used here.
 */

import { test, expect, fetchTestAdminToken } from '../../fixtures/base';
import { getTestTenant, TEST_TENANTS } from '../../fixtures/tenant.fixture';

const BACKEND = 'http://localhost:3005';

test.describe('Layer 2 — Tenant isolation: modules cross-tenant (Phase 0 / 0.1)', () => {
  test('testcorp admin cannot update or delete an othercorp module by spoofing X-Tenant-ID', async ({ supabase }) => {
    const othercorp = await getTestTenant(TEST_TENANTS.SECONDARY);

    // Seed a genuine othercorp-owned module directly (service-role client) —
    // bypasses the create endpoint's unrelated property-context requirement.
    // This is a pure fixture, not the thing under test.
    const { data: property, error: propError } = await supabase
      .from('properties')
      .insert({ name: `Isolation test property ${Date.now()}` })
      .select('id')
      .single();
    if (propError || !property) {
      throw new Error(`[fixture] Failed to seed property: ${propError?.message}`);
    }

    const uniqueSlug = `isolation-test-${Date.now()}`;
    const { data: module_, error: modError } = await supabase
      .from('modules')
      .insert({
        engine_type: 'instant_transaction',
        name: `Isolation test module ${Date.now()}`,
        slug: uniqueSlug,
        tenant_id: othercorp.id,
        property_id: property.id,
        is_active: true,
      })
      .select('id, tenant_id, name')
      .single();
    if (modError || !module_) {
      throw new Error(`[fixture] Failed to seed othercorp module: ${modError?.message}`);
    }

    try {
      const testcorpToken = await fetchTestAdminToken(TEST_TENANTS.PRIMARY);

      // ---- Attempt to update it as testcorp's admin, spoofing X-Tenant-ID ----
      const updateRes = await fetch(`${BACKEND}/api/v1/admin/modules/${module_.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testcorpToken}`,
          'x-tenant-id': othercorp.id, // spoofed — the whole point of this test
        },
        body: JSON.stringify({ name: 'Hijacked by testcorp admin' }),
      });
      expect(updateRes.status).toBe(404);

      // ---- Attempt to delete it, same spoofed header ----
      const deleteRes = await fetch(`${BACKEND}/api/v1/admin/modules/${module_.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testcorpToken}`,
          'x-tenant-id': othercorp.id,
        },
      });
      expect(deleteRes.status).toBe(404);

      // ---- Confirm the module is provably untouched ----
      const { data: unchanged, error: fetchError } = await supabase
        .from('modules')
        .select('name, tenant_id, is_active')
        .eq('id', module_.id)
        .single();

      expect(fetchError).toBeNull();
      expect(unchanged?.tenant_id).toBe(othercorp.id);
      expect(unchanged?.name).not.toBe('Hijacked by testcorp admin');
      expect(unchanged?.is_active).toBe(true); // delete didn't soft-delete it either
    } finally {
      // Cleanup fixture rows regardless of test outcome.
      await supabase.from('modules').delete().eq('id', module_.id);
      await supabase.from('properties').delete().eq('id', property.id);
    }
  });
});
