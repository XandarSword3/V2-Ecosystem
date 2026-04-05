# INVENTORY B: AUTOMATED PROCESSES & SCHEDULED TASKS

> **Scope**: `v2-resort/backend/src/` — every cron job, background timer, script, webhook handler, and startup initialization.  
> **Generated from**: Actual source code reads, not speculation.

---

## Table of Contents

1. [Cron Jobs (node-cron)](#1-cron-jobs-node-cron)
2. [setInterval Timers](#2-setinterval-timers)
3. [Background Scripts](#3-background-scripts)
4. [Webhook Endpoints](#4-webhook-endpoints)
5. [Auto-Expiry & Lifecycle Logic](#5-auto-expiry--lifecycle-logic)
6. [Startup Initialization Sequence](#6-startup-initialization-sequence)
7. [Health Checks & Keep-Alive](#7-health-checks--keep-alive)
8. [State Machines & Side Effects](#8-state-machines--side-effects)
9. [Dead / Uninitialized Automated Processes](#9-dead--uninitialized-automated-processes)

---

## 1. Cron Jobs (node-cron)

All cron jobs are registered in `SchedulerService.init()` which is called from `src/index.ts` L39 at startup.

| Job | Schedule | File | Description | Error Handling |
|-----|----------|------|-------------|----------------|
| **Daily Backup** | `0 3 * * *` (3:00 AM) | `scheduler.service.ts` → `BackupService.createBackup()` → `backup.service.ts` | Full schema backup to Supabase Storage bucket. Fetches all tables, serializes to JSON, uploads to 'backups' bucket. | try/catch → `logger.error()` on failure, does not stop other jobs |
| **Pool Ticket Expiry (midnight)** | `0 0 * * *` (midnight) | `scheduler.service.ts` → `expirePoolTickets()` → `scripts/expire-pool-tickets.ts` | Finds `pool_tickets` with `status='valid'` and `ticket_date < today`, batch-updates to `status='expired'`, inserts `audit_log` entries per ticket. | try/catch → `logger.error()` |
| **Pool Ticket Expiry (4-hour)** | `0 4,8,12,16,20 * * *` | Same as above | Same logic, additional runs for better coverage | try/catch → `logger.error()` |
| **Session Cleanup** | `0 4 * * *` (4:00 AM) | `scheduler.service.ts` inline | Deletes `sessions` rows older than 7 days. Inserts `audit_log` entry with count of removed sessions. | try/catch → `logger.error()`, logs query failures separately |
| **Booking Reminders** | `0 9 * * *` (9:00 AM) | `scheduler.service.ts` → `bookingRemindersService.sendPreArrivalReminders()` → `booking-reminders.service.ts` | Queries confirmed `chalet_bookings` checking in tomorrow where `reminder_sent` is null/false. Sends email, marks `reminder_sent: true`. | try/catch → `logger.error()` |
| **Scheduled Report Delivery** | `*/5 * * * *` (every 5 min) | `reporting.service.ts` L1603 → `startScheduler()` | Queries `report_scheduled` where `is_active=true` and `next_run_at <= now`. Processes up to 10 due reports per run. Calls `executeScheduledReport()` per report. | try/catch per report → `logger.error()`, continues processing remaining |
| **Marketing Background** | `* * * * *` (every minute) | `marketing.service.ts` L1410 → `startBackgroundProcessing()` | Processes pending automations (50 at a time), pending journey steps, queued emails (20 at a time), scheduled campaigns. Uses `isProcessing` mutex flag. | **⚠ NEVER INITIALIZED** — see §9 |
| **Webhook Retry** | `setInterval(60000)` inside `startBackgroundProcessing()` | `webhook-retry.service.ts` L430 | Picks up to 10 pending retries with exponential backoff (1m→5m→30m→2h→24h, max 5 retries). Marks as 'failed' + emails admin after max retries. | **⚠ NEVER INITIALIZED** — see §9 |

### Cron Job Initialization Chain

```
index.ts L39
  └── SchedulerService.init()   (scheduler.service.ts)
        ├── scheduleDailyBackup()         → cron '0 3 * * *'
        ├── schedulePoolTicketExpiry()     → cron '0 0 * * *' + cron '0 4,8,12,16,20 * * *'
        ├── scheduleSessionCleanup()       → cron '0 4 * * *'
        ├── scheduleBookingReminders()     → cron '0 9 * * *'
        ├── reportingService.startScheduler() → cron '*/5 * * * *'
        └── scheduleDashboardMetricPush()  → setInterval(30_000)
```

**NOT in chain**:
- `marketingAutomationService.startBackgroundProcessing()` — never called
- `webhookRetryService.startBackgroundProcessing()` — never called
- `idempotencyGuard.cleanupExpired()` — never scheduled

---

## 2. setInterval Timers

| Timer | Interval | File & Line | Description |
|-------|----------|-------------|-------------|
| **Dashboard Metric Push** | 30 seconds | `scheduler.service.ts` → `scheduleDashboardMetricPush()` | Calls `businessMetricsService.getDashboardMetrics()`, emits to admin role via Socket.IO `dashboard:metrics` event. Errors silently ignored (best-effort). | 
| **Socket Connection Stats** | 60 seconds | `socket/index.ts` L234 | Logs `totalConnections` and `engineClients` count (debug level). Only logs if connections > 0. |
| **Biometric Challenge Cleanup** | 5 minutes | `auth/biometric.controller.ts` L22 | Iterates in-memory `challengeStore` Map, deletes entries where `expires < Date.now()`. Prevents memory leak from abandoned WebAuthn challenges. |
| **Circuit Breaker Monitoring** | Configurable | `utils/circuit-breaker.ts` L211 | Logs circuit breaker stats (state, failures, failureRate) when not in 'closed' state. Timer created per breaker instance. Has `destroy()` to clean up. |
| **Keep-Alive Pinger** | 30 seconds | `scripts/keep-alive.ts` | Pings productiom health endpoint to prevent Render cold starts. Standalone script, not part of main server process. |

---

## 3. Background Scripts

Located in `src/scripts/`:

| Script | File | Purpose | Invocation |
|--------|------|---------|------------|
| `expire-pool-tickets.ts` | `src/scripts/expire-pool-tickets.ts` | Finds valid tickets past their date, updates to 'expired', creates audit logs | Called by `SchedulerService` cron job |
| `keep-alive.ts` | `src/scripts/keep-alive.ts` | Pings `/health` every 30s to prevent cold starts | Standalone process (separate from main server) |
| `apply_rpc.ts` | `src/scripts/apply_rpc.ts` | Contains SQL for RPC functions (chalet availability check with `FOR UPDATE`) | Dev/migration utility, not runtime |
| `db_dump.ts` | Root level | Database dump utility | Manual/dev |
| `add_column.ts` | Root level | Schema migration utility | Manual/dev |
| `reg_check.ts` | Root level | Registration validation utility | Manual/dev |

---

## 4. Webhook Endpoints

### 4.1 Payment Webhooks

| Endpoint | Method | Auth | File | Events Handled |
|----------|--------|------|------|----------------|
| `POST /api/v1/payments/webhook/stripe` | POST | Stripe signature verification | `payment.routes.ts` → `payment.controller.ts` | `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` |

**Processing flow for `payment_intent.succeeded`**:
1. Verify Stripe webhook signature
2. Check `payment_ledger` for existing `webhook_id` (idempotency)
3. Check `payments` table for existing `stripe_payment_intent_id` (double guard)
4. Insert into `payment_ledger` (audit trail)
5. Insert into `payments` (status record)
6. Update reference entity status (`updateReferencePaymentStatus`)
7. Award loyalty points (`awardLoyaltyPointsForPayment`) — non-fatal

### 4.2 Channel Webhooks

| Endpoint | Method | Auth | File |
|----------|--------|------|------|
| `POST /webhooks/channels/webhooks/siteminder/:property_id/:channel` | POST | None (handler validates) | `channel.routes.ts` L72 |
| `POST /webhooks/channels/webhooks/ota/:property_id/:channel` | POST | None (handler validates) | `channel.routes.ts` L77 |

Mounted separately at `app.use('/webhooks/channels', channelWebhookRoutes)` outside the `/api/v1/` prefix.

### 4.3 Chargeback/Dispute Webhooks

| Event | Handler | File |
|-------|---------|------|
| `charge.dispute.created` | `handleDisputeCreated()` | `chargeback.service.ts` |
| `charge.dispute.updated` | `handleDisputeUpdated()` | `chargeback.service.ts` |
| `charge.dispute.closed` | `handleDisputeUpdated()` | `chargeback.service.ts` |

These are routed from the Stripe webhook handler in `payment.controller.ts`.

### 4.4 Webhook Retry Infrastructure

| Component | File | Status |
|-----------|------|--------|
| `WebhookRetryService` | `webhook-retry.service.ts` | Singleton exported, **never started** |
| `webhook_failures` table | — | DB table exists for retry queue |
| Exponential backoff schedule | 1m → 5m → 30m → 2h → 24h | Configured in service |
| Max retries | 5 | Then marks as 'failed' + admin email |
| Batch size | 10 retries per cycle | |
| Admin manual retry | `retryManually()` method | Available but service not running |

---

## 5. Auto-Expiry & Lifecycle Logic

### 5.1 Scheduled Expiry (Active)

| Entity | Mechanism | Schedule | File |
|--------|-----------|----------|------|
| Pool tickets | Script scans `pool_tickets` with `status='valid'` and `ticket_date < today` → updates to `status='expired'` | Midnight + every 4 hours | `expire-pool-tickets.ts` called by `scheduler.service.ts` |
| User sessions | DELETE from `sessions` older than 7 days | Daily at 4:00 AM | `scheduler.service.ts` inline |

### 5.2 Lazy Expiry (On Access)

| Entity | Trigger | Logic | File |
|--------|---------|-------|------|
| Gift cards | Balance check / redemption request | Compares `expires_at` to current date; returns error if expired | `giftcard.controller.ts` |
| Coupons | Validation / application | Checks `valid_from`, `valid_until` date range | `coupon.controller.ts` |
| Idempotency keys | (Should be cleaned up but isn't) | `cleanupExpired()` exists with 24h TTL | `idempotency-guard.ts` — **never called** |
| Webhook events | (Should be cleaned up but isn't) | `cleanupOldEvents()` exists with 30-day retention | `webhookIdempotency.service.ts` — **never called** |
| Biometric challenges | `setInterval` every 5 min | Deletes expired entries from in-memory Map | `biometric.controller.ts` L22 |

### 5.3 Soft Delete Pattern

The codebase uses `deleted_at` timestamp columns for soft deletes across ~15+ tables:

| Table | Soft Delete Column | Where Used |
|-------|-------------------|------------|
| `menu_items` | `deleted_at` | Restaurant menu management |
| `menu_categories` | `deleted_at` | Category management |
| `chalets` | `deleted_at` | Chalet management |
| `pool_sessions` | `deleted_at` | Pool session management |
| `staff_members` | `deleted_at` | Staff management |
| `restaurant_tables` | `deleted_at` | Table management |
| `coupons` | `deleted_at` | Coupon management |
| `giftcards` | `deleted_at` | Gift card management |
| Various others | `deleted_at` | Filtered with `.is('deleted_at', null)` in queries |

All queries filter `.is('deleted_at', null)` to exclude soft-deleted records. No scheduled job exists to permanently purge old soft-deleted records.

---

## 6. Startup Initialization Sequence

From `src/index.ts`:

```
main()
  │
  ├── 1. http.createServer(app)           ← Express app with all middleware
  │      └── app.ts middleware chain:
  │           ├── Sentry request handler
  │           ├── Helmet (security headers)
  │           ├── CORS
  │           ├── compression
  │           ├── cookie-parser
  │           ├── express.json (10mb limit)
  │           ├── CSRF protection
  │           ├── Morgan (HTTP logging)
  │           ├── Health check routes (/health, /api/health, /health/ready)
  │           ├── ~30+ module route mounts under /api/v1/
  │           ├── Channel webhook routes under /webhooks/channels
  │           ├── 404 handler
  │           └── Global error handler
  │
  ├── 2. initSentry(app)                  ← Error tracking
  │
  ├── 3. server.listen(port, '0.0.0.0')   ← Start accepting requests IMMEDIATELY
  │
  ├── 4. initializeDatabase()             ← BACKGROUND (non-blocking!)
  │      └── On failure: logged, server continues without DB
  │
  ├── 5. initializeSocketServer(server)    ← WebSocket (Socket.IO)
  │      └── Sets up namespaces, auth, connection tracking
  │      └── Starts socket stats interval (60s)
  │
  ├── 6. SchedulerService.init()           ← All cron jobs (see §1)
  │
  ├── 7. shutdown handlers                 ← SIGTERM, SIGINT
  │
  ├── 8. uncaughtException handler         ← Ignores "headers sent", shuts down for others
  │
  └── 9. unhandledRejection handler        ← Logs only, does NOT shutdown
```

**Key observation**: The server starts accepting HTTP requests (step 3) BEFORE the database is initialized (step 4). Health checks at `/health` will succeed even if DB hasn't connected yet (basic endpoint). The `/health/ready` endpoint WILL correctly report unhealthy if DB isn't ready.

---

## 7. Health Checks & Keep-Alive

### 7.1 Health Check Endpoints

| Endpoint | Purpose | Checks | Response |
|----------|---------|--------|----------|
| `GET /health` | Load balancer / basic liveness | DB ping (select `system_settings`) | `{ status, timestamp, dbLatency }` or 503 |
| `GET /api/health` | Basic liveness | None (always returns 200) | `{ status: 'ok' }` |
| `GET /health/ready` | Readiness probe | DB connectivity + latency | `{ status, db: { connected, latency } }` or 503 |
| `GET /health/detailed` | Monitoring dashboard | DB + Storage + Stripe + Email + Memory + CPU | Full `HealthCheckResult` object |

### 7.2 Keep-Alive Script (`src/scripts/keep-alive.ts`)

```
setInterval(30_000)
  └── fetch('https://<production-url>/health')
       └── Logs success/failure
       └── Prevents Render free-tier cold starts
```

Runs as a **separate process**, not part of the main server.

---

## 8. State Machines & Side Effects

### 8.1 State Machine Framework (`src/engines/state-machine.ts`)

The engine framework defines state machines for entity lifecycle management. Transitions can have **side effects** (fire-and-forget functions executed after successful state change).

| Engine Type | States | Key Transitions |
|-------------|--------|-----------------|
| `session_access` (Pool) | `valid → used → expired → cancelled` | `validate` (valid→valid), `enter` (valid→used), `exit` (used→used), `expire` (→expired), `cancel` (→cancelled) |
| `menu_service` (Restaurant) | `pending → confirmed → preparing → ready → served → completed → cancelled` | `confirm`, `start_prep`, `mark_ready`, `serve`, `complete`, `cancel` |

Side effects are executed after state transition succeeds. If a side effect fails, it is logged but does NOT revert the state transition.

### 8.2 Engine Service (`src/engines/engine-service.ts`)

High-level bridge between raw engines and module controllers:
- `calculatePricing()` — routes through unified pricing pipeline
- `transitionState()` — validates + executes state machine transitions
- `getAvailableActions()` — returns valid actions for UI

---

## 9. Dead / Uninitialized Automated Processes

| Process | Status | Impact | File |
|---------|--------|--------|------|
| **Marketing Background Processing** | `startBackgroundProcessing()` defined but **never called** anywhere in `src/` | Marketing automations, journey steps, queued emails, and scheduled campaigns are **never processed** | `marketing.service.ts` L1407 |
| **Webhook Retry Processing** | `startBackgroundProcessing()` defined but **never called** anywhere in `src/` — not imported in any source file | Failed webhooks recorded to `webhook_failures` table are **never retried**. Admin email alerts on max-retry are **never sent**. | `webhook-retry.service.ts` L430 |
| **Idempotency Key Cleanup** | `cleanupExpired()` defined but **no cron job** — not in `SchedulerService.init()` | `engine_idempotency_keys` table grows **indefinitely** | `idempotency-guard.ts` |
| **Webhook Event Cleanup** | `cleanupOldEvents()` defined but **never called** | `processed_webhook_events` table grows **indefinitely** (if it were being used — currently also dead code) | `webhookIdempotency.service.ts` L121 |
| **Generic Webhook Idempotency** | `processWithIdempotency()` defined but **never imported** in production source | Available safety net is **unused** — payment webhook uses its own inline check instead | `webhookIdempotency.service.ts` L73 |
| **Circuit Breaker** | Class defined and exported but **no production imports found** | Available resilience pattern is **unused** | `utils/circuit-breaker.ts` |
| **Soft Delete Purge** | No job exists to permanently delete records with `deleted_at` set | Soft-deleted records accumulate **indefinitely** in ~15+ tables | N/A |

---

## Summary: Complete Process Map

```
STARTUP
  ├── HTTP Server (immediate)
  ├── Sentry (immediate)
  ├── Database (background, async)
  ├── Socket.IO (immediate)
  │     └── setInterval: connection stats (60s)
  └── SchedulerService.init()
        ├── cron: daily backup (3:00 AM)
        ├── cron: pool ticket expiry (midnight + every 4h)
        ├── cron: session cleanup (4:00 AM)
        ├── cron: booking reminders (9:00 AM)
        ├── cron: report delivery (every 5 min)
        └── setInterval: dashboard metrics push (30s)

ALWAYS-ON TIMERS
  ├── Biometric challenge cleanup (5 min)
  ├── Socket stats logging (60s)
  ├── Dashboard metrics push (30s)
  └── Circuit breaker monitoring (configurable, if instantiated)

WEBHOOK ENDPOINTS
  ├── POST /api/v1/payments/webhook/stripe
  │     ├── payment_intent.succeeded → record + update status + loyalty
  │     ├── payment_intent.payment_failed → record failure
  │     ├── charge.refunded → record refund
  │     ├── charge.dispute.created → create chargeback
  │     └── charge.dispute.updated/closed → update chargeback
  ├── POST /webhooks/channels/webhooks/siteminder/:property_id/:channel
  └── POST /webhooks/channels/webhooks/ota/:property_id/:channel

NEVER STARTED (DEAD)
  ├── ✗ Marketing automation processing (every minute)
  ├── ✗ Webhook retry processing (every 60s)
  ├── ✗ Idempotency key cleanup
  ├── ✗ Webhook event cleanup
  └── ✗ Soft delete purge

EXTERNAL PROCESS
  └── keep-alive.ts → pings /health every 30s (separate process)
```

---

## Recommendations

| # | Item | Priority | Action |
|---|------|----------|--------|
| 1 | Start marketing background processing | **HIGH** | Add `marketingAutomationService.startBackgroundProcessing()` to `SchedulerService.init()` |
| 2 | Start webhook retry processing | **HIGH** | Add `webhookRetryService.startBackgroundProcessing()` to `SchedulerService.init()` (import the service first) |
| 3 | Schedule idempotency key cleanup | **MEDIUM** | Add cron job in scheduler calling `cleanupExpired()` (e.g., daily at 2:00 AM) |
| 4 | Add soft-delete purge job | **LOW** | Creates a nightly job to permanently DELETE records where `deleted_at` is older than N days |
| 5 | Gift card scheduled expiry | **LOW** | Currently lazy-only; consider a nightly job to mark expired gift cards for reporting accuracy |
| 6 | Integrate or remove dead webhook idempotency service | **LOW** | Either wire `processWithIdempotency()` into payment webhook handler, or delete the file |
| 7 | Integrate or remove circuit breaker | **LOW** | Wire it into external service calls (Stripe, email) or remove to reduce dead code |
