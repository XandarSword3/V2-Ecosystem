import { describe, it, expect, beforeAll } from 'vitest';
import { login, api, record } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A } from './fixtures';

/**
 * P0-6 — checked-in rooms: unscoped transaction query plus ambiguous embed.
 *
 * The secure contract is: staff in tenant A/property A calling module A get
 * 200 with only their own guests. Today PostgREST aborts the request with 500
 * ("more than one relationship was found for 'transactions' and 'users'"), and
 * the underlying query has no tenant/property predicate either. The test encodes
 * the contract; it fails today on the 500 and would still fail if an unscoped
 * query ever returned tenant B's guest (the marker string below).
 */
describe('P0-6 checked-in rooms scoping', () => {
  let token = '';

  beforeAll(async () => {
    const auth = await login(EMAILS.staffA, PASSWORD, TENANT_SLUG_A);
    token = auth.token;
  });

  it('returns 200 and never exposes tenant B guest data', async () => {
    const res = await api('GET', '/staff/modules/audit-probe-a/checked-in-rooms', {
      token,
      headers: { 'X-Tenant-ID': IDS.tenantA, 'X-Property-ID': IDS.propertyA },
    });

    record('p0-6-evidence.json', { status: res.status, body: res.body, raw: res.raw });

    expect(res.raw).not.toContain('AUDIT VICTIM GUEST');
    expect(res.status).toBe(200);
  });
});
