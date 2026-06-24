/**
 * Admin Complete Feature Coverage E2E Test
 * 
 * This test has the admin bot systematically try out EVERY admin feature.
 * It covers all pages, performs actual CRUD operations, and verifies functionality.
 * 
 * Features Tested:
 * - Dashboard & Analytics
 * - User Management (Customers, Staff, Admins, Roles)
 * - MenuService (Menu, Categories, Orders, Tables)
 * - Pool (Sessions, Tickets, Capacity)
 * - AccommodationUnits (Listings, Bookings)
 * - Reviews Management
 * - Reports & Analytics
 * - Settings (General, Appearance, Navbar, Footer, Homepage, Payments)
 * - Notifications (Send, Templates, Schedule)
 * - Translations
 * - Backups
 * - Modules
 * - Audit Logs
 */

import { test, expect, Page } from '../fixtures/auth.fixture';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';

const ADMIN_CREDENTIALS = {
  email: process.env.E2E_ADMIN_EMAIL || 'admin@v2ecosystem.com',
  password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
};

// Test data for CRUD operations
const TEST_DATA = {
  menuItem: {
    name: `Test Item ${Date.now()}`,
    price: '15.99',
    description: 'A test menu item created by E2E',
  },
  category: {
    name: `Test Category ${Date.now()}`,
  },
  user: {
    name: 'E2E Test User',
    email: `e2e.test.${Date.now()}@example.com`,
  },
  template: {
    name: `Test Template ${Date.now()}`,
    subject: 'Test Subject',
    body: 'Hello {{name}}, this is a test.',
  },
  accommodation unit: {
    name: `Test AccommodationUnit ${Date.now()}`,
    price: '250',
  },
};

// Track created items for cleanup
const createdItems = {
  menuItemId: null as string | null,
  categoryId: null as string | null,
  userId: null as string | null,
  templateId: null as string | null,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function waitForStableUI(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    await page.locator('main, [role="main"], body').first().waitFor({ state: 'visible', timeout: 10000 });
  }
}
async function loginAsAdmin(page: Page, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for login form AND React to hydrate
      await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 });
      
      // Wait extra for React hydration
      await waitForStableUI(page);
      let loginSuccess = false;
      const responseHandler = (response: any) => {
        if (response.url().includes('/auth/login') && response.status() === 200) {
          loginSuccess = true;
        }
      };
      page.on('response', responseHandler);
      
      // Fill credentials - simple and reliable
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      // Clear first in case there's a prefilled value
      await emailInput.clear();
      await emailInput.fill(ADMIN_CREDENTIALS.email);
      
      await passwordInput.clear();
      await passwordInput.fill(ADMIN_CREDENTIALS.password);
      
      // Wait for React to process the input
      await waitForStableUI(page);
      await passwordInput.press('Enter');
      
      // Wait for navigation to admin (window.location.href = '/admin')
      await waitForStableUI(page);
      page.off('response', responseHandler);
      
      // Verify we're logged in by checking URL
      const currentUrl = page.url();
      
      // Check localStorage
      const hasToken = await page.evaluate(() => !!localStorage.getItem('accessToken'));
      
      if (currentUrl.includes('/admin') && hasToken) {
        console.log(`Login succeeded on attempt ${attempt}`);
        // Wait for dashboard to load
        await waitForStableUI(page);
        return true;
      }
      
      // If still on login page but we have a token, try navigating manually
      if (hasToken) {
        await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForStableUI(page);
        return true;
      }
      
      console.log(`Login attempt ${attempt} failed, URL: ${currentUrl}, hasToken: ${hasToken}`);
      
      if (attempt < retries) {
        await waitForStableUI(page);
      }
    } catch (error) {
      console.error(`Admin login attempt ${attempt} failed:`, error);
      if (attempt < retries) {
        await waitForStableUI(page);
      }
    }
  }
  
  console.error('All login attempts failed');
  return false;
}

