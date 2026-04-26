import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 9 — Staff Scanner i18n', () => {
  test('IMPROVE-9A: scanner page renders all i18n strings', async ({ page }) => {
    // Log in first
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="text"], input[type="email"]').first().fill('admin@v2resort.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();

    // Navigate to scanner
    await page.goto('http://localhost:3000/staff/scanner');

    // Verify all major i18n strings are present (English defaults)
    await expect(page.getByRole('heading', { name: 'Ticket Scanner' })).toBeVisible();
    await expect(page.getByText('Scan pool tickets to validate entry')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear History' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scan or Enter Code' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter ticket code or scan QR...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Validate Ticket' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Scans' })).toBeVisible();
    await expect(page.getByText('No scans yet')).toBeVisible();
    await expect(page.getByText('Scanned tickets will appear here')).toBeVisible();

    // Confirm no missing-key fallbacks (next-intl shows raw key path when missing)
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('staffScanner.');
  });
});
