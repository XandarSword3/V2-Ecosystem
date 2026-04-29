import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

test.describe('Admin functional - Integrations', () => {
  test('INT-10 integrations index renders and QuickBooks page hits status endpoint', async ({
    page,
    auth,
  }) => {
    const token = await auth.getApiToken('admin');

    // API contract: status endpoint exists and returns a boolean connected flag.
    const status = await apiJson(page.request, {
      method: 'GET',
      path: '/integrations/quickbooks/status',
      token,
    });
    expect(status.status).toBe(200);
    expect(typeof status.body?.connected).toBe('boolean');

    // UI contract: integrations index renders and offers QuickBooks config.
    await loginAdminUi(page, auth);
    await page.goto('/admin/integrations', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'QuickBooks' })).toBeVisible();
    await expect(page.getByRole('link', { name: /configure/i })).toBeVisible();

    // UI contract: QuickBooks page renders and requests status.
    const waitStatus = page.waitForResponse(
      (r) =>
        r.url().includes('/api/v1/integrations/quickbooks/status') && r.request().method() === 'GET',
    );
    await page.goto('/admin/integrations/quickbooks', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /quickbooks integration/i })).toBeVisible();
    const resp = await waitStatus;
    expect(resp.ok()).toBeTruthy();

    // If not connected, the page must offer a connect action (we don't run OAuth flow in tests).
    if (status.body?.connected === false) {
      await expect(page.getByRole('button', { name: /connect quickbooks/i })).toBeVisible();
    }
  });
});

