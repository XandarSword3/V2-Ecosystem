import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

const API_URL = process.env.API_URL || 'http://localhost:3005';

async function getActiveModules(page: any) {
  const resp = await page.request.get(`${API_URL}/api/modules?activeOnly=true`);
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  return (json?.data || []) as Array<{ id: string; slug: string; name: string; template_type?: string }>;
}

async function getAllModulesPublic(page: any) {
  const resp = await page.request.get(`${API_URL}/api/modules`);
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  return (json?.data || []) as Array<any>;
}

async function ensureModuleBySlug(page: any, token: string, opts: { slug: string; name: string; template_type: string }) {
  const list = await apiJson(page.request, { method: 'GET', path: '/admin/modules', token });
  expect(list.status).toBe(200);
  const found = (list.body?.data || []).find((m: any) => String(m.slug).toLowerCase() === opts.slug.toLowerCase());
  if (found) {
    // Ensure it is visible to the public modules feed (activeOnly=true).
    if (found.is_active !== true) {
      const updated = await apiJson(page.request, {
        method: 'PUT',
        path: `/admin/modules/${found.id}`,
        token,
        data: { is_active: true, show_in_main: true },
      });
      expect(updated.status).toBe(200);
      return updated.body?.data;
    }
    return found as { id: string; slug: string; name: string; template_type: string };
  }

  const created = await apiJson(page.request, {
    method: 'POST',
    path: '/admin/modules',
    token,
    data: {
      template_type: opts.template_type,
      name: opts.name,
      slug: opts.slug,
      description: `Seeded by admin functional tests (${opts.slug})`,
      settings: {},
    },
  });
  // Backend returns 200/201 depending on controller evolution.
  expect([200, 201]).toContain(created.status);
  const createdRow = created.body?.data as { id: string; slug: string; name: string; template_type: string };
  expect(createdRow?.id, 'Expected createModule to return created row').toBeTruthy();

  // Verify it is visible through the same admin GET endpoint (no caching surprises).
  const listAfter = await apiJson(page.request, { method: 'GET', path: '/admin/modules', token });
  expect(listAfter.status).toBe(200);
  const byId = (listAfter.body?.data || []).find((m: any) => m.id === createdRow.id);
  expect(byId, `Expected created module id=${createdRow.id} to appear in GET /admin/modules`).toBeTruthy();

  // Some environments default modules to inactive; explicitly activate.
  if ((byId as any).is_active !== true) {
    const updated = await apiJson(page.request, {
      method: 'PUT',
      path: `/admin/modules/${createdRow.id}`,
      token,
      data: { is_active: true, show_in_main: true },
    });
    expect(updated.status).toBe(200);
    return updated.body?.data;
  }

  return createdRow;
}

