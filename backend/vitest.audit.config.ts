import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import { assertLocalTestEnvironment } from './tests/env-guard';

// Deterministic local-only env for the audit suite. .env (remote) is never loaded.
dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), override: true });
process.env.SUPABASE_DB_PASSWORD = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.REDIS_URL = 'redis://127.0.0.1:6380/0';
process.env.CSRF_BYPASS_IN_TESTS = 'true';

assertLocalTestEnvironment(process.env, 'audit');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/audit/**/*.test.ts'],
    globalSetup: ['./tests/audit/global-setup.ts'],
    setupFiles: ['./tests/audit/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    sequence: { shuffle: false },
    pool: 'forks',
    testTimeout: 45000,
    hookTimeout: 180000,
    env: {
      NODE_ENV: 'test',
      AUDIT_BASE_URL: 'http://127.0.0.1:3199/api/v1',
    },
  },
});
