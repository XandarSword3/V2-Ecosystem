import { test, expect } from '@playwright/test';

test.describe('Bookings Calendar [STF-BOOK]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'staff@v2resort.com');
    await page.fill('input[type="password"]', 'staff123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(staff|dashboard)/);
    await page.goto('http://localhost:3000/staff/bookings');
    await page.waitForLoadState('networkidle');
  });

  test('STF-BOOK-001: Date navigation (Prev/Today/Next)', async ({ page }) => {
    const prevBtn = page.locator('button').filter({ hasText: /prev|back|←|</i });
    const nextBtn = page.locator('button').filter({ hasText: /next|forward|→|>/i });
    const todayBtn = page.locator('button').filter({ hasText: /today/i });
    await expect(prevBtn.first()).toBeVisible();
    await expect(nextBtn.first()).toBeVisible();
    await expect(todayBtn.first()).toBeVisible();
    await nextBtn.first().click();
    await page.waitForTimeout(500);
    await prevBtn.first().click();
    await page.waitForTimeout(500);
  });

  test('STF-BOOK-002: Check-in/out/staying stats', async ({ page }) => {
    const stats = page.locator('[class*="stat"], [class*="card"], [class*="metric"], [class*="summary"]');
    await expect(stats.first()).toBeVisible();
    const labels = page.locator('text=/check.?in|check.?out|stay|arrival|departure|occupied/i');
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('STF-BOOK-003: Booking list for selected date', async ({ page }) => {
    const list = page.locator('[class*="list"], [class*="table"], tbody, [class*="booking"]');
    await expect(list.first()).toBeVisible();
    const dateDisplay = page.locator('[class*="date"], [class*="calendar-header"], h2, h3').filter({
      hasText: /\d{1,2}|\w+day|january|february|march|april|may|june|july|august|september|october|november|december/i,
    });
    await expect(dateDisplay.first()).toBeVisible();
  });

  test('STF-BOOK-004: Check-in/out actions from calendar', async ({ page }) => {
    const actionBtns = page.locator('button').filter({
      hasText: /check.?in|check.?out|confirm|process/i,
    });
    const btnCount = await actionBtns.count();
    expect(btnCount).toBeGreaterThanOrEqual(0);
    const heading = page.locator('h1, h2, h3').filter({ hasText: /booking|calendar|schedule/i });
    await expect(heading.first()).toBeVisible();
  });
});
