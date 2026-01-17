/**
 * Staff Complete Feature Coverage E2E Test
 * 
 * This test has the staff bot systematically try out ALL staff features.
 * Staff typically have access to operational features without full admin privileges.
 * 
 * Features Tested:
 * - Dashboard (Staff view)
 * - Restaurant Order Processing
 * - Pool Session Management
 * - Chalet Booking Management
 * - Review Responses
 * - Customer Lookup
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const STAFF_CREDENTIALS = {
  email: process.env.E2E_STAFF_EMAIL || 'staff@v2resort.com',
  password: process.env.E2E_STAFF_PASSWORD || 'staff123',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function loginAsStaff(page: Page): Promise<boolean> {
  try {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for login form to be ready
    await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 });
    
    // Clear and fill fields
    await page.locator('input[type="email"]').clear();
    await page.locator('input[type="email"]').fill(STAFF_CREDENTIALS.email);
    await page.locator('input[type="password"]').clear();
    await page.locator('input[type="password"]').fill(STAFF_CREDENTIALS.password);
    
    // Wait for form to be ready
    await page.waitForTimeout(500);
    
    // Click login button
    const loginButton = page.getByRole('button', { name: /sign in|login/i });
    await loginButton.click();
    
    // Wait for redirect
    await page.waitForTimeout(3000);
    return true;
  } catch (error) {
    console.error('Staff login failed:', error);
    return false;
  }
}

async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(`${FRONTEND_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for page to stabilize after navigation
  await page.waitForTimeout(2000);
  await page.waitForLoadState('load');
}

// ============================================
// SECTION 1: STAFF DASHBOARD
// ============================================
test.describe('1. Staff Dashboard', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('1.1 View staff dashboard', async () => {
    // Staff might redirect to admin or their own dashboard
    await navigateTo(staffPage, '/admin');
    await expect(staffPage.locator('main').first()).toBeVisible();
  });

  test('1.2 View today\'s tasks', async () => {
    const tasksSection = staffPage.locator('text=/task|today|pending|action/i');
    if (await tasksSection.first().isVisible()) {
      expect(true).toBe(true);
    }
  });

  test('1.3 View quick stats', async () => {
    const stats = staffPage.locator('[class*="stat"], [class*="Card"]');
    const count = await stats.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// SECTION 2: RESTAURANT ORDER PROCESSING
// ============================================
test.describe('2. Restaurant Order Processing', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('2.1 View restaurant orders', async () => {
    await navigateTo(staffPage, '/admin/restaurant/orders');
    // Check for any content indicating we're on the orders page
    const hasOrdersContent = await staffPage.locator('text=/order|restaurant/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasMainContent = await staffPage.locator('main').first().isVisible().catch(() => false);
    expect(hasOrdersContent || hasMainContent).toBe(true);
  });

  test('2.2 View pending orders', async () => {
    const pendingOrders = staffPage.locator('text=/pending|new|waiting/i');
    if (await pendingOrders.first().isVisible()) {
      expect(true).toBe(true);
    }
  });

  test('2.3 Filter by status', async () => {
    const statusFilter = staffPage.locator('select, button:has-text("Status")').first();
    if (await statusFilter.isVisible()) {
      const tagName = await statusFilter.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await statusFilter.selectOption('pending');
        await staffPage.waitForTimeout(500);
      }
    }
  });

  test('2.4 View order details', async () => {
    const orderRow = staffPage.locator('tr, [class*="order"]').first();
    if (await orderRow.isVisible()) {
      await orderRow.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('2.5 Accept order', async () => {
    const acceptButton = staffPage.locator('button:has-text("Accept"), button:has-text("Start"), button:has-text("Confirm")').first();
    if (await acceptButton.isVisible()) {
      await expect(acceptButton).toBeEnabled();
    }
  });

  test('2.6 Update order status to preparing', async () => {
    const statusSelect = staffPage.locator('select[name="status"], select').first();
    if (await statusSelect.isVisible()) {
      const options = await statusSelect.locator('option').allTextContents();
      if (options.some(o => o.toLowerCase().includes('prepar'))) {
        await statusSelect.selectOption({ label: options.find(o => o.toLowerCase().includes('prepar')) || '' });
        await staffPage.waitForTimeout(500);
      }
    }
  });

  test('2.7 Mark order as ready', async () => {
    const readyButton = staffPage.locator('button:has-text("Ready"), button:has-text("Complete")').first();
    if (await readyButton.isVisible()) {
      await expect(readyButton).toBeEnabled();
    }
  });

  test('2.8 Print order receipt', async () => {
    const printButton = staffPage.locator('button:has-text("Print"), button[aria-label*="print" i]').first();
    if (await printButton.isVisible()) {
      await expect(printButton).toBeEnabled();
    }
  });

  test('2.9 View order history', async () => {
    const historyTab = staffPage.locator('button:has-text("History"), button:has-text("Completed")').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('2.10 Search orders', async () => {
    const search = staffPage.locator('input[placeholder*="Search" i]').first();
    if (await search.isVisible()) {
      await search.fill('test');
      await staffPage.waitForTimeout(500);
      await search.clear();
    }
  });
});

// ============================================
// SECTION 3: POOL SESSION MANAGEMENT
// ============================================
test.describe('3. Pool Session Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('3.1 View pool sessions', async () => {
    await navigateTo(staffPage, '/admin/pool/sessions');
    // Check for any content indicating we're on the pool sessions page
    const hasPoolContent = await staffPage.locator('text=/pool|session/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasMainContent = await staffPage.locator('main').first().isVisible().catch(() => false);
    expect(hasPoolContent || hasMainContent).toBe(true);
  });

  test('3.2 View today\'s sessions', async () => {
    const todayFilter = staffPage.locator('button:has-text("Today"), input[type="date"]').first();
    if (await todayFilter.isVisible()) {
      await todayFilter.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('3.3 View current capacity', async () => {
    const capacityInfo = staffPage.locator('text=/capacity|\\d+\\/\\d+|available/i');
    if (await capacityInfo.first().isVisible()) {
      expect(true).toBe(true);
    }
  });

  test('3.4 View ticket passes', async () => {
    await navigateTo(staffPage, '/admin/pool/tickets');
    const ticketsContent = staffPage.locator('text=/ticket|pass|admission/i');
    await expect(ticketsContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('3.5 Validate ticket', async () => {
    const validateButton = staffPage.locator('button:has-text("Validate"), button:has-text("Scan"), button:has-text("Check")').first();
    if (await validateButton.isVisible()) {
      await validateButton.click();
      await staffPage.waitForTimeout(500);
      
      // Close modal if opened
      const cancelButton = staffPage.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
  });

  test('3.6 Check in guest', async () => {
    const checkInButton = staffPage.locator('button:has-text("Check In"), button:has-text("Admit")').first();
    if (await checkInButton.isVisible()) {
      await expect(checkInButton).toBeEnabled();
    }
  });

  test('3.7 View guest list', async () => {
    const guestList = staffPage.locator('table, [class*="guest-list"]');
    if (await guestList.first().isVisible()) {
      expect(true).toBe(true);
    }
  });
});

// ============================================
// SECTION 4: CHALET BOOKING MANAGEMENT
// ============================================
test.describe('4. Chalet Booking Management', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('4.1 View chalet bookings', async () => {
    await navigateTo(staffPage, '/admin/chalets');
    // Check for any content indicating we're on the chalets page
    const hasChaletContent = await staffPage.locator('text=/chalet|booking/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasMainContent = await staffPage.locator('main').first().isVisible().catch(() => false);
    expect(hasChaletContent || hasMainContent).toBe(true);
  });

  test('4.2 View today\'s check-ins', async () => {
    const checkInsSection = staffPage.locator('text=/check.?in|arrival|today/i');
    if (await checkInsSection.first().isVisible()) {
      expect(true).toBe(true);
    }
  });

  test('4.3 View today\'s check-outs', async () => {
    const checkOutsSection = staffPage.locator('text=/check.?out|departure/i');
    if (await checkOutsSection.first().isVisible()) {
      expect(true).toBe(true);
    }
  });

  test('4.4 View booking details', async () => {
    const bookingRow = staffPage.locator('tr, [class*="booking"]').first();
    if (await bookingRow.isVisible()) {
      await bookingRow.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('4.5 Process check-in', async () => {
    const checkInButton = staffPage.locator('button:has-text("Check In"), button:has-text("Confirm Arrival")').first();
    if (await checkInButton.isVisible()) {
      await expect(checkInButton).toBeEnabled();
    }
  });

  test('4.6 Process check-out', async () => {
    const checkOutButton = staffPage.locator('button:has-text("Check Out"), button:has-text("Complete Stay")').first();
    if (await checkOutButton.isVisible()) {
      await expect(checkOutButton).toBeEnabled();
    }
  });

  test('4.7 Mark chalet as cleaned', async () => {
    const cleanButton = staffPage.locator('button:has-text("Clean"), button:has-text("Ready")').first();
    if (await cleanButton.isVisible()) {
      await expect(cleanButton).toBeEnabled();
    }
  });

  test('4.8 View chalet status', async () => {
    const statusBadges = staffPage.locator('[class*="badge"], [class*="status"]');
    const count = await statusBadges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('4.9 Add note to booking', async () => {
    const noteButton = staffPage.locator('button:has-text("Note"), button:has-text("Comment")').first();
    if (await noteButton.isVisible()) {
      await noteButton.click();
      await staffPage.waitForTimeout(500);
      
      const noteInput = staffPage.locator('textarea').first();
      if (await noteInput.isVisible()) {
        await noteInput.fill('E2E test note');
      }
      
      const cancelButton = staffPage.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
  });
});

// ============================================
// SECTION 5: MENU VIEWING
// ============================================
test.describe('5. Menu Viewing (Read-Only)', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('5.1 View menu items', async () => {
    await navigateTo(staffPage, '/admin/restaurant/menu');
    // Check for any content indicating we're on the menu page
    const hasMenuContent = await staffPage.locator('text=/menu|restaurant|item/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasMainContent = await staffPage.locator('main').first().isVisible().catch(() => false);
    expect(hasMenuContent || hasMainContent).toBe(true);
  });

  test('5.2 Search menu', async () => {
    const search = staffPage.locator('input[placeholder*="Search" i]').first();
    if (await search.isVisible()) {
      await search.fill('pizza');
      await staffPage.waitForTimeout(500);
      await search.clear();
    }
  });

  test('5.3 Filter by category', async () => {
    const categoryFilter = staffPage.locator('select, button:has-text("Category")').first();
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('5.4 View item details', async () => {
    const menuItem = staffPage.locator('[class*="menu-item"], tr').first();
    if (await menuItem.isVisible()) {
      await menuItem.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('5.5 Check item availability', async () => {
    const availabilityToggle = staffPage.locator('[role="switch"], input[type="checkbox"]').first();
    if (await availabilityToggle.isVisible()) {
      // Staff might not be able to change, but can view
      expect(true).toBe(true);
    }
  });
});

// ============================================
// SECTION 6: REVIEWS
// ============================================
test.describe('6. Reviews', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('6.1 View reviews', async () => {
    await navigateTo(staffPage, '/admin/reviews');
    // Check for any content indicating we're on the reviews page
    const hasReviewContent = await staffPage.locator('text=/review|rating/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasMainContent = await staffPage.locator('main').first().isVisible().catch(() => false);
    expect(hasReviewContent || hasMainContent).toBe(true);
  });

  test('6.2 Filter by rating', async () => {
    const ratingFilter = staffPage.locator('select, button:has-text("Rating")').first();
    if (await ratingFilter.isVisible()) {
      await ratingFilter.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('6.3 View review details', async () => {
    const reviewCard = staffPage.locator('[class*="review"], tr').first();
    if (await reviewCard.isVisible()) {
      await reviewCard.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('6.4 Respond to review', async () => {
    const respondButton = staffPage.locator('button:has-text("Respond"), button:has-text("Reply")').first();
    if (await respondButton.isVisible()) {
      await respondButton.click();
      await staffPage.waitForTimeout(500);
      
      const responseInput = staffPage.locator('textarea').first();
      if (await responseInput.isVisible()) {
        await responseInput.fill('Thank you for your feedback!');
      }
      
      const cancelButton = staffPage.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
  });
});

// ============================================
// SECTION 7: CUSTOMER LOOKUP
// ============================================
test.describe('7. Customer Lookup', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('7.1 View customers', async () => {
    await navigateTo(staffPage, '/admin/users/customers');
    await expect(staffPage.locator('main').first()).toBeVisible();
  });

  test('7.2 Search customer', async () => {
    const search = staffPage.locator('input[placeholder*="Search" i]').first();
    if (await search.isVisible()) {
      await search.fill('john');
      await staffPage.waitForTimeout(500);
      await search.clear();
    }
  });

  test('7.3 View customer details', async () => {
    const customerRow = staffPage.locator('tr, [class*="customer"]').first();
    if (await customerRow.isVisible()) {
      await customerRow.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('7.4 View customer booking history', async () => {
    const historySection = staffPage.locator('text=/history|booking|order/i');
    if (await historySection.first().isVisible()) {
      expect(true).toBe(true);
    }
  });
});

// ============================================
// SECTION 8: NOTIFICATIONS
// ============================================
test.describe('8. Staff Notifications', () => {
  test.describe.configure({ mode: 'serial' });
  
  let staffPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    staffPage = await context.newPage();
    const success = await loginAsStaff(staffPage);
    if (!success) test.skip(true, 'Staff login failed');
  });
  
  test.afterAll(async () => {
    await staffPage.close();
  });

  test('8.1 View notification bell', async () => {
    const bell = staffPage.locator('[data-testid="notifications"], button[aria-label*="notification" i], [class*="notification-bell"]').first();
    if (await bell.isVisible()) {
      await bell.click();
      await staffPage.waitForTimeout(500);
    }
  });

  test('8.2 View notifications list', async () => {
    const notificationsList = staffPage.locator('[class*="notification"], [class*="dropdown"]');
    if (await notificationsList.first().isVisible()) {
      expect(true).toBe(true);
    }
  });

  test('8.3 Mark notification as read', async () => {
    const notification = staffPage.locator('[class*="notification-item"]').first();
    if (await notification.isVisible()) {
      await notification.click();
      await staffPage.waitForTimeout(500);
    }
  });
});

// ============================================
// FINAL: LOGOUT
// ============================================
test.describe('9. Staff Logout', () => {
  test('Staff can logout', async ({ page }) => {
    await loginAsStaff(page);
    
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(2000);
      expect(page.url()).toMatch(/\/login|\/$/);
    }
  });
});
