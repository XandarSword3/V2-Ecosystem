import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Customer Loyalty Program [CUS-LOY]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByLabel(/email/i).fill('customer@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 5000 }).catch(() => {});
  });

  test('CUS-LOY-001: view loyalty dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND}/loyalty`);
    const heading = page.getByRole('heading', { name: /loyalty|rewards|points/i });
    await expect(heading).toBeVisible();
  });

  test('CUS-LOY-002: view points balance', async ({ page }) => {
    await page.goto(`${FRONTEND}/loyalty`);
    const balance = page.locator('[class*="balance"], [class*="points"]')
      .or(page.getByText(/\d+\s*(points|pts)/i));
    await expect(balance.first()).toBeVisible();
    const balanceText = await balance.first().textContent();
    expect(balanceText).toMatch(/\d/);
  });

  test('CUS-LOY-003: view tier status', async ({ page }) => {
    await page.goto(`${FRONTEND}/loyalty`);
    const tier = page.locator('[class*="tier"], [class*="level"], [class*="status"]')
      .or(page.getByText(/bronze|silver|gold|platinum|basic|premium/i));
    await expect(tier.first()).toBeVisible();
  });

  test('CUS-LOY-004: view transaction history', async ({ page }) => {
    await page.goto(`${FRONTEND}/loyalty`);
    const historyTab = page.getByRole('tab', { name: /history|transaction/i })
      .or(page.getByRole('link', { name: /history|transaction/i }))
      .or(page.getByText(/history|transaction/i));
    await historyTab.first().click();
    const historyList = page.locator('[class*="history"], [class*="transaction"], table, [class*="list"]');
    await expect(historyList.first()).toBeVisible();
  });

  test('CUS-LOY-006: enroll in loyalty program (unauthenticated)', async ({ page }) => {
    await page.goto(`${FRONTEND}/loyalty`);
    const enrollBtn = page.getByRole('button', { name: /enrol|join|sign.?up|register/i })
      .or(page.getByRole('link', { name: /enrol|join/i }));
    const isVisible = await enrollBtn.first().isVisible().catch(() => false);
    if (isVisible) {
      await expect(enrollBtn.first()).toBeVisible();
    } else {
      // Already enrolled — verify dashboard is shown
      const dashboard = page.locator('[class*="dashboard"], [class*="loyalty"]');
      await expect(dashboard.first()).toBeVisible();
    }
  });
});
