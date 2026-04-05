import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export type AuthRole = 'guest' | 'customer' | 'admin' | 'staff';

type AuthFixtures = {
  auth: {
    loginAs: (role: Exclude<AuthRole, 'guest'>) => Promise<void>;
    getApiToken: (role: Exclude<AuthRole, 'guest'>) => Promise<string>;
  };
};

type RoleCredentials = {
  email: string;
  password: string;
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';

const ROLE_CREDENTIALS: Record<Exclude<AuthRole, 'guest'>, RoleCredentials> = {
  customer: {
    email: process.env.E2E_CUSTOMER_EMAIL || 'e2e.customer@test.com',
    password: process.env.E2E_CUSTOMER_PASSWORD || 'TestPass123!',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
  },
  staff: {
    email: process.env.E2E_STAFF_EMAIL || 'restaurant.staff@v2resort.com',
    password: process.env.E2E_STAFF_PASSWORD || 'staff123',
  },
};

const ROLE_CREDENTIAL_FALLBACKS: Record<Exclude<AuthRole, 'guest'>, RoleCredentials[]> = {
  customer: [
    { email: 'customer@test.com', password: 'password123' },
    { email: 'customer@example.com', password: 'password123' },
  ],
  admin: [
    { email: 'admin@v2resort.com', password: 'Admin123!' },
  ],
  staff: [
    { email: 'staff@v2resort.com', password: 'staff123' },
  ],
};

const tokenCache = new Map<string, string>();

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
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: creds,
      timeout: 30000,
    });

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

  throw new Error(`UI login failed for role ${role}: still on login page`);
}

export const test = base.extend<AuthFixtures>({
  auth: async ({ page, request }, use) => {
    await use({
      loginAs: async (role) => {
        await loginViaUi(page, role);
      },
      getApiToken: async (role) => {
        return loginViaApi(request, role);
      },
    });
  },
});

export { expect };
