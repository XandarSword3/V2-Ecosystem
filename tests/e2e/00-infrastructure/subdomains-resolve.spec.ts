/**
 * 00-infrastructure/subdomains-resolve.spec.ts
 *
 * Layer 0 — does the routing layer actually work?
 *
 * These tests require NO auth, NO seeded data beyond what global-setup provides.
 * They test the middleware's classifyHost() logic against a real running frontend.
 *
 * All URLs use *.localhost (not *.v2platform.local). Chrome/Chromium resolves
 * anything.localhost to 127.0.0.1 natively — no hosts file entries required.
 * This means the 'unknown subdomain' test can use a genuinely non-existent
 * subdomain and get a real 404 from Next.js rather than a DNS crash.
 *
 * If ANY of these fail, stop. Nothing above Layer 0 is meaningful until routing works.
 */

import { test, expect } from '@playwright/test';

test.describe('Layer 0 — Subdomain routing', () => {

  test('bare localhost is hard-blocked (404)', async ({ page }) => {
    // middleware.ts classifies localhost (no subdomain) as 'unresolved' and returns 404.
    // Intentional — bare localhost carries no tenant identity.
    const response = await page.goto('http://localhost:3000');
    expect(response?.status()).toBe(404);
  });

  test('platform.localhost serves content (200)', async ({ page }) => {
    // platform.localhost is the platform tier — always exists, seeded by migration.
    const response = await page.goto('http://platform.localhost:3000');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('testcorp.localhost serves content (200)', async ({ page }) => {
    // testcorp is seeded by global-setup as a trialing tenant.
    const response = await page.goto('http://testcorp.localhost:3000');
    expect(response?.status()).toBe(200);
  });

  test('unknown subdomain returns 404', async ({ page }) => {
    // No tenant with subdomain 'doesnotexist123' exists in the DB.
    // Chrome resolves doesnotexist123.localhost → 127.0.0.1 natively,
    // so the request reaches Next.js. The middleware classifies it as
    // tenant tier, finds no matching tenant, and returns 404.
    const response = await page.goto('http://doesnotexist123.localhost:3000');
    expect(response?.status()).toBe(404);
  });

  test('/platform-admin is accessible on platform tier (not 404)', async ({ page }) => {
    // Should reach the auth gate and redirect to /login — not 404.
    const response = await page.goto('http://platform.localhost:3000/platform-admin');
    // Unauthenticated users get redirected to /login (200 after redirect).
    // What it must NOT be: 404 or 500.
    expect([200, 302]).toContain(response?.status());
    expect(page.url()).toMatch(/\/login|\/platform-admin/);
  });

  test('/platform-admin is hard-blocked on tenant tier (404)', async ({ page }) => {
    // middleware.ts explicitly 404s /platform-admin requests on non-platform hosts.
    const response = await page.goto('http://testcorp.localhost:3000/platform-admin');
    expect(response?.status()).toBe(404);
  });

});
