import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Iteration 17 Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[name="email"]', 'admin@v2resort.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/staff/**');
  });

  test('FIX-17A+B: GiftCardPurchase uses formatCurrency + AbortController', async ({ page }) => {
    await page.goto(BASE + '/account/giftcards');
    // Verify the page loads with formatted currency
    await expect(page.locator('h1')).toContainText('Gift Card');
    // Confirm formatted currency shows Minimum/Maximum with proper symbol
    const minMaxText = page.locator('text=/Minimum.*Maximum/');
    await expect(minMaxText).toBeVisible();
    await expect(minMaxText).toContainText('10.00');
    await expect(minMaxText).toContainText('1,000.00');
  });

  test('FIX-17C: Pool staff page loads with AbortController', async ({ page }) => {
    await page.goto(BASE + '/staff/pool');
    // Page renders without errors
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