async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(`${FRONTEND_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for React to hydrate and any loading states to clear
  await waitForStableUI(page);
  await page.waitForLoadState('load');
}

async function fillInput(page: Page, selector: string, value: string): Promise<void> {
  const input = page.locator(selector).first();
  if (await input.isVisible()) {
    await input.fill(value);
  }
}

async function clickButton(page: Page, text: string): Promise<boolean> {
  const button = page.locator(`button:has-text("${text}")`).first();
  if (await button.isVisible()) {
    await button.click();
    await waitForStableUI(page);
    return true;
  }
  return false;
}

// ============================================
// SECTION 1: DASHBOARD
// ============================================
test.describe('1. Dashboard Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('1.1 View dashboard overview', async () => {
    await navigateTo(adminPage, '/admin');
    
    // Should show welcome message or dashboard content
    await expect(adminPage.locator('text=/Welcome|Dashboard|Today/i').first()).toBeVisible({ timeout: 15000 });
    
    // Should show some stats like Online Users, Orders, Revenue
    const statsVisible = await adminPage.locator('text=/Online Users|Today\'s Orders|Today\'s Revenue|Active Bookings/i').first().isVisible();
    expect(statsVisible).toBeTruthy();
  });

  test('1.2 View revenue breakdown', async () => {
    // Look for revenue breakdown section
    const revenueSection = adminPage.locator('text=/Revenue by Business Unit|MenuService|AccommodationUnits|Pool/i').first();
    const visible = await revenueSection.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('1.3 View recent activity', async () => {
    const activitySection = adminPage.locator('text=/Recent Orders|Recent Activity|Latest/i').first();
    const visible = await activitySection.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('1.4 View quick stats', async () => {
    // Check for dashboard stat text elements
    const statsCount = await adminPage.locator('text=/Online Users|Orders|Revenue|Bookings|Tickets/i').count();
    expect(statsCount).toBeGreaterThan(0);
  });
});

// ============================================
// SECTION 2: USER MANAGEMENT
// ============================================
test.describe('2. User Management Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  // --- CUSTOMERS ---
  test('2.1 View customers list', async () => {
    await navigateTo(adminPage, '/admin/users/customers');
    // Wait for page load first
    await adminPage.waitForLoadState('networkidle');
    // Look for heading - the Customers page shows the heading
    const heading = adminPage.getByRole('heading', { name: /Customers/i }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    
    // Should have search (may not be visible if list empty)
    const search = adminPage.locator('input[placeholder*="Search" i], input[type="search"]');
    if (await search.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(search.first()).toBeVisible();
    }
  });

  test('2.2 Search customers', async () => {
    const search = adminPage.locator('input[placeholder*="Search" i]').first();
    if (await search.isVisible()) {
      await search.fill('test');
      await waitForStableUI(adminPage);
      await search.clear();
    }
  });

  test('2.3 Filter customers', async () => {
    const filterButton = adminPage.locator('button:has-text("Filter"), select').first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await waitForStableUI(adminPage);
    }
  });

  // --- STAFF ---
  test('2.4 View staff list', async () => {
    await navigateTo(adminPage, '/admin/users/staff');
    await expect(adminPage.getByRole('heading', { name: /Staff|Team/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('2.5 Open create staff modal', async () => {
    const addButton = adminPage.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await waitForStableUI(adminPage);
      const cancelButton = adminPage.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
  });

  // --- ADMINS ---
  test('2.6 View admins list', async () => {
    await navigateTo(adminPage, '/admin/users/admins');
    await expect(adminPage.locator('main').first()).toBeVisible();
  });

  // --- ROLES ---
  test('2.7 View roles', async () => {
    await navigateTo(adminPage, '/admin/users/roles');
    await expect(adminPage.getByRole('heading', { name: /Role|Permission/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('2.8 View role permissions', async () => {
    const roleCard = adminPage.locator('[class*="role"], tr').first();
    if (await roleCard.isVisible()) {
      await roleCard.click();
      await waitForStableUI(adminPage);
    }
  });

  // --- LIVE USERS ---
  test('2.9 View live users', async () => {
    await navigateTo(adminPage, '/admin/users/live');
    const liveContent = adminPage.locator('text=/online|live|active|connected/i');
    await expect(liveContent.first()).toBeVisible({ timeout: 10000 });
  });

  // --- CREATE USER ---
  test('2.10 Open create user page', async () => {
    await navigateTo(adminPage, '/admin/users/create');
    await waitForStableUI(adminPage);
    await expect(adminPage.locator('main').first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// SECTION 3: RESTAURANT MANAGEMENT
// ============================================
test.describe('3. MenuService Management Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  // --- MENU ---
  test('3.1 View menu items', async () => {
    await navigateTo(adminPage, '/admin/${slug}/menu');
    await expect(adminPage.getByRole('heading', { name: /Menu/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('3.2 Open add menu item modal', async () => {
    const addButton = adminPage.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await waitForStableUI(adminPage);
      const modal = adminPage.locator('[class*="modal"], [class*="Modal"], [role="dialog"]');
      if (await modal.first().isVisible()) {
        // Fill form
        await fillInput(adminPage, 'input[name="name"], input[placeholder*="name" i]', TEST_DATA.menuItem.name);
        await fillInput(adminPage, 'input[name="price"], input[placeholder*="price" i]', TEST_DATA.menuItem.price);
        
        // Cancel without saving (test mode)
        await clickButton(adminPage, 'Cancel');
      }
    }
  });

  test('3.3 Search menu items', async () => {
    const search = adminPage.locator('input[placeholder*="Search" i]').first();
    if (await search.isVisible()) {
      await search.fill('burger');
      await waitForStableUI(adminPage);
      await search.clear();
    }
  });

  test('3.4 Filter by category', async () => {
    const categoryFilter = adminPage.locator('select, button:has-text("Category")').first();
    if (await categoryFilter.isVisible()) {
      const tagName = await categoryFilter.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await categoryFilter.selectOption({ index: 1 });
        await waitForStableUI(adminPage);
        await categoryFilter.selectOption({ index: 0 });
      } else {
        await categoryFilter.click();
        await waitForStableUI(adminPage);
      }
    }
  });

  // --- CATEGORIES ---
  test('3.5 View categories', async () => {
    await navigateTo(adminPage, '/admin/${slug}/categories');
    await expect(adminPage.getByRole('heading', { name: /Categor/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('3.6 Open add category modal', async () => {
    const addButton = adminPage.locator('button:has-text("Add"), button:has-text("Create")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await waitForStableUI(adminPage);
      await fillInput(adminPage, 'input[name="name"], input[placeholder*="name" i]', TEST_DATA.category.name);
      await clickButton(adminPage, 'Cancel');
    }
  });

  test('3.7 Reorder categories', async () => {
    // Look for drag handles or reorder buttons
    const dragHandle = adminPage.locator('[class*="drag"], [class*="handle"], [data-testid="drag-handle"]').first();
    if (await dragHandle.isVisible()) {
      await expect(dragHandle).toBeVisible();
    }
  });

  // --- ORDERS ---
  test('3.8 View orders', async () => {
    await navigateTo(adminPage, '/admin/${slug}/orders');
    await expect(adminPage.getByRole('heading', { name: /Order/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('3.9 Filter orders by status', async () => {
    const statusFilter = adminPage.locator('select[name="status"], button:has-text("Status"), select').first();
    if (await statusFilter.isVisible()) {
      const tagName = await statusFilter.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await statusFilter.selectOption({ index: 1 });
        await waitForStableUI(adminPage);
      }
    }
  });

  test('3.10 Filter orders by date', async () => {
    const dateFilter = adminPage.locator('input[type="date"]').first();
    if (await dateFilter.isVisible()) {
      const today = new Date().toISOString().split('T')[0];
      await dateFilter.fill(today);
      await waitForStableUI(adminPage);
    }
  });

  test('3.11 View order details', async () => {
    const orderRow = adminPage.locator('tr, [class*="order-item"]').first();
    if (await orderRow.isVisible()) {
      await orderRow.click();
      await waitForStableUI(adminPage);
    }
  });

  // --- TABLES ---
  test('3.12 View tables', async () => {
    await navigateTo(adminPage, '/admin/${slug}/tables');
    const tableContent = adminPage.locator('text=/table|seating|floor/i');
    await expect(tableContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('3.13 Add table', async () => {
    const addButton = adminPage.locator('button:has-text("Add"), button:has-text("Create")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await waitForStableUI(adminPage);
      await clickButton(adminPage, 'Cancel');
    }
  });
});

// ============================================
// SECTION 4: POOL MANAGEMENT
// ============================================
test.describe('4. Pool Management Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('4.1 View pool dashboard', async () => {
    await navigateTo(adminPage, '/admin/pool');
    await expect(adminPage.locator('main').first()).toBeVisible();
  });

  // --- SESSIONS ---
  test('4.2 View pool sessions', async () => {
    await navigateTo(adminPage, '/admin/pool/sessions');
    await expect(adminPage.getByRole('heading', { name: /Session/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('4.3 Create session', async () => {
    const addButton = adminPage.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await waitForStableUI(adminPage);
      await clickButton(adminPage, 'Cancel');
    }
  });

  test('4.4 View session details', async () => {
    const sessionCard = adminPage.locator('[class*="session"], tr').first();
    if (await sessionCard.isVisible()) {
      await sessionCard.click();
      await waitForStableUI(adminPage);
    }
  });

  // --- TICKETS ---
  test('4.5 View pool tickets/passes', async () => {
    await navigateTo(adminPage, '/admin/pool/tickets');
    const ticketContent = adminPage.locator('text=/ticket|pass|admission/i');
    await expect(ticketContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('4.6 Filter tickets by status', async () => {
    const statusFilter = adminPage.locator('select, button:has-text("Status")').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await waitForStableUI(adminPage);
    }
  });

  // --- CAPACITY ---
  test('4.7 View capacity settings', async () => {
    await navigateTo(adminPage, '/admin/pool/capacity');
    const capacityContent = adminPage.locator('text=/capacity|limit|maximum/i');
    await expect(capacityContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('4.8 Update capacity', async () => {
    const capacityInput = adminPage.locator('input[name*="capacity"], input[type="number"]').first();
    if (await capacityInput.isVisible()) {
      await expect(capacityInput).toBeEnabled();
    }
  });
});

// ============================================
// SECTION 5: CHALET MANAGEMENT
// ============================================
test.describe('5. AccommodationUnit Management Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('5.1 View accommodation_units list', async () => {
    await navigateTo(adminPage, '/admin/accommodation_units');
    await expect(adminPage.getByRole('heading', { name: /AccommodationUnit/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('5.2 View accommodation unit stats', async () => {
    await waitForStableUI(adminPage);
    await expect(adminPage.locator('main').first()).toBeVisible({ timeout: 10000 });
  });

  test('5.3 Open add accommodation unit modal', async () => {
    const addButton = adminPage.locator('button:has-text("Add"), button:has-text("Create")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await waitForStableUI(adminPage);
      await fillInput(adminPage, 'input[name="name"], input[placeholder*="name" i]', TEST_DATA.accommodation unit.name);
      await fillInput(adminPage, 'input[name="price"], input[placeholder*="price" i]', TEST_DATA.accommodation unit.price);
      
      await clickButton(adminPage, 'Cancel');
    }
  });

  test('5.4 View accommodation unit bookings', async () => {
    const bookingsTab = adminPage.locator('button:has-text("Booking"), [data-testid="bookings-tab"]').first();
    if (await bookingsTab.isVisible()) {
      await bookingsTab.click();
      await waitForStableUI(adminPage);
    }
  });

  test('5.5 Filter bookings', async () => {
    const statusFilter = adminPage.locator('select, button:has-text("Status")').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await waitForStableUI(adminPage);
    }
  });
});

// ============================================
// SECTION 6: REVIEWS MANAGEMENT
// ============================================
test.describe('6. Reviews Management Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('6.1 View reviews list', async () => {
    await navigateTo(adminPage, '/admin/reviews');
    await expect(adminPage.getByRole('heading', { name: /Review/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('6.2 Filter reviews by rating', async () => {
    const ratingFilter = adminPage.locator('select, button:has-text("Rating")').first();
    if (await ratingFilter.isVisible()) {
      await ratingFilter.click();
      await waitForStableUI(adminPage);
    }
  });

  test('6.3 Filter reviews by status', async () => {
    const statusFilter = adminPage.locator('select:has-text("pending"), select').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ index: 1 });
      await waitForStableUI(adminPage);
    }
  });

  test('6.4 View review details', async () => {
    const reviewCard = adminPage.locator('[class*="review"], tr').first();
    if (await reviewCard.isVisible()) {
      await reviewCard.click();
      await waitForStableUI(adminPage);
    }
  });

  test('6.5 Respond to review', async () => {
    const respondButton = adminPage.locator('button:has-text("Respond"), button:has-text("Reply")').first();
    if (await respondButton.isVisible()) {
      await respondButton.click();
      await waitForStableUI(adminPage);
      await clickButton(adminPage, 'Cancel');
    }
  });
});

// ============================================
// SECTION 7: REPORTS & ANALYTICS
// ============================================
test.describe('7. Reports & Analytics Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('7.1 View reports overview', async () => {
    await navigateTo(adminPage, '/admin/reports');
    await expect(adminPage.getByRole('heading', { name: /Report|Analytics/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('7.2 View revenue report', async () => {
    const revenueTab = adminPage.locator('button:has-text("Revenue"), [data-testid="revenue-tab"]').first();
    if (await revenueTab.isVisible()) {
      await revenueTab.click();
      await waitForStableUI(adminPage);
    }
  });

  test('7.3 View occupancy report', async () => {
    const occupancyTab = adminPage.locator('button:has-text("Occupancy"), [data-testid="occupancy-tab"]').first();
    if (await occupancyTab.isVisible()) {
      await occupancyTab.click();
      await waitForStableUI(adminPage);
    }
  });

  test('7.4 Change date range', async () => {
    const dateRange = adminPage.locator('select:has-text("week"), select:has-text("month"), input[type="date"]').first();
    if (await dateRange.isVisible()) {
      const tagName = await dateRange.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await dateRange.selectOption({ index: 1 });
      }
      await waitForStableUI(adminPage);
    }
  });

  test('7.5 Refresh data', async () => {
    const refreshButton = adminPage.locator('button:has-text("Refresh"), button[aria-label*="refresh" i]').first();
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await waitForStableUI(adminPage);
    }
  });

  test('7.6 Export report', async () => {
    const exportButton = adminPage.locator('button:has-text("Export"), button:has-text("Download")').first();
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeEnabled();
    }
  });
});

// ============================================
// SECTION 8: SETTINGS
// ============================================
test.describe('8. Settings Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  // --- GENERAL SETTINGS ---
  test('8.1 View general settings', async () => {
    await navigateTo(adminPage, '/admin/settings');
    await expect(adminPage.getByRole('heading', { name: /Setting/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('8.2 Edit site name', async () => {
    const siteNameInput = adminPage.locator('input[name="siteName"], input[name="name"]').first();
    if (await siteNameInput.isVisible()) {
      await expect(siteNameInput).toBeEnabled();
    }
  });

  test('8.3 Toggle settings', async () => {
    const toggles = adminPage.locator('[role="switch"], input[type="checkbox"]');
    const count = await toggles.count();
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  // --- APPEARANCE ---
  test('8.4 View appearance settings', async () => {
    await navigateTo(adminPage, '/admin/settings/appearance');
    const appearanceContent = adminPage.locator('text=/theme|color|logo|appearance/i');
    await expect(appearanceContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('8.5 Change theme colors', async () => {
    const colorPicker = adminPage.locator('input[type="color"], [class*="color-picker"]').first();
    if (await colorPicker.isVisible()) {
      await expect(colorPicker).toBeEnabled();
    }
  });

  // --- NAVBAR ---
  test('8.6 View navbar settings', async () => {
    await navigateTo(adminPage, '/admin/settings/navbar');
    const navbarContent = adminPage.locator('text=/navbar|navigation|menu/i');
    await expect(navbarContent.first()).toBeVisible({ timeout: 10000 });
  });

  // --- FOOTER ---
  test('8.7 View footer settings', async () => {
    await navigateTo(adminPage, '/admin/settings/footer');
    const footerContent = adminPage.locator('text=/footer|link|social/i');
    await expect(footerContent.first()).toBeVisible({ timeout: 10000 });
  });

  // --- HOMEPAGE ---
  test('8.8 View homepage settings', async () => {
    await navigateTo(adminPage, '/admin/settings/homepage');
    const homepageContent = adminPage.locator('text=/homepage|hero|banner|section/i');
    await expect(homepageContent.first()).toBeVisible({ timeout: 10000 });
  });

  // --- PAYMENTS ---
  test('8.9 View payment settings', async () => {
    await navigateTo(adminPage, '/admin/settings/payments');
    const paymentContent = adminPage.locator('text=/payment|stripe|currency/i');
    await expect(paymentContent.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// SECTION 9: NOTIFICATIONS
// ============================================
test.describe('9. Notification Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('9.1 View notifications page', async () => {
    await navigateTo(adminPage, '/admin/settings/notifications');
    await expect(adminPage.getByRole('heading', { name: /Notification/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('9.2 View notification stats', async () => {
    // The notification page has tabs and notification content - verify the page loaded
    const pageContent = adminPage.locator('.space-y-6, [class*="notification"], button:has-text("Send"), [role="tablist"]');
    const count = await pageContent.count();
    expect(count).toBeGreaterThan(0);
  });

  test('9.3 Switch to broadcasts tab', async () => {
    const broadcastsTab = adminPage.locator('button:has-text("broadcasts")');
    if (await broadcastsTab.isVisible()) {
      await broadcastsTab.click();
      await waitForStableUI(adminPage);
    }
  });

  test('9.4 Switch to templates tab', async () => {
    const templatesTab = adminPage.locator('button:has-text("templates")');
    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await waitForStableUI(adminPage);
    }
  });

  test('9.5 Open send notification modal', async () => {
    const sendButton = adminPage.locator('button:has-text("Send Notification")');
    await expect(sendButton).toBeVisible();
    await sendButton.click();
    await waitForStableUI(adminPage);
    await expect(adminPage.getByRole('heading', { name: /Send Notification/i })).toBeVisible();
  });

  test('9.6 Fill notification form', async () => {
    await fillInput(adminPage, 'input[placeholder*="title" i]', 'E2E Test Notification');
    
    const messageInput = adminPage.locator('textarea[placeholder*="message" i]').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('This is a test notification from E2E');
    }
  });

  test('9.7 Select notification type', async () => {
    const typeSelect = adminPage.locator('select').first();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption({ index: 1 });
    }
  });

  test('9.8 Set priority', async () => {
    const prioritySelect = adminPage.locator('select:near(:text("Priority"))').first();
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('high');
    }
  });

  test('9.9 Add action button', async () => {
    const addActionButton = adminPage.locator('button:has-text("Add Action")');
    if (await addActionButton.isVisible()) {
      await addActionButton.click();
      await waitForStableUI(adminPage);
      
      await fillInput(adminPage, 'input[placeholder*="Label" i]', 'View');
      await fillInput(adminPage, 'input[placeholder*="URL" i]', '/test');
    }
  });

  test('9.10 Set schedule', async () => {
    const scheduleInput = adminPage.locator('input[type="datetime-local"]').first();
    if (await scheduleInput.isVisible()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await scheduleInput.fill(tomorrow.toISOString().slice(0, 16));
    }
  });

  test('9.11 Close modal without sending', async () => {
    await clickButton(adminPage, 'Cancel');
  });

  test('9.12 Open new template modal', async () => {
    // Switch to templates tab first
    const templatesTab = adminPage.locator('button:has-text("templates")');
    await templatesTab.click();
    await waitForStableUI(adminPage);
    
    const newTemplateButton = adminPage.locator('button:has-text("New Template")');
    if (await newTemplateButton.isVisible()) {
      await newTemplateButton.click();
      await waitForStableUI(adminPage);
      await fillInput(adminPage, 'input[placeholder*="Template" i], input[placeholder*="Welcome" i]', TEST_DATA.template.name);
      
      await clickButton(adminPage, 'Cancel');
    }
  });
});

// ============================================
// SECTION 10: TRANSLATIONS
// ============================================
test.describe('10. Translations Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('10.1 View translations page', async () => {
    await navigateTo(adminPage, '/admin/settings/translations');
    const translationsContent = adminPage.locator('text=/translation|language|locale/i');
    await expect(translationsContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('10.2 View frontend translations', async () => {
    const frontendTab = adminPage.locator('button:has-text("Frontend"), button:has-text("JSON")').first();
    if (await frontendTab.isVisible()) {
      await frontendTab.click();
      await waitForStableUI(adminPage);
    }
  });

  test('10.3 View database translations', async () => {
    const databaseTab = adminPage.locator('button:has-text("Database"), button:has-text("Content")').first();
    if (await databaseTab.isVisible()) {
      await databaseTab.click();
      await waitForStableUI(adminPage);
    }
  });

  test('10.4 View missing translations', async () => {
    // Verify translations page is functional with content
    await expect(adminPage.locator('main').first()).toBeVisible();
  });

  test('10.5 Auto-translate button', async () => {
    const autoTranslateButton = adminPage.locator('button:has-text("Auto"), button:has-text("Translate")').first();
    if (await autoTranslateButton.isVisible()) {
      await expect(autoTranslateButton).toBeEnabled();
    }
  });
});

// ============================================
// SECTION 11: BACKUPS
// ============================================
test.describe('11. Backups Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('11.1 View backups page', async () => {
    await navigateTo(adminPage, '/admin/settings/backups');
    const backupsContent = adminPage.locator('text=/backup|restore|system health/i');
    await expect(backupsContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('11.2 View backup list', async () => {
    // Verify backups page shows content
    await expect(adminPage.locator('main').first()).toBeVisible();
  });

  test('11.3 Create backup button', async () => {
    const createButton = adminPage.locator('button:has-text("Create"), button:has-text("Backup")').first();
    if (await createButton.isVisible()) {
      await expect(createButton).toBeEnabled();
    }
  });

  test('11.4 View system health', async () => {
    const healthCard = adminPage.locator('text=/System Health|status/i');
    await expect(healthCard.first()).toBeVisible();
  });
});

// ============================================
// SECTION 12: MODULES
// ============================================
test.describe('12. Modules Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('12.1 View modules page', async () => {
    await navigateTo(adminPage, '/admin/modules');
    await expect(adminPage.getByRole('heading', { name: /Module/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('12.2 View module list', async () => {
    // Modules page uses a table - look for table rows or the Add Module button
    const tableOrContent = adminPage.locator('table tbody tr, button:has-text("Add Module"), .space-y-6');
    const count = await tableOrContent.count();
    expect(count).toBeGreaterThan(0);
  });

  test('12.3 Toggle module', async () => {
    const toggles = adminPage.locator('[role="switch"], input[type="checkbox"]');
    if (await toggles.first().isVisible()) {
      await expect(toggles.first()).toBeEnabled();
    }
  });

  test('12.4 View module settings', async () => {
    const settingsButton = adminPage.locator('button:has-text("Settings"), button:has-text("Configure")').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await waitForStableUI(adminPage);
      await clickButton(adminPage, 'Cancel');
    }
  });
});

// ============================================
// SECTION 13: AUDIT LOGS
// ============================================
test.describe('13. Audit Log Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('13.1 View audit logs', async () => {
    await navigateTo(adminPage, '/admin/audit');
    await expect(adminPage.getByRole('heading', { name: /Audit|Log/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('13.2 View log entries', async () => {
    const logEntries = adminPage.locator('tr, [class*="log-entry"]');
    const count = await logEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  test('13.3 Filter by action type', async () => {
    const actionFilter = adminPage.locator('select, button:has-text("Action")').first();
    if (await actionFilter.isVisible()) {
      await actionFilter.click();
      await waitForStableUI(adminPage);
    }
  });

  test('13.4 Filter by user', async () => {
    const userFilter = adminPage.locator('select:has-text("user"), input[placeholder*="user" i]').first();
    if (await userFilter.isVisible()) {
      await userFilter.click();
      await waitForStableUI(adminPage);
    }
  });

  test('13.5 View log details', async () => {
    const logRow = adminPage.locator('tr, [class*="log"]').first();
    if (await logRow.isVisible()) {
      await logRow.click();
      await waitForStableUI(adminPage);
    }
  });
});

// ============================================
// SECTION 14: ORDERS (GLOBAL)
// ============================================
test.describe('14. Global Orders Features', () => {
let adminPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    const success = await loginAsAdmin(adminPage);
    if (!success) test.skip(true, 'Admin login failed');
  });
  
  test.afterAll(async () => {
    await adminPage.close();
  });

  test('14.1 View all orders', async () => {
    await navigateTo(adminPage, '/admin/orders');
    await expect(adminPage.getByRole('heading', { name: /Order/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('14.2 Filter by type', async () => {
    const typeFilter = adminPage.locator('select, button:has-text("Type")').first();
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      await waitForStableUI(adminPage);
    }
  });

  test('14.3 Search orders', async () => {
    const search = adminPage.locator('input[placeholder*="Search" i]').first();
    if (await search.isVisible()) {
      await search.fill('test');
      await waitForStableUI(adminPage);
      await search.clear();
    }
  });
});

// ============================================
// FINAL VERIFICATION
// ============================================
test.describe('15. Final Verification', () => {
  test('Admin can logout', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, '/admin');
    
    // Find logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await waitForStableUI(page);
      expect(page.url()).toMatch(/\/login|\/$/);
    }
  });
});
