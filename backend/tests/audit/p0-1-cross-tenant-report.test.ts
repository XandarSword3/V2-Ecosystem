import { describe, it, expect, beforeAll } from 'vitest';
import { login, api, record } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A } from './fixtures';

/**
 * P0-1 — client-controlled tenant/property headers.
 *
 * Desired behaviour: a manager authenticated in tenant A who sends tenant B's
 * X-Tenant-ID / X-Property-ID must be rejected (403). Today the request is
 * served and tenant B's revenue is returned, so this test fails.
 */
describe('P0-1 cross-tenant report read via headers', () => {
  let token = '';

  beforeAll(async () => {
    const auth = await login(EMAILS.managerA, PASSWORD, TENANT_SLUG_A);
    token = auth.token;
  });

  it('rejects a manager from tenant A reading tenant B revenue', async () => {
    const exploit = await api('GET', '/admin/reports/overview?range=month', {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantB, 'X-Property-ID': IDS.propertyB },
    });

    const control = await api('GET', '/admin/reports/overview?range=month', {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantA, 'X-Property-ID': IDS.propertyA },
    });

    record('p0-1-evidence.json', {
      exploitStatus: exploit.status,
      exploitRevenue: exploit.body?.data?.overview?.totalRevenue,
      controlStatus: control.status,
      controlRevenue: control.body?.data?.overview?.totalRevenue,
      exploitBody: exploit.body,
    });

    expect(control.status).toBe(200);
    expect(exploit.status).toBe(403);
    expect(exploit.body?.data?.overview?.totalRevenue).not.toBe(4342.42);
  });
});
