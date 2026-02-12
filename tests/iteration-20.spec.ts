import { test, expect } from '@playwright/test';

test.describe('Iteration 20 - POS Modal A11y + i18n Status Keys', () => {

  test('FIX-20A: staff/restaurant renders StaffPOSTemplate', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/restaurant');
    await expect(page.getByRole('heading', { name: /Pending/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pending/i })).toBeVisible();
  });

  test('FIX-20B: admin POS page compiles without errors', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/modules/restaurant');
    await expect(page.getByText(/Restaurant|Kitchen/i)).toBeVisible();
  });

  test('IMPROVE-20C: staff/chalets renders with booking statuses', async ({ page }) => {
    await page.goto('http://localhost:3000/staff/chalets');
    await expect(page.getByRole('heading', { name: /Chalets Management/i })).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
  });
});
