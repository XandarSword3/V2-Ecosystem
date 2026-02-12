import { test, expect } from '@playwright/test';

// Iteration 25 — Pool i18n verification
// IMPROVE Iter-25: Verify all pool page strings are i18n'd

test.describe('Iteration 25 — Pool Page i18n', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/staff/pool');
    await page.waitForLoadState('networkidle');
  });

  test('pool page header shows i18n strings', async ({ page }) => {
    // Title from tp('title')
    await expect(page.getByRole('heading', { name: 'Pool Management' })).toBeVisible();
    // Subtitle from tp('subtitle')
    await expect(page.getByText('Validate tickets and track pool usage')).toBeVisible();
  });

  test('pool page stats cards show i18n labels', async ({ page }) => {
    await expect(page.getByText('Total Today')).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('In Pool Now')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
  });

  test('pool page tabs show i18n labels', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Tickets' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maintenance Logs' })).toBeVisible();
  });

  test('pool page empty state shows i18n string', async ({ page }) => {
    await expect(page.getByText('No tickets for today')).toBeVisible();
  });

  test('pool page buttons show i18n text', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Refresh/ })).toBeVisible();
  });
});
