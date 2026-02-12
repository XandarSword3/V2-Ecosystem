import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Public Pages Smoke [CUS-HOME, CUS-NAV, CUS-STATIC]', () => {
  test('homepage loads with hero and navigation', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('main').first()).toBeVisible();
    // Hero section should have a CTA
    const heroLink = page.getByRole('link', { name: /restaurant|book|explore|menu/i }).first();
    await expect(heroLink).toBeVisible();
  });

  test('homepage has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    // Filter out known non-critical errors (like favicon 404)
    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(realErrors).toHaveLength(0);
  });

  test('restaurant page loads with menu content', async ({ page }) => {
    await page.goto(`${BASE}/restaurant`);
    await expect(page.locator('main').first()).toBeVisible();
    const body = await page.locator('body').textContent();
    // Should have menu-related content
    expect(body?.length).toBeGreaterThan(100);
  });

  test('chalets page loads', async ({ page }) => {
    await page.goto(`${BASE}/chalets`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('pool page loads', async ({ page }) => {
    await page.goto(`${BASE}/pool`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('snack bar page loads', async ({ page }) => {
    await page.goto(`${BASE}/snack-bar`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('gift cards page loads', async ({ page }) => {
    await page.goto(`${BASE}/giftcards`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('login page loads with form', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in|login/i })).toBeVisible();
  });

  test('register page loads with form', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('contact page loads', async ({ page }) => {
    await page.goto(`${BASE}/contact`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('footer is present on homepage', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('footer').first()).toBeVisible();
    const footerLinks = page.locator('footer a');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('navigation links are present', async ({ page }) => {
    await page.goto(BASE);
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible();
    const navLinks = nav.getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
