import { test, expect } from '../fixtures/auth.fixture';
import { apiJson, loginAdminUi } from './harness';

test.describe('Admin functional - Marketing', () => {
  test('MKT-10 loyalty: create tier then UI shows it', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const tierName = `E2E Tier ${Date.now()}`;
    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/loyalty/tiers',
      token,
      data: {
        name: tierName,
        min_points: 123,
        points_multiplier: 1.2,
        benefits: { note: 'created-by-e2e' },
        color: '#a855f7',
        icon: 'Crown',
        is_active: true,
      },
    });
    expect([200, 201]).toContain(created.status);
    const tierId = created.body?.data?.id;
    expect(typeof tierId).toBe('string');

    const tiers = await apiJson(page.request, { method: 'GET', path: '/loyalty/tiers', token });
    expect(tiers.status).toBe(200);
    expect((tiers.body?.data || []).some((t: any) => t.id === tierId)).toBeTruthy();

    await loginAdminUi(page, auth);
    await page.goto('/admin/loyalty', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /tiers/i }).click();
    await expect(page.getByText(tierName).first()).toBeVisible({ timeout: 20000 });
  });

  test('MKT-20 coupons: create coupon then UI shows code', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const code = `E2E${Date.now()}`.slice(0, 12).toUpperCase();
    const name = `E2E Coupon ${Date.now()}`;
    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/coupons',
      token,
      data: {
        code,
        name,
        description: 'created-by-e2e',
        discountType: 'percentage',
        discountValue: 5,
        minOrderAmount: 0,
        appliesTo: 'all',
        perUserLimit: 1,
      },
    });
    expect([200, 201]).toContain(created.status);

    const list = await apiJson(page.request, { method: 'GET', path: '/coupons', token });
    expect(list.status).toBe(200);
    expect((list.body?.data || []).some((c: any) => c.code === code)).toBeTruthy();

    await loginAdminUi(page, auth);
    await page.goto('/admin/coupons', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="text"]').first().fill(code);
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 20000 });
  });

  test('MKT-30 giftcards: create gift card then UI shows it', async ({ page, auth }) => {
    const token = await auth.getApiToken('admin');

    const recipientEmail = `e2e.recipient.${Date.now()}@test.com`;
    const created = await apiJson(page.request, {
      method: 'POST',
      path: '/giftcards/admin',
      token,
      data: {
        initialValue: 25,
        recipientName: 'Test Recipient',
        recipientEmail,
        message: 'created-by-e2e',
      },
    });
    expect([200, 201]).toContain(created.status);
    const cardId = created.body?.data?.id;
    const code = created.body?.data?.code;
    expect(typeof cardId).toBe('string');
    expect(typeof code).toBe('string');

    const cards = await apiJson(page.request, { method: 'GET', path: '/giftcards/admin', token });
    expect(cards.status).toBe(200);
    expect((cards.body?.data || []).some((c: any) => c.id === cardId)).toBeTruthy();

    await loginAdminUi(page, auth);
    await page.goto('/admin/giftcards', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    // Codes may be hidden behind a visibility toggle; search by recipient email instead.
    await page.locator('input[type="text"]').first().fill(recipientEmail);
    await expect(page.getByText(recipientEmail).first()).toBeVisible({ timeout: 20000 });
  });
});

