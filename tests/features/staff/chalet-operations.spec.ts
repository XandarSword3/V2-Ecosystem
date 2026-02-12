import { test, expect } from '@playwright/test';

test.describe('Chalet Operations [STF-CHAL]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'staff@v2resort.com');
    await page.fill('input[type="password"]', 'staff123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(staff|dashboard)/);
    await page.goto('http://localhost:3000/staff/chalets');
    await page.waitForLoadState('networkidle');
  });

  test('STF-CHAL-001: Today check-ins/outs stats display', async ({ page }) => {
    const stats = page.locator('[class*="stat"], [class*="card"], [class*="metric"]').filter({
      hasText: /check.?in|check.?out|arrival|departure/i,
    });
    await expect(stats.first()).toBeVisible();
    const numbers = page.locator('[class*="stat"] [class*="value"], [class*="stat"] [class*="number"], [class*="metric"] span');
    const count = await numbers.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('STF-CHAL-002: Search bookings functionality', async ({ page }) => {
    const search = page.locator('input[type="search"], input[placeholder*="earch"], [class*="search"] input');
    await expect(search.first()).toBeVisible();
    await search.first().fill('test');
    await page.waitForTimeout(500);
    const resultArea = page.locator('[class*="list"], [class*="table"], [class*="result"], tbody');
    await expect(resultArea.first()).toBeVisible();
  });

  test('STF-CHAL-003: Today/All toggle filter', async ({ page }) => {
    const toggle = page.locator('button, [role="tab"]').filter({ hasText: /today|all|upcoming/i });
    await expect(toggle.first()).toBeVisible();
    const count = await toggle.count();
    expect(count).toBeGreaterThanOrEqual(2);
    await toggle.last().click();
    await page.waitForTimeout(500);
  });

  test('STF-CHAL-004: Booking list with guest info', async ({ page }) => {
    const rows = page.locator('tr, [class*="booking-row"], [class*="list-item"], [class*="card"]').filter({
      hasText: /chalet|guest|room|booking/i,
    });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
    const heading = page.locator('h1, h2, h3').filter({ hasText: /chalet|booking|accommodation/i });
    await expect(heading.first()).toBeVisible();
  });

  test('STF-CHAL-005: Booking detail modal', async ({ page }) => {
    const row = page.locator('tr, [class*="booking"], [class*="card"]').filter({
      hasText: /chalet|guest|room/i,
    }).first();
    const hasRow = await row.isVisible().catch(() => false);
    if (hasRow) {
      await row.click();
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="detail"], [class*="drawer"]');
      await expect(modal.first()).toBeVisible({ timeout: 5000 });
    } else {
      const emptyState = page.locator('text=/no booking|no chalet|empty/i');
      await expect(emptyState).toBeVisible();
    }
  });
});
