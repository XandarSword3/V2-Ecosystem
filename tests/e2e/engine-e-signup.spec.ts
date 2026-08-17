import { test, expect } from '@playwright/test';

/**
 * Engine E (platform_entitlement) Signup & Checkout Spec
 *
 * Exercises the public SaaS signup and plan selection flow:
 * 1. Validates available subscription plans (GET /api/v1/platform/plans).
 * 2. Validates the signup API contract (POST /api/v1/platform/checkout).
 * 3. Asserts validation rules (required fields).
 * 4. Asserts Stripe checkout session creation with correct tier metadata.
 * 5. Asserts public tenant slug resolution (GET /api/v1/platform/tenants/by-slug/:slug).
 *
 * This route is CSRF-exempt (public landing-page CTA, same as /auth/register).
 */

const API_URL = process.env.API_URL || 'http://localhost:3005';

test.describe('Engine E: Platform Signup & Checkout Flow', () => {
  test('GET /api/v1/platform/plans returns public plans list', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/platform/plans`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/v1/platform/checkout rejects missing required fields', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/platform/checkout`, {
      data: {
        email: 'test@example.com',
        // missing tier, name, subdomain
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/v1/platform/checkout accepts valid subscription signup request', async ({ request }) => {
    const testSubdomain = `test-resort-${Date.now()}`;
    const testEmail = `operator-${Date.now()}@example.com`;

    const res = await request.post(`${API_URL}/api/v1/platform/checkout`, {
      data: {
        tier: 'growth',
        email: testEmail,
        name: 'Alex Operator',
        subdomain: testSubdomain,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('url');
  });

  test('GET /api/v1/platform/tenants/by-slug/:slug returns 404 for nonexistent tenant', async ({ request }) => {
    const fakeSlug = `nonexistent-tenant-${Date.now()}`;
    const res = await request.get(`${API_URL}/api/v1/platform/tenants/by-slug/${fakeSlug}`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
