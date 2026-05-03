import { defineConfig, devices } from '@playwright/test';

/**
 * Unified E2E Test Configuration
 * 
 * Environment Variables:
 *   FRONTEND_URL - Frontend URL (default: http://localhost:3000)
 *   API_URL - Backend API URL (default: http://localhost:3005)
 *   RUN_ALL_TESTS - Set to 'true' to run full suite including exploratory tests
 *   TEST_MODE - 'admin' | 'all' | 'rebrand' | 'default'
 * 
 * Running Tests:
 *   npx playwright test
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const RUN_ALL_TESTS = process.env.RUN_ALL_TESTS === 'true';
const TEST_MODE = process.env.TEST_MODE || 'default';

const exploratorySuites = [
  '**/workflows/**/*.spec.ts',
  '**/features/**/*.spec.ts',
  '**/complete-feature-coverage.spec.ts',
  '**/customer-flows.spec.ts',
  '**/cms-sync-hardened.spec.ts',
  '**/cms-settings-comprehensive.spec.ts',
  '**/admin-systematic.spec.ts',
  '**/auth-apple.spec.ts',
  '**/iteration-*.spec.ts',
  '**/iteration-*-test.spec.ts',
  '**/stress-behavior.spec.ts',
  '**/system_flow.spec.ts',
  '**/verification_inventory.spec.ts',
  '**/module-builder*.spec.ts',
];

const getTestIgnore = () => {
  const ignores = ['**/simulation/**', '**/node_modules/**'];
  if (!RUN_ALL_TESTS && TEST_MODE !== 'all') {
    ignores.push(...exploratorySuites);
  }
  return ignores;
};

const getOutputFile = () => {
  switch (TEST_MODE) {
    case 'admin': return 'test-results/admin-results.json';
    case 'all': return 'test-results/all-results.json';
    case 'rebrand': return 'test-results/rebrand-results.json';
    default: return 'test-results/smoke-results.json';
  }
};

export default defineConfig({
  testDir: './tests',
  testIgnore: getTestIgnore(),
  timeout: 120000,
  expect: {
    timeout: 15000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: getOutputFile() }]
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
});
