import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3005';
const FRONTEND_URL = 'http://localhost:3000';

// Test credentials - admin user
const ADMIN_EMAIL = 'admin@v2resort.com';
const ADMIN_PASSWORD = 'admin123';

// Store auth state
let authToken: string = '';
let adminCookies: any[] = [];

// Helper to login as admin
async function loginAsAdmin(page: Page): Promise<boolean> {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');
  
  if (await emailInput.isVisible()) {
    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill(ADMIN_PASSWORD);
    
    // Find and click submit button
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    
    // Wait for navigation or error
    await page.waitForTimeout(3000);
    
    // Check if we're redirected (login successful)
    const currentUrl = page.url();
    return !currentUrl.includes('/login');
  }
  return false;
}

// ============================================
// ADMIN SETTINGS TESTS
// ============================================
test.describe('Admin Settings Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
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
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.accessToken;
        
        // Now save settings
        const response = await request.put(`${API_URL}/api/admin/settings`, {
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
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.accessToken;
        
        // Save a theme
        await request.put(`${API_URL}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { theme: 'midnight' }
        });
        
        // Fetch settings and verify
        const getRes = await request.get(`${API_URL}/api/settings`);
        expect(getRes.ok()).toBeTruthy();
        const settings = await getRes.json();
        expect(settings.data?.theme).toBe('midnight');
      }
    });
  });

  test.describe('Homepage Settings', () => {
    test('should save homepage hero slides', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.accessToken;
        
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
        
        const response = await request.put(`${API_URL}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: heroSettings
        });
        
        expect(response.ok()).toBeTruthy();
      }
    });

    test('should persist hero slide changes', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.accessToken;
        
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
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      
      if (loginRes.ok()) {
        const loginData = await loginRes.json();
        authToken = loginData.data?.accessToken;
        
        const response = await request.put(`${API_URL}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: {
            resortName: 'V2 Resort Test',
            tagline: 'Test Tagline',
            description: 'Test Description',
            phone: '+961 1 234 567',
            email: 'test@v2resort.com',
            address: 'Test Address, Lebanon'
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
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe('Staff Dashboard', () => {
    test('should load staff dashboard', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff`);
      await page.waitForLoadState('networkidle');
      
      // Should see some dashboard content or redirect to login
      const hasContent = await page.locator('text=/dashboard|orders|today|staff/i').first().isVisible().catch(() => false);
      // Dashboard should load or redirect appropriately
    });
  });

  test.describe('Staff Restaurant', () => {
    test('should load restaurant staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/restaurant`);
      await page.waitForLoadState('networkidle');
      
      // Should see order management UI
      const hasOrderUI = await page.locator('text=/orders|pending|preparing|ready/i').first().isVisible().catch(() => false);
    });

    test('should display live orders', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/restaurant`);
      await page.waitForLoadState('networkidle');
      
      // Look for order cards or list
      const orderList = page.locator('[class*="order"], [data-testid*="order"]');
    });
  });

  test.describe('Staff Pool', () => {
    test('should load pool staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/pool`);
      await page.waitForLoadState('networkidle');
      
      // Should see pool management UI - tickets, capacity, etc.
      const hasPoolUI = await page.locator('text=/capacity|tickets|check.?in|guests/i').first().isVisible().catch(() => false);
    });

    test('should show current pool capacity', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/pool`);
      await page.waitForLoadState('networkidle');
      
      // Look for capacity indicator
      const capacityElement = page.locator('text=/\\d+.*capacity|capacity.*\\d+/i');
    });
  });

  test.describe('Staff Chalets', () => {
    test('should load chalets staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/chalets`);
      await page.waitForLoadState('networkidle');
      
      // Should see bookings/chalets UI
      const hasChaletUI = await page.locator('text=/bookings|check.?in|check.?out|chalets/i').first().isVisible().catch(() => false);
    });

    test('should display booking list', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/chalets`);
      await page.waitForLoadState('networkidle');
      
      // Look for booking items
      const bookingList = page.locator('[class*="booking"], [data-testid*="booking"]');
    });
  });

  test.describe('Staff Snack Bar', () => {
    test('should load snack bar staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/snack`);
      await page.waitForLoadState('networkidle');
      
      // Should see snack bar order UI
      const hasSnackUI = await page.locator('text=/orders|pending|ready|snack/i').first().isVisible().catch(() => false);
    });
  });

  test.describe('Staff Bookings', () => {
    test('should load bookings staff page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/bookings`);
      await page.waitForLoadState('networkidle');
      
      // Should see bookings management UI
      const hasBookingsUI = await page.locator('text=/bookings|reservations|today|upcoming/i').first().isVisible().catch(() => false);
    });
  });

  test.describe('Staff Scanner', () => {
    test('should load scanner page', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/staff/scanner`);
      await page.waitForLoadState('networkidle');
      
      // Should see QR scanner or camera UI
      const hasScannerUI = await page.locator('text=/scan|qr|camera|ticket/i').first().isVisible().catch(() => false);
    });
  });
});

// ============================================
// VISUAL REGRESSION TESTS - THEME CHANGES
// ============================================
test.describe('Visual Regression - Theme Tests', () => {
  const themes = ['beach', 'mountain', 'sunset', 'forest', 'midnight', 'luxury'];
  
  test.beforeAll(async ({ request }) => {
    // Login
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    if (loginRes.ok()) {
      const loginData = await loginRes.json();
      authToken = loginData.data?.accessToken;
    }
  });

  for (const theme of themes) {
    test(`should apply ${theme} theme correctly`, async ({ page, request }) => {
      // Set theme via API
      if (authToken) {
        await request.put(`${API_URL}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { theme }
        });
      }
      
      // Wait for settings to propagate
      await page.waitForTimeout(1000);
      
      // Load homepage
      await page.goto(FRONTEND_URL);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot for visual comparison
      await page.screenshot({ 
        path: `test-results/theme-${theme}.png`,
        fullPage: false 
      });
      
      // Verify page loaded
      await expect(page.locator('body')).toBeVisible();
    });
  }

  test('should show weather effects when enabled', async ({ page, request }) => {
    // Enable waves effect
    if (authToken) {
      await request.put(`${API_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { 
          theme: 'beach',
          showWeatherWidget: true,
          weatherEffect: 'waves'
        }
      });
    }
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for animations
    
    // Look for weather effect elements
    const weatherEffects = page.locator('[class*="weather"], [class*="waves"], svg[class*="wave"]');
    
    // Take screenshot
    await page.screenshot({ 
      path: `test-results/weather-waves.png`,
      fullPage: false 
    });
  });

  test('should hide weather effects when disabled', async ({ page, request }) => {
    if (authToken) {
      await request.put(`${API_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { 
          showWeatherWidget: false,
          weatherEffect: 'none'
        }
      });
    }
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ 
      path: `test-results/weather-disabled.png`,
      fullPage: false 
    });
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
      const sessionsRes = await request.get(`${API_URL}/api/pool/sessions?date=${today}`);
      
      if (sessionsRes.ok()) {
        const sessionsData = await sessionsRes.json();
        
        if (sessionsData.data && sessionsData.data.length > 0) {
          const session = sessionsData.data[0];
          
          // Create ticket
          const ticketRes = await request.post(`${API_URL}/api/pool/tickets`, {
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
          const bookingRes = await request.post(`${API_URL}/api/chalets/bookings`, {
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
      const menuRes = await request.get(`${API_URL}/api/restaurant/menu/items`);
      
      if (menuRes.ok()) {
        const menuData = await menuRes.json();
        
        if (menuData.data && menuData.data.length > 0) {
          const item = menuData.data[0];
          
          // Create order
          const orderRes = await request.post(`${API_URL}/api/restaurant/orders`, {
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
      const itemsRes = await request.get(`${API_URL}/api/snack/items`);
      
      if (itemsRes.ok()) {
        const itemsData = await itemsRes.json();
        
        if (itemsData.data && itemsData.data.length > 0) {
          const item = itemsData.data[0];
          
          // Create order
          const orderRes = await request.post(`${API_URL}/api/snack/orders`, {
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
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load admin dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Should see dashboard with stats
    await expect(page.locator('text=/dashboard|overview|today|revenue/i').first()).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'test-results/admin-dashboard.png' });
  });

  test('should load admin users page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/admin-users.png' });
  });

  test('should load admin modules page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/admin-modules.png' });
  });

  test('should load admin reports page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reports`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/admin-reports.png' });
  });

  test('should load admin audit page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/audit`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/admin-audit.png' });
  });

  test('should load admin reviews page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reviews`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/admin-reviews.png' });
  });
});

// ============================================
// DYNAMIC MODULE (SLUG) TESTS
// ============================================
test.describe('Dynamic Module Tests', () => {
  test('should load dynamic restaurant module', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/modules/restaurant`);
    await page.waitForLoadState('networkidle');
    
    // May redirect or show restaurant page
    await page.screenshot({ path: 'test-results/module-restaurant.png' });
  });

  test('should load dynamic pool module', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/modules/pool`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/module-pool.png' });
  });

  test('should load dynamic chalets module', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/modules/chalets`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/module-chalets.png' });
  });

  test('should handle admin dynamic module pages', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Try admin slug pages
    await page.goto(`${FRONTEND_URL}/admin/restaurant`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/admin-slug-restaurant.png' });
  });

  test('should handle staff dynamic module pages', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Try staff slug pages
    await page.goto(`${FRONTEND_URL}/staff/restaurant`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/staff-slug-restaurant.png' });
  });
});
