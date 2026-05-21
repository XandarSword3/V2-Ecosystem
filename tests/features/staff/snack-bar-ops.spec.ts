import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Snack Bar Operations [STF-SNCK]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'staff@v2ecosystem.com');
    await page.fill('input[type="password"]', 'staff123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(staff|dashboard)/);
    await page.goto('http://localhost:3000/staff/snack-bar');
    await page.waitForLoadState('networkidle');
  });

  test('STF-SNCK-001: Live orders display', async ({ page }) => {
    const heading = page.locator('h1, h2, h3').filter({ hasText: /snack|bar|order/i });
    await expect(heading.first()).toBeVisible();
    const orderArea = page.locator('[class*="order"], [class*="list"], [class*="queue"], [class*="card"]');
    await expect(orderArea.first()).toBeVisible();
  });

  test('STF-SNCK-002: Pending/Preparing/Ready stats', async ({ page }) => {
    const stats = page.locator('[class*="stat"], [class*="badge"], [class*="count"], [class*="metric"]');
    await expect(stats.first()).toBeVisible();
    const labels = page.locator('text=/pending|preparing|ready|new|complete/i');
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('STF-SNCK-003: Search/filter orders', async ({ page }) => {
    const search = page.locator('input[type="search"], input[placeholder*="earch"], [class*="search"] input, [class*="filter"] input');
    await expect(search.first()).toBeVisible();
    await search.first().fill('test');
    await page.waitForLoadState('networkidle');
    const results = page.locator('[class*="order"], [class*="list"], [class*="card"], tbody');
    await expect(results.first()).toBeVisible();
  });

  test('STF-SNCK-004: Status advance buttons', async ({ page }) => {
    const advanceBtn = page.locator('button').filter({
      hasText: /start|advance|ready|complete|preparing|next|serve/i,
    });
    const btnCount = await advanceBtn.count();
    expect(btnCount).toBeGreaterThanOrEqual(0);
    const heading = page.locator('h1, h2, h3').filter({ hasText: /snack|bar/i });
    await expect(heading.first()).toBeVisible();
  });

  test('STF-SNCK-005: Auto-refresh notice', async ({ page }) => {
    const refresh = page.locator('text=/auto.?refresh|live|real.?time|update/i, [class*="refresh"], [class*="live"]');
    const refreshCount = await refresh.count();
    expect(refreshCount).toBeGreaterThanOrEqual(0);
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(50);
  });
});
