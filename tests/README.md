# End-to-End Tests (tests)

This folder contains Playwright suites that validate cross-system behavior across customer, staff, and admin flows.

## Primary Suites

| Directory | Purpose |
| --------- | ------- |
| smoke | Fast smoke checks for PR feedback |
| phase3 | Critical-path journey coverage |
| workflows | Multi-step business workflows |
| features | Domain-specific scenarios |
| rebrand | Rebrand and white-label journeys |
| simulation | Concurrency and heavy-journey simulations |

## Config Mapping

| Config | Target |
| ------ | ------ |
| playwright.config.ts | Phase 3 suite (tests/phase3) |
| playwright.all.config.ts | Broad non-phase3 root tests |
| playwright.rebrand.config.ts | Rebrand suite (tests/rebrand) |

## Execution

```bash
# From v2-ecosystem root

# Broad root suite
npx playwright test -c playwright.all.config.ts --project=chromium

# Phase 3 critical and nightly suite
npx playwright test -c playwright.config.ts --project=chromium

# Rebrand suite
npx playwright test -c playwright.rebrand.config.ts --project=chromium

# PR smoke focus
npx playwright test -c playwright.all.config.ts --project=chromium --grep "@smoke"
```

## CI Behavior

1. PRs run smoke coverage in Stage 5.
2. PRs, schedules, and manual runs execute Phase 3 coverage job.
3. Main pushes, schedules, and manual runs execute full nightly E2E.

## Environment Variables

Depending on suite, CI/local runs may require:

1. FRONTEND_URL
2. API_URL
3. PRODUCTION_FRONTEND_URL (for @production smoke)
4. PRODUCTION_API_URL (for @production smoke)
5. E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD
6. E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD
7. E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD (when staff flows are exercised)
