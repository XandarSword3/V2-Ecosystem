/**
 * e2e/fixtures/base.ts
 *
 * Extended Playwright test with V2-specific fixtures.
 * Import { test, expect } from here instead of '@playwright/test' in all specs
 * that need supabase access or pre-authenticated tokens.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CRITICAL: Node.js .localhost resolution
 * ─────────────────────────────────────────────────────────────────────────────
 * Chromium resolves *.localhost → 127.0.0.1 natively (no DNS lookup needed).
 * Node.js on Windows does NOT — it goes through the system resolver, which
 * does not map *.localhost by default. This means:
 *
 *   ✅ page.goto('http://testcorp.localhost:3000')    — works (Chromium)
 *   ❌ request.get('http://testcorp.localhost:3000')  — fails (Node.js DNS)
 *   ❌ fetch('http://testcorp.localhost:3000')         — fails (Node.js DNS)
 *
 * Rule: All Node.js API calls (request fixture, fetch in setup/helpers) MUST
 * use http://localhost:3005 (backend) with an explicit x-tenant-slug header.
 * Never use *.localhost URLs in Node.js contexts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test as base, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './test-credentials';

type V2Fixtures = {
  /** Service-role Supabase client — bypasses RLS. For assertions only, not auth. */
  supabase: SupabaseClient;
  /** Valid JWT for testcorp's super_admin, ready for Authorization headers. */
  adminToken: string;
};

export const test = base.extend<V2Fixtures>({
  supabase: async ({}, use) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('[base] SUPABASE_URL / SUPABASE_SERVICE_KEY not set in e2e/.env.test');
    const client = createClient(url, key, { auth: { persistSession: false } });
    await use(client);
  },

  adminToken: async ({}, use) => {
    const token = await fetchTestAdminToken('testcorp');
    await use(token);
  },
});

export { expect };

// ---------------------------------------------------------------------------
// Auth helper — Node.js safe (uses localhost:3005, not *.localhost)
// ---------------------------------------------------------------------------

/**
 * Obtains a JWT for the seeded super_admin of a given tenant.
 * Uses http://localhost:3005 + x-tenant-slug header — NOT a *.localhost URL.
 * Credentials come from test-credentials.ts (hardcoded, not env vars).
 */
export async function fetchTestAdminToken(subdomain: string): Promise<string> {
  const res = await fetch('http://localhost:3005/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-slug': subdomain,
    },
    body: JSON.stringify({
      email:    TEST_ADMIN_EMAIL(subdomain),
      password: TEST_ADMIN_PASSWORD,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(
      `[base] Login failed for ${TEST_ADMIN_EMAIL(subdomain)} on '${subdomain}': ` +
      `HTTP ${res.status} — ${body}`
    );
  }

  const body = await res.json();
  const token = body.accessToken ?? body.token ?? body.data?.accessToken ?? body.data?.tokens?.accessToken;

  if (!token) {
    throw new Error(
      `[base] Login response for '${subdomain}' contained no token.\n` +
      `Response: ${JSON.stringify(body)}`
    );
  }

  return token;
}
