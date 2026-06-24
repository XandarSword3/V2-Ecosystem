/**
 * e2e/playwright.config.ts
 *
 * Audit-first E2E config. Run in layer order — infrastructure first, nothing else
 * until it passes. See V2_E2E_TESTING_INFRASTRUCTURE.md for philosophy.
 *
 * Corrections vs the design doc:
 *   - Backend port is 3005, not 4000
 *   - Backend health URL is localhost:3005/health
 *   - Env var is SUPABASE_SERVICE_KEY, not SUPABASE_SERVICE_ROLE_KEY
 *
 * Start order before running:
 *   Terminal 1: cd v2-resort/backend  && npm run dev   (port 3005)
 *   Terminal 2: cd v2-resort/frontend && npm run dev   (port 3000)
 *   Terminal 3: stripe listen --forward-to localhost:3005/api/webhooks/stripe/saas
 *   Terminal 4: npx playwright test --config=e2e/playwright.config.ts
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './specs',

  // Run specs in order — the numbering is intentional
  fullyParallel: false,

  // Fail fast — if infrastructure is down, don't burn time on the rest
  bail: 1,

  timeout: 60_000,

  // Zero retries during audit phase — failures are findings, not flakiness
  retries: 0,

  // Serial during audit. Increase later once suite is stable and passing.
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
    ['list'],
  ],

  globalSetup: './setup/global-setup.ts',
  globalTeardown: './setup/global-teardown.ts',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-failure',
    // Extra slack for Stripe webhooks and DB writes to settle
    actionTimeout: 15_000,
    headless: true,
  },

  projects: [
    {
      name: 'platform-tier',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://platform.localhost:3000',
      },
      testMatch: [
        '**/00-infrastructure/**',
        '**/02-engine-e/**',
      ],
    },
    {
      name: 'tenant-tier',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://testcorp.localhost:3000',
      },
      testMatch: [
        '**/01-auth/**',
        '**/03-cms/**',
        '**/04-module-builder/**',
        '**/05-engine-a/**',
        '**/06-engine-b/**',
        '**/07-engine-c/**',
        '**/08-engine-d/**',
      ],
    },
    {
      name: 'isolation',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/09-isolation/**',
        '**/10-billing-gates/**',
      ],
    },
  ],
});
