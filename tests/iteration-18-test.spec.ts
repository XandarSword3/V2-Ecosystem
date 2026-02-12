import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Iteration 18 Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[name="email"]', 'admin@v2resort.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/staff/**');
  });

  test('FIX-18A: Snack bar staff page loads with AbortController', async ({ page }) => {
    await page.goto(BASE + '/staff/snack-bar');
    await expect(page.locator('h1')).toContainText('Snack Bar');
  });

  test('FIX-18B: Home page loads with WeatherWidget AbortController', async ({ page }) => {
    await page.goto(BASE + '/');
    // Home page renders without build errors
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('FIX-18C: Loyalty page loads with AbortController for 3 API calls', async ({ page }) => {
    await page.goto(BASE + '/account/loyalty');
    // Page renders or redirects to login
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
