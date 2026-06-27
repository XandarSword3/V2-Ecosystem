/**
 * middleware.ts
 *
 * Runs on every request before any page or API route is served.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR TIERS (see Architecture Designing.md, "The Five Tiers" — Module
 * is a path inside Property, not a separate domain segment, so this file
 * classifies four domain-level tiers):
 *
 *   1. PLATFORM        — bare domain, no subdomain (v2platform.com).
 *                         Local dev equivalent: platform.localhost:3000
 *                         (reserved alias — bare localhost:3000 carries no
 *                         identity at all on a dev machine, unlike the real
 *                         registered bare domain in production, so it is
 *                         deliberately NOT treated as platform tier and is
 *                         blocked instead. See CONTEXT.md for the decision
 *                         record.)
 *   2. PLATFORM_ADMIN   — bare domain + /platform-admin path
 *                         (v2platform.com/platform-admin). Same host as
 *                         PLATFORM, distinguished by pathname — a path, not
 *                         a subdomain. (Architecture Designing.md originally
 *                         said /admin; corrected to match the actual route
 *                         on disk, app/platform-admin/, and to avoid
 *                         colliding with the tenant-tier /admin panel which
 *                         is a completely different page tree serving a
 *                         completely different audience.)
 *   3. TENANT           — first subdomain segment ({tenant}.v2platform.com).
 *   4. PROPERTY         — second subdomain segment, one level deeper
 *                         ({property}.{tenant}.v2platform.com).
 *
 *   Anything that resolves to none of the above (bare localhost:3000,
 *   garbage/unrecognized hosts) is HARD-BLOCKED (404) — there is no
 *   context-free request that renders anything. This mirrors the
 *   architecture doc's domain hierarchy diagram: "anything else → BLOCKED".
 *
 * Responsibilities (in order):
 *
 * 1. Tier classification — classifyHost() below resolves the Host header
 *    into one of the four tiers or 'unresolved'. Unresolved hosts are
 *    blocked before any further middleware logic runs.
 *
 * 2. Install gate — if the backend reports uninitialized, redirect to /install.
 *
 * 3. Subdomain → X-Tenant-Slug / X-Property-Slug / X-Platform-Tier injection —
 *    injects tier + slug headers so the backend tenantGate/resolveProperty
 *    can resolve context without requiring wildcard DNS to be configured
 *    first. Works in dev (e.g. acme.localhost, resort-a.acme.localhost) and
 *    production (e.g. acme.v2platform.com, resort-a.acme.v2platform.com)
 *    alike.
 *
 * 4. Platform-admin guard — /platform-admin is only accessible on the bare
 *    PLATFORM host, to users whose JWT carries isPlatformAdmin = true.
 *    404s on tenant/property hosts, 403s for non-platform-admin users on
 *    the platform host itself. Decoding happens without a signature check
 *    (edge runtime has no crypto module for HS256); the backend enforces
 *    the real check.
 */

import { NextRequest, NextResponse } from 'next/server';

// Root-level route segments that are NOT property slugs.
// Every path NOT in this list is assumed to be a property slug
// when the host tier is 'tenant' (i.e. no property in subdomain).
const GLOBAL_ROUTE_SEGMENTS = new Set([
  'login', 'register', 'forgot-password', 'reset-password',
  'install', 'platform-admin', 'cookie-policy', 'terms', 'privacy',
  'offline', 'error', 'global-error', 'api', 'favicon.ico',
]);

/**
 * Extract a property slug from the URL path for tenant-tier requests
 * that use path-based property routing ([tenant].localhost/[property]/...).
 * Returns null when the first segment is a known global route.
 */
function extractPropertyFromPath(pathname: string): string | null {
  const segment = pathname.split('/')[1]; // e.g. 'resort-a' from '/resort-a/admin/...'
  if (!segment || GLOBAL_ROUTE_SEGMENTS.has(segment)) return null;
  return segment;
}

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
// Host classifier
//
// Resolves the Host header into one of the four tiers, plus whatever
// tenant/property slugs apply. Vercel preview URLs are treated as 'platform'
// (not tenant-routed, but a known/trusted dev surface, not garbage) so
// preview deployments don't get hard-blocked by the unresolved-host rule.
//
// PLATFORM_ADMIN is not resolved here — same host as PLATFORM, distinguished
// by pathname (the /platform-admin path on a bare/platform host), so the
// middleware body checks that separately after classifyHost runs.
// ---------------------------------------------------------------------------

export type HostTier = 'platform' | 'tenant' | 'property' | 'unresolved';

interface HostClassification {
  tier: HostTier;
  tenant: string | null;
  property: string | null;
}

