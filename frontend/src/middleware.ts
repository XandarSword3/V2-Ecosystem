/**
 * middleware.ts
 *
 * Runs on every request before any page or API route is served.
 *
 * Responsibilities (in order):
 *
 * 1. Install gate — if the backend reports uninitialized, redirect to /install.
 *
 * 2. Subdomain → X-Tenant-Slug injection — extracts the subdomain from the
 *    Host header and injects it as X-Tenant-Slug so the backend tenantGate
 *    can resolve the correct tenant without requiring wildcard DNS to be
 *    configured first. Works in dev (e.g. acme.localhost) and production
 *    (e.g. acme.v2platform.com) alike.
 *
 *    Resolution rules:
 *      - Host = "localhost" | "127.0.0.1"         → no subdomain, skip
 *      - Host = "something.localhost"              → subdomain = "something"
 *      - Host = "tenant.v2platform.com"            → subdomain = "tenant"
 *      - Host = "vercel.app" preview URLs          → skip (not tenant-routed)
 *      - Host = bare domain (e.g. "v2platform.com") → skip (marketing site)
 *
 * 3. Platform-admin guard — /platform-admin/* is only accessible to users
 *    whose JWT carries isPlatformAdmin = true. Returns 403 for everyone else.
 *    Decoding happens without a signature check (edge runtime has no crypto
 *    module for HS256); the backend enforces the real check.
 */

import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Routes that bypass the install check entirely
const ALWAYS_ALLOW_PREFIXES = [
  '/install',
  '/_next',
  '/favicon',
  '/api',
  '/offline',
];

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOW_PREFIXES.some((p) => pathname.startsWith(p));
}

// ---------------------------------------------------------------------------
// Subdomain extractor
// ---------------------------------------------------------------------------

function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  const hostname = host.split(':')[0]; // strip port

  // Vercel preview URLs — not tenant-routed
  if (hostname.endsWith('.vercel.app')) return null;

  // Plain localhost — no tenant
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;

  // Dev: acme.localhost
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, hostname.lastIndexOf('.localhost'));
    return sub || null;
  }

  // Production: tenant.v2platform.com (or any custom domain with subdomain)
  const parts = hostname.split('.');
  if (parts.length <= 2) return null; // bare domain, no subdomain
  return parts[0];
}

// ---------------------------------------------------------------------------
// Lightweight JWT payload reader (no crypto — edge runtime only)
// ---------------------------------------------------------------------------

function readJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const installBypassEnabled = process.env.NEXT_PUBLIC_INSTALL_BYPASS === 'true';

  // ── 1. Platform-admin guard ─────────────────────────────────────────────
  if (pathname.startsWith('/platform-admin')) {
    const token =
      req.cookies.get('accessToken')?.value ??
      req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const payload = readJwtPayload(token);
    if (!payload?.isPlatformAdmin) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // ── 2. Always-allowed routes bypass everything else ─────────────────────
  if (isAlwaysAllowed(pathname)) {
    return injectTenantSlug(req, NextResponse.next());
  }

  // ── 3. Install bypass env flag ──────────────────────────────────────────
  if (installBypassEnabled) {
    return injectTenantSlug(req, NextResponse.next());
  }

  // ── 4. Install gate ─────────────────────────────────────────────────────
  const apiUrl = (
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api/v1'
  ).replace('/api/v1', '');

  try {
    const res = await fetch(`${apiUrl}/api/install/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const body = await res.json();
      const initialized: boolean = body?.data?.initialized ?? true;

      if (!initialized) {
        const installUrl = req.nextUrl.clone();
        installUrl.pathname = '/install';
        return NextResponse.redirect(installUrl);
      }
    }
  } catch {
    // Backend unreachable — allow through, page will surface the error.
  }

  // ── 5. Inject tenant slug header ────────────────────────────────────────
  return injectTenantSlug(req, NextResponse.next());
}

// ---------------------------------------------------------------------------
// Helper: clone response and add X-Tenant-Slug if a subdomain is found
// ---------------------------------------------------------------------------

function injectTenantSlug(req: NextRequest, response: NextResponse): NextResponse {
  const subdomain = extractSubdomain(req.headers.get('host'));
  if (!subdomain) return response;

  // Clone headers so we can mutate them
  const headers = new Headers(response.headers);
  headers.set('X-Tenant-Slug', subdomain);

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|css|js)).*)',
  ],
};
