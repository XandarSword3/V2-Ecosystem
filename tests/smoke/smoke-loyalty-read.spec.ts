import { test, expect } from '../fixtures/auth.fixture';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3005';

test.describe('Smoke 03 - Loyalty Points Read', () => {
  test('SMOKE-03 @smoke customer can read loyalty points', async ({ request, auth }) => {
    const customerToken = await auth.getApiToken('customer');

    const response = await request.get(`${API_BASE_URL}/api/v1/loyalty/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body?.success).toBe(true);

    const account = body?.data || {};
    const points =
      account.available_points ??
      account.current_points ??
      account.loyalty_points ??
      account.lifetime_points;

    expect(typeof points).toBe('number');
    expect(points).toBeGreaterThanOrEqual(0);
  });
});