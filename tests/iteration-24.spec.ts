import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 24  i18n: Chalets Modal + Bookings Strings', () => {
  test('IMPROVE-24A/B: staff/chalets compiles with i18n statusConfig + modal', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/chalets');
    await expect(page.locator('h1')).toContainText('Chalets');
  });

  test('IMPROVE-24C: staff/bookings compiles with i18n strings', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/bookings');
    await expect(page.locator('h1')).toContainText('Booking Calendar');
  });
});
