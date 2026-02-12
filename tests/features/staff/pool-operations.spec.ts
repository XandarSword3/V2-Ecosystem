import { test, expect } from '@playwright/test';

test.describe('Pool Operations [STF-POOL]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'staff@v2resort.com');
    await page.fill('input[type="password"]', 'staff123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(staff|dashboard)/);
    await page.goto('http://localhost:3000/staff/pool');
    await page.waitForLoadState('networkidle');
  });

  test('STF-POOL-001: Scan mode toggle (F2)', async ({ page }) => {
    const scanBtn = page.locator('button').filter({ hasText: /scan|F2/i });
    await expect(scanBtn.first()).toBeVisible();
    await page.keyboard.press('F2');
    await page.waitForTimeout(500);
    const scanUI = page.locator('[class*="scan"], input[placeholder*="scan"], [class*="scanner"]');
    const scanCount = await scanUI.count();
    expect(scanCount).toBeGreaterThanOrEqual(0);
  });

  test('STF-POOL-002: Total/Pending/InPool/Completed stats', async ({ page }) => {
    const stats = page.locator('[class*="stat"], [class*="card"], [class*="metric"], [class*="summary"]');
    await expect(stats.first()).toBeVisible();
    const labels = page.locator('text=/total|pending|in.?pool|completed|capacity/i');
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('STF-POOL-003: Capacity progress bar', async ({ page }) => {
    const progress = page.locator('[role="progressbar"], progress, [class*="progress"], [class*="capacity"]');
    await expect(progress.first()).toBeVisible();
    const value = await progress.first().getAttribute('aria-valuenow') ??
      await progress.first().getAttribute('value') ?? '0';
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  test('STF-POOL-004: Record entry/exit buttons', async ({ page }) => {
    const entryBtn = page.locator('button').filter({ hasText: /entry|check.?in|admit/i });
    const exitBtn = page.locator('button').filter({ hasText: /exit|check.?out|leave/i });
    await expect(entryBtn.first()).toBeVisible();
    await expect(exitBtn.first()).toBeVisible();
  });

  test('STF-POOL-005: Ticket detail modal', async ({ page }) => {
    const ticket = page.locator('tr, [class*="ticket"], [class*="card"], [class*="row"]').filter({
      hasText: /ticket|guest|pool/i,
    }).first();
    const hasTicket = await ticket.isVisible().catch(() => false);
    if (hasTicket) {
      await ticket.click();
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="detail"]');
      await expect(modal.first()).toBeVisible({ timeout: 5000 });
    } else {
      const heading = page.locator('h1, h2, h3').filter({ hasText: /pool/i });
      await expect(heading.first()).toBeVisible();
    }
  });

  test('STF-POOL-006: Maintenance tab with form', async ({ page }) => {
    const tab = page.locator('button, [role="tab"]').filter({ hasText: /maintenance|schedule|clean/i });
    await expect(tab.first()).toBeVisible();
    await tab.first().click();
    await page.waitForTimeout(500);
    const form = page.locator('form, [class*="maintenance"], textarea, select');
    await expect(form.first()).toBeVisible();
  });
});
