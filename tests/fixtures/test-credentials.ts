/**
 * tests/fixtures/test-credentials.ts
 *
 * Test credentials for Playwright testcorp fixtures.
 */

export const TEST_ADMIN_EMAIL = (slug?: string) => process.env.E2E_ADMIN_EMAIL || `admin@${slug || 'testcorp'}.com`;
export const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';
export const TEST_STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'menu.service.staff@v2ecosystem.com';
export const TEST_STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'staff123';
export const TEST_CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || 'e2e.customer@test.com';
export const TEST_CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD || 'TestPass123!';
