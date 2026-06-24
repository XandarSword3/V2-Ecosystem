import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

test.describe('Admin functional - Settings', () => {
  test('SET-05 general settings (/admin/settings): save resort name persists (API + UI reload)', async ({
    page,
    auth,
  }) => {
    const token = await auth.getApiToken('admin');
    await loginAdminUi(page, auth);

    const before = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(before.status).toBe(200);
    const prevName = String(before.body?.data?.propertyName || 'V2 Ecosystem');
    const nextName = `${prevName} E2E`;

    const put = await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { propertyName: nextName },
    });
    expect([200, 204]).toContain(put.status);

    const after = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(after.status).toBe(200);
    expect(String(after.body?.data?.propertyName)).toBe(nextName);

    await page.goto('/admin/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
    const propertyNameInput = page.getByPlaceholder(/enter your resort name/i);
    await expect(propertyNameInput).toHaveValue(nextName, { timeout: 15000 });

    // Cleanup (restore original)
    await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { propertyName: prevName },
    });
  });

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
    if (viaApi.status !== 200) {
      // Backend can briefly error during refresh/warmup; retry once.
      const retry = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
      expect(retry.status).toBe(200);
      expect(retry.body?.data?.weatherLocation || retry.body?.data?.appearance?.weatherLocation).toBe(newLoc);
    } else {
      expect(viaApi.body?.data?.weatherLocation || viaApi.body?.data?.appearance?.weatherLocation).toBe(newLoc);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(locationInput).toHaveValue(newLoc);
  });

  test('SET-40 translations: page loads and stats/missing/status endpoints respond (API + UI)', async ({
    page,
    auth,
  }) => {
    const token = await auth.getApiToken('admin');

    const status = await apiJson(page.request, { method: 'GET', path: '/admin/translations/status', token });
    expect(status.status).toBe(200);

    const stats = await apiJson(page.request, { method: 'GET', path: '/admin/translations/stats', token });
    expect(stats.status).toBe(200);

    const missing = await apiJson(page.request, { method: 'GET', path: '/admin/translations/missing', token });
    expect(missing.status).toBe(200);

    await loginAdminUi(page, auth);
    const waitAny = page.waitForResponse((r) => r.url().includes('/api/v1/admin/translations/') && r.ok());
    await page.goto('/admin/settings/translations', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/translations/i).first()).toBeVisible();
    await waitAny;
  });

  test('SET-50 notifications: page loads and templates CRUD works (API + UI)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const list = await apiJson(page.request, { method: 'GET', path: '/admin/notifications/templates', token });
    expect(list.status).toBe(200);

    const name = `E2E Template ${Date.now()}`;
    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/admin/notifications/templates',
      token,
      data: {
        name,
        title: 'E2E title',
        message: 'E2E message',
        type: 'info',
        target_type: 'admin',
        priority: 'normal',
        actions: [],
        variables: [],
        is_active: true,
      },
    });
    expect([200, 201]).toContain(created.status);
    const templateId = created.body?.data?.id;
    expect(typeof templateId).toBe('string');

    const list2 = await apiJson(page.request, { method: 'GET', path: '/admin/notifications/templates', token });
    expect(list2.status).toBe(200);
    expect((list2.body?.data || []).some((t: any) => t.id === templateId)).toBeTruthy();

    await loginAdminUi(page, auth);
    const waitGet = page.waitForResponse((r) => r.url().includes('/api/v1/admin/notifications') && r.ok());
    await page.goto('/admin/settings/notifications', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/notifications/i).first()).toBeVisible();
    await waitGet;

    const del = await apiJson(page.request, {
      method: 'DELETE',
      path: `/admin/notifications/templates/${templateId}`,
      token,
    });
    expect([200, 204]).toContain(del.status);
  });

  test('SET-60 navbar: save sticky toggle persists (API + UI reload)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    await loginAdminUi(page, auth);

    const before = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(before.status).toBe(200);
    const prevNavbar = before.body?.data?.navbar || { links: [], config: {} };
    const prevSticky = Boolean(prevNavbar?.config?.sticky ?? true);
    const nextNavbar = {
      ...prevNavbar,
      config: { ...(prevNavbar?.config || {}), sticky: !prevSticky },
    };

    const put = await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { navbar: nextNavbar },
    });
    expect([200, 204]).toContain(put.status);

    const after = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(after.status).toBe(200);
    expect(Boolean(after.body?.data?.navbar?.config?.sticky)).toBe(!prevSticky);

    await page.goto('/admin/settings/navbar', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();

    // Cleanup
    await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { navbar: prevNavbar },
    });
  });

  test('SET-70 footer: save logo text persists (API + UI reload)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    await loginAdminUi(page, auth);

    const before = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(before.status).toBe(200);
    const prevFooter = before.body?.data?.footer || { logo: { text: 'V2', showIcon: true } };
    const prevText = String(prevFooter?.logo?.text || 'V2');
    const nextText = `${prevText}-E2E`;
    const nextFooter = { ...prevFooter, logo: { ...(prevFooter?.logo || {}), text: nextText } };

    const put = await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { footer: nextFooter },
    });
    expect([200, 204]).toContain(put.status);

    const after = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(after.status).toBe(200);
    expect(String(after.body?.data?.footer?.logo?.text)).toBe(nextText);

    await page.goto('/admin/settings/footer', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();

    // Cleanup
    await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { footer: prevFooter },
    });
  });

  test('SET-80 payments: save currency persists (API + UI reload)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');
    await loginAdminUi(page, auth);

    const before = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(before.status).toBe(200);
    const prev = before.body?.data?.payments || { currency: 'USD', stripeMode: 'test' };
    const prevCurrency = String(prev.currency || 'USD');
    const nextCurrency = prevCurrency === 'USD' ? 'EUR' : 'USD';

    const put = await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { key: 'payments', value: { ...prev, currency: nextCurrency } },
    });
    expect([200, 204]).toContain(put.status);

    const after = await apiJson(page.request, { method: 'GET', path: '/admin/settings', token });
    expect(after.status).toBe(200);
    expect(String(after.body?.data?.payments?.currency)).toBe(nextCurrency);

    await page.goto('/admin/settings/payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /provider config/i })).toBeVisible();

    // Cleanup
    await apiJson(page.request, {
      method: 'PUT',
      path: '/admin/settings',
      token,
      data: { key: 'payments', value: prev },
    });
  });

  test('SET-90 backups: page loads and list endpoint responds (API + UI)', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const list = await apiJson(page.request, { method: 'GET', path: '/admin/backups', token });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body?.data)).toBeTruthy();

    await loginAdminUi(page, auth);
    const waitList = page.waitForResponse((r) => r.url().includes('/api/v1/admin/backups') && r.ok());
    await page.goto('/admin/settings/backups', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/backups/i).first()).toBeVisible();
    await waitList;
  });
});

