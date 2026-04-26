import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 5 — Reviews API, Login Autocomplete, Homepage CTA', () => {
  test('BUG-5A: Homepage has no console errors (reviews API graceful)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    const apiErrors = consoleErrors.filter((e) =>
      e.includes('500') || e.includes('reviews')
    );
    expect(apiErrors).toHaveLength(0);
  });

  test('BUG-5B: Login email input has autoComplete="email"', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
  });

  test('BUG-5B: Login password input has autoComplete="current-password"', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('IMPROVE-5A: Homepage "Book Now" CTA links to /restaurant', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // The bottom CTA "Book Now" button should link to /restaurant, not /
    const bookNowLink = page.locator('a:has(button:has-text("Book Now"))').first();
    const href = await bookNowLink.getAttribute('href');
    expect(href).toBe('/restaurant');
  });
});
