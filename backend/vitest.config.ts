import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    deps: {
      interopDefault: true,
    },
    typecheck: {
      tsconfig: './tsconfig.spec.json',
    },
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'tests/_pending/**',
      'tests/integration/**',
      'tests/atomic-verification.integration.test.ts',
      'tests/criticalFlows.test.ts',
      'tests/ai-agent.integration.test.ts',
      'tests/comprehensive-verification.test.ts',
      'tests/security-patches.test.ts',
      // Dead tests — import from src/lib/ which was deleted (lib/ purge, June 2026)
      'tests/unit/services/event.service.test.ts',
      'tests/unit/services/feedback.service.test.ts',
      'tests/unit/services/membership.service.test.ts',
      'tests/unit/services/package.service.test.ts',
      'tests/unit/services/waitlist.service.test.ts',
      'tests/unit/services/weather.service.test.ts',
      'tests/unit/modules/maintenance/maintenance.service.test.ts',
      'tests/unit/modules/notifications/notifications.service.test.ts',
    ],
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      // Exclude non-testable files from coverage
      exclude: [
        // Database migrations and seeds
        'src/database/**/*migration*.ts',
        'src/database/migrate*.ts',
        'src/database/seed*.ts',
        'src/database/fix-*.ts',
        'src/database/create-*.ts',
        'src/database/run*.ts',
        'src/database/reset*.ts',
        
        // Scripts (CLI tools, one-time operations)
        'src/scripts/**',
        
        // API documentation
        'src/docs/**',
        
        // Server bootstrap (just starts the app)
        'src/index.ts',
        
        // Type definitions
        '**/*.d.ts',
        
        // Test files themselves
        'tests/**',
        
        // Config files
        '*.config.ts',
        '*.config.js',
      ],
      // Ratchet-only coverage gate. Re-baselined 2026-11-09 after the
      // coverage-gap remediation (provisioning.service, discount-reversal,
      // inventory-side-effects, inventory.service, stay-pricing previously
      // 0% → now 94–100). Measured unit coverage (V8, Node 22):
      // 48.13% statements / 40.05% branches / 52.40% functions / 49.64% lines.
      // Thresholds sit ~1-2pp below measured to absorb Node 20 (CI) variance.
      // NEVER lower these; raise only after a verified measurement, backed
      // by tests asserting real behavior (docs/_archive/audit-reports/TEST_COVERAGE_PLAN.md).
      thresholds: {
        statements: 47,
        branches: 38,
        functions: 51,
        lines: 48,
      },
    },
  },
});
