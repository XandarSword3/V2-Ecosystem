import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';

/**
 * Admin functional suites are intended to prove end-to-end behavior.
 * Locally, this config auto-starts servers; in CI it will reuse existing
 * servers (the workflow already starts `npm run dev`).
 */
export default defineConfig({
  testDir: './tests/admin-functional',
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/admin-functional-results.json' }],
  ],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:backend',
      url: `${API_URL}/api/health`,
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev:frontend',
      url: FRONTEND_URL,
      timeout: 180000,
      reuseExistingServer: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_URL,
      },
    },
  ],
});

