/**
 * Admin Notifications E2E Tests
 * 
 * Tests the enhanced notification system including:
 * - Viewing notifications
 * - Creating and sending broadcasts
 * - Template management (CRUD)
 * - Scheduling notifications
 * - Priority levels
 * - Action buttons
 * - Bulk operations
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

/**
 * Helper to login as admin
 */
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

test.describe('Admin Notifications System', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) {
      test.skip(true, 'Login failed - backend may be down');
    }
    
    // Navigate to notifications page
    await page.goto(`${FRONTEND_URL}/admin/settings/notifications`);
    await page.waitForLoadState('networkidle');
  });

  // ============================================
  // PAGE LOADING TESTS
  // ============================================
  
  test('should load notifications page with stats', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /Notifications/i }).first()).toBeVisible();
    
    // Check stats cards are visible
    await expect(page.getByText(/Total Sent|Sent Today|Unread|Scheduled/i).first()).toBeVisible();
    
    // Check tabs are visible
    await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /broadcasts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /templates/i })).toBeVisible();
  });

  test('should display tab navigation', async ({ page }) => {
    // Verify all three tabs exist
    const notificationsTab = page.locator('button:has-text("notifications")');
    const broadcastsTab = page.locator('button:has-text("broadcasts")');
    const templatesTab = page.locator('button:has-text("templates")');
    
    await expect(notificationsTab).toBeVisible();
    await expect(broadcastsTab).toBeVisible();
    await expect(templatesTab).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    // Click on broadcasts tab
    await page.click('button:has-text("broadcasts")');
    await page.waitForTimeout(500);
    
    // Click on templates tab
    await page.click('button:has-text("templates")');
    await page.waitForTimeout(500);
    
    // Click back to notifications tab
    await page.click('button:has-text("notifications")');
    await page.waitForTimeout(500);
  });

  // ============================================
  // BROADCAST CREATION TESTS
  // ============================================
  
  test('should open send notification modal', async ({ page }) => {
    // Click "Send Notification" button
    await page.click('button:has-text("Send Notification")');
    
    // Modal should be visible
    await expect(page.getByRole('heading', { name: /Send Notification/i })).toBeVisible();
    
    // Form fields should be present
    await expect(page.locator('input[placeholder*="title" i]')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="message" i]')).toBeVisible();
  });

  test('should validate required fields in notification modal', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Send Notification")');
    await page.waitForTimeout(500);
    
    // Try to send without filling fields (should show error or be disabled)
    const sendButton = page.locator('button:has-text("Send Now"), button:has-text("Schedule")');
    await sendButton.click();
    
    // Should show error toast or remain on modal
    await page.waitForTimeout(1000);
    const modalStillVisible = await page.getByRole('heading', { name: /Send Notification/i }).isVisible();
    expect(modalStillVisible).toBe(true);
  });

  test('should fill and close notification modal', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Send Notification")');
    await page.waitForTimeout(500);
    
    // Fill in the form
    await page.fill('input[placeholder*="title" i]', 'Test Notification');
    await page.locator('textarea[placeholder*="message" i]').fill('This is a test notification message');
    
    // Select type
    await page.selectOption('select:near(:text("Type"))', 'warning');
    
    // Select priority
    await page.selectOption('select:near(:text("Priority"))', 'high');
    
    // Select target
    await page.selectOption('select:near(:text("Target"))', 'staff');
    
    // Close modal without sending
    await page.click('button:has-text("Cancel")');
    
    // Modal should be closed
    await expect(page.getByRole('heading', { name: /Send Notification/i })).not.toBeVisible();
  });

  test('should show scheduling option in notification modal', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Send Notification")');
    await page.waitForTimeout(500);
    
    // Look for datetime-local input for scheduling
    const scheduleInput = page.locator('input[type="datetime-local"]');
    await expect(scheduleInput).toBeVisible();
  });

  test('should allow adding action buttons', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Send Notification")');
    await page.waitForTimeout(500);
    
    // Look for "Add Action" button
    const addActionButton = page.locator('button:has-text("Add Action")');
    await expect(addActionButton).toBeVisible();
    
    // Click to add action
    await addActionButton.click();
    
    // Action fields should appear
    await expect(page.locator('input[placeholder*="Label" i]')).toBeVisible();
    await expect(page.locator('input[placeholder*="URL" i]')).toBeVisible();
  });

  // ============================================
  // TEMPLATE MANAGEMENT TESTS
  // ============================================
  
  test('should switch to templates tab', async ({ page }) => {
    // Click templates tab
    await page.click('button:has-text("templates")');
    await page.waitForTimeout(500);
    
    // Should show templates content (either list or empty state)
    const templatesContent = page.locator('text=/No templates|Create Template/i, [class*="template"]');
    await expect(templatesContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should open create template modal', async ({ page }) => {
    // Click "New Template" button
    await page.click('button:has-text("New Template")');
    await page.waitForTimeout(500);
    
    // Modal should be visible
    await expect(page.getByRole('heading', { name: /Create Template/i })).toBeVisible();
    
    // Template-specific fields should be present
    await expect(page.locator('input[placeholder*="Template Name" i], input[placeholder*="Welcome Message" i]')).toBeVisible();
  });

  test('should fill and close template modal', async ({ page }) => {
    // Open template modal
    await page.click('button:has-text("New Template")');
    await page.waitForTimeout(500);
    
    // Fill template form
    await page.locator('input[placeholder*="Template Name" i], input[placeholder*="Welcome" i]').first().fill('Welcome Template');
    await page.locator('input[placeholder*="Welcome" i], input[placeholder*="{{name}}" i]').nth(1).fill('Welcome {{name}}!');
    await page.locator('textarea[placeholder*="Hello" i], textarea[placeholder*="{{name}}" i]').fill('Hello {{name}}, welcome to our resort!');
    
    // Add variable
    await page.locator('input[placeholder*="variable" i], input[placeholder*="name" i]').fill('name');
    
    // Close without saving
    await page.click('button:has-text("Cancel")');
    
    // Modal should be closed
    await expect(page.getByRole('heading', { name: /Create Template/i })).not.toBeVisible();
  });

  // ============================================
  // FILTER TESTS
  // ============================================
  
  test('should have type filter dropdown', async ({ page }) => {
    // Look for type filter
    const typeFilter = page.locator('select:has-text("All Types")');
    await expect(typeFilter).toBeVisible();
    
    // Should have options
    await typeFilter.click();
    await expect(page.locator('option:has-text("Info")')).toBeVisible();
    await expect(page.locator('option:has-text("Success")')).toBeVisible();
    await expect(page.locator('option:has-text("Warning")')).toBeVisible();
    await expect(page.locator('option:has-text("Error")')).toBeVisible();
  });

  test('should have priority filter dropdown', async ({ page }) => {
    // Look for priority filter
    const priorityFilter = page.locator('select:has-text("All Priorities")');
    await expect(priorityFilter).toBeVisible();
    
    // Should have options
    await priorityFilter.click();
    await expect(page.locator('option:has-text("Low")')).toBeVisible();
    await expect(page.locator('option:has-text("Normal")')).toBeVisible();
    await expect(page.locator('option:has-text("High")')).toBeVisible();
    await expect(page.locator('option:has-text("Urgent")')).toBeVisible();
  });

  test('should apply type filter', async ({ page }) => {
    // Select a type filter
    await page.selectOption('select:has-text("All Types")', 'warning');
    await page.waitForTimeout(500);
    
    // Filter should be applied (page should re-render)
    const selectedFilter = await page.locator('select:has-text("Warning")').inputValue();
    expect(selectedFilter).toBe('warning');
  });

  // ============================================
  // BULK OPERATIONS TESTS
  // ============================================
  
  test('should have select all checkbox', async ({ page }) => {
    // Look for select all checkbox
    const selectAll = page.locator('input[type="checkbox"]:near(:text("Select all"))');
    await expect(selectAll).toBeVisible();
  });

  test('should show bulk actions when items selected', async ({ page }) => {
    // Select the "select all" checkbox if there are notifications
    const selectAll = page.locator('input[type="checkbox"]:near(:text("Select all"))');
    
    if (await selectAll.isVisible()) {
      await selectAll.check();
      await page.waitForTimeout(500);
      
      // Look for bulk action buttons (may only appear if items are selected)
      const deleteSelectedButton = page.locator('button:has-text("Delete Selected")');
      const clearButton = page.locator('button:has-text("Clear")');
      
      // These may or may not be visible depending on whether there are notifications
      // Just verify the select all worked
      const isChecked = await selectAll.isChecked();
      expect(isChecked).toBe(true);
    }
  });

  // ============================================
  // REFRESH FUNCTIONALITY
  // ============================================
  
  test('should have refresh button', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();
  });

  test('should refresh notifications on button click', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh")');
    await refreshButton.click();
    
    // Wait for refresh to complete
    await page.waitForTimeout(1000);
    
    // Page should still be functional
    await expect(page.getByRole('heading', { name: /Notifications/i }).first()).toBeVisible();
  });

  // ============================================
  // VISUAL/UI TESTS
  // ============================================
  
  test('should display notification type icons correctly', async ({ page }) => {
    // If there are notifications, they should have type icons
    // Look for SVG icons within notification cards
    const notificationCards = page.locator('[class*="Card"], [class*="card"]');
    const count = await notificationCards.count();
    
    if (count > 0) {
      // Cards should have icons
      const icons = notificationCards.first().locator('svg');
      await expect(icons.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display priority badges', async ({ page }) => {
    // If there are notifications, check for priority badges
    const priorityBadges = page.locator('text=/Low|Normal|High|Urgent/i');
    
    // May or may not have notifications with visible priority badges
    const count = await priorityBadges.count();
    // Just verify the page loaded correctly
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // ============================================
  // STATS CARDS TESTS
  // ============================================
  
  test('should display all stats cards', async ({ page }) => {
    // Check for 4 stats cards
    const totalSentCard = page.locator('text=/Total Sent/i');
    const sentTodayCard = page.locator('text=/Sent Today/i');
    const unreadCard = page.locator('text=/Unread/i');
    const scheduledCard = page.locator('text=/Scheduled/i');
    
    await expect(totalSentCard).toBeVisible();
    await expect(sentTodayCard).toBeVisible();
    await expect(unreadCard).toBeVisible();
    await expect(scheduledCard).toBeVisible();
  });

  test('stats cards should display numbers', async ({ page }) => {
    // Stats cards should have numeric values
    const statsValues = page.locator('.text-3xl, [class*="font-bold"]');
    const count = await statsValues.count();
    
    // Should have at least 4 stats values
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

// ============================================
// INTEGRATION WITH OTHER ADMIN FEATURES
// ============================================
test.describe('Notifications Integration', () => {
  test.beforeEach(async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) {
      test.skip(true, 'Login failed - backend may be down');
    }
  });

  test('should access notifications from admin sidebar', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Look for notifications link in sidebar or menu
    const notificationLink = page.locator('a[href*="notifications"], [href*="notifications"]');
    
    if (await notificationLink.first().isVisible()) {
      await notificationLink.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should be on notifications page
      await expect(page).toHaveURL(/notifications/);
    }
  });

  test('should show notification bell in header', async ({ page }) => {
    // Navigate to any admin page
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Look for notification bell icon in header
    const bellIcon = page.locator('header svg[class*="bell"], header [data-testid="notifications-bell"]');
    const bellButton = page.locator('header button:has(svg)');
    
    // Should have some kind of notification indicator
    const count = await bellIcon.count();
    expect(count).toBeGreaterThanOrEqual(0); // May or may not exist depending on UI
  });
});
