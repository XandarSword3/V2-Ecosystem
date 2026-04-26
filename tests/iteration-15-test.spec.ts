import { test, expect } from './fixtures/auth.fixture';

// Iteration 15  Test Specification
// BUG-15D: Pool recordEntry/recordExit catch blocks  no more mock success
// FIX-15B: Profile booking cards  keyboard accessible
// FIX-15A: Giftcards  formatCurrency instead of hardcoded $

test.describe('Iteration 15  Pool Errors, Profile A11y, Currency Fix', () => {

  test('FIX-15A: Giftcards page shows formatted currency in range', async ({ page }) => {
    await page.goto('/giftcards');
    await expect(page.getByText(/\$10\.00.*\$1,000\.00/)).toBeVisible();
  });

  test('FIX-15A: Giftcards page shows currency symbol in input', async ({ page }) => {
    await page.goto('/giftcards');
    await expect(page.getByText('$')).toBeVisible();
  });

  test('FIX-15B: Profile page loads for authenticated user', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('admin@v2resort.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.goto('/profile');
    await expect(page.getByText(/Profile|Account/i)).toBeVisible();
  });

  test('BUG-15D: Pool staff page loads', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('admin@v2resort.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.goto('/staff/pool');
    await expect(page.getByText(/Pool Management/i)).toBeVisible();
  });
});
