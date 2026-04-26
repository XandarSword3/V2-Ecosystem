import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/rebrand',
  timeout: 600000,
  expect: { timeout: 30000 },
  fullyParallel: true,
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    screenshot: 'off',
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
