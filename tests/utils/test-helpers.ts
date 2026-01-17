/**
 * Shared Test Utilities for Playwright E2E Tests
 * 
 * Provides common helpers for authentication, API calls, and assertions.
 */

import { Page, APIRequestContext, expect } from '@playwright/test';

// Environment-driven configuration
export const CONFIG = {
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  API_URL: process.env.API_URL || 'http://localhost:3005',
  ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com',
  ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || 'admin123',
  STAFF_EMAIL: process.env.E2E_STAFF_EMAIL || 'restaurant.staff@v2resort.com',
  STAFF_PASSWORD: process.env.E2E_STAFF_PASSWORD || 'staff123',
  DEFAULT_TIMEOUT: 15000,
};

// Store auth tokens for reuse
let cachedAdminToken: string | null = null;
let cachedStaffToken: string | null = null;

/**
 * Login via API and get access token
 */
export async function getAuthToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string | null> {
  try {
    const response = await request.post(`${CONFIG.API_URL}/api/auth/login`, {
      data: { email, password },
      timeout: 30000,
    });

    if (response.ok()) {
      const data = await response.json();
      return data.data?.tokens?.accessToken || data.data?.accessToken || null;
    }
    console.error(`Login failed for ${email}: ${response.status()}`);
    return null;
  } catch (error) {
    console.error(`Login error for ${email}:`, error);
    return null;
  }
}

/**
 * Get admin token (cached)
 */
export async function getAdminToken(request: APIRequestContext): Promise<string | null> {
  if (cachedAdminToken) return cachedAdminToken;
  cachedAdminToken = await getAuthToken(request, CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
  return cachedAdminToken;
}

/**
 * Login as admin via the UI
 */
export async function loginAsAdmin(page: Page): Promise<boolean> {
  try {
    await page.goto(`${CONFIG.FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    // Wait for form to be ready
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    await emailInput.fill(CONFIG.ADMIN_EMAIL);
    await passwordInput.fill(CONFIG.ADMIN_PASSWORD);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for either redirect or error
    await Promise.race([
      page.waitForURL(/\/(admin|staff|dashboard)/, { timeout: 15000 }),
      page.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => null),
    ]);

    const currentUrl = page.url();
    return !currentUrl.includes('/login');
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageReady(page: Page, options?: {
  selector?: string;
  text?: string | RegExp;
  timeout?: number;
}): Promise<boolean> {
  const timeout = options?.timeout || CONFIG.DEFAULT_TIMEOUT;

  try {
    await page.waitForLoadState('networkidle', { timeout });

    if (options?.selector) {
      await page.waitForSelector(options.selector, { timeout });
    }

    if (options?.text) {
      await page.locator(`text=${options.text}`).first().waitFor({ timeout });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Safely check if element exists and is visible
 */
export async function isElementVisible(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Make authenticated API request
 */
export async function apiRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  options?: {
    data?: any;
    token?: string;
  }
): Promise<{ ok: boolean; status: number; data: any }> {
  const token = options?.token || (await getAdminToken(request));
  const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_URL}${endpoint}`;

  try {
    const response = await request[method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'](url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: options?.data,
      timeout: 30000,
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      ok: response.ok(),
      status: response.status(),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: String(error) },
    };
  }
}

/**
 * Skip test if backend is unavailable
 */
export async function requireBackend(request: APIRequestContext): Promise<void> {
  const response = await apiRequest(request, 'GET', '/api/healthz');
  if (!response.ok) {
    throw new Error('Backend is not available. Start the server before running E2E tests.');
  }
}

/**
 * Clear cached tokens (for test cleanup)
 */
export function clearTokenCache(): void {
  cachedAdminToken = null;
  cachedStaffToken = null;
}
