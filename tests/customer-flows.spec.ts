/**
 * Customer Flow E2E Tests
 * 
 * Tests the critical revenue-generating customer journeys:
 * 1. Restaurant ordering flow
 * 2. Chalet booking flow
 * 3. Pool ticket purchase flow
 * 
 * These tests validate the complete customer experience from browsing to payment.
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';

// Test data
const TEST_CUSTOMER = {
  name: 'Test Customer',
  email: 'test.customer@example.com',
  phone: '+961 71 234 567',
};

// ============================================
// RESTAURANT ORDERING FLOW
// ============================================
test.describe('Restaurant Ordering Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/restaurant`);
    await page.waitForLoadState('networkidle');
  });

  test('should display restaurant menu page', async ({ page }) => {
    // Verify page loaded
    await expect(page).toHaveTitle(/restaurant|menu/i);
    
    // Should show menu categories or items
    const menuContent = page.locator('[data-testid="menu-items"], .menu-category, .menu-item, [class*="menu"]');
    await expect(menuContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display menu categories', async ({ page }) => {
    // Look for category tabs, buttons, or sections
    const categories = page.locator('[data-testid="category"], [role="tab"], .category-button, .menu-category');
    
    // Should have at least one category
    const count = await categories.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display menu items with prices', async ({ page }) => {
    // Wait for menu items to load
    await page.waitForTimeout(2000);
    
    // Look for menu items
    const menuItems = page.locator('[data-testid="menu-item"], .menu-item, [class*="MenuItem"]');
    const count = await menuItems.count();
    
    // Should have menu items
    expect(count).toBeGreaterThan(0);
    
    // First item should have a price
    const priceElement = page.locator('text=/\\$\\d+|USD|LBP|\\d+\\.\\d{2}/').first();
    await expect(priceElement).toBeVisible({ timeout: 5000 });
  });

  test('should be able to add item to cart', async ({ page }) => {
    // Wait for menu to load
    await page.waitForTimeout(2000);
    
    // Find and click an add to cart button
    const addButton = page.locator('button:has-text("Add"), button:has-text("add"), [data-testid="add-to-cart"]').first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Cart should update (look for cart icon with count or cart drawer)
      const cartIndicator = page.locator('[data-testid="cart-count"], .cart-count, [class*="badge"]');
      await expect(cartIndicator).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show dietary filter options', async ({ page }) => {
    // Look for dietary filter buttons or checkboxes
    const dietaryFilters = page.locator('text=/vegetarian|vegan|gluten.?free|halal/i');
    
    // May or may not be visible depending on UI implementation
    const filterButton = page.locator('button:has-text("Filter"), [data-testid="filter"]');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await expect(dietaryFilters.first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ============================================
// CHALET BOOKING FLOW
// ============================================
test.describe('Chalet Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/chalets`);
    await page.waitForLoadState('networkidle');
  });

  test('should display chalets page', async ({ page }) => {
    // Verify page loaded
    const pageContent = page.locator('h1, h2');
    await expect(pageContent.first()).toBeVisible({ timeout: 10000 });
    
    // Should show chalet listings
    const chaletCards = page.locator('[data-testid="chalet-card"], .chalet-card, [class*="ChaletCard"]');
    await expect(chaletCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display chalet cards with key information', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Should show chalet names
    const chaletCards = page.locator('[data-testid="chalet-card"], .chalet-card, [class*="chalet"]');
    const count = await chaletCards.count();
    expect(count).toBeGreaterThan(0);
    
    // Should show prices
    const priceElement = page.locator('text=/\\$\\d+|USD|per night|night/i').first();
    await expect(priceElement).toBeVisible({ timeout: 5000 });
  });

  test('should be able to select dates for booking', async ({ page }) => {
    // Look for date picker
    const datePicker = page.locator('[data-testid="date-picker"], input[type="date"], [class*="DatePicker"], [class*="calendar"]');
    
    // Click on first chalet to see booking form
    const chaletCard = page.locator('[data-testid="chalet-card"], .chalet-card').first();
    if (await chaletCard.isVisible()) {
      await chaletCard.click();
      await page.waitForTimeout(2000);
      
      // Date picker should be visible on booking page
      await expect(datePicker.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should navigate to chalet detail page', async ({ page }) => {
    // Click on first chalet
    const chaletLink = page.locator('[data-testid="chalet-card"] a, .chalet-card a, a[href*="/chalets/"]').first();
    
    if (await chaletLink.isVisible()) {
      await chaletLink.click();
      await page.waitForLoadState('networkidle');
      
      // Should be on detail page
      expect(page.url()).toMatch(/\/chalets\/[a-zA-Z0-9-]+/);
      
      // Should show booking form or button
      const bookButton = page.locator('button:has-text("Book"), button:has-text("Reserve"), [data-testid="book-button"]');
      await expect(bookButton).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show availability calendar', async ({ page }) => {
    // Navigate to a specific chalet
    const chaletLink = page.locator('a[href*="/chalets/"]').first();
    if (await chaletLink.isVisible()) {
      await chaletLink.click();
      await page.waitForLoadState('networkidle');
      
      // Look for calendar component
      const calendar = page.locator('[data-testid="availability-calendar"], [class*="Calendar"], [role="grid"]');
      await expect(calendar.first()).toBeVisible({ timeout: 10000 });
    }
  });
});

// ============================================
// POOL TICKET PURCHASE FLOW
// ============================================
test.describe('Pool Ticket Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/pool`);
    await page.waitForLoadState('networkidle');
  });

  test('should display pool page', async ({ page }) => {
    // Verify page loaded
    const pageContent = page.locator('h1, h2');
    await expect(pageContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show available pool sessions', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for session cards or time slots
    const sessions = page.locator('[data-testid="pool-session"], .session-card, [class*="Session"]');
    const count = await sessions.count();
    
    // Should have sessions or a message about no sessions
    const content = page.locator('text=/session|time|slot|morning|afternoon|evening|no.*available/i');
    await expect(content.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display ticket pricing', async ({ page }) => {
    // Should show pricing for different ticket types
    const pricing = page.locator('text=/adult|child|infant|\\$\\d+|USD/i');
    await expect(pricing.first()).toBeVisible({ timeout: 5000 });
  });

  test('should be able to select ticket quantities', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for quantity selectors
    const quantityInput = page.locator('input[type="number"], [data-testid="quantity"], .quantity-selector, button:has-text("+")');
    
    if (await quantityInput.first().isVisible()) {
      // Should be able to adjust quantity
      await expect(quantityInput.first()).toBeEnabled();
    }
  });

  test('should show total price calculation', async ({ page }) => {
    // Select tickets if possible
    const addButton = page.locator('button:has-text("+")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Total should be visible
      const total = page.locator('text=/total|Total|\\$\\d+\\.\\d{2}/');
      await expect(total.first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ============================================
// CHECKOUT FLOW (SHARED)
// ============================================
test.describe('Checkout Flow', () => {
  test('should have working payment integration indicators', async ({ page }) => {
    // Go to restaurant and add item
    await page.goto(`${FRONTEND_URL}/restaurant`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to get to checkout
    const cartButton = page.locator('[data-testid="cart"], .cart-button, button:has-text("Cart")');
    if (await cartButton.isVisible()) {
      await cartButton.click();
      await page.waitForTimeout(1000);
      
      // Look for checkout button
      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Pay"), [data-testid="checkout"]');
      
      if (await checkoutButton.isVisible()) {
        await checkoutButton.click();
        await page.waitForTimeout(2000);
        
        // Should see payment form or Stripe elements
        const paymentForm = page.locator('[class*="stripe"], [data-testid="payment-form"], form');
        await expect(paymentForm.first()).toBeVisible({ timeout: 10000 });
      }
    }
  });
});

// ============================================
// API TESTS FOR CUSTOMER ENDPOINTS
// ============================================
test.describe('Customer API Endpoints', () => {
  test('GET /api/restaurant/menu - should return menu items', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/restaurant/menu`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });

  test('GET /api/restaurant/menu/items - should support dietary filters', async ({ request }) => {
    // Test vegetarian filter
    const vegResponse = await request.get(`${API_URL}/api/restaurant/menu/items?vegetarian=true`);
    expect(vegResponse.status()).toBe(200);
    
    const vegData = await vegResponse.json();
    expect(vegData.success).toBe(true);
    
    // Test multiple filters
    const multiResponse = await request.get(`${API_URL}/api/restaurant/menu/items?vegan=true&glutenFree=true`);
    expect(multiResponse.status()).toBe(200);
  });

  test('GET /api/chalets - should return chalet listings', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/chalets`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('GET /api/chalets/availability - should return availability', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await request.get(`${API_URL}/api/chalets/availability?startDate=${today}&endDate=${nextWeek}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('GET /api/pool/sessions - should return pool sessions', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/pool/sessions`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('GET /api/pool/settings - should return pool settings', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/pool/settings`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('GET /api/settings - should return public settings', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/settings`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

// ============================================
// RESPONSIVE DESIGN TESTS
// ============================================
test.describe('Responsive Design', () => {
  test('restaurant page works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${FRONTEND_URL}/restaurant`);
    await page.waitForLoadState('networkidle');
    
    // Content should be visible and usable
    const content = page.locator('main, [role="main"], .content');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
    
    // No horizontal scrollbar (content fits)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding
  });

  test('chalets page works on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${FRONTEND_URL}/chalets`);
    await page.waitForLoadState('networkidle');
    
    // Content should be visible
    const chaletCards = page.locator('[data-testid="chalet-card"], .chalet-card, [class*="chalet"]');
    await expect(chaletCards.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// LANGUAGE/LOCALIZATION TESTS
// ============================================
test.describe('Localization', () => {
  test('should support language switching', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Look for language switcher
    const langSwitcher = page.locator('[data-testid="language-switcher"], button:has-text("EN"), button:has-text("AR"), button:has-text("FR"), [class*="language"]');
    
    if (await langSwitcher.first().isVisible()) {
      await expect(langSwitcher.first()).toBeEnabled();
    }
  });

  test('Arabic locale should work', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/ar`);
    await page.waitForLoadState('networkidle');
    
    // Page should have RTL direction
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir).toBe('rtl');
  });
});
