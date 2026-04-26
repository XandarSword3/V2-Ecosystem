import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 19 - Modal A11y Fixes', () => {

  test('FIX-19A: staff/modules/chalets renders MultiDayBookingDashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/modules/chalets');
    await expect(page.getByRole('heading', { name: /Chalets Bookings/i })).toBeVisible();
    await expect(page.getByText('Check-ins Today')).toBeVisible();
    await expect(page.getByText('Total Bookings')).toBeVisible();
  });

  test('FIX-19B: restaurant page renders CustomerPOSTemplate', async ({ page }) => {
    await page.goto('http://localhost:3000/restaurant');
    await expect(page.getByRole('heading', { name: /Our Menu/i })).toBeVisible();
  });

  test('FIX-19C: staff/chalets page renders without errors', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/chalets');
    await expect(page.getByRole('heading', { name: /Chalets Management/i })).toBeVisible();
    await expect(page.getByText('Today', { exact: false })).toBeVisible();
  });
});
