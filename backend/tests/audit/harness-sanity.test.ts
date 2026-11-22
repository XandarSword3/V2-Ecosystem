import { describe, it, expect } from 'vitest';
import { login, api } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A } from './fixtures';

/**
 * Harness sanity (expected GREEN). If this file fails, the red proofs next to
 * it are not measuring the application — they are measuring a broken fixture.
 */
describe('audit harness sanity', () => {
  it('backend is healthy and fixtures are live', async () => {
    const health = await fetch('http://127.0.0.1:3199/health');
    expect(health.status).toBe(200);

    const auth = await login(EMAILS.managerA, PASSWORD, TENANT_SLUG_A);

    const control = await api('GET', '/admin/reports/overview?range=month', {
      token: auth.token,
      headers: { 'X-Tenant-ID': IDS.tenantA, 'X-Property-ID': IDS.propertyA },
    });
    expect(control.status).toBe(200);
    expect(control.body?.data?.overview?.totalRevenue).toBe(100);
  });
});
