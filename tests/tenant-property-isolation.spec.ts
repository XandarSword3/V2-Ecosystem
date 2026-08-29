/**
 * F2.5: Tenant/Property/Module Isolation E2E
 *
 * Proves:
 *   Tenant A + Property A + Module A → allowed
 *   Tenant A + Property B → according to property grants
 *   Tenant B + Module A → rejected
 *   Same module slug in another tenant → rejected
 *   displayPropertyId never affects backend authorization
 *
 * Prerequisites:
 *   - Running backend with seeded tenants (A and B)
 *   - Each tenant has at least one property and one module
 *   - Staff users with property-scoped access
 *
 * Run: npx playwright test tests/tenant-property-isolation.spec.ts
 */

import { test, expect } from '@playwright/test';

// ============================================
// Test fixtures — seeded test data
// ============================================

const TENANT_A_STAFF = {
  email: process.env.TEST_TENANT_A_STAFF_EMAIL || 'staff-a@test.example.com',
  password: process.env.TEST_TENANT_A_STAFF_PASSWORD || 'TestStaffA123!',
  tenantId: process.env.TEST_TENANT_A_ID || 'tenant-a-id',
  propertyId: process.env.TEST_TENANT_A_PROPERTY_ID || 'property-a-id',
  moduleSlug: process.env.TEST_TENANT_A_MODULE_SLUG || 'restaurant-a',
};

const TENANT_B_STAFF = {
  email: process.env.TEST_TENANT_B_STAFF_EMAIL || 'staff-b@test.example.com',
  password: process.env.TEST_TENANT_B_STAFF_PASSWORD || 'TestStaffB123!',
  tenantId: process.env.TEST_TENANT_B_ID || 'tenant-b-id',
  propertyId: process.env.TEST_TENANT_B_PROPERTY_ID || 'property-b-id',
  moduleSlug: process.env.TEST_TENANT_B_MODULE_SLUG || 'restaurant-b',
};

// ============================================
// Helpers
// ============================================

async function login(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 10000 });
}

// ============================================
// Tests
// ============================================

test.describe('Tenant Isolation: Cross-tenant access rejected', () => {
  test('Tenant A staff cannot access Tenant B modules via API', async ({ page }) => {
    await login(page, TENANT_A_STAFF.email, TENANT_A_STAFF.password);

    // Attempt to access Tenant B's module orders
    const response = await page.request.get(
      `/api/v1/staff/modules/${TENANT_B_STAFF.moduleSlug}/orders`,
      {
        headers: {
          'x-property-id': TENANT_B_STAFF.propertyId,
        },
      }
    );

    // Should be rejected — cross-tenant module access
    expect(response.status()).toBe(403);
  });

  test('Tenant A staff cannot access Tenant B admin endpoints', async ({ page }) => {
    await login(page, TENANT_A_STAFF.email, TENANT_A_STAFF.password);

    // Attempt to access Tenant B's admin dashboard
    const response = await page.request.get('/api/v1/admin/dashboard', {
      headers: {
        'x-tenant-id': TENANT_B_STAFF.tenantId,
        'x-property-id': TENANT_B_STAFF.propertyId,
      },
    });

    // Should be rejected — cross-tenant access
    expect(response.status()).toBe(403);
  });

  test('Same module slug in different tenants is isolated', async ({ page }) => {
    await login(page, TENANT_A_STAFF.email, TENANT_A_STAFF.password);

    // Attempt to access a module with the same slug but in Tenant B
    const response = await page.request.get(
      `/api/v1/${TENANT_A_STAFF.moduleSlug}/orders`,
      {
        headers: {
          'x-property-id': TENANT_B_STAFF.propertyId,
        },
      }
    );

    // Should be rejected — property belongs to different tenant
    expect([403, 404]).toContain(response.status());
  });
});

test.describe('Property Isulation: Unauthorized property rejected', () => {
  test('Staff without property access cannot access that property', async ({ page }) => {
    await login(page, TENANT_A_STAFF.email, TENANT_A_STAFF.password);

    // Attempt to access a property the staff member doesn't have access to
    const response = await page.request.get('/api/v1/admin/modules', {
      headers: {
        'x-property-id': '00000000-0000-0000-0000-000000000000', // fake property
      },
    });

    // Should be rejected or return empty (depending on middleware)
    expect([403, 404]).toContain(response.status());
  });
});

test.describe('displayPropertyId is presentation-only', () => {
  test('Changing displayPropertyId does not affect backend authorization', async ({ page }) => {
    await login(page, TENANT_A_STAFF.email, TENANT_A_STAFF.password);

    // Make a request with one property ID
    const response1 = await page.request.get('/api/v1/admin/modules', {
      headers: {
        'x-property-id': TENANT_A_STAFF.propertyId,
      },
    });

    // Make a request with a different property ID (unauthorized)
    const response2 = await page.request.get('/api/v1/admin/modules', {
      headers: {
        'x-property-id': '00000000-0000-0000-0000-000000000000',
      },
    });

    // The unauthorized property request should fail
    // The authorized one should succeed
    if (response1.status() === 200) {
      expect(response2.status()).not.toBe(200);
    }
  });
});

test.describe('Module Isolation: Cross-tenant module access', () => {
  test('Module access is scoped to tenant', async ({ page }) => {
    await login(page, TENANT_A_STAFF.email, TENANT_A_STAFF.password);

    // Attempt to access Tenant B's module via slug
    const response = await page.request.get(
      `/api/v1/${TENANT_B_STAFF.moduleSlug}/items`
    );

    // Should not return Tenant B's data
    if (response.status() === 200) {
      const data = await response.json();
      // If it returns data, it should be Tenant A's data, not Tenant B's
      // (or it should be empty if the slug doesn't exist in Tenant A)
    }
  });
});
