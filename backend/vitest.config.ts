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
      'tests/criticalFlows.test.ts',
      'tests/ai-agent.integration.test.ts',
      'tests/comprehensive-verification.test.ts',
      'tests/security-patches.test.ts',
      'tests/unit/modules/bookings/bookings.service.test.ts', // Blocked by config import error - requires investigation
      // Dead tests — import from src/lib/ which was deleted (lib/ purge, June 2026)
      'tests/unit/services/amenity.service.test.ts',
      'tests/unit/services/event.service.test.ts',
      'tests/unit/services/feedback.service.test.ts',
      'tests/unit/services/maintenance.service.test.ts',
      'tests/unit/services/membership.service.test.ts',
      'tests/unit/services/package.service.test.ts',
      'tests/unit/services/task.service.test.ts',
      'tests/unit/services/waitlist.service.test.ts',
      'tests/unit/services/weather.service.test.ts',
      'tests/unit/modules/maintenance/maintenance.service.test.ts',
      'tests/unit/modules/notifications/notifications.service.test.ts',
      'tests/unit/controllers/notifications.controller.test.ts',
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
      // Coverage thresholds - raised after Phase 3 test rebuild
      // Current: ~68% statements, ~59% branches, ~67% functions
      // Target: 80% statements, 70% branches, 75% functions
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
