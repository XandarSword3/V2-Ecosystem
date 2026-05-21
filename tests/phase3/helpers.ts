/**
 * Phase 3 E2E Test Helpers
 * Shared utilities for browser-based end-to-end testing.
 */

import { Page, expect, BrowserContext } from '@playwright/test';

export const URLS = {
  FRONTEND: process.env.FRONTEND_URL || 'http://localhost:3000',
  API: process.env.API_URL || 'http://localhost:3005',
};

export const CREDS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@v2ecosystem.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
  },
  staff: {
    email: process.env.E2E_STAFF_EMAIL || 'restaurant.staff@v2ecosystem.com',
    password: process.env.E2E_STAFF_PASSWORD || 'staff123',
  },
  customer: {
    email: 'e2e.customer@test.com',
    password: 'TestPass123!',
    fullName: 'Test Customer',
  },
};

/** Role type for multi-actor tests */
export type ActorRole = 'admin' | 'staff' | 'customer';

async function tryApiLogin(page: Page, email: string, password: string): Promise<{ user: any; tokens: any } | null> {
  try {
    const response = await page.request.post(`${URLS.API}/api/v1/auth/login`, {
      data: { email, password },
    });

    if (!response.ok()) return null;

    const body = await response.json();
    if (!body.success || !body.data?.tokens || !body.data?.user) return null;

    return {
      user: body.data.user,
      tokens: body.data.tokens,
    };
  } catch {
    return null;
  }
}

async function ensureTestCustomer(page: Page): Promise<void> {
  try {
    const response = await page.request.post(`${URLS.API}/api/v1/auth/register`, {
      data: {
        email: CREDS.customer.email,
        password: CREDS.customer.password,
        fullName: CREDS.customer.fullName,
      },
    });

    if (response.ok()) return;

    const text = await response.text().catch(() => '');
    if (response.status() === 409 || /already|exists|duplicate/i.test(text)) return;
  } catch {
    // Best-effort bootstrap; login retry handles final outcome.
  }
}

async function loginForRole(page: Page, role: ActorRole): Promise<{ user: any; tokens: any } | null> {
  const creds = role === 'admin' ? CREDS.admin : role === 'customer' ? CREDS.customer : CREDS.staff;

  let auth = await tryApiLogin(page, creds.email, creds.password);

  // Customer account is not always present after a clean reset.
  // Bootstrap it once, then retry login.
  if (!auth && role === 'customer') {
    await ensureTestCustomer(page);
    auth = await tryApiLogin(page, creds.email, creds.password);
  }

  return auth;
}

/**
 * Login via the UI login page. Returns true if login succeeded.
 */
export async function uiLogin(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // Wait for form — id attributes are stripped during hydration, use type selectors
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });

  await emailInput.fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();

  // Wait for navigation away from /login or error
  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Login via the local backend API and inject tokens into localStorage.
 * This bypasses the CSRF/remote-backend issue in the UI login flow.
 * Also mocks the /auth/me endpoint to prevent the frontend from
 * validating tokens against the remote Render backend (which clears them).
 */
export async function apiLogin(page: Page, email: string, password: string): Promise<boolean> {
  try {
    const auth = await tryApiLogin(page, email, password);
    if (!auth) return false;

    const { tokens, user } = auth;

    // Mock /auth/me so the frontend's validateSession() succeeds
    // instead of calling the remote Render backend (which 404s and clears tokens)
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: user }),
      });
    });

    // Inject auth state into the browser's localStorage  
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ accessToken, refreshToken, userData }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
    }, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, userData: user });

    return true;
  } catch {
    return false;
  }
}

/**
 * Login as admin via API (bypasses CSRF/remote-backend issue).
 */
export async function loginAsAdmin(page: Page): Promise<boolean> {
  return apiLogin(page, CREDS.admin.email, CREDS.admin.password);
}

/**
 * Login as staff via API (bypasses CSRF/remote-backend issue).
 */
export async function loginAsStaff(page: Page): Promise<boolean> {
  return apiLogin(page, CREDS.staff.email, CREDS.staff.password);
}

/**
 * Wait for the page to finish loading (network idle + optional selector).
 */
export async function waitForPageLoad(page: Page, opts?: {
  selector?: string;
  timeout?: number;
}): Promise<void> {
  const timeout = opts?.timeout || 15000;
  try {
    await page.waitForLoadState('domcontentloaded', { timeout });
    // Brief pause for React hydration
    await page.waitForLoadState('networkidle');
  } catch {
    // Tolerate timeout
  }
  if (opts?.selector) {
    await page.waitForSelector(opts.selector, { timeout });
  }
}

