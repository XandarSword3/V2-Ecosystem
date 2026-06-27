import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Allow HMR WebSocket connections from multi-level subdomains used in dev
  // e.g. resort-1.tenant-a.v2platform.local, any.tenant.v2platform.local
  // Note: * does not cross dots, so two-level patterns need explicit *.* entries
  allowedDevOrigins: [
    '*.v2platform.local',      // tenant-a.v2platform.local
    '*.*.v2platform.local',    // resort-1.tenant-a.v2platform.local
    '*.localhost',             // tenant-a.localhost
    '*.*.localhost',           // resort-1.tenant-a.localhost
  ],
  
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'v2ecosystem.com' },
      { protocol: 'https', hostname: 'v2-ecosystem-backend.onrender.com' },
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Environment variables - DO NOT add /api here, api.ts adds it
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://v2-ecosystem-backend.onrender.com' : 'http://localhost:3005'),
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV === 'production' ? 'https://v2-ecosystem-backend.onrender.com' : 'http://localhost:3005'),
  },

  // URL redirects for deprecated routes (point old hardcoded paths to dynamic routes)
  async redirects() {
    return [
      // Snack Bar redirects (from old /admin/snack/* to new /admin/snack-bar/*)
      { source: '/admin/snack/menu', destination: '/admin/snack-bar/menu', permanent: true },
      { source: '/admin/snack/categories', destination: '/admin/snack-bar/categories', permanent: true },
      { source: '/admin/snack/orders', destination: '/admin/snack-bar/orders', permanent: true },
      // Note: /admin/pool/*, /admin/restaurant/*, and /admin/chalets/* routes 
      // now handled by [slug] dynamic routes - no redirects needed
    ];
  },

  // Security headers are now set in src/middleware.ts using nonce-based CSP.
  // The static headers() here are kept only as a fallback for routes the
  // middleware matcher might miss (e.g. static assets). The middleware's
  // per-request nonce overrides these on every dynamic page.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP is intentionally minimal here — the real per-request nonce
          // CSP is injected by middleware.ts. This header covers static files only.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Org and project from Sentry dashboard
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in production
  dryRun: process.env.NODE_ENV !== 'production',
};

// Wrap with Sentry only if DSN is configured
const configWithIntl = withNextIntl(nextConfig);
const finalConfig = process.env.NEXT_PUBLIC_SENTRY_DSN 
  ? withSentryConfig(configWithIntl, sentryWebpackPluginOptions)
  : configWithIntl;

export default finalConfig;
