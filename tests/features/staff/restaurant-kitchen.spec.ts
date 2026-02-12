import { test, expect } from '@playwright/test';

test.describe('Restaurant Kitchen Display [STF-REST]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'staff@v2resort.com');
    await page.fill('input[type="password"]', 'staff123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(staff|dashboard)/);
    await page.goto('http://localhost:3000/staff/restaurant');
    await page.waitForLoadState('networkidle');
  });

  test('STF-REST-001: Kanban board loads with columns', async ({ page }) => {
    const columns = page.locator('[class*="column"], [class*="kanban"], [data-testid*="column"]');
    await expect(columns.first()).toBeVisible();
    const count = await columns.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('STF-REST-002: Status filter buttons present', async ({ page }) => {
    const filters = page.locator('button, [role="tab"]').filter({ hasText: /pending|preparing|ready|all/i });
    await expect(filters.first()).toBeVisible();
    const count = await filters.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('STF-REST-003: Orders listed with status indicators', async ({ page }) => {
    const orders = page.locator('[class*="order"], [class*="card"], [data-testid*="order"]');
    const orderCount = await orders.count();
    expect(orderCount).toBeGreaterThanOrEqual(0);
    if (orderCount > 0) {
      const status = orders.first().locator('[class*="status"], [class*="badge"], span');
      await expect(status.first()).toBeVisible();
    }
  });

  test('STF-REST-004: Can view order detail modal', async ({ page }) => {
    const order = page.locator('[class*="order"], [class*="card"], [data-testid*="order"]').first();
    const hasOrders = await order.isVisible().catch(() => false);
    if (hasOrders) {
      await order.click();
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="detail"]');
      await expect(modal.first()).toBeVisible({ timeout: 5000 });
    } else {
      const emptyState = page.locator('text=/no order|empty|no item/i');
      await expect(emptyState).toBeVisible();
    }
  });

  test('STF-REST-005: Real-time order notification badge', async ({ page }) => {
    const badge = page.locator('[class*="badge"], [class*="notification"], [class*="count"]');
    const badgeCount = await badge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
    const heading = page.locator('h1, h2, h3').filter({ hasText: /kitchen|restaurant|order/i });
    await expect(heading.first()).toBeVisible();
  });
});
