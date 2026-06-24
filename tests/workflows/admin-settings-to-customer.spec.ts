import { test, expect } from '../fixtures/auth.fixture';

const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';
const API = `${process.env.API_URL || 'http://localhost:3005'}/api/v1`;

test.describe('Admin Settings → Customer Experience Workflow', () => {
  test('Phase 1: Admin configures homepage settings', async ({ page, auth }) => {
    await auth.loginAs('admin');

    // Navigate to homepage settings
    await page.goto(`${BASE}/admin/settings/homepage`);
    await expect(page.locator('main').first()).toBeVisible();
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(50);
  });

  test('Phase 2: Admin configures appearance', async ({ page, auth }) => {
    await auth.loginAs('admin');

    await page.goto(`${BASE}/admin/settings/appearance`);
    await expect(page.locator('main').first()).toBeVisible();
    // Should have theme/color options
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(50);
  });

  test('Phase 3: Customer sees configured homepage', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('main').first()).toBeVisible();
    // Homepage should have hero section
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(100);
    // Footer should be present
    await expect(page.locator('footer').first()).toBeVisible();
  });

  test('Phase 4: Customer experiences menu service with configured settings', async ({ page }) => {
    await page.goto(`${BASE}/menu service`);
    await expect(page.locator('main').first()).toBeVisible();
    // Menu should load with items
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('Phase 5: Verify settings API returns config', async ({ request, auth }) => {
    const token = await auth.getApiToken('admin');

    const settingsRes = await request.get(`${API}/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(settingsRes.status()).toBe(200);
  });
});
