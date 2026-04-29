import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

test.describe('Admin functional - Users', () => {
  test('USR-10 customers list renders and shows newly created user (API + UI)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const email = `e2e.customer.${Date.now()}@test.com`;
    const full_name = 'Test Customer';
    const password = 'TestPass123!';

    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/admin/users',
      token,
      data: {
        email,
        password,
        full_name,
        phone: null,
        roles: ['customer'],
      },
    });
    if (![200, 201].includes(created.status)) {
      throw new Error(`Create user failed: HTTP ${created.status} ${JSON.stringify(created.body)}`);
    }
    const userId = created.body?.data?.id || created.body?.data?.user?.id;
    expect(typeof userId).toBe('string');

    const list = await apiJson(page.request, {
      method: 'GET',
      path: '/admin/users',
      token,
      params: { type: 'customer', search: email },
    });
    expect(list.status).toBe(200);
    expect((list.body?.data || []).some((u: any) => u.email === email)).toBeTruthy();

    await loginAdminUi(page, auth);
    await page.goto('/admin/users/customers', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /customers/i })).toBeVisible();
    await page.locator('input[type="text"]').first().fill(email);
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 20000 });

    // Drill into user details page.
    await page.getByText(email).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 20000 });
  });

  test('USR-20 roles & permissions pages load and can create a role (API + UI)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    const roleName = `e2e_role_${Date.now()}`;

    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/admin/roles',
      token,
      data: { name: roleName, description: 'created-by-e2e' },
    });
    expect([200, 201]).toContain(created.status);

    const roles = await apiJson(page.request, { method: 'GET', path: '/admin/roles', token });
    expect(roles.status).toBe(200);
    expect((roles.body?.data || []).some((r: any) => r.name === roleName)).toBeTruthy();

    const perms = await apiJson(page.request, { method: 'GET', path: '/admin/permissions', token });
    expect(perms.status).toBe(200);
    expect(Array.isArray(perms.body?.data)).toBeTruthy();

    await loginAdminUi(page, auth);
    await page.goto('/admin/users/roles', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible();
    await expect(page.getByText(roleName).first()).toBeVisible({ timeout: 20000 });
  });

  test('USR-30 role assignment persists for a user (API + UI)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    // Create a user we can assign roles to.
    const email = `e2e.assign.${Date.now()}@test.com`;
    const createUser = await apiJson(page.request, {
      method: 'POST',
      path: '/admin/users',
      token,
      data: { email, password: 'TestPass123!', full_name: 'Test Customer', role: 'customer' },
    });
    expect([200, 201]).toContain(createUser.status);
    const userId = createUser.body?.data?.id;
    expect(typeof userId).toBe('string');

    // Ensure there is at least one role to assign.
    const roles = await apiJson(page.request, { method: 'GET', path: '/admin/roles', token });
    expect(roles.status).toBe(200);
    const roleId = roles.body?.data?.[0]?.id;
    expect(typeof roleId).toBe('string');

    const assign = await apiJson(page.request, {
      method: 'PUT',
      path: `/admin/users/${userId}/roles`,
      token,
      data: { roleIds: [roleId] },
    });
    expect([200, 204]).toContain(assign.status);

    const getUser = await apiJson(page.request, { method: 'GET', path: `/admin/users/${userId}`, token });
    expect(getUser.status).toBe(200);
    const rolesList = getUser.body?.data?.roles || [];
    expect(Array.isArray(rolesList)).toBeTruthy();
    expect(rolesList.length).toBeGreaterThan(0);

    await loginAdminUi(page, auth);
    await page.goto(`/admin/users/${userId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(email).first()).toBeVisible();
  });
});

