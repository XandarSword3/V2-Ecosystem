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
        // Kept 2 pp below measured 41.3% (Node 22) to absorb V8 instrumentation
        // variance between Node 20 (CI) and Node 22 (local).  Do not raise this
        // higher than 40 without verifying the measurement on Node 20 first.
        statements: 39,
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
