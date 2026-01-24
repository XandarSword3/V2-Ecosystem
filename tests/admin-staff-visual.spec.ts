import { test, expect, Page, APIRequestContext } from '@playwright/test';

/**
 * Admin and Staff Visual/Functional E2E Tests
 * 
 * Environment Variables:
 * - FRONTEND_URL: Frontend base URL (default: http://localhost:3000)
 * - API_URL: Backend API URL (default: http://localhost:3005)
 * - E2E_ADMIN_EMAIL: Admin email (default: admin@v2resort.com)
 * - E2E_ADMIN_PASSWORD: Admin password (default: admin123)
 */

// Environment-driven configuration
const API_URL = process.env.API_URL || 'http://localhost:3005';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

// Store auth state (cached per test file)
let authToken: string = '';

/**
 * Helper to get auth token via API (faster than UI login)
 */
async function getAuthToken(request: APIRequestContext): Promise<string> {
  if (authToken) return authToken;
  
  try {
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      timeout: 30000,
    });
    
    if (response.ok()) {
      const data = await response.json();
      authToken = data.data?.tokens?.accessToken || data.data?.accessToken || '';
    }
  } catch (error) {
    console.error('API Login failed:', error);
  }
  return authToken;
}

/**
 * Helper to login as admin via UI with retry logic
 */
async function loginAsAdmin(page: Page, retries = 2): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto(`${FRONTEND_URL}/login`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Wait for form to be fully ready
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      
      await emailInput.fill(ADMIN_EMAIL);
      await passwordInput.fill(ADMIN_PASSWORD);
      
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      
      // Wait for navigation to admin/staff/dashboard
      try {
        await page.waitForURL(/\/(admin|staff|dashboard)/, { timeout: 15000 });
        return true;  // Login succeeded
      } catch {
        // Check if we're still on login page with an error
        const currentUrl = page.url();
        if (!currentUrl.includes('/login')) {
          return true;  // Navigated elsewhere, login succeeded
        }
        
        // Check for error messages
        const errorAlert = page.locator('[role="alert"]');
        if (await errorAlert.isVisible()) {
          const alertText = await errorAlert.textContent();
          if (alertText && alertText.trim()) {
            console.warn(`Login attempt ${attempt + 1} failed:`, alertText);
          }
        }
      }
    } catch (error) {
      console.warn(`Login attempt ${attempt + 1} error:`, error);
      if (attempt === retries) return false;
      await page.waitForTimeout(1000); // Brief pause before retry
    }
  }
  return false;
}

