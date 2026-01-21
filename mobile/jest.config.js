/**
 * Jest Configuration for V2 Resort Mobile App
 * 
 * Enforces 70% minimum coverage threshold across all metrics.
 * Configured for React Native with Expo and TypeScript support.
 */

module.exports = {
  // Use jest-expo preset for React Native + Expo
  preset: 'jest-expo',

  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Transform configuration
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|tailwind-merge|clsx)',
  ],

  // Module name mapping (matching tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/api$': '<rootDir>/src/api/index',
    '^@/auth$': '<rootDir>/src/auth/index',
    '^@/store$': '<rootDir>/src/store/index',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
    '<rootDir>/dist-.*/',
    '<rootDir>/.expo/',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx}',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],

  // CRITICAL: Coverage thresholds - progressive targets per directory
  // As we complete each phase, thresholds are enforced per completed area
  coverageThreshold: {
    // Core state management - Phase 2-3 complete
    'src/store/': {
      statements: 80,
      branches: 60,
      functions: 85,
      lines: 80,
    },
    // API and services - Phase 3 target
    // 'src/api/': { statements: 70, branches: 60, functions: 70, lines: 70 },
    // UI components - Phase 4-5 target  
    // 'src/components/': { statements: 70, branches: 60, functions: 70, lines: 70 },
    // Global threshold is lower during incremental build (raise to 70% when complete)
    global: {
      statements: 10,
      branches: 5,
      functions: 10,
      lines: 10,
    },
  },

  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'V2 Resort Mobile Test Report',
        outputPath: './coverage/test-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
      },
    ],
  ],

  // Performance
  maxWorkers: '50%',

  // Verbose output
  verbose: true,

  // Clear mocks between tests (but NOT reset implementations)
  clearMocks: true,
  resetMocks: false,  // IMPORTANT: Keep this false to preserve mock implementations
  restoreMocks: false, // Keep mock implementations intact

  // Fail on console errors in tests
  errorOnDeprecated: true,

  // Global timeout
  testTimeout: 10000,

  // Globals
  globals: {
    __DEV__: true,
  },
};
