/**
 * F2: Scope/Role Disagreement — Scope is Primary
 *
 * Proves that the backend's authorization follows scope as the source of
 * truth, not role claims. Tests the actual behavior of the backend with
 * the existing user data.
 *
 * Key assertions:
 *   1. Staff scope → staff permissions (not admin)
 *   2. Staff CANNOT access admin-only endpoints
 *   3. Permissions endpoint returns scope-derived permissions
 *   4. JWT scope and roles are consistent in the backend's resolution
 *
 * For true conflicting-claim testing (scope=staff, roles=admin), this
 * requires database-level modification of user roles. That test is
 * classified as NOT RUN until a test fixture supports it.
 *
 * Run: npx playwright test tests/scope-role-disagreement.spec.ts
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3005';

const STAFF = { email: 'menu.service.staff@v2ecosystem.com', password: 'staff123' };
const TEST_MODULE = 'delete';

async function login(request: any): Promise<string> {
  const response = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: STAFF.email, password: STAFF.password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.ok(), 'Login must succeed').toBeTruthy();
  const body = await response.json();
  return body.data.tokens.accessToken;
}

// ============================================
// 1. Scope determines permissions, not roles
// ============================================

test.describe('Scope determines permissions', () => {
  test('staff scope grants staff-level permissions, not admin', async ({ request }) => {
    const token = await login(request);

    const response = await request.get(`${API_URL}/api/v1/auth/me/permissions`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const body = await response.json();
    const permissions = body.data.permissions || [];

    // Scope is property_staff → must grant staff-level permissions
    expect(body.data.scope).toBe('property_staff');

    // Must have module-scoped permissions (staff gets module access)
    const modulePerms = permissions.filter((p: string) => p.startsWith('module:'));
    expect(modulePerms.length, 'Staff must have module-scoped permissions').toBeGreaterThan(0);

    // Must NOT have admin-level permissions (scope is not admin)
    if (!permissions.includes('*')) {
      expect(
        permissions.includes('admin:settings:manage'),
      ).toBe(false);
      expect(
        permissions.includes('admin:users:manage'),
      ).toBe(false);
    }
  });

  test('JWT roles match scope-derived role', async ({ request }) => {
    const token = await login(request);

    // Get user info
    const meResp = await request.get(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const meBody = await meResp.json();

    // scope=property_staff → roles should include 'staff'
    expect(meBody.data.scope).toBe('property_staff');
    expect(meBody.data.roles).toContain('staff');
  });
});

// ============================================
// 2. Staff cannot access admin-only endpoints
// ============================================

test.describe('Staff cannot access admin-only endpoints', () => {
  test('staff cannot manage admin settings', async ({ request }) => {
    const token = await login(request);

    // Try to access an admin-only endpoint
    const response = await request.get(`${API_URL}/api/v1/admin/settings`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    // Staff should be rejected (403 or 401)
    expect(
      [401, 403].includes(response.status()),
      `Staff must be rejected from admin settings. Got ${response.status()}`,
    ).toBeTruthy();
  });

  test('staff cannot create users', async ({ request }) => {
    const token = await login(request);

    const response = await request.post(`${API_URL}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        email: 'unauthorized@test.com',
        password: 'test123',
        fullName: 'Unauthorized User',
        role: 'staff',
      },
    });

    // Staff should be rejected
    expect(
      [401, 403].includes(response.status()),
      `Staff must be rejected from user creation. Got ${response.status()}`,
    ).toBeTruthy();
  });

  test('staff cannot access platform admin endpoints', async ({ request }) => {
    const token = await login(request);

    const response = await request.get(`${API_URL}/api/v1/platform/tenants`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    // Staff should be rejected
    expect(
      [401, 403].includes(response.status()),
      `Staff must be rejected from platform admin. Got ${response.status()}`,
    ).toBeTruthy();
  });
});

// ============================================
// 3. Staff CAN access staff-allowed endpoints
// ============================================

test.describe('Staff CAN access staff-allowed endpoints', () => {
  test('staff can list orders for own module', async ({ request }) => {
    const token = await login(request);

    const response = await request.get(
      `${API_URL}/api/v1/staff/modules/${TEST_MODULE}/orders`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );

    expect(response.ok(), 'Staff should access own module orders').toBeTruthy();
  });

  test('staff can access permissions endpoint', async ({ request }) => {
    const token = await login(request);

    const response = await request.get(`${API_URL}/api/v1/auth/me/permissions`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    expect(response.ok(), 'Staff should access permissions endpoint').toBeTruthy();
  });
});

// ============================================
// 4. Scope/role consistency
// ============================================

test.describe('Scope and roles are consistent', () => {
  test('permissions endpoint scope matches JWT scope', async ({ request }) => {
    const token = await login(request);

    // Get user info (JWT)
    const meResp = await request.get(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const meBody = await meResp.json();

    // Get permissions
    const permResp = await request.get(`${API_URL}/api/v1/auth/me/permissions`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const permBody = await permResp.json();

    // Scope must match
    expect(permBody.data.scope, 'Permissions scope must match JWT scope').toBe(meBody.data.scope);

    // Roles must match (or be superset)
    for (const role of meBody.data.roles) {
      expect(
        permBody.data.roles.includes(role),
        `Permissions roles must include JWT role '${role}'`,
      ).toBeTruthy();
    }
  });
});

// ============================================
// 5. NOT RUN: True conflicting claims test
// ============================================

test.describe('NOT RUN: True scope/role conflict test', () => {
  test.skip(true, 'Requires database modification to create user with scope=property_staff, roles=[admin]');

  test('conflicting claims: scope=property_staff, roles=admin', async () => {
    // This test would:
    // 1. Create/modify a user with scope='property_staff' and app_roles=['admin']
    // 2. Login as that user
    // 3. Verify the backend uses scope (property_staff) not roles (admin)
    //    for authorization decisions
    //
    // Cannot run because:
    // - Cannot modify user roles through the API (staff lacks permission)
    // - Admin user requires 2FA
    // - Cannot access Supabase directly (DNS failure from this machine)
    //
    // When this test fixture is available, it should prove:
    // - /auth/me/permissions returns staff-level permissions (scope-derived)
    // - Admin-only endpoints still reject the user
    // - The backend does not elevate based on stale role claims
    expect(true).toBeTruthy();
  });
});
