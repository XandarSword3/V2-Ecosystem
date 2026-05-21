# E2E Simulation Tests

Simulation specs model higher-load and concurrent-actor behavior.

## Scope

These tests focus on:

1. Multi-actor concurrency
2. Race-condition sensitive paths
3. Capacity and workflow contention scenarios

## Running

```bash
# From v2-ecosystem root
npx playwright test tests/simulation --config playwright.all.config.ts --project=chromium
```

## Runtime Requirements

1. Frontend and backend services must be reachable.
2. Test credentials used by simulation specs must be available in environment.
