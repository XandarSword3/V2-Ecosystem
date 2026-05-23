# SYSTEM AUDIT REMEDIATION EXECUTION LOG
*Last updated: 2026-05-23*

---

## STATUS LEGEND
- ✅ DONE — code written, wired, migration exists
- 🔧 PARTIAL — code written but needs manual hookup (noted below)
- ❌ NOT DONE

---

## P0 — WILL CRASH IN PRODUCTION

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| BUG-01 | Stripe webhook returns 500 (payment_ledger immutability conflict) | ✅ | `payment.controller.ts` — INSERT-only pattern, IdempotencyGuard wraps processing |
| BUG-02 | `getMyPayments` returns nothing (missing customer_id) | ✅ | `payment.controller.ts` — now queries `transactions.customer_id` |
| BUG-03 | Install creates no `properties` record | ✅ | `install.controller.ts` — properties row inserted during install |

---

## P1 — WRONG BEHAVIOR

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| GAP-01 | Pricing pipeline bypassed (discount_amount: 0 hardcode) | ✅ | `bookings.service.ts` wired to pricing pipeline; `accommodation.controller.ts` now passes `couponCode` |
| GAP-02 | Multi-property isolation not enforced | ✅ | `validatePropertyAccess` middleware applied to loyalty, coupons, giftcards routes |
| GAP-03 | Kiosk payment is a mock (setTimeout) | ✅ | `kiosk.service.ts` — real Stripe PaymentIntent creation |
| GAP-04 | Mobile key issuance is simulated | ✅ | `mobile-checkin.service.ts` — real provider dispatch; throws if no provider configured |
| GAP-05 | Whish/OMT no verification (auto-completes) | ✅ | `payment.controller.ts` — status `pending_verification`; `PATCH /payments/:id/verify` route added |
| GAP-06 | `payment_intent.payment_failed` doesn't update booking | ✅ | `payment.controller.ts` — `payment_intent.payment_failed` sets `status: payment_failed` on transactions |
| GAP-07 | Analytics query builder table name injection | ✅ | `query-builder.service.ts` — whitelist enforced in `executeQuery` and `getQuerySuggestions` |
| GAP-08 | GDPR export missing tables | ✅ | `gdpr.service.ts` — now includes loyalty_transactions, reservation engine TXs, capacity engine TXs, gift_card_transactions |

---

## P2 — MISSING FEATURES

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| MISSING-01 | SiteMinder/OTA channel sync entirely stubbed | ✅ | `siteminder.adapter.ts` — real HTTP adapter with Axios |
| MISSING-02 | MessageBird is a stub | ✅ | `messaging.service.ts` — real MessageBird REST API call |
| MISSING-03 | WhatsApp has no dispatch path | ✅ | `messaging.service.ts` — `case 'whatsapp'` using Meta Cloud API |
| MISSING-04 | Mobile payment only works for time_exclusive_reservation | ❌ SKIP | Per user instruction: mobile app is out of scope |
| MISSING-05 | FinancialLedgerService, TransactionManager, IdempotencyGuard are dead | ✅ | `engine-service.ts` now exports `recordToLedger()`, `recordRefundToLedger()`, `executeAtomicOperation()` with real callsites into Ledger + TxManager. `engine_financial_ledger`, `engine_idempotency_keys`, `engine_compensation_log` tables created in migration `20260523000001`. |
| MISSING-06 | Support module is contact-form only | ✅ | `support.controller.ts` (new) + `support.routes.ts` updated — full CRUD: list, get, update status/priority, assign, escalate, add internal notes, SLA tracking, dashboard stats |
| MISSING-07 | Sessions table has no index on refresh_token | ✅ | Migration `20260523000001` — `idx_sessions_refresh_token` on `sessions(refresh_token) WHERE is_active = TRUE` |

---

## P3 — NICE TO HAVE

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| P3-01 | Mobile CI | ❌ SKIP | Mobile app is out of scope |
| P3-02 | Staging deploy failures are silent (`continue-on-error: true`) | ✅ | `ci.yml` — removed `continue-on-error`, Render response code now checked, fails pipeline on non-2xx |
| P3-03 | Migration failures are non-fatal in CI | ✅ | `ci.yml` — migrations now fail-fast; pipeline exits with error count |
| P3-04 | Hardcoded `ironparadisegym.com` | ✅ | Removed from `public.controller.ts`, `email.service.ts` (all instances), `config/index.ts`. Contact email now comes from `site_settings` only. |
| P3-05 | Sessions index on refresh_token | ✅ | Covered by MISSING-07 |
| P3-06 | Access token blacklisting | ✅ | `token-blacklist.service.ts` (new) — per-JTI blacklist in `token_blacklist` table. `auth.service.ts` — logout() now blacklists the JTI. `auth.middleware.ts` — checks blacklist on every request. `auth.utils.ts` — `generateTokens()` now includes `jti` claim. |
| P3-07 | Stripe `payment_intent.canceled` not handled | ✅ | `payment.controller.ts` — `case 'payment_intent.canceled'` sets transaction status to `cancelled` |

---

## ARCHITECTURE LAW COMPLIANCE SWEEP

| Violation | Status |
|-----------|--------|
| `sendPoolTicketConfirmation` → `sendAccessTicketConfirmation` | ✅ |
| `sendTicketWithQR` → `sendAccessTicketWithQR` | ✅ |
| `sendFallbackTicketDelivery` → `sendFallbackAccessTicketDelivery` | ✅ |
| `chaletName` param in all email methods → `unitName` | ✅ |
| "Pool Ticket" in email content → "Access Ticket" | ✅ |
| "Chalet" in email content → "Unit" | ✅ |

---

## ONE MANUAL HOOKUP REQUIRED

**File:** `backend/src/index.ts`  
**Action:** Add two lines after `SchedulerService.init()`:

```typescript
import { registerEngineCleanupJobs } from './jobs/engine-cleanup.job.js';
registerEngineCleanupJobs();
```

This wires the daily token blacklist prune and idempotency key prune cron jobs.
All other fixes are self-contained and active immediately.

---

## FILES CREATED/MODIFIED THIS SESSION

### New files
- `supabase/migrations/20260523000001_engine_support_tables.sql`
- `backend/src/modules/support/support.controller.ts`
- `backend/src/services/token-blacklist.service.ts`
- `backend/src/jobs/engine-cleanup.job.ts`

### Modified files
- `backend/src/engines/engine-service.ts` — FinancialLedger + TransactionManager wired in
- `backend/src/modules/support/support.routes.ts` — full ticket management routes
- `backend/src/modules/auth/auth.service.ts` — blacklistToken on per-session logout
- `backend/src/modules/auth/auth.utils.ts` — jti claim in generateTokens
- `backend/src/middleware/auth.middleware.ts` — blacklist check on every request
- `backend/src/modules/public/public.controller.ts` — ironparadisegym.com removed
- `backend/src/services/email.service.ts` — ironparadisegym.com removed, white-label method names
- `backend/src/config/index.ts` — ironparadisegym.com removed
- `.github/workflows/ci.yml` — fatal migrations, fatal staging deploys