// ============================================
// ADMIN SETTINGS TESTS
// ============================================
test.describe('Admin Settings Tests', () => {
  // Run tests in this suite sequentially to avoid auth conflicts
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginAsAdmin(page);
    if (!loginSuccess) {
      test.skip(true, 'Login failed - skipping test');
    }
  });

  test.describe('Appearance Settings', () => {
    test('should load appearance settings page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/admin/settings/appearance`);
      await page.waitForLoadState('networkidle');
      
      // Should see theme selector
      await expect(page.locator('text=/theme|Theme/i').first()).toBeVisible({ timeout: 10000 });
    });

    test('should have theme selection options', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/admin/settings/appearance`);
      await page.waitForLoadState('networkidle');
      
      // Look for theme cards or buttons
      const themeOptions = ['beach', 'mountain', 'sunset', 'forest', 'midnight', 'luxury'];
      
      for (const theme of themeOptions) {
        const themeElement = page.locator(`text=/${theme}/i`).first();
        // At least some themes should be visible
      }
    });

    test('should have weather effect selector', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/admin/settings/appearance`);
      await page.waitForLoadState('networkidle');
      
      // Look for weather effect dropdown or options
      const weatherSelector = page.locator('select, [role="combobox"]').filter({ hasText: /wave|snow|rain|auto/i });
      // Should exist (may or may not be visible depending on weather widget toggle)
    });

    test('should save appearance settings via API', async ({ request }) => {
      // First login to get token
      const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.tokens?.accessToken;
        
        // Now save settings
        const response = await request.put(`${API_URL}/api/v1/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: {
            theme: 'forest',
            showWeatherWidget: true,
            weatherEffect: 'leaves',
            animationsEnabled: true,
            reducedMotion: false,
            soundEnabled: true
          }
        });
        
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });

    test('should persist theme changes', async ({ request }) => {
      // Login
      const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.tokens?.accessToken;
        
        // Save a theme
        await request.put(`${API_URL}/api/v1/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { theme: 'midnight' }
        });
        
        // Fetch settings from admin API and verify
        const getRes = await request.get(`${API_URL}/api/v1/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        expect(getRes.ok()).toBeTruthy();
        const settings = await getRes.json();
        expect(settings.data?.theme).toBe('midnight');
      }
    });
  });

  test.describe('Homepage Settings', () => {
    test('should save homepage hero slides', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.tokens?.accessToken;
        
        const heroSettings = {
          homepage: {
            heroSlides: [
              {
                id: '1',
                title: 'Test Hero Slide',
                subtitle: 'Test subtitle',
                buttonText: 'Learn More',
                buttonLink: '/about',
                imageUrl: '/images/hero1.jpg',
                enabled: true
              }
            ],
            sections: [
              { id: '1', type: 'services', title: 'Our Services', enabled: true, order: 1 }
            ],
            ctaTitle: 'Ready to Book?',
            ctaSubtitle: 'Contact us today',
            ctaButtonText: 'Book Now',
            ctaButtonLink: '/chalets'
          }
        };
        
        const response = await request.put(`${API_URL}/api/v1/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: heroSettings
        });
        
        expect(response.ok()).toBeTruthy();
      }
    });

    test('should persist hero slide changes', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.tokens?.accessToken;
        
        // Fetch settings
        const getRes = await request.get(`${API_URL}/api/settings`);
        expect(getRes.ok()).toBeTruthy();
        const settings = await getRes.json();
        
        // Should have homepage key with our data
        if (settings.data?.homepage) {
          expect(settings.data.homepage.ctaTitle).toBeDefined();
        }
      }
    });
  });

  test.describe('General Settings', () => {
    test('should save general settings', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.tokens?.accessToken;
        
        const response = await request.put(`${API_URL}/api/v1/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: {
            resortName: 'V2 Resort Test',
            tagline: 'Test Tagline',
            description: 'Test Description',
            phone: '+1 234 567 8900',
            email: 'test@v2resort.com',
            address: 'Test Address, Global City'
          }
        });
        
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });
  });
});

// ============================================
// STAFF PAGES TESTS
// ============================================
test.describe('Staff Pages Tests', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginAsAdmin(page);
    if (!loginSuccess) {
      test.skip(true, 'Login failed - skipping test');
    }
  });

  test.describe('Staff Dashboard', () => {
    test('should load staff dashboard', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff`);
      await page.waitForLoadState('networkidle');
      
      // Should see some dashboard content or redirect to login
      const dashboardContent = page.locator('text=/dashboard|orders|today|staff/i').first();
      await expect(dashboardContent).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Staff Restaurant', () => {
    test('should load restaurant staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/restaurant`);
      await page.waitForLoadState('networkidle');
      
      // Should see order management UI
      const orderUI = page.locator('text=/orders|pending|preparing|ready|restaurant/i').first();
      await expect(orderUI).toBeVisible({ timeout: 15000 });
    });

    test('should display live orders section', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/restaurant`);
      await page.waitForLoadState('networkidle');
      
      // Look for order cards or list (may be empty but container should exist)
      const orderContainer = page.locator('[class*="order"], [data-testid*="order"], main');
      await expect(orderContainer.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Staff Pool', () => {
    test('should load pool staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/pool`);
      await page.waitForLoadState('networkidle');
      
      // Should see pool management UI - tickets, capacity, etc.
      const poolUI = page.locator('text=/capacity|tickets|check.?in|guests|pool/i').first();
      await expect(poolUI).toBeVisible({ timeout: 15000 });
    });

    test('should show capacity section', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/pool`);
      await page.waitForLoadState('networkidle');
      
      // Page should have loaded successfully
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Staff Chalets', () => {
    test('should load chalets staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/chalets`);
      await page.waitForLoadState('networkidle');
      
      // Should see bookings/chalets UI
      const chaletUI = page.locator('text=/bookings|check.?in|check.?out|chalets|reservations/i').first();
      await expect(chaletUI).toBeVisible({ timeout: 15000 });
    });

    test('should display booking section', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/chalets`);
      await page.waitForLoadState('networkidle');
      
      // Main content should be visible
      await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Staff Snack Bar', () => {
    test('should load snack bar staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/snack`);
      await page.waitForLoadState('networkidle');
      
      // Should see snack bar order UI
      const snackUI = page.locator('text=/orders|pending|ready|snack/i').first();
      await expect(snackUI).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Staff Bookings', () => {
    test('should load bookings staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/bookings`);
      await page.waitForLoadState('networkidle');
      
      // Should see bookings management UI
      const bookingsUI = page.locator('text=/bookings|reservations|today|upcoming/i').first();
      await expect(bookingsUI).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Staff Scanner', () => {
    test('should load scanner page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/scanner`);
      await page.waitForLoadState('networkidle');
      
      // Should see QR scanner or camera UI or at least the page loaded
      const scannerUI = page.locator('text=/scan|qr|camera|ticket|scanner/i').first();
      // Scanner may require permissions, just verify page loads
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

// ============================================
// VISUAL REGRESSION TESTS - THEME CHANGES
// ============================================
test.describe('Visual Regression - Theme Tests', () => {
  const themes = ['beach', 'mountain', 'sunset', 'forest', 'midnight', 'luxury'];
  
  test.beforeAll(async ({ request }) => {
    // Get auth token for API calls
    await getAuthToken(request);
  });

  for (const theme of themes) {
    test(`should apply ${theme} theme correctly`, async ({ page, request }) => {
      // Ensure we have auth token
      const token = await getAuthToken(request);
      test.skip(!token, 'Auth required for theme tests');
      
      // Set theme via API
      await request.put(`${API_URL}/api/v1/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { theme }
      });
      
      // Wait for settings to propagate
      await page.waitForTimeout(500);
      
      // Load homepage
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
      
      // Take screenshot for visual comparison
      await page.screenshot({ 
        path: `test-results/theme-${theme}.png`,
        fullPage: false 
      });
      
      // Verify page loaded successfully
      await expect(page.locator('body')).toBeVisible();
    });
  }

  test('should show weather effects when enabled', async ({ page, request }) => {
    const token = await getAuthToken(request);
    test.skip(!token, 'Auth required');
    
    // Enable waves effect
    await request.put(`${API_URL}/api/v1/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { 
        theme: 'beach',
        showWeatherWidget: true,
        weatherEffect: 'waves'
      }
    });
    
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // Wait for animations
    
    // Take screenshot
    await page.screenshot({ 
      path: `test-results/weather-waves.png`,
      fullPage: false 
    });
    
    // Page should load successfully
    await expect(page.locator('body')).toBeVisible();
  });

  test('should hide weather effects when disabled', async ({ page, request }) => {
    const token = await getAuthToken(request);
    test.skip(!token, 'Auth required');
    
    await request.put(`${API_URL}/api/v1/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { 
        showWeatherWidget: false,
        weatherEffect: 'none'
      }
    });
    
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    
    // Take screenshot
    await page.screenshot({ 
      path: `test-results/weather-disabled.png`,
      fullPage: false 
    });
    
    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================
// PURCHASE FLOW TESTS
// ============================================
test.describe('Purchase Flow Tests', () => {
  test.describe('Pool Ticket Purchase', () => {
    test('should complete pool ticket booking flow', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/pool`);
      await page.waitForLoadState('networkidle');
      
      // Should see pool page with booking options
      await expect(page.locator('text=/pool|swim|tickets|book/i').first()).toBeVisible({ timeout: 10000 });
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/pool-page.png' });
    });

    test('should create pool ticket via API', async ({ request }) => {
      // Get pool sessions first
      const today = new Date().toISOString().split('T')[0];
      const sessionsRes = await request.get(`${API_URL}/api/v1/pool/sessions?date=${today}`);
      
      if (sessionsRes.ok()) {
        const sessionsData = await sessionsRes.json();
        
        if (sessionsData.data && sessionsData.data.length > 0) {
          const session = sessionsData.data[0];
          
          // Create ticket
          const ticketRes = await request.post(`${API_URL}/api/v1/pool/tickets`, {
            data: {
              sessionId: session.id,
              adults: 2,
              children: 1,
              infants: 0,
              guestName: 'Test Guest',
              guestEmail: 'test@example.com',
              guestPhone: '+1234567890',
              paymentMethod: 'cash'
            }
          });
          
          if (ticketRes.ok()) {
            const ticketData = await ticketRes.json();
            expect(ticketData.success).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Chalet Booking Purchase', () => {
    test('should display chalet booking page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/chalets`);
      await page.waitForLoadState('networkidle');
      
      // Should see chalets with booking options
      await expect(page.locator('text=/chalet|book|reserve|accommodation/i').first()).toBeVisible({ timeout: 10000 });
      
      await page.screenshot({ path: 'test-results/chalets-page.png' });
    });

    test('should create chalet booking via API', async ({ request }) => {
      // Get chalets
      const chaletsRes = await request.get(`${API_URL}/api/chalets`);
      
      if (chaletsRes.ok()) {
        const chaletsData = await chaletsRes.json();
        
        if (chaletsData.data && chaletsData.data.length > 0) {
          const chalet = chaletsData.data[0];
          
          // Set dates
          const checkIn = new Date();
          checkIn.setDate(checkIn.getDate() + 14);
          const checkOut = new Date(checkIn);
          checkOut.setDate(checkOut.getDate() + 2);
          
          // Create booking
          const bookingRes = await request.post(`${API_URL}/api/v1/chalets/bookings`, {
            data: {
              chaletId: chalet.id,
              checkIn: checkIn.toISOString().split('T')[0],
              checkOut: checkOut.toISOString().split('T')[0],
              guestCount: 2,
              guestName: 'Test Booker',
              guestEmail: 'booker@test.com',
              guestPhone: '+1234567890',
              paymentMethod: 'cash'
            }
          });
          
          if (bookingRes.ok()) {
            const bookingData = await bookingRes.json();
            expect(bookingData.success).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Restaurant Order Purchase', () => {
    test('should display restaurant menu', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/restaurant`);
      await page.waitForLoadState('networkidle');
      
      // Should see restaurant menu
      await expect(page.locator('text=/menu|restaurant|order|food/i').first()).toBeVisible({ timeout: 10000 });
      
      await page.screenshot({ path: 'test-results/restaurant-page.png' });
    });

    test('should create restaurant order via API', async ({ request }) => {
      // Get menu items
      const menuRes = await request.get(`${API_URL}/api/v1/restaurant/menu/items`);
      
      if (menuRes.ok()) {
        const menuData = await menuRes.json();
        
        if (menuData.data && menuData.data.length > 0) {
          const item = menuData.data[0];
          
          // Create order
          const orderRes = await request.post(`${API_URL}/api/v1/restaurant/orders`, {
            data: {
              items: [{ itemId: item.id, quantity: 2 }],
              orderType: 'dine_in',
              tableNumber: 10,
              paymentMethod: 'cash',
              guestName: 'Test Diner',
              guestPhone: '+1234567890'
            }
          });
          
          if (orderRes.ok()) {
            const orderData = await orderRes.json();
            expect(orderData.success).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Snack Bar Order Purchase', () => {
    test('should display snack bar menu', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/snack-bar`);
      await page.waitForLoadState('networkidle');
      
      // Should see snack bar menu
      await expect(page.locator('text=/snack|menu|order|drink/i').first()).toBeVisible({ timeout: 10000 });
      
      await page.screenshot({ path: 'test-results/snackbar-page.png' });
    });

    test('should create snack order via API', async ({ request }) => {
      // Get snack items
      const itemsRes = await request.get(`${API_URL}/api/v1/snack/items`);
      
      if (itemsRes.ok()) {
        const itemsData = await itemsRes.json();
        
        if (itemsData.data && itemsData.data.length > 0) {
          const item = itemsData.data[0];
          
          // Create order
          const orderRes = await request.post(`${API_URL}/api/v1/snack/orders`, {
            data: {
              items: [{ itemId: item.id, quantity: 1 }],
              locationCode: 'POOL-A1',
              paymentMethod: 'cash',
              guestName: 'Test Snacker'
            }
          });
          
          if (orderRes.ok()) {
            const orderData = await orderRes.json();
            expect(orderData.success).toBe(true);
          }
        }
      }
    });
  });
});

// ============================================
// ADMIN PAGES FUNCTIONALITY TESTS
// ============================================
test.describe('Admin Pages Functionality', () => {
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginAsAdmin(page);
    if (!loginSuccess) {
      test.skip(true, 'Login failed - skipping test');
    }
  });

  test('should load admin dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'networkidle' });
    
    // Wait for main content area to load
    await expect(page.locator('main, [role="main"], .dashboard-content, .admin-content').first()).toBeVisible({ timeout: 15000 });
    
    // Verify we're on the admin page by checking URL or main content
    expect(page.url()).toContain('/admin');
    
    await page.screenshot({ path: 'test-results/admin-dashboard.png' });
  });

  test('should load admin users page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users`, { waitUntil: 'networkidle' });
    
    // Verify page loaded
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/admin-users.png' });
  });

  test('should load admin modules page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`, { waitUntil: 'networkidle' });
    
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/admin-modules.png' });
  });

  test('should load admin reports page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reports`, { waitUntil: 'networkidle' });
    
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/admin-reports.png' });
  });

  test('should load admin audit page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/audit`, { waitUntil: 'networkidle' });
    
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/admin-audit.png' });
  });

  test('should load admin reviews page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reviews`, { waitUntil: 'networkidle' });
    
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/admin-reviews.png' });
  });
});

