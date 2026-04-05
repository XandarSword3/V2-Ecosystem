import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'tests/integration/**',
      'tests/criticalFlows.test.ts',
      'tests/ai-agent.integration.test.ts',
      'tests/comprehensive-verification.test.ts',
      'tests/security-patches.test.ts',
    ],
    coverage: {
      provider: 'v8',
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
        statements: 65,
        branches: 55,
        functions: 65,
        lines: 65,
      },
    },
  },
});
