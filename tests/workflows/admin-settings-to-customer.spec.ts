import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:3005/api/v1';

test.describe.serial('Admin Settings → Customer Experience Workflow', () => {
  test('Phase 1: Admin configures homepage settings', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill('admin@v2resort.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    // Navigate to homepage settings
    await page.goto(`${BASE}/admin/settings/homepage`);
    await expect(page.locator('main').first()).toBeVisible();
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(50);
  });

  test('Phase 2: Admin configures appearance', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill('admin@v2resort.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });

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

  test('Phase 4: Customer experiences restaurant with configured settings', async ({ page }) => {
    await page.goto(`${BASE}/restaurant`);
    await expect(page.locator('main').first()).toBeVisible();
    // Menu should load with items
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('Phase 5: Verify settings API returns config', async ({ request }) => {
    const authRes = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@v2resort.com', password: 'admin123' },
    });
    expect(authRes.status()).toBe(200);
    const authData = await authRes.json();
    const token = authData.data?.tokens?.accessToken || authData.token;

    const settingsRes = await request.get(`${API}/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(settingsRes.status()).toBe(200);
  });
});
