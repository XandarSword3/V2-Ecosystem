import { test, expect } from '@playwright/test';

const API = 'http://localhost:3005/api/v1';
const API_BASE = 'http://localhost:3005/api';

test.describe('API Health Smoke [SYS-AUTH, SYS-PAY]', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@v2resort.com', password: 'admin123' },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    authToken = data.data?.tokens?.accessToken || data.token;
    expect(authToken).toBeTruthy();
  });

  test('restaurant menu API returns items', async ({ request }) => {
    const response = await request.get(`${API}/restaurant/menu/items`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('restaurant categories API responds', async ({ request }) => {
    const response = await request.get(`${API}/restaurant/menu/categories`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('chalets API returns listings', async ({ request }) => {
    const response = await request.get(`${API}/chalets`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('pool sessions API responds', async ({ request }) => {
    const response = await request.get(`${API}/pool/sessions`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('modules API returns list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/modules`);
    expect(response.status()).toBe(200);
  });

  test('admin dashboard API requires auth', async ({ request }) => {
    const response = await request.get(`${API}/admin/dashboard`);
    // Should reject without auth
    expect([401, 403]).toContain(response.status());
  });

  test('authenticated admin can access dashboard API', async ({ request }) => {
    const response = await request.get(`${API}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.status()).toBe(200);
  });

  test('users API requires auth', async ({ request }) => {
    const response = await request.get(`${API}/admin/users`);
    expect([401, 403]).toContain(response.status());
  });

  test('authenticated admin can access users API', async ({ request }) => {
    const response = await request.get(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
