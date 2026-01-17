import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3005';

test('Debug admin login flow', async ({ page }) => {
  // First, let's login via API directly
  const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
    data: {
      email: 'admin@v2resort.com',
      password: 'admin123'
    }
  });
  
  const loginData = await loginResponse.json();
  console.log('API Login response:', JSON.stringify(loginData, null, 2));
  
  if (loginData.success && loginData.data) {
    const { tokens, user } = loginData.data;
    
    // Navigate to the frontend
    await page.goto(`${FRONTEND_URL}/login`);
    
    // Set localStorage before navigation
    await page.evaluate(({ accessToken, refreshToken, userData }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
    }, { 
      accessToken: tokens.accessToken, 
      refreshToken: tokens.refreshToken, 
      userData: user 
    });
    
    // Now navigate to admin
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-admin-after-localstorage.png' });
    
    // Check current URL
    console.log('Current URL after localStorage set:', page.url());
    
    // Check page content
    const pageContent = await page.content();
    console.log('Page has dashboard:', pageContent.includes('Dashboard'));
    console.log('Page has login:', pageContent.includes('Sign in'));
    
    // Check if we're on admin page
    expect(page.url()).toContain('/admin');
    
    // Check for admin dashboard content
    await expect(page.locator('text=/Welcome|Dashboard|Today\'s/i').first()).toBeVisible({ timeout: 10000 });
  } else {
    console.log('Login failed:', loginData);
  }
});

test('Debug UI login flow', async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/login`);
  
  // Wait for form
  await page.waitForSelector('input[type="email"]');
  
  // Fill form
  await page.locator('input[type="email"]').fill('admin@v2resort.com');
  await page.locator('input[type="password"]').fill('admin123');
  
  // Setup network logging
  page.on('response', response => {
    if (response.url().includes('/api/auth/login')) {
      console.log('Login API response status:', response.status());
    }
  });
  
  // Click login and wait
  await page.locator('button[type="submit"]').click();
  
  // Wait for any navigation
  await page.waitForTimeout(5000);
  
  console.log('URL after login:', page.url());
  
  // Check localStorage
  const localStorage = await page.evaluate(() => {
    return {
      accessToken: window.localStorage.getItem('accessToken'),
      user: window.localStorage.getItem('user'),
    };
  });
  console.log('LocalStorage after login:', JSON.stringify(localStorage, null, 2));
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-ui-login.png' });
  
  // Wait more for page to load
  await page.waitForTimeout(3000);
  
  // Check page content
  const hasLogin = await page.locator('text=/Sign in|Login|Welcome Back/i').first().isVisible().catch(() => false);
  const hasDashboard = await page.locator('text=/Online Users|Today\'s Orders|Today\'s Revenue/i').first().isVisible().catch(() => false);
  console.log('Has login page:', hasLogin);
  console.log('Has dashboard:', hasDashboard);
  
  // Take another screenshot
  await page.screenshot({ path: 'test-results/debug-ui-login-final.png' });
  
  // The test should show dashboard
  expect(hasDashboard).toBe(true);
});
