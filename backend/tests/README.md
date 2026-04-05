# Backend Tests

Backend testing uses Vitest across three layers:

1. Unit and module tests in tests/unit
2. Contract checks in tests/contract
3. Integration tests in tests/integration

## Current Health Snapshot

Latest full backend unit run:

1. Test files: 216 passed, 0 failed
2. Tests: 6744 passed, 17 skipped, 0 failed

## Directory Layout

| Directory | Purpose |
| --------- | ------- |
| tests/unit | Fast isolated behavior tests |
| tests/contract | OpenAPI and contract checks |
| tests/integration | API and dependency-backed integration flows |
| tests/utils | Shared test helpers and mocks |

## Commands

```bash
# From backend/
npm run test:unit
npm run test:ci
npm run test:coverage
npm run test:integration
npm run test:all
```

## Coverage Gate (backend/vitest.config.ts)

1. statements: 65
2. branches: 55
3. functions: 65
4. lines: 65

## CI Usage

1. Stage 2 runs npm run test:ci and uploads backend coverage artifacts.
2. Stage 3 runs npm run test:integration with Postgres and Redis services provisioned in CI.

## Notes

1. Integration details are documented in tests/integration/README.md.
2. Shared helpers are in tests/utils (mock factories, auth helpers, DB helpers).
