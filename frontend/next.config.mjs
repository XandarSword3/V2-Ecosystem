import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Ignore ESLint warnings during builds (only fail on errors)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Image optimization
  images: {
    domains: ['localhost', 'v2resort.com', 'v2-resort-backend.onrender.com'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Environment variables - DO NOT add /api here, api.ts adds it
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://v2-resort-backend.onrender.com' : 'http://localhost:3001'),
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV === 'production' ? 'https://v2-resort-backend.onrender.com' : 'http://localhost:3001'),
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
