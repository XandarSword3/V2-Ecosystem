/**
 * middleware.ts
 *
 * Runs on every request before any page or API route is served.
 *
 * Install gate logic:
 *   1. If the request is already for /install, let it through unconditionally
 *      (avoids infinite redirect loop).
 *   2. If the request is for a static asset, API proxy, or _next internals,
 *      let it through — no install check needed.
 *   3. Otherwise, call GET /api/install/status on the backend.
 *      - initialized: false  →  redirect to /install
 *      - initialized: true   →  continue normally
 *      - fetch fails          →  continue normally (don't block the app if
 *                                the backend is temporarily unreachable; the
 *                                install page itself handles that case).
 *
 * This is an Edge middleware — no Node.js APIs available, fetch only.
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that must always be reachable regardless of install state
const ALWAYS_ALLOW = [
  '/install',
  '/_next',
  '/favicon',
  '/api',          // Next.js api routes (none in this project but safe to allow)
  '/offline',
];

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOW.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isAlwaysAllowed(pathname)) {
    return NextResponse.next();
  }

  // Resolve the backend base URL.
  // NEXT_PUBLIC_API_URL already ends in /api/v1 per the project convention.
  const apiUrl = (
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api/v1'
  ).replace('/api/v1', '');

  try {
    const res = await fetch(`${apiUrl}/api/install/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Short timeout — don't hold page loads hostage if backend is slow
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
    // Backend unreachable — allow through. The page itself will surface the
    // error rather than leaving the user staring at a redirect loop.
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Match all routes except:
   *   - _next/static  (static files)
   *   - _next/image   (image optimisation)
   *   - favicon.ico
   *   - public folder assets (png, jpg, svg, etc.)
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|css|js)).*)',
  ],
};
