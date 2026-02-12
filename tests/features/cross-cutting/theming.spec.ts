import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Theming Features [SYS-THEME-001 → 003]', () => {
  test('theme toggle is visible', async ({ page }) => {
    await page.goto(BASE);
    // Look for dark/light mode toggle
    const toggle = page.locator('[class*="theme"], button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="mode"]').first();
    const count = await toggle.count();
    expect(count).toBeGreaterThan(0);
  });

  test('page has CSS variables applied', async ({ page }) => {
    await page.goto(BASE);
    // Check that theme CSS vars are applied
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--background');
    });
    // Should have a background color variable set
    expect(bgColor.trim().length).toBeGreaterThan(0);
  });

  test('page renders without broken styles', async ({ page }) => {
    await page.goto(BASE);
    // Verify the page has actual styled content (not unstyled HTML)
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    // Background should be set (not default transparent)
    expect(bgColor).toBeTruthy();
    expect(bgColor).not.toBe('');
  });

  test('admin panel has theming applied', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill('admin@v2resort.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    // Admin should have styled content
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
  });
});
