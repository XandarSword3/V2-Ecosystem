# Testing Guide

This repository uses a layered strategy:

1. Backend unit and contract tests (Vitest)
2. Backend integration tests (Vitest + Postgres/Redis)
3. Frontend unit and route behavior tests (Vitest + Testing Library)
4. Frontend critical-route coverage gate (Vitest critical config)
5. End-to-end suites (Playwright)
6. Optional stress simulations (tools/stress-test)

## Test Layers and Locations

| Layer | Location | Primary Command |
| ----- | -------- | --------------- |
| Backend unit | backend/tests/unit | npm run test:unit |
| Backend contract | backend/tests/contract | npm run test:unit |
| Backend integration | backend/tests/integration | npm run test:integration |
| Frontend unit | frontend/tests and frontend/src | npm test |
| Frontend critical routes | frontend/tests/high-impact | npm run test:cov:critical |
| E2E phase 3 | tests/phase3 | npx playwright test -c playwright.config.ts |
| E2E broad suite | tests | npx playwright test -c playwright.all.config.ts |

## Verified Commands

### Root

```bash
npm run test
npm run test:backend
npm run test:frontend
```

### Backend

```bash
cd backend
npm run test:unit
npm run test:ci
npm run test:coverage
npm run test:integration
npm run test:all
```

### Frontend

```bash
cd frontend
npm test
npm run test:cov
npm run test:cov:critical
```

### Playwright (root)

```bash
npx playwright test -c playwright.config.ts --project=chromium
npx playwright test -c playwright.all.config.ts --project=chromium
npx playwright test -c playwright.rebrand.config.ts --project=chromium
```

## Coverage Thresholds (Current)

### Backend (backend/vitest.config.ts)

- statements: 65
- branches: 55
- functions: 65
- lines: 65

### Frontend default (frontend/vitest.config.ts)

- statements: 45
- branches: 25

### Frontend critical routes (frontend/vitest.critical.config.ts)

- lines: 46
- branches: 31

## CI Gates (.github/workflows/ci.yml)

The pipeline is staged and blocking:

1. Stage 1 - Quality Gate
2. Stage 2 - Backend Unit (coverage artifact uploaded)
3. Stage 2 - Frontend Unit
4. Stage 2 - Frontend Critical Route Coverage Gate (required)
5. Stage 3 - Backend Integration (with Postgres 15 and Redis 7 services)
6. Stage 4 - Build
7. Stage 5+ - E2E jobs by event type

Frontend coverage artifacts are uploaded from:

- frontend/coverage
- frontend/coverage-critical

## Integration Test Dependency Expectations

Backend integration tests expect:

1. PostgreSQL on port 5433 with database v2resort_test
2. Redis on port 6380
3. Valid integration env values (DATABASE_URL, SUPABASE_URL, keys, JWT_SECRET)

These are now provisioned directly in CI for Stage 3.

## Notes

1. Use backend/test:ci for full backend quality gate behavior including coverage output.
2. Use frontend/test:cov:critical for PR-safe coverage gating of highest-risk routes.
3. Use frontend/test:cov for broad trend tracking only; it measures the whole source tree.

## Playwright Config Profiles

- `playwright.config.ts`: primary phase3 E2E coverage profile.
- `playwright.all.config.ts`: broad exploratory profile with optional data-dependent suites.
- `playwright.rebrand.config.ts`: dedicated long-running rebrand scenario profile.
