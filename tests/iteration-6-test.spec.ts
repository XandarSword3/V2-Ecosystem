import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 6 — Register Autocomplete, Cart Discount & Modifier Fixes', () => {
  test('BUG-6A: Register page has no autocomplete warnings', async ({ page }) => {
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'verbose') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/register');
    await page.waitForLoadState('networkidle');

    const autoCompleteWarnings = consoleWarnings.filter((w) =>
      w.includes('autocomplete')
    );
    expect(autoCompleteWarnings).toHaveLength(0);
  });

  test('BUG-6A: Register first name has autoComplete="given-name"', async ({ page }) => {
    await page.goto('http://localhost:3000/register');
    await page.waitForLoadState('networkidle');

    // First text input is first name
    const firstNameInput = page.locator('input[type="text"]').first();
    await expect(firstNameInput).toHaveAttribute('autocomplete', 'given-name');
  });

  test('BUG-6A: Register email has autoComplete="email"', async ({ page }) => {
    await page.goto('http://localhost:3000/register');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
  });

  test('BUG-6A: Register password has autoComplete="new-password"', async ({ page }) => {
    await page.goto('http://localhost:3000/register');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
  });
});
