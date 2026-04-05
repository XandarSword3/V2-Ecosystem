import { test, expect } from '../fixtures/auth.fixture';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_URL || 'http://localhost:3005';

test.describe('Smoke 01 - Login Session Persistence', () => {
  test('SMOKE-01 @smoke customer login token survives reload', async ({ page, request, auth }) => {
    const accessToken = await auth.getApiToken('customer');

    const meResponse = await request.get(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meResponse.status()).toBe(200);
    const meBody = await meResponse.json();
    const user = meBody?.data;
    expect(user).toBeTruthy();

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ token, userData }) => {
      localStorage.setItem('accessToken', token);
      if (!localStorage.getItem('refreshToken')) {
        localStorage.setItem('refreshToken', 'smoke-refresh-token');
      }
      localStorage.setItem('user', JSON.stringify(userData));
    }, { token: accessToken, userData: user });

    await page.goto(`${FRONTEND_URL}/account/loyalty`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login(\?|$)/i);

    const tokenBeforeReload = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(tokenBeforeReload).toBe(accessToken);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login(\?|$)/i);

    const tokenAfterReload = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(tokenAfterReload).toBe(accessToken);
  });
});