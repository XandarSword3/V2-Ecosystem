import { defineConfig, devices } from '@playwright/test';

/**
 * Full E2E Test Configuration — includes all suites (smoke, phase3, exploratory, production)
 *
 * Used by CI jobs:
 *   - e2e-smoke       → --grep "@smoke"        (PR gate)
 *   - e2e-full-nightly → full suite            (nightly / workflow_dispatch)
 *   - production-smoke → --grep "@production"  (post-deploy)
 *
 * Environment Variables:
 *   FRONTEND_URL           – Frontend URL              (default: http://localhost:3000)
 *   API_URL                – Backend API URL           (default: http://localhost:3005)
 *   PRODUCTION_FRONTEND_URL – Override for production smoke
 *   PRODUCTION_API_URL      – Override for production smoke
 *   E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD
 *   E2E_ADMIN_EMAIL  / E2E_ADMIN_PASSWORD
 */

const FRONTEND_URL =
  process.env.PRODUCTION_FRONTEND_URL ||
  process.env.FRONTEND_URL ||
  'http://localhost:3000';

export default defineConfig({
  testDir: './tests',

  // Run ALL suites — nothing is excluded; callers filter via --grep or file args.
  testIgnore: ['**/simulation/**', '**/node_modules/**'],

  timeout: 120_000,
  expect: { timeout: 15_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // One retry in CI to absorb transient flakiness; zero locally so failures are
  // immediately obvious during development.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/all-results.json' }],
  ],

  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