function classifyHost(host: string | null): HostClassification {
  const unresolved: HostClassification = { tier: 'unresolved', tenant: null, property: null };
  if (!host) return unresolved;

  const hostname = host.split(':')[0]; // strip port

  // Vercel preview URLs — trusted dev/preview surface, treated as platform
  if (hostname.endsWith('.vercel.app')) {
    return { tier: 'platform', tenant: null, property: null };
  }

  // Bare localhost carries no identity on a dev machine — every local
  // project sits on it, so unlike the real registered bare domain in
  // production it is NOT the platform tier. Blocked, per Alex's directive.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return unresolved;
  }

  // Dev: reserved "platform.localhost" and "platform.v2platform.local" aliases for the platform tier.
  if (hostname === 'platform.localhost' || hostname === 'platform.v2platform.local') {
    return { tier: 'platform', tenant: null, property: null };
  }

  // Dev: acme.localhost or resort-a.acme.localhost
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, hostname.lastIndexOf('.localhost'));
    if (!sub) return unresolved;
    const parts = sub.split('.');
    if (parts.length === 1) return { tier: 'tenant', tenant: parts[0], property: null };
    // resort-a.acme.localhost → property=resort-a, tenant=acme
    return { tier: 'property', tenant: parts[1], property: parts[0] };
  }

  // Dev: acme.v2platform.local or resort-a.acme.v2platform.local
  if (hostname.endsWith('.v2platform.local')) {
    const sub = hostname.slice(0, hostname.lastIndexOf('.v2platform.local'));
    if (!sub) return unresolved;
    const parts = sub.split('.');
    if (parts.length === 1) return { tier: 'tenant', tenant: parts[0], property: null };
    // resort-a.acme.v2platform.local → property=resort-a, tenant=acme
    return { tier: 'property', tenant: parts[1], property: parts[0] };
  }

  // Production: bare domain (v2platform.com) → platform tier.
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return { tier: 'platform', tenant: null, property: null };
  }
  if (parts.length === 3) {
    return { tier: 'tenant', tenant: parts[0], property: null };
  }
  // 4+ parts: property.tenant.<rest of domain>
  return { tier: 'property', tenant: parts[1], property: parts[0] };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const installBypassEnabled = process.env.NEXT_PUBLIC_INSTALL_BYPASS === 'true';

  // ── 0. Tier classification + unresolved-host hard block ─────────────────
  // Always-allowed prefixes (Next.js internals, static assets, Next's own
  // /api routes) bypass classification entirely — these have to load
  // regardless of host so the app shell can render at all, including the
  // 404 page itself.
  const classification = isAlwaysAllowed(pathname)
    ? null
    : classifyHost(req.headers.get('host'));

  if (classification?.tier === 'unresolved') {
    return new NextResponse('Not Found', { status: 404 });
  }

  // ── 1. Platform-admin guard ─────────────────────────────────────────────
  // PLATFORM_ADMIN lives at /platform-admin on the bare PLATFORM host only —
  // it is a path, not a subdomain, per the architecture doc. A request for
  // this path on a tenant or property host has no business reaching it at
  // all, so it's blocked outright rather than merely unguarded.
  if (pathname.startsWith('/platform-admin')) {
    if (classification && classification.tier !== 'platform') {
      return new NextResponse('Not Found', { status: 404 });
    }

    // SECURITY (C-1): the access token is an in-memory JS variable only —
    // it is never written to any cookie, so it can't be read at the edge.
    // The only thing available here is the non-httpOnly `x-auth-session`
    // marker cookie set at login, which proves "a session exists" but
    // carries no claims (not even isPlatformAdmin). Real authorization for
    // isPlatformAdmin happens exclusively on the backend, which verifies
    // the actual signed JWT on every request — this guard is just a UX
    // redirect for anonymous visitors, not an authorization boundary.
    const hasSession =
      req.cookies.get('x-auth-session')?.value === '1' ||
      Boolean(req.headers.get('authorization'));

    if (!hasSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── 2. Always-allowed routes bypass everything else ─────────────────────
  if (isAlwaysAllowed(pathname)) {
    return injectTierHeaders(classification, NextResponse.next());
  }

  // ── 3. Install bypass env flag ──────────────────────────────────────────
  if (installBypassEnabled) {
    return injectTierHeaders(classification, NextResponse.next());
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

  // ── 5. Inject tier + tenant/property slug headers ───────────────────────
  // For tenant-tier requests, property may be encoded in the URL path
  // (path-based routing: [tenant].localhost/[property]/admin/...)
  // rather than in a subdomain (resort-a.acme.localhost).
  const pathProperty =
    classification?.tier === 'tenant' && !classification.property
      ? extractPropertyFromPath(pathname)
      : null;

  return injectTierHeaders(classification, NextResponse.next(), pathProperty);
}

// ---------------------------------------------------------------------------
// Helper: clone response and add X-Platform-Tier / X-Tenant-Slug /
// X-Property-Slug based on the resolved classification. classification is
// null only when the route is always-allowed (classification was skipped),
// in which case no tier header is meaningful and none is added.
// pathProperty is non-null when property comes from the URL path rather
// than a subdomain (tenant-tier path-based routing).
// ---------------------------------------------------------------------------

function injectTierHeaders(
  classification: HostClassification | null,
  response: NextResponse,
  pathProperty: string | null = null,
): NextResponse {
  if (!classification) return response;

  const { tier, tenant, property } = classification;
  const effectiveProperty = property ?? pathProperty;

  // Clone headers so we can mutate them
  const headers = new Headers(response.headers);
  headers.set('X-Platform-Tier', tier);
  if (tenant) headers.set('X-Tenant-Slug', tenant);
  if (effectiveProperty) headers.set('X-Property-Slug', effectiveProperty);

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
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|css|js)).*)',
  ],
};
