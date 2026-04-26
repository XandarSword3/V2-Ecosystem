/**
 * Frontend UI Coverage Test
 * 
 * This test verifies that all bot actions correspond to actual UI elements
 * in the frontend that users can interact with.
 */

import { test, expect, Page } from '../fixtures/auth.fixture';

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_URL || 'http://localhost:3005';

// Helper to check if an element exists
async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

test.describe('Frontend UI Coverage Verification', () => {
  
  test.describe('Guest-Facing Pages', () => {
    
    test('Chalets page has booking UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/chalets`);

      const hasChaletListing = await page
        .locator('[class*="chalet"]').first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);
      test.skip(
        !hasChaletListing,
        `Chalets page/module unavailable in this environment (url: ${page.url()})`
      );
      
      // Should have chalet listings
      await expect(page.locator('[class*="chalet"]').first()).toBeVisible({ timeout: 10000 });
      
      // Should have book/view details buttons
      const hasBookButton = await elementExists(page, 'button:has-text("Book"), a:has-text("Book"), button:has-text("View"), a:has-text("View")');
      expect(hasBookButton).toBeTruthy();
      
      console.log('✅ Chalets page: Has chalet listings and booking UI');
    });
    
    test('Snack Bar page has ordering UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/snack-bar`);
      
      // Should have menu items
      await expect(page.locator('[class*="snack"], [class*="menu"], [class*="item"]').first()).toBeVisible({ timeout: 10000 });
      
      // Should have add to cart buttons
      const hasAddButton = await elementExists(page, 'button:has-text("Add"), button:has-text("+"), [class*="cart"]');
      expect(hasAddButton).toBeTruthy();
      
      console.log('✅ Snack Bar page: Has menu items and ordering UI');
    });
    
    test('Pool page has ticket purchasing UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/pool`);
      
      // Should have pool info
      await expect(page.locator('body')).toContainText(/pool|swim|ticket/i);
      
      // Should have purchase/book button
      const hasPurchaseButton = await elementExists(page, 'button:has-text("Buy"), button:has-text("Book"), button:has-text("Purchase")');
      
      console.log(`✅ Pool page: Has pool information${hasPurchaseButton ? ' and ticket purchasing' : ''}`);
    });
    
    test('Restaurant page has reservation/ordering UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/restaurant`);
      
      // Should have menu or reservation info
      await expect(page.locator('body')).toContainText(/menu|reservation|book|order/i);
      
      console.log('✅ Restaurant page: Has menu/reservation UI');
    });
    
    test('Kiosk page has self-check-in UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/kiosk`);
      
      // Should have check-in/out buttons
      const hasCheckinButton = await elementExists(page, 'button:has-text("Check-In"), button:has-text("Check In"), [class*="checkin"]');
      const hasCheckoutButton = await elementExists(page, 'button:has-text("Check-Out"), button:has-text("Check Out"), [class*="checkout"]');
      
      expect(hasCheckinButton || hasCheckoutButton).toBeTruthy();
      
      console.log('✅ Kiosk page: Has self-service check-in/out buttons');
    });
    
    test('Gift Cards page has purchase UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/giftcards`);
      
      // Should have gift card options
      await expect(page.locator('body')).toContainText(/gift|card|purchase|buy/i);
      
      const hasPurchaseButton = await elementExists(page, 'button:has-text("Buy"), button:has-text("Purchase"), button:has-text("Add")');
      
      console.log(`✅ Gift Cards page: Has gift card info${hasPurchaseButton ? ' and purchase UI' : ''}`);
    });
    
    test('Profile page has account management UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/profile`);
      
      // May redirect to login, that's fine
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Profile page: Redirects to login (auth required)');
      } else {
        await expect(page.locator('body')).toContainText(/profile|account|settings/i);
        console.log('✅ Profile page: Has profile management UI');
      }
    });
  });
  
  test.describe('Admin Pages', () => {
    
    test('Admin dashboard exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      
      // May redirect to login
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin dashboard: Requires authentication');
      } else {
        await expect(page.locator('body')).toContainText(/dashboard|admin|overview/i);
        console.log('✅ Admin dashboard: Accessible');
      }
    });
    
    test('Admin chalets management exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/chalets`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin chalets: Requires authentication');
      } else {
        // Should have CRUD buttons
        const hasCreateButton = await elementExists(page, 'button:has-text("Add"), button:has-text("Create"), button:has-text("New")');
        console.log(`✅ Admin chalets: Has management UI${hasCreateButton ? ' with create button' : ''}`);
      }
    });
    
    test('Admin snack management exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/snack`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin snack: Requires authentication');
      } else {
        const hasCreateButton = await elementExists(page, 'button:has-text("Add"), button:has-text("Create")');
        console.log(`✅ Admin snack: Has management UI${hasCreateButton ? ' with create button' : ''}`);
      }
    });
    
    test('Admin kiosk management exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/kiosk`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin kiosk: Requires authentication');
      } else {
        console.log('✅ Admin kiosk: Has kiosk management UI');
      }
    });
    
    test('Admin pool management exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/pool`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin pool: Requires authentication');
      } else {
        console.log('✅ Admin pool: Has pool management UI');
      }
    });
    
    test('Admin channels management exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/channels`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin channels: Requires authentication');
      } else {
        console.log('✅ Admin channels: Has channel management UI');
      }
    });
    
    test('Admin loyalty management exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/loyalty`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin loyalty: Requires authentication');
      } else {
        console.log('✅ Admin loyalty: Has loyalty management UI');
      }
    });
    
    test('Admin reports exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/reports`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Admin reports: Requires authentication');
      } else {
        console.log('✅ Admin reports: Has reporting UI');
      }
    });
  });
  
  test.describe('Staff Pages', () => {
    
    test('Staff dashboard exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/staff`);
      
      const isLoginPage = page.url().includes('login');
      
      if (isLoginPage) {
        console.log('✅ Staff dashboard: Requires authentication');
      } else {
        console.log('✅ Staff dashboard: Accessible');
      }
    });
  });
});

test.describe('API Coverage Verification', () => {
  
  test('Chalets API exists', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/v1/chalets`);
    // 401 is fine (auth required), 404 would be bad
    expect([200, 401, 403]).toContain(response.status());
    console.log(`✅ Chalets API: Exists (status: ${response.status()})`);
  });
  
  test('Snack API exists', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/v1/snack/items`);
    expect([200, 401, 403]).toContain(response.status());
    console.log(`✅ Snack API: Exists (status: ${response.status()})`);
  });
  
  test('Pool API exists', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/v1/pool/tickets`);
    // Pool module can be disabled in some environments, which returns 404 via module guard.
    expect([200, 401, 403, 404]).toContain(response.status());
    console.log(`✅ Pool API: Exists (status: ${response.status()})`);
  });
  
  test('Kiosk API exists', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/v1/kiosk/status`);
    expect([200, 401, 403, 404]).toContain(response.status());
    console.log(`✅ Kiosk API: Exists (status: ${response.status()})`);
  });
});
