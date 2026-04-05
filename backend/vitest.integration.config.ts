import dotenv from 'dotenv';
import path from 'path';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const REQUIRED_INTEGRATION_ENV_VARS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
] as const;

const missingIntegrationEnvVars = REQUIRED_INTEGRATION_ENV_VARS.filter((key) => {
  const value = process.env[key];
  return !value || value.trim() === '';
});

if (missingIntegrationEnvVars.length > 0) {
  throw new Error(
    `Missing required integration test env vars: ${missingIntegrationEnvVars.join(', ')}. Define them in backend/.env.test or export them before running integration tests.`
  );
}

/**
 * Vitest Configuration for Integration Tests
 *
 * Runs integration tests separately from unit tests.
 * Requires running test database (docker-compose.test.yml).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts',
      'tests/**/*.integration.test.ts',
      'tests/comprehensive-verification.test.ts',
      'tests/security-patches.test.ts',
      'tests/criticalFlows.test.ts',
    ],
    exclude: ['node_modules', 'dist'],

    // Integration test settings
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 60000, // 60 seconds for setup/teardown

    // Run tests sequentially to avoid database conflicts
    fileParallelism: false,
    sequence: {
      shuffle: false,
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in single process
      },
    },

    // Reporter configuration
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/integration-results.json',
    },

    // Environment variables for integration tests
    env: {
      RUN_INTEGRATION_TESTS: 'true',
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL!,
      SUPABASE_URL: process.env.SUPABASE_URL!,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY!,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
      JWT_SECRET: process.env.JWT_SECRET!,
    },

    // Setup file
    setupFiles: ['./tests/integration/setup.ts'],
  },
});
