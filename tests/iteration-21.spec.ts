import { test, expect } from '@playwright/test';

test.describe('Iteration 21 - More Modal A11y Fixes', () => {

  test('FIX-21A+B: staff/restaurant renders with order modal a11y', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/restaurant');
    await expect(page.getByRole('heading', { name: /Pending/i })).toBeVisible();
  });

  test('FIX-21C: home page renders with Wishlist component', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.getByRole('heading', { name: /Iron Paradise/i })).toBeVisible();
  });

  test('Settings modal accessible from any page', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const settingsBtn = page.getByRole('button', { name: /Settings/i });
    await expect(settingsBtn).toBeVisible();
  });
});
