import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  test as base,
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

export type AuthRole = 'guest' | 'customer' | 'admin' | 'staff';

type AuthFixtures = {
  auth: {
    loginAs: (role: Exclude<AuthRole, 'guest'>) => Promise<void>;
    getApiToken: (role: Exclude<AuthRole, 'guest'>) => Promise<string>;
    createRolePage: (role: Exclude<AuthRole, 'guest'>) => Promise<{ context: BrowserContext; page: Page }>;
  };
  storageStatePaths: Record<Exclude<AuthRole, 'guest'>, string>;
  adminPage: Page;
  staffPage: Page;
  customerPage: Page;
};

type RoleCredentials = {
  email: string;
  password: string;
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';
const AUTH_STATE_DIR = path.join(process.cwd(), 'tests', '.auth');

const ROLE_CREDENTIALS: Record<Exclude<AuthRole, 'guest'>, RoleCredentials> = {
  customer: {
    email: process.env.E2E_CUSTOMER_EMAIL || 'e2e.customer@test.com',
    password: process.env.E2E_CUSTOMER_PASSWORD || 'TestPass123!',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@v2ecosystem.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
  },
  staff: {
    email: process.env.E2E_STAFF_EMAIL || 'restaurant.staff@v2ecosystem.com',
    password: process.env.E2E_STAFF_PASSWORD || 'staff123',
  },
};

const ROLE_CREDENTIAL_FALLBACKS: Record<Exclude<AuthRole, 'guest'>, RoleCredentials[]> = {
  customer: [
    { email: 'customer@test.com', password: 'password123' },
    { email: 'customer@example.com', password: 'password123' },
  ],
  admin: [
    { email: 'admin@v2ecosystem.com', password: 'Admin123!' },
  ],
  staff: [
    { email: 'staff@v2ecosystem.com', password: 'staff123' },
  ],
};

const tokenCache = new Map<string, string>();

function roleStorageStatePath(role: Exclude<AuthRole, 'guest'>): string {
  return path.join(AUTH_STATE_DIR, `${role}.json`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getCredentialCandidates(role: Exclude<AuthRole, 'guest'>): RoleCredentials[] {
  const primary = ROLE_CREDENTIALS[role];
  const fallbacks = ROLE_CREDENTIAL_FALLBACKS[role].filter(
    (candidate) =>
      candidate.email !== primary.email || candidate.password !== primary.password,
  );

  return [primary, ...fallbacks];
}

async function loginViaApi(
  request: APIRequestContext,
  role: Exclude<AuthRole, 'guest'>
): Promise<string> {
  const cached = tokenCache.get(role);
  if (cached) {
    return cached;
  }

  let lastStatus: number | null = null;

  for (const creds of getCredentialCandidates(role)) {
    // Backend can briefly reject logins while warming up (especially right after webServer boots).
    // Try each credential twice before moving to the next.
    let response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: creds,
      timeout: 30000,
    });
    if (!response.ok()) {
      lastStatus = response.status();
      // One short retry on common transient statuses
      if ([401, 429, 500, 502, 503].includes(lastStatus)) {
        await new Promise((r) => setTimeout(r, 500));
        response = await request.post(`${API_URL}/api/v1/auth/login`, {
          data: creds,
          timeout: 30000,
        });
      }
    }

    if (!response.ok()) {
      lastStatus = response.status();
      continue;
    }

    const body = await response.json();
    const token = body?.data?.tokens?.accessToken || body?.data?.accessToken;
    if (!token || typeof token !== 'string') {
      throw new Error(`Auth API token missing for role ${role}`);
    }

    tokenCache.set(role, token);
    return token;
  }

  throw new Error(
    `Auth API login failed for role ${role}: HTTP ${lastStatus ?? 'unknown'}`,
  );
}

async function loginViaUi(page: Page, role: Exclude<AuthRole, 'guest'>): Promise<void> {
  for (const creds of getCredentialCandidates(role)) {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });

    await page.getByLabel(/email/i).first().fill(creds.email);
    await page.getByLabel(/password/i).first().fill(creds.password);
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).first().click();

    await page.waitForLoadState('networkidle');
    const isStillOnLogin = /\/login(\?|$)/i.test(page.url());
    if (!isStillOnLogin) {
      return;
    }
  }

  // Fallback: seed local storage via API login for environments where
  // interactive login is blocked by CSRF/origin constraints.
  for (const creds of getCredentialCandidates(role)) {
    const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
      data: creds,
      timeout: 30000,
    });
    if (!response.ok()) continue;

    const body = await response.json();
    const tokens = body?.data?.tokens;
    const user = body?.data?.user;
    const accessToken = tokens?.accessToken || body?.data?.accessToken;
    const refreshToken = tokens?.refreshToken || body?.data?.refreshToken || '';
    if (!accessToken) continue;

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ token, refresh, userData }) => {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refresh || '');
        if (userData) localStorage.setItem('user', JSON.stringify(userData));
      },
      { token: accessToken, refresh: refreshToken, userData: user },
    );
    return;
  }

  throw new Error(`UI/API login failed for role ${role}: credentials rejected or session bootstrap failed`);
}

