<!-- Last updated: 2026-05-10 -->

# Testing Guide

> **Backend Tests:** 219 files | **Frontend Tests:** 113 files | **E2E Specs:** 90 files | **CI Stages:** 10

This repository uses a comprehensive testing strategy covering unit, integration, and end-to-end testing across all 4 engine types.

---

## Test Inventory

| Category | Count | Location | Framework |
|----------|-------|----------|-----------|
| Backend Unit/Integration | **219** | `backend/tests/` | Vitest |
| Frontend Unit | **113** | `frontend/tests/` | Vitest + Testing Library |
| E2E Playwright | **90** | `tests/` | Playwright |

---

## Test Structure

### Backend Tests (`backend/tests/`)

```
backend/tests/
├── unit/                    # Unit tests by module
│   ├── accommodations/
│   ├── admin/
│   ├── auth/
│   ├── channels/
│   ├── devices/
│   ├── finance/
│   ├── gdpr/
│   ├── groups/
│   ├── housekeeping/
│   ├── marketing/
│   ├── messaging/
│   ├── mobile-checkin/
│   ├── multi-property/
│   ├── parity/
│   ├── payments/
│   ├── promotions/
│   ├── reporting/
│   ├── revenue/
│   ├── staff/
│   └── users/
└── integration/             # Integration tests
    └── scenarios/
```

### Frontend Tests (`frontend/tests/`)

```
frontend/tests/
├── components/              # React component tests
├── lib/                     # Utility tests
├── pages/                   # Page-level tests
└── validation/              # Form validation tests
```

### E2E Tests (`tests/` — 90 spec files)

| Suite | Directory | Spec Count | Purpose |
|-------|-----------|------------|---------|
| Phase 3 (Engine) | `tests/phase3/` | 16 | Engine-aligned critical path |
| Features | `tests/features/` | 12 | Feature-specific tests |
| Admin | `tests/admin-functional/` | 8 | Admin workflow tests |
| E2E | `tests/e2e/` | 10 | General E2E |
| Rebrand | `tests/rebrand/` | 6 | White-label tests |
| Smoke | `tests/smoke/` | 5 | Production smoke tests |
| Workflows | `tests/workflows/` | 12 | Full workflow tests |
| Simulation | `tests/simulation/` | 15 | Load/performance tests |
| Utils | `tests/utils/` | 6 | Test utilities |

**Phase 3 Spec Files (Engine-Aligned Critical Path):**

| Spec | Engine | Description |
|------|--------|-------------|
| `00-public-pages.spec.ts` | — | Public page smoke tests |
| `01-engine-a-instant-transactions.spec.ts` | `instant_transaction` | POS order flow |
| `02-engine-b-reservations.spec.ts` | `time_exclusive_reservation` | Booking flow |
| `03-engine-c-capacity.spec.ts` | `shared_capacity_access` | Pool/gym access |
| `04-engine-d-entitlements.spec.ts` | `ongoing_entitlement` | Membership flow |
| `05-admin-panel.spec.ts` | — | Admin dashboard |
| `06-admin-db-effect.spec.ts` | — | Admin database effects |
| `06-staff-panel.spec.ts` | — | Staff interface |
| `10-functional-restaurant.spec.ts` | `instant_transaction` | Restaurant POS |
| `11-functional-cart.spec.ts` | — | Shopping cart |
| `12-functional-admin.spec.ts` | — | Admin functions |
| `13-functional-api.spec.ts` | — | API endpoints |
| `20-journey-engine-a.spec.ts` | `instant_transaction` | End-to-end engine A |
| `21-journey-engine-b.spec.ts` | `time_exclusive_reservation` | End-to-end engine B |
| `22-journey-engine-c.spec.ts` | `shared_capacity_access` | End-to-end engine C |
| `23-journey-engine-d.spec.ts` | `ongoing_entitlement` | End-to-end engine D |
| `24-journey-cross-engine.spec.ts` | Mixed | Cross-engine journey |

---

## CI Pipeline (7 Stages)

Defined in `.github/workflows/ci.yml`:

| Stage | Job Name | Description |
|-------|----------|-------------|
| **Stage 1** | Quality Gate | Linting, formatting checks |
| **Stage 2** | Backend Unit | Unit tests (219 files) |
| **Stage 2** | Frontend Unit | Component tests (113 files) |
| **Stage 3** | Backend Integration | Integration tests with Postgres 15 + Redis 7 |
| **Stage 4** | Build | Backend + frontend build |
| **Stage 5** | E2E Smoke | Smoke tests on pull_request |
| **Stage 5.5** | Phase 3 Coverage | Full engine test suite on PR + nightly |
| **Stage 6** | Full E2E | Complete E2E suite on schedule/workflow_dispatch |

**Services in Stage 3:**
- PostgreSQL 15 (port 5433, database: v2resort_test)
- Redis 7 (port 6380)

---

## Verified Commands

### Root

```powershell
npm run test
npm run test:backend
npm run test:frontend
```

### Backend

```powershell
cd backend
npm run test:unit
npm run test:ci
npm run test:coverage
npm run test:integration
npm run test:all
```

### Frontend

```powershell
cd frontend
npm test
npm run test:cov
npm run test:cov:critical
```

### Playwright (root)

```powershell
# Phase 3 (engine-aligned) - primary profile
npx playwright test -c playwright.config.ts --project=chromium

# Broad exploratory suite
npx playwright test -c playwright.all.config.ts --project=chromium

# Rebrand scenarios
npx playwright test -c playwright.rebrand.config.ts --project=chromium
```

---

## Coverage Thresholds

### Backend (`backend/vitest.config.ts`)

| Metric | Threshold |
|--------|-----------|
| statements | 65% |
| branches | 55% |
| functions | 65% |
| lines | 65% |

### Frontend Default (`frontend/vitest.config.ts`)

| Metric | Threshold |
|--------|-----------|
| statements | 45% |
| branches | 25% |

### Frontend Critical Routes (`frontend/vitest.critical.config.ts`)

| Metric | Threshold |
|--------|-----------|
| lines | 46% |
| branches | 31% |

---

## Integration Test Requirements

Backend integration tests require:

1. **PostgreSQL** on port 5433 with database `v2resort_test`
2. **Redis** on port 6380
3. **Environment variables:**
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET`

These are provisioned automatically in CI Stage 3.

---

## Playwright Config Profiles

| Config File | Use Case | Trigger |
|-------------|----------|---------|
| `playwright.config.ts` | Phase 3 engine-aligned coverage | Primary E2E profile |
| `playwright.all.config.ts` | Broad exploratory testing | Extended test runs |
| `playwright.rebrand.config.ts` | White-label/rebrand scenarios | Rebrand validation |

---

## Testing Best Practices

1. **Engine Testing**: Write tests against the unified `transactions` table, not legacy tables
2. **Idempotency**: Always test with `X-Idempotency-Key` header for payment operations
3. **State Machines**: Test valid and invalid state transitions for each engine type
4. **Cross-Engine**: Test journeys that span multiple engine types (e.g., book chalet + order room service)
5. **Coverage Gates**: Use `test:cov:critical` for PR-safe coverage validation

---

## Related Documentation

- [Architecture Overview](../architecture/ARCHITECTURE.md) — Engine framework
- [Control Flow](../architecture/control-flow.md) — Request lifecycle
- [API Reference](../api/API.md) — Endpoint documentation
- [Subsystem Registry](../meta/subsystem-registry.md) — Module listing
