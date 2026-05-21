import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
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

  // Security headers for all pages
  // Note: CSP script-src requires 'unsafe-inline' and 'unsafe-eval' for Next.js
  // (inline scripts for page data, webpack HMR in dev). In production, use
  // a middleware with nonces for stricter CSP.
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
      : "script-src 'self' 'unsafe-inline' https://js.stripe.com";
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https: wss: ws: http://localhost:3005",
              "frame-src 'self' https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
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
