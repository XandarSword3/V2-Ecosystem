import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

const API_URL = process.env.API_URL || 'http://localhost:3005';

test.describe('Admin functional - Reports', () => {
  test('RPT-10 overview loads and export returns non-empty payload (API + UI)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const overview = await apiJson(page.request, { method: 'GET', path: '/admin/reports/overview', token });
    expect(overview.status).toBe(200);
    expect(overview.body?.data).toBeTruthy();

    // API export (csv)
    const exportResp = await page.request.get(
      `${API_URL}/api/v1/admin/reports/export?type=menu service&format=csv&range=month`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(exportResp.ok()).toBeTruthy();
    const buf = await exportResp.body();
    expect(buf.byteLength).toBeGreaterThan(10);

    // UI: analytics page loads and clicking Export All triggers the export endpoint.
    await loginAdminUi(page, auth);
    await page.goto('/admin/reports/analytics', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const waitUiExport = page.waitForResponse((r) => r.url().includes('/api/v1/admin/reports/export') && r.request().method() === 'GET');
    await page.getByRole('button', { name: /export all/i }).click();
    const uiResp = await waitUiExport;
    expect(uiResp.ok()).toBeTruthy();
  });
});

