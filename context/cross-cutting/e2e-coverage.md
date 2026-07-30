# Cross-cutting: E2E Coverage

## Source of truth

- `playwright.config.ts` / `playwright.all.config.ts` (repo root)
- `e2e/` — test specs; `e2e/.env.test` — E2E-specific env
- CI: GitHub Actions runs Playwright E2E, frontend Vitest, backend
  integration tests (`.github/workflows/ci.yml`)

## Status

- [ ] Not yet audited per-engine — first session to touch this
      should populate an actual engine → spec-file coverage table
      here instead of this placeholder.
- Note: backend unit suite currently has 23/153 test files failing
  (205/3585 tests) and frontend has 84/110 files failing (294/536
  tests) on `main` as of 2026-07-25 — pre-existing, not introduced
  by the 2026-07-25 contract-freeze merge (verified by running both
  suites before and after). Worth knowing before trusting a green
  CI run on unrelated work; a failing job may already be expected.
