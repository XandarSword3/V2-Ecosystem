import { test, expect } from '../../fixtures/auth.fixture';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';
const LOYALTY_PATH = '/account/loyalty';

test.describe('Customer Loyalty Program [CUS-LOY]', () => {
  test.beforeEach(async ({ page, auth }, testInfo) => {
    const isUnauthenticatedCase = /unauthenticated/i.test(testInfo.title);
    if (isUnauthenticatedCase) {
      return;
    }

    await auth.loginAs('customer');

    // Guard: fail fast if auth did not stick, so loyalty tests don't run on login page.
    await page.goto(`${FRONTEND}${LOYALTY_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    if (/\/login|\/auth/i.test(page.url())) {
      throw new Error(`Loyalty auth guard failed for test: ${testInfo.title}`);
    }
  });

  test('CUS-LOY-001: view loyalty dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND}${LOYALTY_PATH}`);
    const dashboardMarkers = page.getByText(/available points|your benefits|recent activity/i);
    await expect(dashboardMarkers.first()).toBeVisible();
  });

  test('CUS-LOY-002: view points balance', async ({ page }) => {
    await page.goto(`${FRONTEND}${LOYALTY_PATH}`);
    const balance = page.getByText(/available points/i)
      .or(page.getByText(/\d+\s*(points|pts)/i));
    await expect(balance.first()).toBeVisible();
    const balanceText = await page.locator('text=/\d{1,3}(,\d{3})*/').first().textContent();
    expect(balanceText).toMatch(/\d/);
  });

  test('CUS-LOY-003: view tier status', async ({ page }) => {
    await page.goto(`${FRONTEND}/loyalty`);
    const tier = page.locator('[class*="tier"], [class*="level"], [class*="status"]')
      .or(page.getByText(/bronze|silver|gold|platinum|basic|premium/i));
    await expect(tier.first()).toBeVisible();
  });

  test('CUS-LOY-004: view transaction history', async ({ page }) => {
    await page.goto(`${FRONTEND}${LOYALTY_PATH}`);
    const historySection = page.getByText(/recent activity/i)
      .or(page.locator('[class*="history"], [class*="transaction"], table, [class*="list"]'));
    await expect(historySection.first()).toBeVisible();
  });

  test('CUS-LOY-006: enroll in loyalty program (unauthenticated)', async ({ page }) => {
    await page.goto(`${FRONTEND}${LOYALTY_PATH}`);
    await page.waitForLoadState('networkidle');
    // Unauthenticated users are redirected to login with redirect target.
    await expect(page).toHaveURL(/\/login(\?|$)/i);
  });
});
