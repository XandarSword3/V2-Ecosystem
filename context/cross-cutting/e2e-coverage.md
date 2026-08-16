# Cross-cutting: E2E Coverage

## Source of truth

- `playwright.config.ts` / `playwright.all.config.ts` (repo root — `testDir: './tests'`)
- `tests/` — top-level Playwright specs, fixtures (`tests/fixtures/`), helpers (`tests/helpers/`), and environment (`tests/.env.test`)
- CI: GitHub Actions runs Playwright E2E, frontend Vitest, backend integration tests (`.github/workflows/ci.yml`)

## Test Suite Health Baseline (Re-verified 2026-08-16)

- **Backend Unit & Integration Suite**: 36 failed | 119 passed (155 test files total). 269 failed | 3302 passed | 8 skipped (3579 individual tests).
- **Frontend Vitest Suite**: 14 failed | 100 passed (114 test files total). 25 failed | 509 passed (534 individual tests).

## Per-Engine Automated Coverage Matrix

| Engine | Engine Type | Automated Coverage / Spec Files | Status |
|---|---|---|---|
| **Engine A** | `instant_transaction` | `tests/e2e/engine-a-customer-checkout.spec.ts`<br>`tests/e2e/engine-a-staff-settlement.spec.ts`<br>`backend/tests/unit/modules/staff/module-staff-payment.test.ts`<br>`frontend/tests/high-impact/staff-pos-template.behavior.test.tsx` | **Covered** (Customer menu/cart/checkout + Staff POS payment & loyalty + Unit tests) |
| **Engine B** | `time_exclusive_reservation` | `tests/features/reservations.spec.ts`<br>`tests/workflows/booking-flow.spec.ts`<br>`backend/tests/unit/reservations/` | **Partial** (Booking workflows covered; multi-day checkout pending audit) |
| **Engine C** | `shared_capacity_access` | `tests/features/session-access.spec.ts`<br>`backend/tests/unit/modules/` | **Partial** (Session access & QR validation) |
| **Engine D** | `ongoing_entitlement` | `backend/tests/unit/modules/promotions/` | **Pending** (Membership & tier entitlements) |
| **Engine E** | `platform_entitlement` | `tests/e2e/engine-e-signup.spec.ts`<br>`backend/tests/integration/stripe-provisioning-webhook.test.ts`<br>`tests/e2e/02-tenant-isolation/modules-cross-tenant.spec.ts` | **Covered** (Public signup CTA + HMAC-signed SaaS webhook provisioning + Tenant isolation) |

