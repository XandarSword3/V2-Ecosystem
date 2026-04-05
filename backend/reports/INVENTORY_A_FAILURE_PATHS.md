# INVENTORY A: FAILURE PATHS & ERROR HANDLING

> **Scope**: `v2-resort/backend/src/` — every failure path, error handler, race condition, and transaction boundary.  
> **Generated from**: Actual source code reads, not speculation.

---

## Table of Contents

1. [Global Error Infrastructure](#1-global-error-infrastructure)
2. [Payment Failure Scenarios](#2-payment-failure-scenarios)
3. [Concurrency & Race Conditions](#3-concurrency--race-conditions)
4. [Transaction Boundaries & Cascade Failures](#4-transaction-boundaries--cascade-failures)
5. [Idempotency Coverage](#5-idempotency-coverage)
6. [Module-Level Error Handling](#6-module-level-error-handling)
7. [Process-Level Failure Handling](#7-process-level-failure-handling)
8. [Dead Code & Unused Safety Nets](#8-dead-code--unused-safety-nets)

---

## 1. Global Error Infrastructure

### 1.1 Express Error Middleware (`src/app.ts` L241-284)

| Aspect | Behavior |
|--------|----------|
| Operational errors (`isOperational=true`) | Returns status code + message to client |
| Unexpected errors (no `isOperational`) | Logs full stack, returns sanitized `"Internal Server Error"` in production |
| Validation errors | Includes `errors[]` array in response body |
| All errors | Include `{ success: false, error, code? }` shape |

### 1.2 Async Handler Wrapper (`src/middleware/async-handler.ts` L1-21)

All route handlers are wrapped with `asyncHandler()` which calls `Promise.resolve(fn(req,res,next)).catch(next)`. This guarantees **every unhandled async rejection in routes** reaches the global error middleware. Forgetting to use it would silently swallow errors.

### 1.3 AppError Class

Custom `AppError` extends `Error` with:
- `statusCode` (HTTP code)
- `isOperational` (boolean — distinguishes programmer bugs from expected failures)
- `code` (string identifier like `COUPON_EXPIRED`)

### 1.4 Sentry Integration (`src/app.ts` L22)

`initSentry(app)` is called early in startup. Sentry captures unhandled exceptions and rejected promises for alerting.

### 1.5 Circuit Breaker (`src/utils/circuit-breaker.ts`)

Generic circuit breaker pattern with states: `closed → open → half-open`.

| Config | Value |
|--------|-------|
| Failure threshold | Configurable |
| Reset timeout | Configurable |
| Monitoring | `setInterval` logs stats when not in `closed` state |
| `CircuitBreakerOpenError` | Thrown when circuit is open |

**Usage**: Available but grep shows no imports in production source files — may be unused or used only in planned integrations.

---

## 2. Payment Failure Scenarios

### 2.1 Stripe PaymentIntent Creation (`src/modules/payments/payment.controller.ts` L50-120)

| Failure | Handling |
|---------|----------|
| Missing `referenceType` or `referenceId` | Returns 400 |
| Stripe API error | Caught, returns 500 with Stripe error message |
| Invalid amount (≤0) | NOT validated at controller level — relies on Stripe to reject |

### 2.2 Stripe Webhook — `payment_intent.succeeded` (`payment.controller.ts` L160-280)

| Failure | Handling |
|---------|----------|
| Invalid webhook signature | `verifyWebhookSignature()` throws → 400 returned |
| Duplicate webhook (same `webhook_id` in `payment_ledger`) | Returns 200 early (idempotent) |
| Duplicate webhook (same `stripe_payment_intent_id` in `payments`) | Returns 200 early (double guard) |
| Insert into `payment_ledger` fails | Error thrown → webhook returns 500 → Stripe retries |
| Insert into `payments` fails | Error thrown → webhook returns 500 → Stripe retries, but `payment_ledger` row already exists (next retry will hit idempotency check and return 200 WITHOUT creating `payments` row) |
| `updateReferencePaymentStatus()` fails | **CRITICAL**: Payment recorded but order/booking status not updated. Error propagates → Stripe retries → idempotency check returns 200, status NEVER updated |
| `awardLoyaltyPointsForPayment()` fails | **Non-fatal**: wrapped in try/catch, logged only, webhook still returns 200 |

### 2.3 Stripe Webhook — `payment_intent.payment_failed` (`payment.controller.ts` ~L285)

| Failure | Handling |
|---------|----------|
| Records failure to `payment_ledger` | Logged, returns 200 |
| Reference status update fails | Logged, returns 200 anyway |

### 2.4 Stripe Webhook — `charge.refunded` (`payment.controller.ts` ~L300)

| Failure | Handling |
|---------|----------|
| Records refund to `payment_ledger` | If insert fails → error propagates |
| Updates `payments` table status | If update fails → ledger has refund but payments table is stale |

### 2.5 Manual Refund (`payment.controller.ts` L350-420)

| Step | Failure Handling |
|------|-----------------|
| Check if already refunded | Returns 400 if `refund_status = 'refunded'` |
| `stripe.refunds.create()` | If Stripe rejects → returns 400, order status NOT updated (correct) |
| Update `payments` table | If fails → Stripe refund exists but DB not updated (orphan refund) |
| Update order/booking status | If fails → payment marked refunded but order still shows paid |

### 2.6 Cash/Manual Payment Recording (`payment.controller.ts` L420-462)

| Step | Failure Handling |
|------|-----------------|
| Insert `payments` row | If fails → error propagates, reference not updated |
| Update reference status | If fails → `payments` row exists but order shows unpaid |
| **No transaction wrapping** | Two separate DB operations — partial failure possible |

### 2.7 Chargeback Handling (`src/services/chargeback.service.ts`)

| Failure | Handling |
|---------|----------|
| Duplicate dispute (`stripe_dispute_id` exists) | Returns existing chargeback (idempotent) |
| Email alert to admin fails | Logged, does not block chargeback recording |
| Evidence submission to Stripe fails | Error propagates to caller |

---

## 3. Concurrency & Race Conditions

### 3.1 PROTECTED Operations

| Operation | Protection Mechanism | File & Line |
|-----------|---------------------|-------------|
| Loyalty `earnPoints()` | `pg_advisory_xact_lock` via `earn_loyalty_points_atomic` RPC | `loyalty.controller.ts` L194 |
| Loyalty `redeemPoints()` | `pg_advisory_xact_lock` via `redeem_loyalty_points_atomic` RPC | `loyalty.controller.ts` L275 |
| Loyalty `adjustPoints()` | `pg_advisory_xact_lock` via `earn_loyalty_points_atomic` RPC | `loyalty.controller.ts` L337 |
| Coupon `applyCoupon()` | `apply_coupon_atomic` RPC (atomic usage count + validation) | `coupon.controller.ts` L236 |
| Gift card (via engine pricing pipeline) | `redeem_giftcard_atomic` RPC | `discount-resolvers.ts` ~L80 |
| Chalet booking | Redis distributed lock (`acquireBookingLock`) with 30s TTL, 10s spin-wait; in-memory fallback | `chalet.controller.ts` ~L200 |
| Chalet row lock (in RPC) | `SELECT ... FOR UPDATE` on chalets row | `scripts/apply_rpc.ts` L28 |
| Idempotency key claim | Upsert with unique constraint on key hash | `idempotency-guard.ts` |

### 3.2 UNPROTECTED Operations (Race Condition Risks)

| Operation | Risk | File & Line |
|-----------|------|-------------|
| **Gift card redemption (direct endpoint)** | `redeemGiftCard()` does SELECT balance → UPDATE balance as two separate operations. Two concurrent requests can both read the same balance and both succeed, over-redeeming. | `giftcard.controller.ts` L300-400 |
| **Pool ticket purchase** | Capacity check (count existing tickets) and ticket creation are separate queries with NO lock. Two concurrent purchases can both pass the capacity check and both create tickets, exceeding `max_capacity`. | `pool.controller.ts` capacity check area |
| **Order creation** | Menu item availability checked then order created — no lock. Concurrent orders could both pass stock check. Inventory deduction is via RPC (`deduct_inventory_for_order_v2`) which is atomic, but if deduction fails the order still succeeds (non-fatal). | `order.service.ts` |
| **Booking add-on insert after booking created** | Booking row created first, then add-ons inserted in a loop. No transaction. If server crashes between booking insert and add-on inserts, orphan booking exists without add-ons. | `chalet.controller.ts` |
| **Coupon post-RPC order update** | `apply_coupon_atomic` RPC atomically increments usage, but the subsequent order table update with coupon discount is a separate query. If the update fails, the coupon usage is consumed but discount not applied to the order. | `coupon.controller.ts` L236+ |
| **Reference status update after payment** | Stripe webhook records payment, then calls `updateReferencePaymentStatus()` as a separate operation. If it fails, payment exists but reference status is stale. | `payment.controller.ts` |

### 3.3 Concurrency Summary Diagram

```
SAFE (atomic RPCs / locks):
  Loyalty earn/redeem  →  pg_advisory_xact_lock
  Coupon apply         →  apply_coupon_atomic RPC
  Gift card (engine)   →  redeem_giftcard_atomic RPC
  Chalet booking       →  Redis distributed lock
  Idempotency keys     →  DB unique constraint upsert

UNSAFE (no locking):
  Gift card (direct)   →  SELECT then UPDATE (no RPC)
  Pool capacity        →  COUNT then INSERT (no lock)
  Inventory deduction  →  Atomic RPC but non-fatal on failure
  Multi-step creates   →  No DB transaction wrapping
```

---

## 4. Transaction Boundaries & Cascade Failures

### 4.1 Application-Level Saga (TransactionManager — `src/engines/transaction-manager.ts`)

The system does **NOT** use database-level `BEGIN/COMMIT/ROLLBACK`. Instead it uses an application-level Saga pattern:

| Aspect | Behavior |
|--------|----------|
| Step execution | Sequential, ordered |
| On step failure | Compensates all previously-completed steps in reverse order |
| Compensation failure | **Logged but swallowed** — does NOT propagate |
| Failed compensation record | Inserted into `engine_compensation_log` with `requires_manual_review: true` |
| Optional steps | Failure does NOT trigger compensation chain |

**Risk**: If the process crashes mid-saga, no database transaction exists to roll back. Partial state may persist and `engine_compensation_log` entries may not be written.

### 4.2 Simpler Transaction Helper (`src/utils/transaction.ts`)

| Function | Steps | Rollback |
|----------|-------|----------|
| `createBookingTransactional()` | Insert `chalet_bookings` → Insert `chalet_booking_add_ons` | On add-on failure: delete booking row |
| `createOrderTransactional()` | Insert `restaurant_orders` → Insert `restaurant_order_items` | On item failure: delete order row |

Same pattern: application-level rollback via DELETE, not DB transactions.

### 4.3 Cascade Failure Scenarios

| Scenario | What Breaks | Impact |
|----------|------------|--------|
| Order created but items insert fails | `createOrderTransactional` rolls back order | **Handled** (if rollback succeeds) |
| Order created, items created, inventory deduction RPC fails | Order persists, inventory not deducted | **Non-fatal by design** — order succeeds, stock may over-sell |
| Order created, items created, kitchen propagation fails | Order persists but kitchen display never shows it | **Non-fatal by design** — logged, order succeeds |
| Order created, email fails | Order persists, no confirmation email | **Non-fatal by design** |
| Booking created but add-on insert fails (via controller, NOT transactional helper) | Orphan booking without add-ons | **Silent data inconsistency** |
| Payment webhook: ledger written, `payments` insert fails | Ledger has record, payments table doesn't | **Next retry returns 200 (idempotent on ledger), payments row NEVER created** |
| Payment webhook: payments written, reference status update fails | Payment recorded, order shows unpaid | **Next retry returns 200 (idempotent), status NEVER updated** |
| GDPR deletion: anonymization succeeds, marketing consent delete fails | User partially anonymized | GDPR resets status to 'pending' for retry |

---

## 5. Idempotency Coverage

### 5.1 Engine Idempotency Guard (`src/engines/idempotency-guard.ts`)

| Aspect | Detail |
|--------|--------|
| Storage | `engine_idempotency_keys` table |
| Key format | `{tenantId}:{engineType}:{entityId}:{action}:{nonce}` |
| On duplicate (completed) | Returns cached result, HTTP 200 |
| On duplicate (processing) | Throws `IdempotencyConflictError` (409) |
| On claim failure | **FALLBACK**: Proceeds WITHOUT idempotency protection ("better to process than to block") |
| On operation failure | Marks key as 'failed' — retries can re-attempt |
| TTL | 24 hours |
| Cleanup | `cleanupExpired()` method exists but **NO cron job calls it** |

### 5.2 Webhook Idempotency

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Payment webhook (inline) | Checks `payment_ledger` for existing `webhook_id` + checks `payments` for existing `stripe_payment_intent_id` | **ACTIVE** — used in production |
| `webhookIdempotency.service.ts` | Generic `processWithIdempotency()` using `processed_webhook_events` table | **DEAD CODE** — not imported anywhere in `src/` |
| `cleanupOldEvents()` (30-day cleanup) | Defined in `webhookIdempotency.service.ts` | **DEAD CODE** — never called |
| Chargeback webhook | Checks `chargebacks` table for existing `stripe_dispute_id` | **ACTIVE** |

### 5.3 Idempotency Gaps

| Operation | Idempotent? | Risk |
|-----------|-------------|------|
| `POST /create-intent` | No — creates new PaymentIntent each call | Client could create multiple intents for same order |
| `POST /record-cash` | No — no dedup check | Accidental double-tap creates duplicate payment |
| `POST /record-manual` | No — no dedup check | Same risk |
| Loyalty points from webhook | Yes — checked at RPC level | Safe |
| Booking creation | Only if using engine with idempotency guard; direct controller has none | Manual double-submit risk |

---

## 6. Module-Level Error Handling

### 6.1 Chalet Module (`src/modules/chalets/chalet.controller.ts`)

| Error | Handling |
|-------|----------|
| Chalet not found | Returns 404 |
| Date conflict (already booked) | Returns 409 |
| Lock acquisition timeout (10s) | Returns 429 or 500 |
| Lock release failure | Logged in `finally` block, does not affect response |
| Email send failure (confirmation) | Logged, booking still succeeds |
| Pricing calculation failure | Error propagates → 500 |

### 6.2 Pool Module (`src/modules/pool/pool.controller.ts`)

| Error | Handling |
|-------|----------|
| Session not found | Returns 404 |
| Capacity exceeded | Returns 400 |
| Invalid state transition | `StateMachineError` → 400 with descriptive message |
| Socket emit failure | Non-fatal, logged |
| Ticket not found for cancellation | Returns 404 |

### 6.3 Restaurant Order Module (`src/modules/restaurant/services/order.service.ts`)

| Error | Handling |
|-------|----------|
| Menu item not found / inactive | Returns 400 before order creation |
| Order creation (DB) fails | Error propagates → 500 |
| Order items insertion fails | Rollback handler deletes order row |
| Inventory deduction RPC fails | **Non-fatal** — logged, order succeeds |
| Kitchen propagation fails | **Non-fatal** — logged, order succeeds |
| Email notification fails | **Non-fatal** — logged, order succeeds |

### 6.4 Gift Card Module (`src/modules/giftcards/giftcard.controller.ts`)

| Error | Handling |
|-------|----------|
| Gift card not found | Returns 404 |
| Gift card expired | Returns 400 (checked lazily on access) |
| Insufficient balance | Returns 400 |
| Gift card already redeemed (balance = 0) | Returns 400 |
| **Concurrent redemption** | **NO PROTECTION** at controller level (see §3.2) |

### 6.5 Coupon Module (`src/modules/coupons/coupon.controller.ts`)

| Error | Handling |
|-------|----------|
| Coupon not found | Returns 404 |
| Coupon expired / not yet valid | Returns 400 |
| Usage limit exceeded | Returns 400 (checked in RPC) |
| Per-user limit exceeded | Returns 400 |
| Min order amount not met | Returns 400 |
| First-order-only violation | Returns 400 |
| RPC `apply_coupon_atomic` fails | Error propagates → 500 |

### 6.6 Loyalty Module (`src/modules/loyalty/loyalty.controller.ts`)

| Error | Handling |
|-------|----------|
| Member not found | Returns 404 |
| Insufficient points for redemption | Returns 400 (checked in RPC) |
| RPC failure | Error propagates → 500 |
| Concurrent earn/redeem | **SAFE** — `pg_advisory_xact_lock` |

### 6.7 GDPR Module (`src/modules/gdpr/gdpr.service.ts`)

| Error | Handling |
|-------|----------|
| Data export: table fetch fails | Caught per-table, continues with available data |
| Data export: ZIP creation fails | Error propagates |
| Data deletion: fetch user fails | Error propagates |
| Data deletion: anonymization partially fails | Status reset to 'pending' for retry |
| Data deletion: preserves orders/bookings/payments | By design — financial records are not deleted |

### 6.8 Marketing Module (`src/modules/marketing/marketing.service.ts`)

| Error | Handling |
|-------|----------|
| Background processing: any error | Caught at top level, `isProcessing` flag reset via `finally` |
| Individual automation execution fails | Logged, continues processing remaining |
| Email send fails | Logged, continues |

### 6.9 Channel Webhooks (`src/modules/channels/`)

| Error | Handling |
|-------|----------|
| Invalid property_id | Returns 400 |
| Unknown channel | Returns 400 |
| Processing error | Returns 500 |

---

## 7. Process-Level Failure Handling

### 7.1 Startup Sequence (`src/index.ts`)

| Step | Failure Behavior |
|------|-----------------|
| HTTP server creation | If `server.listen()` fails → process crashes |
| `initSentry(app)` | If Sentry init fails → logged, server continues |
| `initializeDatabase()` | **Runs in background** (non-blocking). If it fails → logged, server runs without DB → all requests will fail on first DB access |
| `initializeSocketServer()` | If fails → process crashes (no try/catch) |
| `SchedulerService.init()` | If fails → process crashes (no try/catch) |

### 7.2 Graceful Shutdown (`src/index.ts` L44-90)

| Signal | Behavior |
|--------|----------|
| `SIGTERM` / `SIGINT` | Sets `isShuttingDown` flag, closes HTTP → WebSocket → Database |
| Duplicate signal | Ignored (idempotent) |
| Timeout | 30 seconds, then `process.exit(1)` |

### 7.3 Uncaught Exceptions (`src/index.ts` ~L95-110)

| Exception Type | Behavior |
|----------------|----------|
| `"write after end"` / `"headers already sent"` | **Ignored** (Express known issue) |
| All other uncaught exceptions | Logs error, initiates graceful shutdown |

### 7.4 Unhandled Rejections (`src/index.ts` ~L110)

| Behavior |
|----------|
| **Logs only** — does NOT shutdown. Process continues running with potentially corrupted state. |

### 7.5 Health Checks

| Endpoint | Check | File |
|----------|-------|------|
| `GET /health` | DB ping (select from `system_settings`) | `app.ts` |
| `GET /api/health` | Basic liveness | `app.ts` |
| `GET /health/ready` | DB connectivity + latency measurement | `app.ts` |
| `GET /health/detailed` | DB + Storage + Stripe + Email, memory/CPU metrics | `health.controller.ts` |

---

## 8. Dead Code & Unused Safety Nets

| Component | Status | File |
|-----------|--------|------|
| `webhookIdempotency.service.ts` → `processWithIdempotency()` | **DEAD CODE** — exported but never imported in `src/` | `webhookIdempotency.service.ts` L73 |
| `webhookIdempotency.service.ts` → `cleanupOldEvents()` | **DEAD CODE** — never called | `webhookIdempotency.service.ts` L121 |
| `webhook-retry.service.ts` → `startBackgroundProcessing()` | **NEVER INITIALIZED** — exported singleton exists, but `startBackgroundProcessing()` is never called at startup or in scheduler | `webhook-retry.service.ts` L430 |
| `webhook-retry.service.ts` → `processPendingRetries()` | **UNREACHABLE** — only called inside `startBackgroundProcessing()` | `webhook-retry.service.ts` |
| `idempotency-guard.ts` → `cleanupExpired()` | **NEVER SCHEDULED** — method exists but no cron job calls it; keys accumulate forever | `idempotency-guard.ts` |
| `marketing.service.ts` → `startBackgroundProcessing()` | **NEVER INITIALIZED** — method exists but never called at startup or in scheduler | `marketing.service.ts` L1407 |
| Circuit breaker (`circuit-breaker.ts`) | **Appears unused** — no production imports found in `src/` | `utils/circuit-breaker.ts` |

---

## Summary of Critical Risks

| # | Risk | Severity | Recommendation |
|---|------|----------|----------------|
| 1 | Gift card direct redemption endpoint has NO atomic RPC — race condition allows over-redemption | **HIGH** | Use `redeem_giftcard_atomic` RPC like the engine resolver does |
| 2 | Pool ticket capacity check has NO lock — concurrent purchases can exceed max_capacity | **HIGH** | Add `SELECT ... FOR UPDATE` or advisory lock on session row |
| 3 | Payment webhook idempotency can leave `payments` row missing or reference status stale on partial failure | **HIGH** | Wrap ledger + payments + status update in single DB transaction or add reconciliation job |
| 4 | Webhook retry service is never started — failed webhooks accumulate but are never retried | **MEDIUM** | Call `webhookRetryService.startBackgroundProcessing()` in `SchedulerService.init()` |
| 5 | Marketing background processing is never started — automation triggers never fire | **MEDIUM** | Call `marketingAutomationService.startBackgroundProcessing()` in `SchedulerService.init()` |
| 6 | Idempotency key cleanup is never scheduled — table grows indefinitely | **LOW** | Add cron job calling `cleanupExpired()` |
| 7 | `processWithIdempotency` generic helper is dead code | **LOW** | Either integrate it into webhook handler or remove it |
| 8 | Unhandled rejections only log, don't shutdown — may mask cascading failures | **LOW** | Consider `process.exit(1)` with graceful shutdown for unhandled rejections |
| 9 | No DB-level transactions anywhere — all multi-step ops risk partial failure | **MEDIUM** | Consider Supabase `rpc` wrapper that runs multiple operations in a single PostgreSQL function |
| 10 | Booking/order creation via controller (not transactional helper) can leave orphan records | **MEDIUM** | Always use the transactional helpers or wrap in RPC |
