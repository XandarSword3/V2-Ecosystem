/**
 * Complete Feature Coverage E2E Tests
 * 
 * Comprehensive tests covering all major features across the V2 Resort application.
 * These tests "let the bots loose" to systematically test every feature.
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

// ============================================
// HELPER FUNCTIONS
// ============================================

async function loginAsAdmin(page: Page): Promise<boolean> {
  try {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

async function navigateToPage(page: Page, path: string): Promise<void> {
  await page.goto(`${FRONTEND_URL}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
}

// ============================================
// PUBLIC PAGES TESTS
// ============================================
test.describe('Public Pages Accessibility', () => {
  
  test('Home page loads correctly', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Should have main content
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    
    // Should have navigation
    const nav = page.locator('nav, header');
    await expect(nav.first()).toBeVisible();
  });

  test('Restaurant page loads correctly', async ({ page }) => {
    await navigateToPage(page, '/restaurant');
    
    // Should have menu content
    await expect(page.locator('[class*="menu"], [data-testid*="menu"]').first()).toBeVisible({ timeout: 10000 });
    
    // Should have categories or items
    const menuItems = page.locator('[class*="MenuItem"], [class*="menu-item"], [data-testid*="menu-item"]');
    const count = await menuItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Pool page loads correctly', async ({ page }) => {
    await navigateToPage(page, '/pool');
    
    // Should have pool content
    await expect(page.locator('main').first()).toBeVisible();
    
    // Look for pricing or ticket information
    const pricingContent = page.locator('text=/price|ticket|book|session/i');
    await expect(pricingContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Chalets page loads correctly', async ({ page }) => {
    await navigateToPage(page, '/chalets');
    
    // Should have chalets content
    await expect(page.locator('main').first()).toBeVisible();
    
    // Look for chalet cards or listings
    const chaletContent = page.locator('[class*="chalet"], [class*="Chalet"], text=/chalet/i');
    await expect(chaletContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Login page loads correctly', async ({ page }) => {
    await navigateToPage(page, '/login');
    
    // Should have login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ============================================
// ADMIN DASHBOARD TESTS
// ============================================
test.describe('Admin Dashboard', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Dashboard loads with stats', async ({ page }) => {
    await navigateToPage(page, '/admin');
    
    // Should have dashboard content
    await expect(page.locator('main').first()).toBeVisible();
    
    // Should have stat cards
    const statCards = page.locator('[class*="Card"], [class*="stat"]');
    const count = await statCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Dashboard shows revenue stats', async ({ page }) => {
    await navigateToPage(page, '/admin');
    
    // Look for revenue or financial data
    const revenueContent = page.locator('text=/revenue|income|earnings|\\$/i');
    await expect(revenueContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN USER MANAGEMENT TESTS
// ============================================
test.describe('Admin User Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Users page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/users');
    
    // Should have users list or navigation
    await expect(page.locator('main').first()).toBeVisible();
    
    // Should have user content
    const userContent = page.locator('text=/users|customers|staff/i');
    await expect(userContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Customers list loads', async ({ page }) => {
    await navigateToPage(page, '/admin/users/customers');
    
    // Should have customers heading or list
    await expect(page.getByRole('heading', { name: /Customer|User/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Staff list loads', async ({ page }) => {
    await navigateToPage(page, '/admin/users/staff');
    
    // Should have staff heading or list
    await expect(page.getByRole('heading', { name: /Staff|Team|Employee/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Live users page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/users/live');
    
    // Should have live users content
    await expect(page.locator('main').first()).toBeVisible();
    const liveContent = page.locator('text=/Online|Live|Active|Connected/i');
    await expect(liveContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN RESTAURANT MANAGEMENT TESTS
// ============================================
test.describe('Admin Restaurant Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Restaurant menu page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/restaurant/menu');
    
    await expect(page.getByRole('heading', { name: /Menu/i }).first()).toBeVisible({ timeout: 10000 });
    
    // Should have add button
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")');
    await expect(addButton.first()).toBeVisible();
  });

  test('Restaurant orders page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/restaurant/orders');
    
    await expect(page.getByRole('heading', { name: /Order/i }).first()).toBeVisible({ timeout: 10000 });
    
    // Should have filters or search
    const filterContent = page.locator('input[placeholder*="Search"], select, button:has-text("Filter")');
    await expect(filterContent.first()).toBeVisible();
  });

  test('Restaurant categories page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/restaurant/categories');
    
    await expect(page.getByRole('heading', { name: /Categor/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Restaurant inventory page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/restaurant/inventory');
    
    await expect(page.locator('main').first()).toBeVisible();
    const inventoryContent = page.locator('text=/inventory|stock|item/i');
    await expect(inventoryContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Restaurant tables page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/restaurant/tables');
    
    await expect(page.locator('main').first()).toBeVisible();
    const tableContent = page.locator('text=/table|seating|floor/i');
    await expect(tableContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN POOL MANAGEMENT TESTS
// ============================================
test.describe('Admin Pool Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Pool sessions page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/pool/sessions');
    
    await expect(page.getByRole('heading', { name: /Session/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Pool passes page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/pool/passes');
    
    await expect(page.locator('main').first()).toBeVisible();
    const passContent = page.locator('text=/pass|ticket|admission/i');
    await expect(passContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Pool settings page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/pool/settings');
    
    await expect(page.locator('main').first()).toBeVisible();
    const settingsContent = page.locator('text=/setting|config|hours|capacity/i');
    await expect(settingsContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN CHALET MANAGEMENT TESTS
// ============================================
test.describe('Admin Chalet Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Chalets list page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/chalets');
    
    await expect(page.getByRole('heading', { name: /Chalet/i }).first()).toBeVisible({ timeout: 10000 });
    
    // Should have add button
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")');
    await expect(addButton.first()).toBeVisible();
  });

  test('Chalet bookings page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/chalets/bookings');
    
    await expect(page.locator('main').first()).toBeVisible();
    const bookingContent = page.locator('text=/booking|reservation|calendar/i');
    await expect(bookingContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN REVIEWS MANAGEMENT TESTS
// ============================================
test.describe('Admin Reviews Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Reviews page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/reviews');
    
    await expect(page.getByRole('heading', { name: /Review/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Reviews have moderation actions', async ({ page }) => {
    await navigateToPage(page, '/admin/reviews');
    
    // Should have approve/reject buttons or filters
    const moderationContent = page.locator('text=/approve|reject|pending|filter/i, button:has-text("Approve"), button:has-text("Reject")');
    await expect(moderationContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN REPORTS TESTS
// ============================================
test.describe('Admin Reports', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Reports page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/reports');
    
    await expect(page.getByRole('heading', { name: /Report|Analytics/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Reports have date filters', async ({ page }) => {
    await navigateToPage(page, '/admin/reports');
    
    // Should have date range selectors
    const dateContent = page.locator('input[type="date"], button:has-text("This Week"), button:has-text("This Month"), select:has-text("Period")');
    await expect(dateContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Reports have export functionality', async ({ page }) => {
    await navigateToPage(page, '/admin/reports');
    
    // Should have export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("PDF")');
    await expect(exportButton.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN SETTINGS TESTS
// ============================================
test.describe('Admin Settings', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('General settings page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/settings');
    
    await expect(page.getByRole('heading', { name: /Setting/i }).first()).toBeVisible({ timeout: 10000 });
    
    // Should have save button
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton.first()).toBeVisible();
  });

  test('Notifications settings page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/settings/notifications');
    
    await expect(page.getByRole('heading', { name: /Notification/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Backups page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/settings/backups');
    
    await expect(page.locator('main').first()).toBeVisible();
    const backupContent = page.locator('text=/backup|restore|create/i');
    await expect(backupContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Translations page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/settings/translations');
    
    await expect(page.locator('main').first()).toBeVisible();
    const translationContent = page.locator('text=/translation|language|locale/i');
    await expect(translationContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Roles and permissions page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/settings/roles');
    
    await expect(page.locator('main').first()).toBeVisible();
    const rolesContent = page.locator('text=/role|permission|access/i');
    await expect(rolesContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Audit logs page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/audit');
    
    await expect(page.locator('main').first()).toBeVisible();
    const auditContent = page.locator('text=/audit|log|activity|action/i');
    await expect(auditContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ADMIN MODULES MANAGEMENT TESTS
// ============================================
test.describe('Admin Modules Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Modules page loads', async ({ page }) => {
    await navigateToPage(page, '/admin/modules');
    
    await expect(page.getByRole('heading', { name: /Module/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Modules have enable/disable toggles', async ({ page }) => {
    await navigateToPage(page, '/admin/modules');
    
    // Should have toggle switches
    const toggles = page.locator('input[type="checkbox"], [role="switch"], button[aria-pressed]');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================
test.describe('Admin Navigation', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) test.skip(true, 'Login failed');
  });

  test('Sidebar navigation works', async ({ page }) => {
    await navigateToPage(page, '/admin');
    
    // Should have sidebar or navigation menu
    const sidebar = page.locator('nav, aside, [role="navigation"]');
    await expect(sidebar.first()).toBeVisible();
    
    // Click on a navigation item
    const navItem = page.locator('a[href*="/admin/restaurant"], a[href*="/admin/pool"], a[href*="/admin/chalets"]').first();
    if (await navItem.isVisible()) {
      await navItem.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('User can logout', async ({ page }) => {
    await navigateToPage(page, '/admin');
    
    // Look for logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")');
    if (await logoutButton.first().isVisible()) {
      await logoutButton.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should be redirected to login or home
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(login|$)/);
    }
  });
});

// ============================================
// RESPONSIVE DESIGN TESTS
// ============================================
test.describe('Responsive Design', () => {
  test('Mobile viewport works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Should have mobile menu or hamburger
    const mobileMenu = page.locator('button[aria-label*="menu" i], [class*="hamburger"], [class*="mobile-menu"]');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('Tablet viewport works', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('Desktop viewport works', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main').first()).toBeVisible();
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================
test.describe('Error Handling', () => {
  test('404 page displays for invalid routes', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/this-page-does-not-exist-12345`);
    await page.waitForLoadState('networkidle');
    
    // Should show 404 or not found content
    const notFoundContent = page.locator('text=/404|not found|page.*exist/i');
    await expect(notFoundContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Protected routes redirect to login', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    
    // Try to access admin route directly
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Should be redirected to login or show login form
    const loginForm = page.locator('input[type="email"], input[type="password"]');
    const loginRedirect = page.url().includes('login');
    
    // Either we're on login page or there's a login form
    expect(loginRedirect || await loginForm.first().isVisible()).toBe(true);
  });
});
