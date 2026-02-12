import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';

test.describe('Customer Cookie Consent [CUS-NAV]', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies so banner appears fresh
    await page.context().clearCookies();
  });

  test('CUS-NAV-009: cookie banner appears on first visit', async ({ page }) => {
    await page.goto(FRONTEND);
    const banner = page.locator('[class*="cookie"], [class*="consent"], [role="banner"]')
      .or(page.getByText(/cookie|we use cookies|this site uses/i));
    await expect(banner.first()).toBeVisible({ timeout: 5000 });
  });

  test('CUS-NAV-010: accept all cookies', async ({ page }) => {
    await page.goto(FRONTEND);
    const banner = page.locator('[class*="cookie"], [class*="consent"]')
      .or(page.getByText(/cookie|we use cookies/i));
    await expect(banner.first()).toBeVisible({ timeout: 5000 });
    const acceptBtn = page.getByRole('button', { name: /accept.*all|accept|got it|ok|agree/i });
    await expect(acceptBtn.first()).toBeVisible();
    await acceptBtn.first().click();
    await expect(banner.first()).not.toBeVisible({ timeout: 3000 });
  });

  test('CUS-NAV-012: cookie preferences modal', async ({ page }) => {
    await page.goto(FRONTEND);
    const banner = page.locator('[class*="cookie"], [class*="consent"]')
      .or(page.getByText(/cookie|we use cookies/i));
    await expect(banner.first()).toBeVisible({ timeout: 5000 });
    const prefsBtn = page.getByRole('button', { name: /preference|settings|customize|manage/i });
    await expect(prefsBtn.first()).toBeVisible();
    await prefsBtn.first().click();
    const modal = page.getByRole('dialog')
      .or(page.locator('[class*="modal"], [class*="preferences-panel"]'));
    await expect(modal.first()).toBeVisible();
    const essentialToggle = modal.first().locator('[class*="essential"], text=/essential|necessary|required/i');
    await expect(essentialToggle.first()).toBeVisible();
    const analyticsToggle = modal.first().locator('[class*="analytics"], text=/analytics|performance/i');
    await expect(analyticsToggle.first()).toBeVisible();
  });
});
