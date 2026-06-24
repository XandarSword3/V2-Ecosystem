/**
 * e2e/fixtures/test-credentials.ts
 *
 * Single source of truth for all hardcoded E2E test credentials.
 *
 * These values are intentionally hardcoded — not env vars.
 * They correspond to accounts that global-setup seeds on every run
 * against a test-only Supabase project. They are meaningless outside
 * that context and carry no production risk.
 *
 * If you need to change the password, change it here AND in
 * global-setup.ts ensureTestAdminUser() — they must match.
 */

export const TEST_ADMIN_PASSWORD = 'V2e2eTest!2026';

export const TEST_ADMIN_EMAIL = (subdomain: string) =>
  `admin@${subdomain}.v2platform.com`;

export const PLATFORM_ADMIN_EMAIL = 'admin@v2ecosystem.com';

/** Pre-built credential objects ready for page.fill() calls. */
export const TESTCORP_ADMIN = {
  email:    TEST_ADMIN_EMAIL('testcorp'),
  password: TEST_ADMIN_PASSWORD,
} as const;

export const PLATFORM_ADMIN = {
  email:    PLATFORM_ADMIN_EMAIL,
  password: TEST_ADMIN_PASSWORD,
} as const;
