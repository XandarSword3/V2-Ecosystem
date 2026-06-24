import { test } from '../fixtures/auth.fixture';

function toApiPath(url: string) {
  // Example:
  // - http://localhost:3005/api/v1/admin/audit-logs -> /admin/audit-logs
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/api\/v1/, '');
  } catch {
    return url;
  }
}

async function waitForApiRequest(page: any, opts: { method: string; apiPath: string; timeoutMs?: number }) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const { method, apiPath } = opts;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      page.off('request', onReq);
      reject(new Error(`Timed out waiting for ${method} /api/v1${apiPath}`));
    }, timeoutMs);

    const onReq = (req: any) => {
      if (req.method() !== method) return;
      const reqPath = toApiPath(req.url());
      if (reqPath !== apiPath) return;

      clearTimeout(timeout);
      page.off('request', onReq);
      resolve(req);
    };

    page.on('request', onReq);
  });
}

test.describe('SMOKE - Admin button wiring (refresh)', () => {
  test('SMOKE-10 @smoke audit refresh calls GET /admin/audit-logs', async ({ page, auth }) => {
    await auth.loginAs('admin');
    await page.goto('/admin/audit', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 15000 });

    const wait = waitForApiRequest(page, { method: 'GET', apiPath: '/admin/audit-logs' });
    await refreshBtn.click();
    await wait;
  });

  test('SMOKE-11 @smoke reviews refresh calls GET /reviews/admin', async ({ page, auth }) => {
    await auth.loginAs('admin');
    await page.goto('/admin/reviews', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 15000 });

    const wait = waitForApiRequest(page, { method: 'GET', apiPath: '/reviews/admin' });
    await refreshBtn.click();
    await wait;
  });

  test('SMOKE-12 @smoke customizations refresh calls GET /customizations/groups', async ({ page, auth }) => {
    await auth.loginAs('admin');
    await page.goto('/admin/customizations', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 15000 });

    const wait = waitForApiRequest(page, { method: 'GET', apiPath: '/customizations/groups' });
    await refreshBtn.click();
    await wait;
  });

  test('SMOKE-13 @smoke dynamic-menu refresh calls GET /${slug}/modifiers', async ({ page, auth }) => {
    await auth.loginAs('admin');
    await page.goto('/admin/${slug}/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 15000 });

    const wait = waitForApiRequest(page, { method: 'GET', apiPath: '/${slug}/modifiers' });
    await refreshBtn.click();
    await wait;
  });

  test('SMOKE-14 @smoke pool capacity refresh calls GET /pool/staff/capacity', async ({ page, auth }) => {
    await auth.loginAs('admin');
    await page.goto('/admin/pool/capacity', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 15000 });

    const wait = waitForApiRequest(page, { method: 'GET', apiPath: '/pool/staff/capacity' });
    await refreshBtn.click();
    await wait;
  });

  test('SMOKE-15 @smoke loyalty refresh calls GET /loyalty/tiers', async ({ page, auth }) => {
    await auth.loginAs('admin');
    await page.goto('/admin/loyalty', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 15000 });

    const wait = waitForApiRequest(page, { method: 'GET', apiPath: '/loyalty/tiers' });
    await refreshBtn.click();
    await wait;
  });

  test('SMOKE-16 @smoke reports analytics refresh calls GET /admin/reports/overview', async ({ page, auth }) => {
    await auth.loginAs('admin');
    await page.goto('/admin/reports/analytics', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 15000 });

    const wait = waitForApiRequest(page, { method: 'GET', apiPath: '/admin/reports/overview' });
    await refreshBtn.click();
    await wait;
  });
});