async function ensureRoleStorageState(
  browser: Browser,
  role: Exclude<AuthRole, 'guest'>,
): Promise<string> {
  const storagePath = roleStorageStatePath(role);
  const forceRefresh = String(process.env.PW_FORCE_REFRESH_AUTH_STATE || '').toLowerCase() === 'true';

  await fs.mkdir(AUTH_STATE_DIR, { recursive: true });

  if (!forceRefresh && (await fileExists(storagePath))) {
    return storagePath;
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginViaUi(page, role);
    await context.storageState({ path: storagePath });
    return storagePath;
  } finally {
    await context.close();
  }
}

async function applyRoleStorageToPage(page: Page, storagePath: string): Promise<void> {
  const state = JSON.parse(await fs.readFile(storagePath, 'utf8')) as {
    cookies?: Array<Record<string, unknown>>;
    origins?: Array<{ origin: string; localStorage?: Array<{ name: string; value: string }> }>;
  };

  const context = page.context();
  await context.clearCookies();
  if (state.cookies && state.cookies.length > 0) {
    await context.addCookies(state.cookies as Parameters<BrowserContext['addCookies']>[0]);
  }

  const origins = state.origins || [];
  for (const originState of origins) {
    await page.goto(originState.origin, { waitUntil: 'domcontentloaded' });
    await page.evaluate((items) => {
      localStorage.clear();
      for (const item of items || []) {
        localStorage.setItem(item.name, item.value);
      }
    }, originState.localStorage || []);
  }

  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
}

export const test = base.extend<AuthFixtures>({
  storageStatePaths: [
    async ({}, use) => {
      await fs.mkdir(AUTH_STATE_DIR, { recursive: true });
      const admin = roleStorageStatePath('admin');
      const staff = roleStorageStatePath('staff');
      const customer = roleStorageStatePath('customer');
      await use({ admin, staff, customer });
    },
    { scope: 'worker' },
  ],
  auth: async ({ page, request, browser, storageStatePaths }, use) => {
    await use({
      loginAs: async (role) => {
        const storagePath = await ensureRoleStorageState(browser, role);
        await applyRoleStorageToPage(page, storagePath);
      },
      getApiToken: async (role) => {
        return loginViaApi(request, role);
      },
      createRolePage: async (role) => {
        const storagePath = await ensureRoleStorageState(browser, role);
        const context = await browser.newContext({ storageState: storagePath });
        const rolePage = await context.newPage();
        return { context, page: rolePage };
      },
    });
  },
  adminPage: async ({ browser }, use) => {
    const storagePath = await ensureRoleStorageState(browser, 'admin');
    const context = await browser.newContext({ storageState: storagePath });
    const rolePage = await context.newPage();
    try {
      await use(rolePage);
    } finally {
      await context.close();
    }
  },
  staffPage: async ({ browser }, use) => {
    const storagePath = await ensureRoleStorageState(browser, 'staff');
    const context = await browser.newContext({ storageState: storagePath });
    const rolePage = await context.newPage();
    try {
      await use(rolePage);
    } finally {
      await context.close();
    }
  },
  customerPage: async ({ browser }, use) => {
    const storagePath = await ensureRoleStorageState(browser, 'customer');
    const context = await browser.newContext({ storageState: storagePath });
    const rolePage = await context.newPage();
    try {
      await use(rolePage);
    } finally {
      await context.close();
    }
  },
});

export type { APIRequestContext, Browser, BrowserContext, Page };
export { expect };
