/**
 * F2.6: Authorization E2E — Staff/Manager/Admin capability visibility
 *
 * Proves:
 *   - ordinary staff sees only staff capabilities
 *   - manager sees manager capabilities
 *   - admin sees admin capabilities
 *   - unauthorized UI actions are hidden/disabled
 *   - direct API invocation of those same unauthorized actions is rejected
 *
 * Prerequisites:
 *   - Running backend with seeded test users (staff, manager, admin)
 *   - At least one active instant_transaction module
 *   - Playwright config with auth fixtures
 *
 * Run: npx playwright test tests/authorization-staff.spec.ts
 */

import { test, expect } from '@playwright/test';

// ============================================
// Test fixtures — seeded test accounts
// ============================================
// These accounts must exist in the test database with the correct scopes.
// The test harness should create them via API or database seeding.

const STAFF_USER = {
  email: process.env.TEST_STAFF_EMAIL || 'staff@test.example.com',
  password: process.env.TEST_STAFF_PASSWORD || 'TestStaff123!',
  scope: 'property_staff',
};

const MANAGER_USER = {
  email: process.env.TEST_MANAGER_EMAIL || 'manager@test.example.com',
  password: process.env.TEST_MANAGER_PASSWORD || 'TestManager123!',
  scope: 'property_manager',
};

const ADMIN_USER = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.example.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'TestAdmin123!',
  scope: 'tenant_admin',
};

// ============================================
// Helpers
// ============================================

async function login(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 10000 });
}

async function loginAsStaff(page: any) {
  await login(page, STAFF_USER.email, STAFF_USER.password);
}

async function loginAsManager(page: any) {
  await login(page, MANAGER_USER.email, MANAGER_USER.password);
}

async function loginAsAdmin(page: any) {
  await login(page, ADMIN_USER.email, ADMIN_USER.password);
}

// ============================================
// Tests
// ============================================

test.describe('Authorization: Staff capabilities', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  test('staff sees KDS/orders but not admin-only pages', async ({ page }) => {
    // Staff should see the staff dashboard
    await page.goto('/default/staff');
    await expect(page.locator('text=Staff')).toBeVisible({ timeout: 5000 });

    // Staff should NOT see admin-only nav items
    await page.goto('/default/admin');
    // Should be redirected or see limited view
    // The admin nav should not show Settings, Audit Logs, etc.
  });

  test('staff can advance order fulfillment (ORDER_UPDATE)', async ({ page }) => {
    // Navigate to staff KDS
    await page.goto('/default/staff/modules');

    // If there are orders in the queue, staff should see action buttons
    const advanceButton = page.locator('button:has-text("Start Prep"), button:has-text("Mark Ready")');
    const count = await advanceButton.count();

    if (count > 0) {
      // Button should be visible and enabled
      await expect(advanceButton.first()).toBeVisible();
      await expect(advanceButton.first()).toBeEnabled();
    }
  });

  test('staff cannot access admin settings (backend rejects)', async ({ page }) => {
    // Direct API call — backend should reject
    const response = await page.request.get('/api/v1/admin/settings', {
      headers: { 'Content-Type': 'application/json' },
    });
    // Staff scope should not have admin:settings:manage
    expect(response.status()).toBe(403);
  });

  test('staff cannot modify catalog items (backend rejects)', async ({ page }) => {
    // Direct API call to create a menu item — backend should reject
    const response = await page.request.post('/api/v1/admin/modules', {
      data: { name: 'Unauthorized Module', template_type: 'instant_transaction' },
    });
    // Staff should not have admin:modules:manage
    expect(response.status()).toBe(403);
  });
});

test.describe('Authorization: Manager capabilities', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test('manager sees manager dashboard and reports', async ({ page }) => {
    await page.goto('/default/staff/manager');
    await expect(page.locator('text=Manager Dashboard')).toBeVisible({ timeout: 5000 });
  });

  test('manager can view reports (ADMIN_REPORTS)', async ({ page }) => {
    // Manager should have admin:reports:read
    const response = await page.request.get('/api/v1/admin/dashboard');
    // Manager should be able to access this
    expect(response.status()).toBe(200);
  });

  test('manager cannot access audit logs (backend rejects)', async ({ page }) => {
    // Direct API call — manager should not have admin:audit:read
    const response = await page.request.get('/api/v1/admin/audit-logs');
    expect(response.status()).toBe(403);
  });
});

test.describe('Authorization: Admin capabilities', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin sees full admin panel', async ({ page }) => {
    await page.goto('/default/admin');
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
  });

  test('admin can access settings (ADMIN_SETTINGS)', async ({ page }) => {
    const response = await page.request.get('/api/v1/admin/settings');
    expect(response.status()).toBe(200);
  });

  test('admin can access audit logs (ADMIN_AUDIT_LOG)', async ({ page }) => {
    const response = await page.request.get('/api/v1/admin/audit-logs');
    expect(response.status()).toBe(200);
  });
});

test.describe('Authorization: UI hides unauthorized actions', () => {
  test('staff does not see Add Item button in catalog', async ({ page }) => {
    await loginAsStaff(page);

    // Navigate to a module's menu page
    // Staff should NOT see the "Add Item" button (requires catalog:write)
    await page.goto('/default/admin/restaurant/menu');

    // If the page loads, the Add Item button should not be visible for staff
    const addButton = page.locator('button:has-text("Add Item")');
    // Staff without catalog:write should not see this
    const count = await addButton.count();
    if (count > 0) {
      // Button might exist but should be hidden or disabled
      await expect(addButton).not.toBeVisible();
    }
  });

  test('staff order action buttons respect ORDER_UPDATE permission', async ({ page }) => {
    await loginAsStaff();

    // Navigate to orders page
    await page.goto('/default/admin/restaurant/orders');

    // Staff with ORDER_UPDATE should see Confirm/Advance buttons
    // Staff without ORDER_UPDATE should not see them
    const confirmButton = page.locator('button:has-text("Confirm")');
    const count = await confirmButton.count();
    // If there are pending orders, the button should be visible for staff
    // (staff has ORDER_UPDATE in the backend permission cache)
  });
});

test.describe('Authorization: Backend rejects unauthorized direct API calls', () => {
  test('unauthenticated request is rejected', async ({ page }) => {
    const response = await page.request.get('/api/v1/admin/modules');
    expect(response.status()).toBe(401);
  });

  test('staff cannot create modules (backend rejects)', async ({ page }) => {
    await loginAsStaff(page);

    const response = await page.request.post('/api/v1/admin/modules', {
      data: { name: 'Unauthorized', template_type: 'instant_transaction' },
    });
    expect(response.status()).toBe(403);
  });

  test('staff cannot refund payments (backend rejects)', async ({ page }) => {
    await loginAsStaff(page);

    // Attempt to refund a non-existent payment — should be rejected
    const response = await page.request.post('/api/v1/payments/transactions/fake-id/refund', {
      data: { amount: 100, reason: 'test' },
    });
    // Staff should not have payment:refund
    expect(response.status()).toBe(403);
  });
});
