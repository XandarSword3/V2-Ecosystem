/**
 * e2e/fixtures/tenant.fixture.ts
 *
 * Tenant context helpers for tests.
 * Provides typed access to the seeded test tenants and helpers for
 * constructing tenant-scoped URLs and API request headers.
 *
 * Node.js API calls MUST use localhost:3005 + x-tenant-slug header.
 * Browser navigation CAN use *.localhost:3000 directly.
 */

import type { APIRequestContext } from '@playwright/test';
import { getDb, getTenantBySubdomain } from '../helpers/db';

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Returns the frontend URL for a given tenant subdomain.
 * Use in page.goto() calls — Chromium resolves *.localhost natively.
 */
export function tenantUrl(subdomain: string, path = ''): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `http://${subdomain}.localhost:3000${normalizedPath}`;
}

/**
 * Returns the backend API URL for a Node.js fetch / request fixture call.
 * Uses localhost:3005 directly — no *.localhost subdomain (Node.js DNS issue).
 * The x-tenant-slug header must be included in the request separately.
 */
export function backendUrl(path = ''): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `http://localhost:3005${normalizedPath}`;
}

// ---------------------------------------------------------------------------
// Request header helpers
// ---------------------------------------------------------------------------

/**
 * Returns the headers required for tenant-scoped backend API calls.
 * Always include these on any request to localhost:3005.
 */
export function tenantHeaders(subdomain: string, token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-slug': subdomain,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Tenant data accessors
// ---------------------------------------------------------------------------

/** Reserved test subdomains — match exactly what global-setup seeds. */
export const TEST_TENANTS = {
  PRIMARY:   'testcorp',
  SECONDARY: 'othercorp', // independent tenant, used for cross-tenant isolation tests
  SUSPENDED: 'suspended',
  PLATFORM:  'platform',
} as const;

export type TestTenantSubdomain = typeof TEST_TENANTS[keyof typeof TEST_TENANTS];

/** Returns the full tenant row for a seeded test tenant. Throws if not found. */
export async function getTestTenant(subdomain: TestTenantSubdomain) {
  const tenant = await getTenantBySubdomain(subdomain);
  if (!tenant) {
    throw new Error(
      `[tenant] Tenant '${subdomain}' not found in DB.\n` +
      'Run global-setup (npx playwright test) to seed it first.'
    );
  }
  return tenant;
}

// ---------------------------------------------------------------------------
// API call wrapper — Node.js safe
// ---------------------------------------------------------------------------

/**
 * Makes a backend API call from a Node.js context (request fixture or fetch).
 * Handles the localhost:3005 + x-tenant-slug pattern automatically.
 */
export async function tenantApiGet(
  request: APIRequestContext,
  subdomain: string,
  path: string,
  token?: string
) {
  return request.get(backendUrl(path), {
    headers: tenantHeaders(subdomain, token),
  });
}

export async function tenantApiPost(
  request: APIRequestContext,
  subdomain: string,
  path: string,
  data: object,
  token?: string
) {
  return request.post(backendUrl(path), {
    headers: tenantHeaders(subdomain, token),
    data,
  });
}
