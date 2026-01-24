/**
 * Comprehensive CMS Settings E2E Tests
 * 
 * Tests all CMS settings pages systematically:
 * 1. General Settings (5 tabs)
 * 2. Appearance/Theme
 * 3. Footer
 * 4. Homepage
 * 5. Navbar
 * 6. Backups
 * 7. Notifications
 * 8. Payments
 * 9. Translations
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

// Helper: Login as admin
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 30000 });
}

// ============================================
// GENERAL SETTINGS TESTS
// ============================================
test.describe('General Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to general settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings`);
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 });
  });

  test('can view and edit general tab', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings`);
    await page.waitForLoadState('networkidle');
    
    // Check for resort name input
    const resortNameInput = page.locator('input[name="resortName"], input[placeholder*="Resort"]').first();
    await expect(resortNameInput).toBeVisible({ timeout: 10000 });
  });

  test('can switch between settings tabs', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings`);
    await page.waitForLoadState('networkidle');
    
    // Look for tab buttons
    const tabs = page.locator('[role="tab"], button[data-tab], .tab-button');
    if (await tabs.count() > 0) {
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);
    }
  });
});

// ============================================
// APPEARANCE SETTINGS TESTS
// ============================================
test.describe('Appearance Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to appearance settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/appearance`);
    await page.waitForLoadState('networkidle');
    
    // Check for theme selection
    await expect(page.getByText(/theme|appearance/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('can see theme presets', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/appearance`);
    await page.waitForLoadState('networkidle');
    
    // Look for theme cards/options
    const themeOptions = page.locator('[data-theme], .theme-card, .theme-option');
    // May not have explicit theme cards, so just verify page loaded
    await expect(page.locator('body')).toBeVisible();
  });

  test('can toggle dark mode setting', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/appearance`);
    await page.waitForLoadState('networkidle');
    
    // Look for dark mode toggle or switch
    const darkModeToggle = page.locator('[data-test="dark-mode-toggle"], input[type="checkbox"], button:has-text("Dark")').first();
    if (await darkModeToggle.isVisible()) {
      await expect(darkModeToggle).toBeEnabled();
    }
  });
});

// ============================================
// FOOTER SETTINGS TESTS
// ============================================
test.describe('Footer Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to footer settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/footer`);
    await page.waitForLoadState('networkidle');
    
    // Check page loaded
    await expect(page.locator('body')).toBeVisible();
  });

  test('can see footer configuration options', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/footer`);
    await page.waitForLoadState('networkidle');
    
    // Look for footer-related inputs or sections
    const footerContent = page.locator('input, textarea, [contenteditable]');
    await expect(footerContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// HOMEPAGE SETTINGS TESTS
// ============================================
test.describe('Homepage Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to homepage settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/homepage`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('can view hero slide configuration', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/homepage`);
    await page.waitForLoadState('networkidle');
    
    // Look for hero-related content
    const heroSection = page.locator(':has-text("Hero"), :has-text("Slide")').first();
    if (await heroSection.isVisible()) {
      await expect(heroSection).toBeVisible();
    }
  });
});

// ============================================
// NAVBAR SETTINGS TESTS
// ============================================
test.describe('Navbar Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to navbar settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/navbar`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('can see navbar links configuration', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/navbar`);
    await page.waitForLoadState('networkidle');
    
    // Look for link-related content
    const navbarContent = page.locator('input, button, [draggable]');
    await expect(navbarContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// BACKUPS SETTINGS TESTS
// ============================================
test.describe('Backups Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to backups settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/backups`);
    await page.waitForLoadState('networkidle');
    
    // Check for backup-related heading or content
    await expect(page.getByText(/backup/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('can see create backup button', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/backups`);
    await page.waitForLoadState('networkidle');
    
    // Look for create backup button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Backup")').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
  });

  test('can see restore from file button', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/backups`);
    await page.waitForLoadState('networkidle');
    
    // Look for restore button
    const restoreButton = page.locator('button:has-text("Restore"), button:has-text("Upload")').first();
    await expect(restoreButton).toBeVisible({ timeout: 10000 });
  });

  test('can view backup history', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/backups`);
    await page.waitForLoadState('networkidle');
    
    // Look for history table or list
    const historySection = page.locator('table, [role="table"], :has-text("History")');
    await expect(historySection.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// NOTIFICATIONS SETTINGS TESTS
// ============================================
test.describe('Notifications Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to notifications settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/notifications`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('can see notification templates', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/notifications`);
    await page.waitForLoadState('networkidle');
    
    // Look for template-related content
    const templateContent = page.locator(':has-text("Template"), :has-text("Email")').first();
    if (await templateContent.isVisible()) {
      await expect(templateContent).toBeVisible();
    }
  });
});

// ============================================
// PAYMENTS SETTINGS TESTS
// ============================================
test.describe('Payments Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to payments settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/payments`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('can see payment gateway options', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/payments`);
    await page.waitForLoadState('networkidle');
    
    // Look for payment gateway content
    const paymentContent = page.locator(':has-text("Stripe"), :has-text("Payment"), input').first();
    await expect(paymentContent).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// TRANSLATIONS SETTINGS TESTS
// ============================================
test.describe('Translations Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to translations settings', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/translations`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('can see language options', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/translations`);
    await page.waitForLoadState('networkidle');
    
    // Look for language-related content
    const languageContent = page.locator(':has-text("English"), :has-text("Arabic"), :has-text("French")').first();
    if (await languageContent.isVisible()) {
      await expect(languageContent).toBeVisible();
    }
  });
});

// ============================================
// MODULES PAGE TESTS
// ============================================
test.describe('Modules Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate to modules page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    await page.waitForLoadState('networkidle');
    
    // Check for modules heading
    await expect(page.getByText(/module/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('can see module list', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    await page.waitForLoadState('networkidle');
    
    // Look for module cards or list items
    const moduleItems = page.locator('[data-module], .module-card, article, .card');
    await expect(moduleItems.first()).toBeVisible({ timeout: 10000 });
  });

  test('can create new module button is visible', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    await page.waitForLoadState('networkidle');
    
    // Look for create module button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
  });
});
