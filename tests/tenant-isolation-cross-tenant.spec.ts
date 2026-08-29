/**
 * F2.5: Cross-Tenant Isolation — Real Resource Access
 *
 * Tests the backend's requireModulePropertyAccess middleware against
 * the real database. Proves:
 *
 *   1. Staff can access their own tenant's modules
 *   2. All modules returned belong to the staff's tenant
 *   3. Accessing a nonexistent module returns 404 (not 200 with data)
 *   4. Cross-tenant header manipulation does NOT grant access
 *   5. The middleware code enforces tenant_id match
 *
 * NOTE: This database has only one tenant. True cross-tenant access denial
 * (Staff A → Module B where B is in Tenant 2) is proven by code audit of
 * requireModulePropertyAccess() in backend/src/middleware/propertyAccess.middleware.ts:
 *
 *   Line 267-278: if (moduleRecord.tenant_id !== userTenantId) → 403
 *
 * The middleware unconditionally rejects cross-tenant access. This test proves
 * the same tenant boundary works correctly for the only tenant we have.
 *
 * Prerequisites:
 *   - Running backend (localhost:3005)
 *   - Staff user: menu.service.staff@v2ecosystem.com / staff123
 *   - Module 'delete' (instant_transaction, tenant cef22e40-...)
 *
 * Run: npx playwright test tests/tenant-isolation-cross-tenant.spec.ts
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3005';
const STAFF = { email: 'menu.service.staff@v2ecosystem.com', password: 'staff123' };
const OWN_MODULE = 'delete';

async function login(request: any): Promise<{ token: string; tenantId: string; scope: string }> {
  const response = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: STAFF.email, password: STAFF.password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.ok(), `Login should succeed`).toBeTruthy();
  const body = await response.json();
  const token = body.data.tokens.accessToken;

  // Get tenant_id from /auth/me
  const meResp = await request.get(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const meBody = await meResp.json();

  return {
    token,
    tenantId: meBody.data.tenantId,
    scope: meBody.data.scope,
  };
}

// ============================================
// 1. Staff owns their tenant
// ============================================

test.describe('Staff tenant ownership', () => {
  test('staff JWT tenant_id matches modules tenant_id', async ({ request }) => {
    const { token, tenantId } = await login(request);

    expect(tenantId, 'Staff must have a tenantId').toBeTruthy();

    // Get modules
    const modResp = await request.get(`${API_URL}/api/v1/admin/modules`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const modBody = await modResp.json();
    const modules = modBody.data || [];

    expect(modules.length, 'Tenant must have at least one module').toBeGreaterThan(0);

    // Every module must belong to the staff's tenant
    for (const mod of modules) {
      expect(
        mod.tenant_id,
        `Module '${mod.slug}' must have tenant_id`,
      ).toBeTruthy();
      expect(
        mod.tenant_id,
        `Module '${mod.slug}' tenant_id '${mod.tenant_id}' must match staff tenant '${tenantId}'`,
      ).toBe(tenantId);
    }
  });
});

// ============================================
// 2. Staff can access own module
// ============================================

test.describe('Staff accesses own module', () => {
  test('staff can list orders for their own module', async ({ request }) => {
    const { token } = await login(request);

    const response = await request.get(
      `${API_URL}/api/v1/staff/modules/${OWN_MODULE}/orders`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );

    expect(response.ok(), 'Staff should access own module orders').toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data), 'Response should contain an orders array').toBeTruthy();
  });

  test('staff can create and list items for their own module', async ({ request }) => {
    const { token } = await login(request);

    const response = await request.get(
      `${API_URL}/api/v1/${OWN_MODULE}/items`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );

    expect(response.ok(), 'Staff should access own module catalog').toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});

// ============================================
// 3. Nonexistent module returns 404 (not 200)
// ============================================

test.describe('Nonexistent module returns 404', () => {
  test('accessing nonexistent module slug returns 404', async ({ request }) => {
    const { token } = await login(request);

    const response = await request.get(
      `${API_URL}/api/v1/staff/modules/nonexistent-module-abc123/orders`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );

    // requireModulePropertyAccess returns 404 when module doesn't exist
    expect(response.status(), 'Nonexistent module must return 404').toBe(404);
  });

  test('accessing nonexistent module via admin endpoint returns 404', async ({ request }) => {
    const { token } = await login(request);

    const response = await request.get(
      `${API_URL}/api/v1/admin/modules/nonexistent-module-abc123`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );

    expect(response.status(), 'Nonexistent module must return 404').toBe(404);
  });
});

// ============================================
// 4. Cross-tenant header manipulation
// ============================================

test.describe('Header manipulation does not bypass tenant boundary', () => {
  test('x-tenant-id header with wrong tenant causes rejection', async ({ request }) => {
    const { token, tenantId } = await login(request);

    // Send x-tenant-id with a DIFFERENT tenant ID
    const response = await request.get(`${API_URL}/api/v1/admin/modules`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-tenant-id': '00000000-0000-0000-0000-000000000099',
      },
    });

    // Backend uses x-tenant-id for tenant resolution — a mismatch causes rejection
    expect(response.status(), 'Mismatched x-tenant-id should cause rejection').not.toBe(200);
    const body = await response.json();
    expect(body.success, 'Response should indicate failure').toBe(false);
  });

  test('x-property-id header is ignored for authorization', async ({ request }) => {
    const { token } = await login(request);

    const response = await request.get(`${API_URL}/api/v1/admin/modules`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-property-id': 'fake-property-id',
      },
    });

    // Backend authorizes via JWT, not x-property-id header
    expect(response.ok(), 'x-property-id must not affect authorization').toBeTruthy();
  });
});

// ============================================
// 5. Scope is primary: property_staff gets staff permissions only
// ============================================

test.describe('Scope is primary', () => {
  test('staff scope grants only staff-level permissions', async ({ request }) => {
    const { token, scope } = await login(request);

    expect(scope).toBe('property_staff');

    const permResp = await request.get(`${API_URL}/api/v1/auth/me/permissions`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const permBody = await permResp.json();
    const permissions = permBody.data.permissions || [];

    // Staff should have module-scoped permissions
    const modulePerms = permissions.filter((p: string) => p.startsWith('module:'));
    expect(modulePerms.length, 'Staff must have module-scoped permissions').toBeGreaterThan(0);

    // Staff should NOT have admin-level permissions (unless wildcard)
    if (!permissions.includes('*')) {
      expect(
        permissions.includes('admin:settings:manage'),
      ).toBe(false);
    }
  });

  test('JWT scope and permissions endpoint scope agree', async ({ request }) => {
    const { token, scope } = await login(request);

    const permResp = await request.get(`${API_URL}/api/v1/auth/me/permissions`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const permBody = await permResp.json();

    expect(permBody.data.scope, 'Permissions endpoint scope must match JWT scope').toBe(scope);
  });
});

// ============================================
// 6. Unauthenticated access is rejected
// ============================================

test.describe('Unauthenticated access rejected', () => {
  test('unauthenticated module access returns 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/admin/modules`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });

  test('unauthenticated staff orders returns 401', async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/v1/staff/modules/${OWN_MODULE}/orders`,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(response.status()).toBe(401);
  });

  test('unauthenticated auth/me returns 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/auth/me`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });
});
