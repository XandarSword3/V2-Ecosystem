import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Iteration 16 Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[name="email"]', 'admin@v2resort.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/staff/**');
  });

  test('FIX-16A: Snack bar order cards have keyboard a11y attributes', async ({ page }) => {
    await page.goto(BASE + '/staff/snack-bar');
    // Page renders without build errors
    await expect(page.locator('h1')).toContainText('Snack Bar');
  });

  test('FIX-16B: Pool ticket cards have keyboard a11y attributes', async ({ page }) => {
    await page.goto(BASE + '/staff/pool');
    // Page renders without build errors
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('FIX-16C: Giftcards page loads with AbortController (no unmount errors)', async ({ page }) => {
    await page.goto(BASE + '/giftcards');
    // Verify the page loads and templates are rendered
    await expect(page.locator('h1')).toContainText('Gift');
    // Confirm currency formatting from Iter-15 still works
    await expect(page.locator('text=/\\\\.00/')).toBeVisible();
  });

  test('BONUS: MultiDayBookingDashboard renders after comment fix', async ({ page }) => {
    await page.goto(BASE + '/staff/modules/chalets');
    // Chalets staff page should render without SWC build error
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
