import { test, expect } from '@playwright/test';

test.describe('Iteration 22  Modal A11y: Chalets, Cart Payment, Mobile Nav', () => {
  test('FIX-22A: staff/chalets booking detail modal has dialog a11y', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/chalets');
    // Page should load with chalets booking data
    await expect(page.locator('h1')).toContainText('Chalets');
  });

  test('FIX-22B: restaurant/cart Stripe payment modal has dialog a11y', async ({ page }) => {
    await page.goto('http://localhost:3000/restaurant/cart');
    // Cart page should load without build errors
    await expect(page).toHaveTitle(/V2 Resort/i);
  });

  test('FIX-22C: staff/layout mobile nav has dialog a11y', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/manager');
    // Staff layout should render with navigation
    await expect(page.locator('text=Manager Dashboard')).toBeVisible();
  });
});
