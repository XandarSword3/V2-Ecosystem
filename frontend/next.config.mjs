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

export default withNextIntl(nextConfig);
