import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

const PROPERTY_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Admin functional - Misc (Channels + Reviews + Audit)', () => {
  test('MSC-10 channels: create connection (API) + render + disconnect (UI) updates list', async ({
    page,
    auth,
  }) => {
    const token = await auth.getApiToken('admin');

    // Reuse existing BOOKING connection if present to avoid uniqueness collisions.
    const preList = await apiJson(page.request, {
      method: 'GET',
      path: `/channels/properties/${PROPERTY_ID}/connections`,
      token,
    });
    expect(preList.status).toBe(200);
    const existing = (preList.body?.connections || []).find((c: any) => c.channel_code === 'BOOKING');

    let connectionId: string;
    if (existing?.id) {
      connectionId = existing.id;
    } else {
      const create = await apiJson(page.request, {
        method: 'POST',
        path: `/channels/properties/${PROPERTY_ID}/connections`,
        token,
        data: {
          channel_code: 'BOOKING',
          hotel_code: `E2E-${Date.now()}`,
        },
      });
      expect(create.status).toBe(201);
      connectionId = create.body?.connection?.id;
      expect(typeof connectionId).toBe('string');
    }

    // Ensure the UI shows a "connected" channel card (disconnect action only renders for connected).
    await apiJson(page.request, {
      method: 'POST',
      path: `/channels/connections/${connectionId}/activate`,
      token,
    });

    const list1 = await apiJson(page.request, {
      method: 'GET',
      path: `/channels/properties/${PROPERTY_ID}/connections`,
      token,
    });
    expect(list1.status).toBe(200);
    const ids1 = (list1.body?.connections || []).map((c: any) => c.id);
    expect(ids1).toContain(connectionId);

    await loginAdminUi(page, auth);
    await page.goto('/admin/channels', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /channel manager/i })).toBeVisible();

    // The UI names channels based on channel_code; we only assert the Booking.com card is present.
    await expect(page.getByRole('heading', { name: /booking\.com/i })).toBeVisible();

    // Disconnect uses a confirm() then DELETE /channels/connections/:id.
    // The UI might render multiple "Disconnect" buttons; capture the actual deleted id from the request URL.
    const waitDelete = page.waitForResponse((r) => {
      if (r.request().method() !== 'DELETE') return false;
      return /\/api\/v1\/channels\/connections\/[^/]+$/.test(r.url());
    });
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /disconnect/i }).first().click({ timeout: 30000 });
    const delResp = await waitDelete;
    expect(delResp.ok()).toBeTruthy();
    const deletedId = delResp.url().split('/').pop();
    expect(typeof deletedId).toBe('string');

    const list2 = await apiJson(page.request, {
      method: 'GET',
      path: `/channels/properties/${PROPERTY_ID}/connections`,
      token,
    });
    expect(list2.status).toBe(200);
    const ids2 = (list2.body?.connections || []).map((c: any) => c.id);
    expect(ids2).not.toContain(deletedId);
  });

  test('MSC-20 reviews: create (API) + approve (UI) persists', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const create = await apiJson(page.request, {
      method: 'POST',
      path: '/reviews',
      token,
      data: {
        rating: 5,
        text: `E2E review ${Date.now()}`,
        service_type: 'general',
      },
    });
    let reviewId: string | null = null;
    if (![200, 201].includes(create.status)) {
      throw new Error(`POST /reviews failed: HTTP ${create.status} ${JSON.stringify(create.body)}`);
    }
    reviewId = create.body?.data?.id || create.body?.review?.id || create.body?.id;
    expect(typeof reviewId).toBe('string');

    // Verify it shows up in admin list API.
    const list = await apiJson(page.request, { method: 'GET', path: '/reviews/admin', token });
    expect(list.status).toBe(200);
    const listItems = list.body?.data || list.body?.reviews || [];
    const listIds = listItems.map((r: any) => r.id);
    expect(listIds).toContain(reviewId);

    await loginAdminUi(page, auth);
    await page.goto('/admin/reviews', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /reviews/i })).toBeVisible();

    const waitApprove = page.waitForResponse(
      (r) => r.url().includes(`/api/v1/reviews/${reviewId}/approve`) && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /approve/i }).first().click();
    const approveResp = await waitApprove;
    expect(approveResp.ok()).toBeTruthy();

    const list2 = await apiJson(page.request, { method: 'GET', path: '/reviews/admin', token });
    expect(list2.status).toBe(200);
    const updated = (list2.body?.data || []).find((r: any) => r.id === reviewId);
    expect(updated).toBeTruthy();
    expect(Boolean(updated.is_approved)).toBeTruthy();
  });

  test('MSC-30 audit: page renders and refresh hits API', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const api = await apiJson(page.request, { method: 'GET', path: '/admin/audit-logs', token });
    expect(api.status).toBe(200);
    expect(Array.isArray(api.body?.data)).toBeTruthy();

    await loginAdminUi(page, auth);
    const waitAudit = page.waitForResponse(
      (r) => r.url().includes('/api/v1/admin/audit-logs') && r.request().method() === 'GET',
    );
    await page.goto('/admin/audit', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /audit logs/i })).toBeVisible();
    const resp = await waitAudit;
    expect(resp.ok()).toBeTruthy();
  });
});