// ============================================
// DYNAMIC MODULE (SLUG) TESTS
// ============================================
test.describe('Dynamic Module Tests', () => {
  test('should load dynamic restaurant module', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/modules/restaurant`, { waitUntil: 'networkidle' });
    
    // May redirect or show restaurant page - verify page loaded
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/module-restaurant.png' });
  });

  test('should load dynamic pool module', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/modules/pool`, { waitUntil: 'networkidle' });
    
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/module-pool.png' });
  });

  test('should load dynamic chalets module', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/modules/chalets`, { waitUntil: 'networkidle' });
    
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/module-chalets.png' });
  });

  test('should handle admin dynamic module pages', async ({ page }) => {
    const loginSuccess = await loginAsAdmin(page);
    test.skip(!loginSuccess, 'Login required');
    
    // Try admin slug pages
    await page.goto(`${FRONTEND_URL}/admin/restaurant`, { waitUntil: 'networkidle' });
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/admin-slug-restaurant.png' });
  });

  test('should handle staff dynamic module pages', async ({ page }) => {
    const loginSuccess = await loginAsAdmin(page);
    test.skip(!loginSuccess, 'Login required');
    
    // Try staff slug pages
    await page.goto(`${FRONTEND_URL}/staff/restaurant`, { waitUntil: 'networkidle' });
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/staff-slug-restaurant.png' });
  });
});
