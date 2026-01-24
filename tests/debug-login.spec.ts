import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3005';

test('debug login flow', async ({ page, request }) => {
  // First verify API is working
  const apiResponse = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: 'admin@v2resort.com', password: 'admin123' }
  });
  const apiData = await apiResponse.json();
  console.log('API Login Response:', JSON.stringify(apiData, null, 2));
  expect(apiResponse.ok()).toBe(true);
  
  // Now test UI login
  await page.goto(`${FRONTEND_URL}/login`);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/login-page.png' });
  
  // Check what inputs are available
  const emailInputs = await page.locator('input').all();
  console.log('Number of inputs found:', emailInputs.length);
  
  for (const input of emailInputs) {
    const type = await input.getAttribute('type');
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    console.log(`Input: type=${type}, name=${name}, id=${id}`);
  }
  
  // Fill the form
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  await emailInput.fill('admin@v2resort.com');
  await passwordInput.fill('admin123');
  
  // Take screenshot before submit
  await page.screenshot({ path: 'test-results/before-submit.png' });
  
  // Listen for network requests
  page.on('request', req => {
    if (req.url().includes('/auth/login')) {
      console.log('Login request:', req.url(), req.method());
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/auth/login')) {
      console.log('Login response:', res.status(), res.url());
    }
  });
  
  // Click submit
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  
  // Wait for response
  await page.waitForTimeout(3000);
  
  // Check for errors
  const alerts = await page.locator('[role="alert"]').all();
  for (const alert of alerts) {
    const text = await alert.textContent();
    console.log('Alert message:', text);
  }
  
  // Take screenshot after submit
  await page.screenshot({ path: 'test-results/after-submit.png' });
  
  // Check final URL
  console.log('Final URL:', page.url());
});
