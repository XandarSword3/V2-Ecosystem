import { defineConfig } from 'vitest/config';

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
    include: ['tests/integration/**/*.test.ts'],
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
      DATABASE_URL: 'postgresql://v2resort_test:v2resort_test_secret@localhost:5433/v2resort_test',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_KEY: 'test-service-key',
      SUPABASE_ANON_KEY: 'test-anon-key',
      JWT_SECRET: 'test-secret-key-min-32-characters-long',
    },

    // Setup file
    setupFiles: ['./tests/integration/setup.ts'],
  },
});
