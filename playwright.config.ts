import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Test Configuration
 * 
 * Environment Variables:
 *   FRONTEND_URL - Frontend URL (default: http://localhost:3000)
 *   API_URL - Backend API URL (default: http://localhost:3005)
 *   E2E_ADMIN_EMAIL - Admin email for testing
 *   E2E_ADMIN_PASSWORD - Admin password for testing
 * 
 * Running Tests:
 *   1. Start backend: cd v2-resort/backend && npm run dev
 *   2. Start frontend: cd v2-resort/frontend && npm run dev
 *   3. Run tests: npx playwright test
 * 
 * Or use webServer config below (uncomment) for automated startup.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 15000
  },
  fullyParallel: false, // Run sequentially to avoid auth conflicts
  forbidOnly: !!process.env.CI,
  retries: 2, // Increased retries for flaky network tests
  workers: 1, // Single worker to avoid session conflicts
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }]
  ],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
  // Uncomment below to auto-start servers (requires proper build)
  // webServer: [
  //   {
  //     command: 'cd backend && npm run dev',
  //     url: API_URL,
  //     timeout: 60000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  //   {
  //     command: 'cd frontend && npm run dev',
  //     url: FRONTEND_URL,
  //     timeout: 120000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  // ],
});
