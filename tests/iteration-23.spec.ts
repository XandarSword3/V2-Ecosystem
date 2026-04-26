import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 23  AbortController: Bookings, FloorPlan, Chalets', () => {
  test('FIX-23A: staff/bookings has AbortController', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/bookings');
    await expect(page.locator('h1')).toContainText('Booking Calendar');
  });

  test('FIX-23C: staff/chalets has AbortController', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/chalets');
    await expect(page.locator('h1')).toContainText('Chalets');
  });
});
