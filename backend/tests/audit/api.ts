import fs from 'fs';
import path from 'path';

export const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3199/api/v1';
const EVIDENCE = path.resolve(process.cwd(), '../../docs/audit-evidence/tests');

export type Auth = { token: string; userId: string; scope: string };

export async function login(email: string, password: string, tenantSlug: string): Promise<Auth> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
    body: JSON.stringify({ email, password }),
  });
  const body: any = await res.json().catch(() => ({}));
  const token = body?.data?.tokens?.accessToken || body?.tokens?.accessToken;
  if (!res.ok || !token) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  return { token, userId: body?.data?.user?.id, scope: body?.data?.user?.scope };
}

export async function api(
  method: string,
  route: string,
  opts: { token?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; body: any; raw: string }> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${route}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const raw = await res.text();
  let body: any = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body, raw };
}

/** Append one evidence record per call so a later context reset can read the proof. */
export function record(file: string, payload: unknown): void {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const target = path.join(EVIDENCE, file);
  let rows: unknown[] = [];
  if (fs.existsSync(target)) {
    try {
      rows = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch {
      rows = [];
    }
  }
  rows.push({ at: new Date().toISOString(), ...(payload as object) });
  fs.writeFileSync(target, JSON.stringify(rows, null, 2), 'utf8');
}
