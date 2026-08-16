/**
 * 00-infrastructure/system-starts.spec.ts
 *
 * Layer 0 — can both servers actually respond?
 *
 * These hit the backend and frontend directly via the Playwright request fixture
 * (no browser). If these fail it means a server isn't running, not a test bug.
 *
 * NOTE: The request fixture uses Node.js DNS, not the browser's resolver.
 * Node.js on Windows does not reliably resolve *.localhost (no system resolver
 * fallback). All request-fixture calls therefore use localhost:3000 / localhost:3005
 * directly. Subdomain routing is verified by the browser tests in
 * subdomains-resolve.spec.ts, not here.
 */

import { test, expect } from '@playwright/test';

test.describe('Layer 0 — Servers are up', () => {

  test('backend health endpoint responds', async ({ request }) => {
    const res = await request.get('http://localhost:3005/api/health');
    // 200 = healthy, 503 = degraded but running — both mean the server is up
    expect([200, 503]).toContain(res.status());
  });

  test('backend returns JSON on health check', async ({ request }) => {
    const res = await request.get('http://localhost:3005/api/health');
    const body = await res.json().catch(() => null);
    expect(body).not.toBeNull();
  });

  test('frontend process is listening on port 3000', async ({ request }) => {
    // Bare localhost returns 404 from the middleware (by design — no tenant identity).
    // 404 still means the server is up and responding. That is all this test checks.
    const res = await request.get('http://localhost:3000');
    expect([200, 404]).toContain(res.status());
  });

  test('backend API v1 root responds', async ({ request }) => {
    // This endpoint returns version info — confirms the router is mounted
    const res = await request.get('http://localhost:3005/api/v1', {
      headers: { 'x-tenant-slug': 'platform' }
    });
    expect([200, 401, 404]).toContain(res.status()); // Any of these = server is routing
  });

});
