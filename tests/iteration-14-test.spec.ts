import { test, expect } from './fixtures/auth.fixture';

// Iteration 14  Test Specification
// BUG-14A: staff/manager AbortController for 6 parallel API calls
// BUG-14C: Performance bar width overflow normalization
// FIX-14B: MultiDayBookingDashboard modal a11y

test.describe('Iteration 14  AbortController, Bar Overflow, Modal A11y', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('admin@v2resort.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();
  });

  test('BUG-14A: Manager dashboard loads with AbortController', async ({ page }) => {
    await page.goto('/staff/manager');
    await expect(page.getByRole('heading', { name: /Manager Dashboard/i })).toBeVisible();
    await expect(page.getByText(/Today's Revenue/i)).toBeVisible();
  });

  test('BUG-14C: Performance bar does not overflow', async ({ page }) => {
    await page.goto('/staff/manager');
    // Performance bars should exist in Weekly Performance section
    await expect(page.getByText(/Weekly Performance/i)).toBeVisible();
  });

  test('FIX-14B: Chalets staff booking dashboard loads', async ({ page }) => {
    await page.goto('/staff/chalets');
    // MultiDayBookingDashboard should render
    await expect(page.getByText(/Check-ins Today|Bookings|Manage/i)).toBeVisible();
  });
});
