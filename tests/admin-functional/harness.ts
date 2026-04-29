import { expect, type Page, type APIRequestContext } from '@playwright/test';
import type { AuthRole } from '../fixtures/auth.fixture';

const API_URL = process.env.API_URL || 'http://localhost:3005';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function ensureCsrfCookie(request: APIRequestContext): Promise<string> {
  const resp = await request.get(`${API_URL}/api/csrf-token`);
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  const token = json?.csrfToken;
  expect(typeof token).toBe('string');
  return token;
}

export async function authHeadersFor(
  request: APIRequestContext,
  token: string,
): Promise<Record<string, string>> {
  const csrfToken = await ensureCsrfCookie(request);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  };
}

export async function apiJson(
  request: APIRequestContext,
  opts: {
    method: HttpMethod;
    path: string;
    token: string;
    data?: any;
    params?: Record<string, string | number | boolean | undefined>;
  },
): Promise<{ status: number; body: any }> {
  const url = new URL(`${API_URL}/api/v1${opts.path.startsWith('/') ? '' : '/'}${opts.path}`);
  for (const [k, v] of Object.entries(opts.params || {})) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  const headers = await authHeadersFor(request, opts.token);
  const resp =
    opts.method === 'GET'
      ? await request.get(url.toString(), { headers })
      : opts.method === 'DELETE'
        ? await request.delete(url.toString(), { headers, data: opts.data })
        : opts.method === 'POST'
          ? await request.post(url.toString(), { headers, data: opts.data })
          : opts.method === 'PUT'
            ? await request.put(url.toString(), { headers, data: opts.data })
            : await request.patch(url.toString(), { headers, data: opts.data });

  const status = resp.status();
  let body: any = null;
  const ct = resp.headers()['content-type'] || '';
  if (ct.includes('application/json')) {
    body = await resp.json();
  } else {
    body = await resp.text();
  }
  return { status, body };
}

export async function loginAdminUi(page: Page, auth: { loginAs: (role: Exclude<AuthRole, 'guest'>) => Promise<void> }) {
  await auth.loginAs('admin');
  // The admin area frequently fetches immediately after navigation; ensure the session is ready.
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
}

