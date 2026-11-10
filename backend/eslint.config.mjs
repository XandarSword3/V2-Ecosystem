// ESLint flat config (required from ESLint v9/v10; the old .eslintrc + --ext
// syntax made `npm run lint` in CI Stage 1 hard-fail with "couldn't find an
// eslint.config.(js|mjs|cjs) file").
//
// Scope: src only (the script passes `src`), and hooks the same rule spirit
// used by the frontend .eslintrc.json: unused vars / explicit-any /
// prefer-const are WARN (report without failing), while known-unsafe
// constructs (fallthrough, async promise executors) are errors. Deliberately
// NO type-aware rules: the goal of this gate is a fast CI guard, not a
// burndown — enable type-checked rules only via a scoped linter if/when
// needed. `scripts/` is ignored: one-off operator migrations intentionally
// use console logging and loose typing.
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'src/scripts/**', 'src/docs/**', 'coverage/**', 'src/**/*.config.ts'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      // Without a tsconfig project binding this stays syntactic-only, which
      // is what we want for CI speed.
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript handles these better
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-import-assign': 'off',

      // Report-but-don't-fail (matches the frontend gate's tolerance)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],

      // Genuinely unsafe — hard errors
      'no-fallthrough': 'error',
      'no-async-promise-executor': 'error',
      'no-prototype-builtins': 'warn',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
