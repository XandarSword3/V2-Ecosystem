import { describe, it, expect, beforeAll } from 'vitest';
import { login, api, record } from './api';
import { EMAILS, IDS, PASSWORD, TENANT_SLUG_A } from './fixtures';

/**
 * P0-2 — billing-portal route reachable by any authenticated principal.
 *
 * Desired behaviour:
 *   1. A plain customer may not address another tenant's billing portal (403),
 *      regardless of the X-Tenant-ID header.
 *   2. A plain customer may not address their *own* tenant's billing portal
 *      either — the portal mints a Stripe session for the tenant, which is a
 *      staff/operator action, not a guest action.
 *   3. Tenant staff still reach the handler. Both fixture tenants have
 *      stripe_customer_id NULL, so the handler's own "no billing account"
 *      branch answers 404. That 404 is the control: it proves the guard did
 *      not over-reject, *and* it proves no external Stripe call happens.
 *
 * Before the fix every case below reached getBillingPortal: the cross-tenant
 * request passed because the tenant came from the header, and the customer
 * requests passed because there was no role guard at all.
 */
describe('P0-2 billing portal authorisation', () => {
  let customerToken = '';
  let managerToken = '';

  beforeAll(async () => {
    const customer = await login(EMAILS.customerA, PASSWORD, TENANT_SLUG_A);
    customerToken = customer.token;
    const manager = await login(EMAILS.managerA, PASSWORD, TENANT_SLUG_A);
    managerToken = manager.token;
  });

  it('rejects a customer asking for tenant B billing portal', async () => {
    const res = await api('GET', '/platform/billing/portal', {
      token: customerToken,
      headers: { 'X-Tenant-ID': IDS.tenantB },
    });

    record('p0-2-evidence.json', {
      case: 'customer-cross-tenant',
      status: res.status,
      body: res.body,
      note: 'tenant B stripe_customer_id is NULL, so a 404 here means the request passed authentication AND tenant resolution',
    });

    // 403 (or 401) is acceptable; 200/404/500 means the route was reached.
    expect([401, 403]).toContain(res.status);
  });

  it('rejects a customer asking for their own tenant billing portal', async () => {
    const res = await api('GET', '/platform/billing/portal', {
      token: customerToken,
      headers: { 'X-Tenant-ID': IDS.tenantA },
    });

    record('p0-2-evidence.json', {
      case: 'customer-same-tenant',
      status: res.status,
      body: res.body,
      note: 'explicit tenant A header matches the customer token tenant, so tenant binding passes; only the role guard can reject',
    });

    expect(res.status).toBe(403);
    expect(String(res.body?.error || '')).toMatch(/restricted to tenant staff/i);
  });

  it('lets tenant staff reach the handler (control: 404, no billing account)', async () => {
    const res = await api('GET', '/platform/billing/portal', {
      token: managerToken,
      headers: { 'X-Tenant-ID': IDS.tenantA },
    });

    record('p0-2-evidence.json', {
      case: 'manager-control',
      status: res.status,
      body: res.body,
      note: 'tenant A stripe_customer_id is NULL, so a 404 is the handler answering — the guard allowed staff through',
    });

    expect(res.status).toBe(404);
    expect(String(res.body?.error || '')).toMatch(/no billing account/i);
  });
});
