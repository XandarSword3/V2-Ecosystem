import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

test.describe('Admin functional - Settings', () => {
  test('SET-10 tax: save display name persists (API + UI reload)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    await loginAdminUi(page, auth);

    await page.goto('/admin/settings/tax', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Tax Configuration', exact: true })).toBeVisible();

    const newName = `E2E Tax ${Date.now()}`;
    const nameInput = page.locator('label:has-text("Tax Display Name")').locator('..').locator('input[type="text"]');
    await nameInput.fill(newName);

    const waitSave = page.waitForResponse((r) => r.url().includes('/api/v1/admin/settings/tax') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /save changes/i }).click();
    const resp = await waitSave;
    if (!resp.ok()) {
      throw new Error(`PUT /admin/settings/tax failed: HTTP ${resp.status()} ${await resp.text().catch(() => '')}`);
    }

    const viaApi = await apiJson(page.request, { method: 'GET', path: '/admin/settings/tax', token });
    expect(viaApi.status).toBe(200);
    expect(viaApi.body?.data?.tax_name_display).toBe(newName);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(nameInput).toHaveValue(newName);
  });

  test('SET-20 homepage: save CTA title persists (API + UI reload)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    await loginAdminUi(page, auth);

    await page.goto('/admin/settings/homepage', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /call to action/i }).click();

    const newTitle = `E2E CTA ${Date.now()}`;
    const ctaCard = page.getByRole('heading', { name: 'Call to Action Section', exact: true }).locator('..').locator('..');
    const titleInput = ctaCard.locator('input').first();
    await titleInput.fill(newTitle);

    const waitSave = page.waitForResponse((r) => r.url().includes('/api/v1/admin/settings/homepage') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /save changes/i }).click();
    const resp = await waitSave;
    if (!resp.ok()) {
      throw new Error(`PUT /admin/settings/homepage failed: HTTP ${resp.status()} ${await resp.text().catch(() => '')}`);
    }

    const viaApi = await apiJson(page.request, { method: 'GET', path: '/admin/settings/homepage', token });
    expect(viaApi.status).toBe(200);
    expect(viaApi.body?.data?.ctaTitle).toBe(newTitle);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /call to action/i }).click();
    await expect(titleInput).toHaveValue(newTitle);
  });

  test('SET-30 appearance: save weather location persists (API + UI reload)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    await loginAdminUi(page, auth);

    await page.goto('/admin/settings/appearance', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const weatherCard = page.getByRole('heading', { name: 'Weather Widget', exact: true }).locator('..').locator('..');
    const weatherLocationLabel = weatherCard.locator('label:has-text("Weather Location")');
    if ((await weatherLocationLabel.count()) === 0) {
      // Weather widget might be disabled in settings; toggle it on so the location input renders.
      await weatherCard.locator('button').first().click();
    }

    const newLoc = `E2E City ${Date.now()}`;
    const locationInput = weatherCard.locator('label:has-text("Weather Location")').locator('..').locator('input[type="text"]');
    await locationInput.waitFor({ state: 'visible', timeout: 30000 });
    await locationInput.fill(newLoc);

    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/settings saved|saved/i)).toBeVisible({ timeout: 20000 });

    const viaApi = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(viaApi.status).toBe(200);
    // settings controller flattens appearance keys to root as well.
    expect(viaApi.body?.data?.weatherLocation || viaApi.body?.data?.appearance?.weatherLocation).toBe(newLoc);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(locationInput).toHaveValue(newLoc);
  });
});