test.describe('Admin functional - Dynamic module admin', () => {
  test('DYN-10 menu_service: create menu item then UI shows it', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    // The database seed does not always include a `menu_service` module row.
    // Ensure it exists (admin endpoints expect a module_id for scoping).
    const restaurantModule = await ensureModuleBySlug(page, token, {
      slug: 'menu_service',
      name: 'MenuService',
      template_type: 'menu_service',
    });
    expect(restaurantModule?.id).toBeTruthy();

    // Sanity: public modules endpoint (used by SettingsProvider) must include it,
    // otherwise the dynamic module layout will redirect to /admin.
    const publicModules = await getActiveModules(page);
    const publicAll = await getAllModulesPublic(page);
    expect(
      publicAll.some((m) => String(m.slug).toLowerCase() === 'menu_service'),
      `Expected /api/modules (all) to include 'menu_service'; got: ${publicAll.map((m) => m.slug).join(', ')}`
    ).toBeTruthy();
    expect(
      publicModules.some((m) => String(m.slug).toLowerCase() === 'menu_service'),
      `Expected /api/modules?activeOnly=true to include 'menu_service'; got: ${publicModules.map((m) => m.slug).join(', ')}`
    ).toBeTruthy();

    // Now load UI (SettingsProvider fetches module list on mount).
    await loginAdminUi(page, auth);

    // Need a category to create an item.
    const catResp = await apiJson(page.request, {
      method: 'GET',
      path: '/${slug}/categories',
      token,
      params: { moduleId: restaurantModule!.id },
    });
    expect(catResp.status).toBe(200);
    const categories = catResp.body?.data || [];
    expect(Array.isArray(categories)).toBeTruthy();
    expect(categories.length, 'Expected at least one category').toBeGreaterThan(0);

    const name = `E2E Menu Item ${Date.now()}`;
    const createResp = await apiJson(page.request, {
      method: 'POST',
      path: '/${slug}/admin/items',
      token,
      data: {
        name,
        description: 'created-by-e2e',
        price: 9.99,
        category_id: categories[0].id,
        is_available: true,
        is_featured: false,
        is_vegetarian: false,
        is_spicy: false,
        preparation_time: 10,
        module_id: restaurantModule!.id,
      },
    });
    expect([200, 201]).toContain(createResp.status);
    const createdId = createResp.body?.data?.id;
    expect(typeof createdId).toBe('string');

    // DB-effect via API: item appears in list.
    const listResp = await apiJson(page.request, {
      method: 'GET',
      path: '/${slug}/items',
      token,
      params: { moduleId: restaurantModule!.id },
    });
    expect(listResp.status).toBe(200);
    const items = listResp.body?.data || [];
    expect(items.some((i: any) => i.id === createdId), 'Expected created item in GET list').toBeTruthy();

    // UI: can find it by searching.
    await page.goto('/admin/${slug}/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    // Placeholder text is translated in some builds; use a robust selector.
    await page.locator('input[type="text"]').first().fill(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });

    // Cleanup
    const delResp = await apiJson(page.request, {
      method: 'DELETE',
      path: `/${slug}/admin/items/${createdId}`,
      token,
    });
    expect([200, 204]).toContain(delResp.status);
  });

  test('DYN-20 session_access: pool capacity save persists maxCapacity', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    await loginAdminUi(page, auth);

    // Read current pool settings (public endpoint).
    const before = await page.request.get(`${API_URL}/api/v1/pool/settings`);
    if (!before.ok()) {
      const body = await before.text().catch(() => '');
      throw new Error(`GET /api/v1/pool/settings failed: HTTP ${before.status()} ${body}`);
    }
    const beforeJson = await before.json();
    const beforeSettings = beforeJson?.data || {};
    const beforeMax = String(beforeSettings.maxCapacity ?? '100');

    const newMax = String(Number.parseInt(beforeMax, 10) + 1);
    const saveResp = await apiJson(page.request, {
      method: 'PUT',
      path: '/pool/admin/settings',
      token,
      data: { maxCapacity: Number(newMax) },
    });
    expect(saveResp.status).toBe(200);

    const after = await page.request.get(`${API_URL}/api/v1/pool/settings`);
    if (!after.ok()) {
      const body = await after.text().catch(() => '');
      throw new Error(`GET /api/v1/pool/settings failed (after save): HTTP ${after.status()} ${body}`);
    }
    const afterJson = await after.json();
    const afterSettings = afterJson?.data || {};
    expect(String(afterSettings.maxCapacity)).toBe(newMax);

    // UI: refresh should render and show the page header (basic sanity).
    await page.goto('/admin/pool/capacity', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /refresh/i }).first()).toBeVisible();

    // Reset occupancy triggers reset endpoint and sets site_settings.pool.currentOccupancy = 0
    const waitReset = page.waitForResponse(
      (r) =>
        r.url().includes('/api/v1/pool/admin/reset-occupancy') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /reset/i }).first().click();
    const resetResp = await waitReset;
    expect(resetResp.ok()).toBeTruthy();

    const poolSettings = await apiJson(page.request, { method: 'GET', path: '/pool/settings', token });
    expect(poolSettings.status).toBe(200);
    expect(Number(poolSettings.body?.data?.currentOccupancy ?? 0)).toBe(0);
  });

  test('DYN-15 menu_service: categories CRUD (API + UI render)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    const restaurantModule = await ensureModuleBySlug(page, token, {
      slug: 'menu_service',
      name: 'MenuService',
      template_type: 'menu_service',
    });

    const name = `E2E Category ${Date.now()}`;
    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/${slug}/admin/categories',
      token,
      data: { name, description: 'e2e', moduleId: restaurantModule!.id },
    });
    expect([200, 201]).toContain(created.status);
    const catId = created.body?.data?.id;
    expect(typeof catId).toBe('string');

    const updatedName = `${name} Updated`;
    const updated = await apiJson(page.request, {
      method: 'PUT',
      path: `/${slug}/admin/categories/${catId}`,
      token,
      data: { name: updatedName, description: 'e2e2', moduleId: restaurantModule!.id },
    });
    expect([200, 204]).toContain(updated.status);

    const list = await apiJson(page.request, {
      method: 'GET',
      path: '/${slug}/categories',
      token,
      params: { moduleId: restaurantModule!.id },
    });
    expect(list.status).toBe(200);
    expect((list.body?.data || []).some((c: any) => c.id === catId && c.name === updatedName)).toBeTruthy();

    await loginAdminUi(page, auth);
    await page.goto('/admin/${slug}/categories', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 15000 });

    const del = await apiJson(page.request, {
      method: 'DELETE',
      path: `/${slug}/admin/categories/${catId}`,
      token,
    });
    expect([200, 204]).toContain(del.status);
  });

  test('DYN-16 menu_service: modifiers create group+option then UI shows group (API + UI)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    const restaurantModule = await ensureModuleBySlug(page, token, {
      slug: 'menu_service',
      name: 'MenuService',
      template_type: 'menu_service',
    });

    const groupName = `E2E Mod Group ${Date.now()}`;
    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/${slug}/modifiers',
      token,
      data: {
        name: groupName,
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        allowMultipleSame: false,
        moduleId: restaurantModule!.id,
        options: [{ name: 'Extra Sauce', price: 1.5, isAvailable: true, modifierType: 'add' }],
      },
    });
    expect([200, 201]).toContain(created.status);
    const groupId = created.body?.data?.id;
    expect(typeof groupId).toBe('string');

    const list = await apiJson(page.request, {
      method: 'GET',
      path: '/${slug}/modifiers',
      token,
      params: { moduleId: restaurantModule!.id },
    });
    expect(list.status).toBe(200);
    expect((list.body?.data || []).some((g: any) => g.id === groupId)).toBeTruthy();

    await loginAdminUi(page, auth);
    await page.goto('/admin/${slug}/modifiers', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(groupName).first()).toBeVisible({ timeout: 15000 });

    const del = await apiJson(page.request, {
      method: 'DELETE',
      path: `/${slug}/modifiers/${groupId}`,
      token,
    });
    expect([200, 204]).toContain(del.status);
  });

  test('DYN-30 multi_day_booking: create price rule then UI shows count increase', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    // AccommodationUnits module usually exists, but we treat it as required for dynamic admin.
    // If missing, create it (tests run against a dedicated local test DB).
    const chaletsModule = await ensureModuleBySlug(page, token, {
      slug: 'accommodation_units',
      name: 'AccommodationUnits',
      template_type: 'multi_day_booking',
    });
    expect(chaletsModule?.id).toBeTruthy();

    await loginAdminUi(page, auth);

    const listBefore = await apiJson(page.request, {
      method: 'GET',
      path: '/accommodation_units/admin/price-rules',
      token,
      params: { moduleId: chaletsModule!.id },
    });
    expect(listBefore.status).toBe(200);
    const beforeRules = listBefore.body?.data || [];
    const beforeCount = Array.isArray(beforeRules) ? beforeRules.length : 0;

    const name = `E2E Price Rule ${Date.now()}`;
    const createResp = await apiJson(page.request, {
      method: 'POST',
      path: '/accommodation_units/admin/price-rules',
      token,
      data: {
        name,
        base_price: 123,
        weekend_price: 150,
        holiday_price: 200,
        per_guest_price: 10,
        min_guests: 1,
        max_guests: 4,
        start_date: '',
        end_date: '',
        is_active: true,
        module_id: chaletsModule!.id,
      },
    });
    if (![200, 201].includes(createResp.status)) {
      throw new Error(`Create price rule failed: HTTP ${createResp.status} ${JSON.stringify(createResp.body)}`);
    }
    const createdId = createResp.body?.data?.id;
    expect(typeof createdId).toBe('string');

    const listAfter = await apiJson(page.request, {
      method: 'GET',
      path: '/accommodation_units/admin/price-rules',
      token,
      params: { moduleId: chaletsModule!.id },
    });
    expect(listAfter.status).toBe(200);
    const afterRules = listAfter.body?.data || [];
    expect(afterRules.length).toBeGreaterThanOrEqual(beforeCount + 1);
    expect(afterRules.some((r: any) => r.id === createdId)).toBeTruthy();

    // UI: open pricing page and ensure new rule name appears.
    await page.goto('/admin/accommodation_units/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });

    // Cleanup
    const del = await apiJson(page.request, {
      method: 'DELETE',
      path: `/accommodation_units/admin/price-rules/${createdId}`,
      token,
    });
    expect([200, 204]).toContain(del.status);
  });
});

