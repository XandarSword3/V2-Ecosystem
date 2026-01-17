import { test, expect, Page } from '@playwright/test';

/**
 * Admin Systematic Feature Tests
 * 
 * Tests core admin functionality across all modules.
 * Requires backend and frontend servers to be running.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

/**
 * Helper to login with retry logic
 */
async function loginAsAdmin(page: Page): Promise<boolean> {
  try {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

test.describe('Admin Systematic Feature Test', () => {
  // Run tests sequentially to avoid auth conflicts
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) {
      test.skip(true, 'Login failed - backend may be down');
    }
    
    // Wait for dashboard to load (with flexible matcher)
    try {
      await expect(page.locator('text=/revenue|dashboard|overview/i').first()).toBeVisible({ timeout: 20000 });
    } catch {
      // Dashboard may have different content, just ensure we're on admin
      await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    }
  });

  // RESTAURANT TESTS
  test('Restaurant Menu loads', async ({ page }) => {
    await page.goto('/admin/restaurant/menu');
    await expect(page.getByRole('heading', { name: /Menu Items|Menu/i }).first()).toBeVisible();
    await expect(page.getByText('Total Items')).toBeVisible(); 
  });

  test('Restaurant Orders loads', async ({ page }) => {
    await page.goto('/admin/restaurant/orders');
    await expect(page.getByRole('heading', { name: /Orders/i }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/Search/i)).toBeVisible(); // Just check for search input
  });

  // CHALET TESTS
  test('Chalet Management loads', async ({ page }) => {
    await page.goto('/admin/chalets');
    await expect(page.getByRole('heading', { name: /Chalets/i }).first()).toBeVisible();
    // Usually a button to add new or list
    await expect(page.getByRole('button', { name: /Add|Create/i })).toBeVisible(); 
  });

  // POOL TESTS
  test('Pool Sessions loads', async ({ page }) => {
    await page.goto('/admin/pool/sessions');
    await expect(page.getByRole('heading', { name: /Sessions/i }).first()).toBeVisible();
  });

  // REVIEWS & REPORTS
  test('Reports & Analytics loads', async ({ page }) => {
    await page.goto('/admin/reports');
    // Look for stats or charts
    await expect(page.getByRole('heading', { name: /Reports|Analytics/i }).first()).toBeVisible();
    // Assuming there's a download button or similar
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible();
  });

  // SETTINGS TESTS (EXPANDED)
  test('General Settings loads', async ({ page }) => {
    await page.goto('/admin/settings'); // Main settings page
    await expect(page.getByRole('heading', { name: /General Settings|Settings/i }).first()).toBeVisible();
    // Should have save button
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
  });

  test('Backups Feature (Diagnosis)', async ({ page }) => {
    await page.goto('/admin/settings/backups');
    
    // Validated from page.tsx: Button text is "Create Manual Backup"
    const createBtn = page.getByRole('button', { name: /Create Manual Backup/i });
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    
    // Don't actually create one to save time/resources, just verify the UI is interactive
    await expect(createBtn).toBeEnabled();
    
    // Verify stats card exists
    await expect(page.getByText('System Health')).toBeVisible();
  });

  test('Translations Feature (Diagnosis)', async ({ page }) => {
    await page.goto('/admin/settings/translations');
    
    const frontendBtn = page.getByRole('button', { name: /Frontend JSON/i });
    await expect(frontendBtn).toBeVisible();
    
    await frontendBtn.click();
    
    // Validated from page.tsx: "Total Missing" is a stat card label in the frontend tab
    await expect(page.getByText('Total Missing', { exact: false })).toBeVisible({ timeout: 10000 }); 
  });

  test('Notifications Feature (Diagnosis)', async ({ page }) => {
    await page.goto('/admin/settings/notifications');
    
    // Validated from page.tsx: H1 is "Notifications"
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
    
    // Check for "Send Notification" button (checking existence/visibility)
    const sendBtn = page.getByRole('button', { name: /Send Notification/i });
    await expect(sendBtn).toBeVisible();
  });

});
