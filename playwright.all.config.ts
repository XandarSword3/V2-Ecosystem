import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const RUN_EXPLORATORY_E2E = process.env.RUN_EXPLORATORY_E2E === 'true';

const exploratoryDataDependentSuites = [
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

export default defineConfig({
  testDir: './tests',
  testIgnore: [
    '**/simulation/**',
    '**/node_modules/**',
    ...(RUN_EXPLORATORY_E2E ? [] : exploratoryDataDependentSuites),
  ],
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['list'], ['json', { outputFile: 'test-results/all-non-phase3-results.json' }]],
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
