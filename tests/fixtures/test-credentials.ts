/**
 * tests/fixtures/test-credentials.ts
 *
 * Test credentials for Playwright testcorp fixtures.
 *
 * ⚠ MUST stay in sync with tests/setup/global-setup.ts — that seeder creates
 * `admin@<slug>.v2platform.com` accounts with the password below (via
 * /auth/register, so the hash matches exactly). Fixtures import these
 * constants directly; if one side changes, the other must follow.
 */

/** Test admin password — the value global-setup registers the accounts with. */
export const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'V2e2eTest!2026';

/** Seeded super_admin email for a tenant subdomain. */
export const TEST_ADMIN_EMAIL = (slug?: string) =>
  process.env.E2E_ADMIN_EMAIL || `admin@${slug || 'testcorp'}.v2platform.com`;

/** Primary test tenant admin — used by login specs (matches global-setup seeding). */
export const TESTCORP_ADMIN = {
  email: TEST_ADMIN_EMAIL('testcorp'),
  password: TEST_ADMIN_PASSWORD,
};

/** Independent second tenant admin — used for cross-tenant isolation tests. */
export const OTHERCORP_ADMIN = {
  email: TEST_ADMIN_EMAIL('othercorp'),
  password: TEST_ADMIN_PASSWORD,
};

export const TEST_STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'menu.service.staff@v2ecosystem.com';
export const TEST_STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'staff123';
export const TEST_CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || 'e2e.customer@test.com';
export const TEST_CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD || 'TestPass123!';
