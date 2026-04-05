import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const criticalRouteFiles = [
  'src/app/admin/[slug]/bookings/page.tsx',
  'src/app/admin/[slug]/reservations/page.tsx',
  'src/app/admin/[slug]/waitlist/page.tsx',
  'src/app/account/loyalty/page.tsx',
  'src/app/admin/settings/payments/page.tsx',
  'src/app/login/page.tsx',
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/high-impact/admin-bookings-route.behavior.test.tsx',
      'tests/high-impact/admin-reservations-route.behavior.test.tsx',
      'tests/high-impact/admin-waitlist-route.behavior.test.tsx',
      'tests/high-impact/account-loyalty-route.behavior.test.tsx',
      'tests/high-impact/admin-payments-route.behavior.test.tsx',
      'tests/high-impact/login-route.behavior.test.tsx',
    ],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: criticalRouteFiles,
      reportsDirectory: './coverage-critical',
      all: true,
      reportOnFailure: true,
      thresholds: {
        lines: 46,
        branches: 31,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