/**
 * Check if an element is visible on the page.
 */
export async function isVisible(page: Page, selector: string, timeout = 5000): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely get text content from a selector.
 */
export async function getText(page: Page, selector: string, timeout = 5000): Promise<string> {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout });
    return (await el.textContent()) || '';
  } catch {
    return '';
  }
}

/**
 * Take a screenshot with a descriptive name.
 */
export async function screenshot(page: Page, name: string): Promise<string> {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `test-results/phase3-screenshots/${safeName}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

/**
 * Check if backend API is reachable.
 */
export async function checkBackendHealth(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get(`${URLS.API}/`);
    return response.ok();
  } catch {
    return false;
  }
}

/**
 * Count elements matching a selector.
 */
export async function countElements(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}

// ============================================================
// API PROXY & FUNCTIONAL TEST UTILITIES
// ============================================================

/**
 * Proxy ALL frontend API calls from the remote Render backend to localhost.
 * The frontend's compiled NEXT_PUBLIC_API_URL points to the remote backend.
 * This intercepts those requests and redirects to the local backend,
 * rewriting /api/* to /api/v1/* to match the local route structure.
 */
export async function setupApiProxy(page: Page, options?: { user?: any }): Promise<void> {
  await page.route(
    (url) => url.toString().includes('v2-ecosystem-backend.onrender.com'),
    async (route) => {
      const requestUrl = new URL(route.request().url());
      let localPath = requestUrl.pathname;

      // Mock auth/me if user provided (prevent validateSession from clearing tokens)
      if (localPath.endsWith('/auth/me') && options?.user) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: options.user }),
        });
        return;
      }

      // Rewrite /api/* to /api/v1/* for the local backend
      if (localPath.startsWith('/api/') && !localPath.startsWith('/api/v1/')) {
        localPath = localPath.replace('/api/', '/api/v1/');
      }

      const localUrl = `http://localhost:3005${localPath}${requestUrl.search}`;
      const method = route.request().method();
      const headers = { ...route.request().headers() };
      delete headers['host'];
      delete headers['origin'];
      delete headers['referer'];
      const postData = route.request().postData();

      try {
        const fetchOpts: RequestInit = { method, headers: headers as HeadersInit };
        if (!['GET', 'HEAD'].includes(method) && postData) {
          fetchOpts.body = postData;
        }
        const resp = await fetch(localUrl, fetchOpts);
        const respBody = Buffer.from(await resp.arrayBuffer());
        const respHeaders: Record<string, string> = {};
        resp.headers.forEach((v, k) => { respHeaders[k] = v; });
        delete respHeaders['content-encoding'];

        await route.fulfill({
          status: resp.status,
          headers: respHeaders,
          body: respBody,
        });
      } catch {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Local proxy failed' }),
        });
      }
    }
  );
}

/**
 * Full test environment setup: login via API, set up proxy, inject tokens.
 * Returns user and tokens for verification, or null on failure.
 */
export async function fullSetup(page: Page, role: ActorRole = 'admin'): Promise<{ user: any; tokens: any } | null> {
  try {
    const auth = await loginForRole(page, role);
    if (!auth) return null;
    const { tokens, user } = auth;

    // Set up proxy BEFORE navigating (so all API calls are intercepted)
    await setupApiProxy(page, { user });

    // Navigate and inject tokens into localStorage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ accessToken, refreshToken, userData }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
    }, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, userData: user });

    return { user, tokens };
  } catch {
    return null;
  }
}

/**
 * Get an auth token from the local backend. No browser setup needed.
 */
export async function getAuthToken(page: Page, role: ActorRole = 'admin'): Promise<string | null> {
  try {
    const auth = await loginForRole(page, role);
    return auth?.tokens?.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Get a CSRF token from the backend. Must be called before any
 * POST/PUT/PATCH/DELETE to non-exempt endpoints (e.g., coupons, settings).
 * The cookie is automatically stored by Playwright's request context.
 */
export async function getCsrfToken(page: Page): Promise<string> {
  const resp = await page.request.get(`${URLS.API}/api/csrf-token`);
  const json = await resp.json();
  return json.csrfToken;
}

/**
 * Get full auth headers including CSRF token for admin API calls.
 */
export async function getAuthHeaders(page: Page, role: ActorRole = 'admin'): Promise<Record<string, string>> {
  const token = await getAuthToken(page, role);
  const csrfToken = await getCsrfToken(page);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  };
}

