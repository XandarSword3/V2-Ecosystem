import { test, expect } from '../../fixtures/auth.fixture';

const BASE = 'http://localhost:3000';

test.describe('Responsive Design [CUS-NAV-003, CUS-NAV-004]', () => {
  test('mobile viewport shows hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto(BASE);
    // Mobile menu button should be visible
    const menuButton = page.locator('button[aria-label*="menu"], button[class*="mobile"], button[class*="hamburger"]').first();
    const count = await menuButton.count();
    expect(count).toBeGreaterThan(0);
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto(BASE);
    await expect(page.locator('main').first()).toBeVisible();
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('desktop viewport shows full navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible();
  });

  test('menu service page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/menu service`);
    await expect(page.locator('main').first()).toBeVisible();
    // Content should be present
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(50);
  });
});
