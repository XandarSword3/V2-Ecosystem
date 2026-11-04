import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    pool: 'threads',
    maxConcurrency: 10,
    fileParallelism: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/types/**',
        'src/**/*.stories.{ts,tsx}',
        'node_modules',
      ],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      thresholds: {
        // Ratchet-only baseline, re-set from measured local coverage
        // (V8, Node 22): 36.0% statements / 29.8% branches (2026-11-04).
        // Kept ~2pp below measured to absorb V8 instrumentation variance
        // between Node 20 (CI) and Node 22 (local). Never lower these;
        // raise only after a verified measurement, and back with tests
        // that assert real behavior (see docs/TEST_COVERAGE_PLAN.md).
        statements: 34,
        branches: 24,
      },
    },
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
