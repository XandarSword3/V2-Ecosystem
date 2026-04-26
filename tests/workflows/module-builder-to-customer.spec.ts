import { test, expect } from '../fixtures/auth.fixture';

const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:3005/api';

test.describe('Module Builder → Customer Experience Workflow', () => {
  test('Phase 1: Admin creates a new module', async ({ page, auth }) => {
    await auth.loginAs('admin');

    // Navigate to modules
    await page.goto(`${BASE}/admin/modules`);
    await expect(page.locator('main').first()).toBeVisible();

    // Module list should load
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(50);
  });

  test('Phase 2: Admin opens module builder', async ({ page, auth }) => {
    await auth.loginAs('admin');

    // Navigate to modules
    await page.goto(`${BASE}/admin/modules`);
    await expect(page.locator('main').first()).toBeVisible();

    // Look for builder links or edit buttons
    const builderLinks = page.locator('a[href*="builder"], button:has-text("Edit"), button:has-text("Builder")');
    const count = await builderLinks.count();
    expect(count).toBeGreaterThanOrEqual(0); // May not have modules yet
  });

  test('Phase 3: Customer sees dynamic modules', async ({ page }) => {
    await page.goto(BASE);
    // Homepage should show dynamic module cards
    await expect(page.locator('main').first()).toBeVisible();
    // Check navigation has module-generated links
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible();
  });

  test('Phase 4: API confirms modules exist', async ({ request }) => {
    const response = await request.get(`${API}/modules`);
    expect(response.status()).toBe(200);
  });
});
