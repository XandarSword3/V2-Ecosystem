# Production Readiness Audit — Engine A (`instant_transaction`) & Engine E (`platform_entitlement`)

**Date:** 2026-11-20
**Auditor:** automated read-only audit
**Repo:** `v2-resort` (monorepo under `C:\Alessandro\Work\Attempts to Code\V2 Ecosystem`)
**Mode:** read-only. No fixes, no commits, no production/remote data mutation. All live checks were run against the local Supabase stack (`127.0.0.1:15421` / `:15432`) and local Redis (`:6380`). Adversarial probes were run from the shell; no throwaway files were left in the repo.

> **Blunt summary:** Engine A's *customer* checkout is materially hardened (server-side pricing, atomic order RPCs, idempotency, fatal ledger write, compensation). Engine A's *staff POS* path is not: it creates `confirmed` orders with no payment/ledger rows, has no creation-time idempotency, uses the legacy inventory RPC, and reports every payment as `paid` even when it is partial. Engine E can charge a customer and then fail to provision them, and it maps Stripe `incomplete` to `trialing` (access without confirmed payment). Tenant isolation is enforced by a service-role client plus manual filters, not by RLS; the RLS layer that *does* exist is partly broken and partly absent. This is not a GA codebase, and it is not a paid-pilot codebase until the P0 items below are closed.

---

## 0. Remediation status (added 2026-11-22)

The findings below are the original point-in-time audit and are left unchanged. All twelve P0 blockers (P0-1 to P0-12) have since been fixed **in the working tree of branch `engine-a-implementation`, uncommitted**, and verified against the **local** Supabase stack. On 2026-11-22 migrations `20261120100000`, `20261120100100` and `20261120100200` were also applied to the **production** database (see "Production rollout" below). No commits were made.

| P0 | Fix |
|---|---|
| P0-1 | Redemption RPCs take a required `p_tenant_id`; old overloads dropped; all callers pass the tenant; discount resolvers fail closed without one. |
| P0-2 | RLS enabled on the 9 flagged tables; anon/authenticated grants tightened (internal tables revoked, `translations` public-read). |
| P0-3 | Recursive `users` / `payments` policies removed; non-recursive `users_self_read` and `tenants_platform_admin_read` in place. |
| P0-4 | Staff POS settlement writes `payments` / `payment_ledger` tender rows. |
| P0-5 | Staff order creation requires an `Idempotency-Key` header or `body.idempotencyKey`; the frontend POS generates one per submit. |
| P0-6 | Provisioning is resumable: retries repair missing child rows and redeliver the welcome email from a durable outbox. |
| P0-7 | `checkout.session.completed` throws (HTTP 500, Stripe retries) on missing metadata, unresolvable subscription, or missing operator email. |
| P0-8 | Stripe `incomplete` now maps to `past_due`, not `trialing`. |
| P0-9 | Loyalty reversal is tenant-scoped (`reverse_loyalty_redemption` returns false without a tenant). |
| P0-10 | `IdempotencyGuard` claims keys atomically via `claim_engine_idempotency_key`. |
| P0-11 | Refunds go through a mutable `refund_intents` table with a unique idempotency key and Stripe idempotency (`payment_ledger` is fully immutable, so it cannot hold intent state). |
| P0-12 | The per-property Stripe webhook skips the tenant billing gate (`skipTenantGate`). |

**Verification (2026-11-22, local stack):**

- Backend `npx tsc --noEmit` and frontend `npx tsc --noEmit`: clean.
- Backend unit suite: 222 files, 4411 tests passed, 6 skipped.
- Integration suites `engine-a-order-lifecycle`, `payment-integrity`, `stripe-provisioning-webhook`, `rls-tenant-isolation`, `phase1-cross-tenant`: 5 files, 35 tests passed. `engine-a-order-lifecycle` needed a test-only update: its 12 staff order-creation calls now send an `Idempotency-Key` (required by P0-5).
- Live DB checks: cross-tenant and null-tenant redemption rejected, correct-tenant redemption succeeded; the `claim_engine_idempotency_key` lifecycle behaves as designed; RLS, grants, and the unique indexes listed in the migrations are present.

**Not yet done, so the verdicts in section 1 are not upgraded:**

- The tenant-scoped backend code is still uncommitted and not deployed. Production currently has both the old and the new redemption RPC overloads. Run `20261120100300_p0_drop_legacy_redemption_overloads.sql` as soon as the new backend is live: the old overloads are the cross-tenant hole (P0-1) and stay open until then.
- P1-1 to P1-10 and the section 4 and 5 items were not in scope and remain open.
- Playwright e2e specs and real Stripe webhook delivery were not run.
- No staging environment exists in this repo; every remote config points at the single production project, so the rollout went straight to production.
- A re-run with the local Redis test container up (`:6380`) passed the same five integration suites plus `redis-money-uses` (6 files, 37 tests).

**Production rollout (2026-11-22):**

- Applied to production, each in its own transaction with a 10 s lock timeout, and recorded in `supabase_migrations.schema_migrations`: `20261120100000_p0_security_foundation`, `20261120100100_p0_provisioning_resumable`, `20261120100200_p0_refund_intents`.
- `20261120100000` was applied **without** its three `DROP FUNCTION` statements for the legacy redemption overloads, so the currently deployed backend keeps working. Those drops moved to `20261120100300_p0_drop_legacy_redemption_overloads.sql`, which is **not yet applied**.
- Verified in production afterwards (read-only catalog checks): RLS enabled on all 9 target tables; anon access removed from the four sensitive tables and `translations` left public-read; recursive `users` / `payments` policies replaced; `refund_intents`, `provisioning_email_outbox`, `claim_engine_idempotency_key` and `reverse_loyalty_redemption` exist; the four unique indexes exist; `engine_idempotency_keys.property_id` is nullable. Behavior probes of the redemption functions were **not** run against production.
- Pre-change snapshot (ledger, old function definitions and ACLs, policies, RLS flags, grants, indexes): `prod-backups/2026-11-22-pre-p0/prod_pre_p0_snapshot.txt`, next to this repo. A full `pg_dump` was not possible through the pooler.
- Production's migration ledger still stops at `20261104140000` before these three rows, so the `20261110*` to `20261119*` migrations are not recorded there even if their effects were applied by other means. That gap predates this work.
- During the rollout, a failed `pg_dump` attempt left a session (pid 2147030) idle in a transaction holding locks; it was terminated before applying.

---

## 1. Verdicts

| Engine | Verdict | Justification |
|---|---|---|
| **Engine A — `instant_transaction`** | **NOT READY** (closed beta only with staff POS disabled) | The customer checkout path is the best-engineered part of the repo: authoritative server-side pricing, atomic order/item/inventory RPCs, scoped idempotency, fatal ledger writes with rollback, and compensation. But the staff POS path bypasses all of that (no `payments`/`payment_ledger` row at creation, no creation idempotency, partial payments never journaled, response always says `paid`), and the shared redemption RPCs are not tenant-scoped. A resort that turns on staff POS will lose/duplicate revenue. |
| **Engine E — `platform_entitlement`** | **NOT READY** | Provisioning is a non-transactional sequence that leaves a half-built tenant behind on failure and then refuses to retry (idempotent no-op on the existing `stripe_subscription_id`). `checkout.session.completed` silently ACKs (HTTP 200) when metadata is missing or the subscription cannot be resolved, so a charged customer can be left unprovisioned with no retry. `incomplete` subscriptions are mapped to `trialing`, granting access before payment is confirmed. Webhook idempotency is check-then-act and best-effort. |
| **Peripheral (frontend / DB / ops)** | **NOT READY** | 9 public tables have RLS disabled, 5 of them are anon-readable (`reservations`, `expenses`, `shift_cash_movements`, `staff_reviews`, `translations`); `users`/`payments`/`tenants` RLS policies recurse and return `500 42P17`; the frontend layout fetches platform-root settings for every tenant; JSON-LD and builder links are unescaped/unvalidated; the backend `.env` points at a remote Supabase project. |

---

## 2. Scorecard (0–5)

### Engine A

| Dimension | Score | Why |
|---|---:|---|
| Money math correctness | **4** | `pricing-pipeline.ts` uses exact bigint Money, requires explicit currency, enforces component invariants, and throws on violation. Quantity is validated (integer, 1–50) and prices are resolved server-side in `catalog-pricing.service.ts`. Deductions: loyalty is hardcoded at 100 pts = $1, and `bookable_units`/`accommodation_add_ons` lookups are not module/tenant-scoped. |
| Tenant isolation | **2** | `getSupabase()` is the service-role client (`backend/src/database/supabase.ts:8-10`); 762 call sites vs 22 `getScopedClient(` sites. `transactions` is deliberately excluded from `TENANT_SCOPED_TABLES` (`security/scoped-client.ts:33-65`). Redemption RPCs select by code with no tenant predicate. |
| Idempotency / concurrency | **2** | Customer checkout has a scoped idempotency key and atomic RPCs. Staff create has none. `IdempotencyGuard.executeOnce` is check-then-upsert and proceeds unprotected on claim error (`engines/idempotency-guard.ts:104-164`). `payments.stripe_payment_intent_id` has no unique index. |
| Ledger / reconciliation | **2** | Customer path writes the engine ledger fatally. Staff `payModuleOrder` writes the engine ledger only on full payment, never writes `payments`/`payment_ledger`, and ignores partial tenders. `postRoomCharge`/`settleFolioBalance` are non-transactional and non-idempotent. |
| Test coverage of critical paths | **2** | 4,407 unit tests pass, but the integration suite skips whole files (`data-integrity`, `auth-mobile`, `biometric-auth`, `offline-queue`, `push-notification`, Phase L flags) and reuses a stale schema. No test covers staff POS ledger/payment creation, cross-tenant redemption, refund double-spend, or provisioning partial failure. |
| Operability / observability | **3** | Structured logging and Sentry are present; ledger failures are logged. But many failures are "non-fatal" warnings (`welcome email`, `fiscal document`, `billing_history`, `user_property_access`), which is exactly where money/access is lost. |
| Security (auth/XSS/secrets) | **2** | Tenant binding is enforced in `auth.middleware.ts`, install gate is solid, and the frontend no longer embeds a Supabase client. But builder `href`/`src` and JSON-LD are unescaped, public module listing is tenant-enumerable via `X-Tenant-Slug`, and 9 tables lack RLS. |

### Engine E

| Dimension | Score | Why |
|---|---:|---|
| Billing correctness | **2** | `incomplete → trialing` (`services/saas-billing.service.ts:494`) grants access before payment. `getOrCreateCustomer` matches by email globally (`:270`). Portal returns to the platform URL, not the tenant. |
| Tenant lifecycle | **2** | `provisioning.service.ts` is a non-transactional sequence; partial failure leaves a tenant row with `stripe_subscription_id` and no property/owner, and retry returns `created: false` (`:142-187`). Welcome email is fire-and-forget; credentials may never reach the customer. |
| Webhook robustness | **2** | Signature verification is real and fails closed (`saas-webhook.controller.ts:30-45`). Idempotency is check-then-act and `billing_history` writes are best-effort/swallowed (`:287-305`, `:333-366`). Missing metadata / unresolvable subscription → `break` → HTTP 200, no retry (`:92-95`, `:109-110`). |
| Tenant isolation | **2** | Platform routes are `super_admin`-gated. Public `getTenantBySlug` exposes `billing_status`. Per-tenant Stripe settings exist but the membership-renewal cron uses the global platform Stripe client. |
| Test coverage | **2** | No integration test for provisioning partial failure, webhook replay/concurrency, `incomplete` mapping, or Stripe cancellation compensation. |
| Operability | **2** | Provisioning failure cancels the subscription (good), but the customer is already charged and the failure is terminal. No retry/resume. |
| Security | **3** | Stripe signature verification, zod validation on public checkout, email/subdomain uniqueness checks. Deductions: check-then-act uniqueness races, global customer reuse by email. |

### Peripheral

| Dimension | Score | Why |
|---|---:|---|
| Frontend | **3** | React text rendering avoids most XSS, and DOMPurify exists for CMS HTML. But JSON-LD is injected via `JSON.stringify` without escaping `</script>`, builder links accept arbitrary schemes, and tenant branding is fetched from platform-root settings. |
| Database / RLS | **2** | 230/239 tables have RLS; 9 do not, and 5 of those are anon-readable. `users`/`payments`/`tenants` policies recurse. `modules.slug` has no unique constraint. Local schema is 4 migrations behind repo head while function bodies are ahead of the migration ledger. |
| Install gate | **4** | `INSTALL_ENABLED` defaults off, token is immutable, `superAdminExists()` fails closed, POST returns 409 once initialized (`install.controller.ts:39`, `:211-212`, `:247`). Frontend bypass flags are redirect-only. |
| Docs / claims accuracy | **2** | Split-bill is documented but `order_payment_splits` has no backend code references and 0 rows. The `engine_v2_*` flags exist but gate nothing. Several "fixed" comments describe behavior the code does not have. |

---

## 3. Launch blockers

Severity legend: **P0** = blocks paid pilot / GA; **P1** = blocks scale or creates material financial/reputational risk; **P2** = should fix before GA.

### P0-1 — Redemption RPCs are not tenant-scoped (cross-tenant gift-card/coupon/loyalty spend)

**Evidence (confirmed):**
- `supabase/migrations/20261119110000_redemption_functions_tenant_scope.sql:38-43` selects a gift card by `WHERE code = UPPER(p_code)` only. `:151-157` selects a coupon by `WHERE code = UPPER(p_code)` only. `:95` selects a loyalty member by `user_id` only.
- `backend/src/engines/discount-resolvers.ts:98-107` calls `apply_coupon_atomic` with code + user + total + module type — no tenant. `:190-194` calls `redeem_giftcard_atomic` with code + amount — no tenant. `:258-266` calls `redeem_loyalty_points_atomic` with user + points — no tenant.
- Local DB confirms `gift_cards.tenant_id`, `coupons.tenant_id`, `coupon_usage.tenant_id`, `gift_card_transactions.tenant_id`, `loyalty_transactions.tenant_id` are all `NOT NULL`, but the functions do not filter on them.

**Impact:** Tenant B can redeem Tenant A's gift card (debits A's balance, discounts B's order) and apply Tenant A's coupon. Loyalty is per-user, so the cross-tenant risk there is lower, but a user who belongs to multiple tenants can spend points in the wrong tenant. This is a direct money leak and a cross-tenant data write.

**Smallest credible fix:** Add `p_tenant_id uuid` (and `p_property_id` where applicable) to all three RPCs, filter the lookup by it, and pass the resolved tenant from the pricing context. Add a unique index on `(tenant_id, code)` for `gift_cards` and `coupons`.

---

### P0-2 — Nine public tables have RLS disabled; five are anon-readable

**Evidence (confirmed, live):**
- `pg_class`: RLS = false for `checkout_compensation_log`, `checkout_compensation_queue`, `engine_fulfillment_capabilities`, `expenses`, `idempotency_records`, `reservations`, `shift_cash_movements`, `staff_reviews`, `translations`.
- `information_schema.role_table_grants`: `anon` has `SELECT` on `expenses`, `reservations`, `shift_cash_movements`, `staff_reviews`, `translations`.
- Live anon PostgREST probe (local stack): `GET /rest/v1/reservations?select=*&limit=1` → `200 []`; same for `expenses`, `staff_reviews`, `translations`, `shift_cash_movements`. The local tables are empty, so no rows were returned, but the grant + disabled-RLS combination is exactly what allows a full read in an environment where those tables have data.
- `GET /rest/v1/transactions` with anon → `401 42501 permission denied for table transactions` (this one is correctly locked down).

**Impact:** Anyone with the public anon key (which is shipped to every browser) can read reservations (customer names/phones), expenses (financial), shift cash movements (financial), staff reviews, and translations. This is a P0 data-exposure finding.

**Smallest credible fix:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all nine, add tenant/property policies, and `REVOKE SELECT ON ... FROM anon, authenticated` for tables that should never be client-readable. Add a CI check that every `public` table has RLS enabled.

---

### P0-3 — `users` / `payments` / `tenants` RLS policies recurse (`42P17`)

**Evidence (confirmed, live):**
- `pg_policies`: `users_self_read` and `users_admin_write` both contain `EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() ...)` — a policy on `users` that subqueries `users`.
- `payments_staff_read` / `payments_admin_write` and `tenants_platform_admin_read` also subquery `users`.
- Live authenticated probe: `GET /rest/v1/users`, `/rest/v1/payments`, `/rest/v1/tenants` → `500 {"code":"42P17","message":"infinite recursion detected in policy for relation \"users\""}`.
- Live authenticated probe on `transactions` → `200`, and a cross-tenant transaction id returns `[]` (RLS works there).

**Impact:** Any direct Supabase client (mobile app, realtime, future serverless function) that reads `users`, `payments`, or `tenants` is broken. It also means the RLS layer has not been exercised end-to-end; the working `transactions` policy is the exception, not the rule. The recursion is an error, not a bypass, but it is a hard availability and correctness failure.

**Smallest credible fix:** Drop the recursive policies and replace them with `SECURITY DEFINER` helper functions (`user_is_staff(auth.uid())`, `user_is_admin(auth.uid())`, `user_is_platform_admin(auth.uid())`) that query `users` with RLS bypassed, or use `auth.jwt()` claims (`app_metadata.role`, `app_metadata.tenant_id`) instead of table lookups. Add an integration test that hits each table through PostgREST with anon and authenticated tokens.

---

### P0-4 — Staff POS settlement never writes `payments` / `payment_ledger`, and always reports `paid`

**Evidence (confirmed):**
- `backend/src/modules/staff/module-staff.controller.ts:2329-2367` inserts the order as `status: 'confirmed'`, `metadata.payment_status: 'unpaid'` — no `payments` row, no `payment_ledger` row, no `engine_financial_ledger` row.
- `:2952-2953` computes `isFullyPaid` / `paymentStatus` (`paid` vs `partial`), but `:2961-2996` writes the engine ledger **only** when `isFullyPaid && pricingSnapshot`. Partial tenders are never journaled.
- `:3089` and `:3101` unconditionally emit/return `paymentStatus: 'paid'`, even when `paymentStatus` is `partial`.
- `:2966` uses `tenantId: req.user?.tenantId || 'unknown'` for the ledger.
- No `payments` row and no `payment_ledger` row are written anywhere in `payModuleOrder`.

**Impact:** Cash/quick-order revenue is invisible to the `payments` and `payment_ledger` tables that reporting/reconciliation read. Partial payments are recorded only as order metadata, so a customer can pay half and the system reports `paid`. The response lies to the UI.

**Smallest credible fix:** On every tender, insert a `payments` row and a `payment_ledger` row (with the actual amount and `partial`/`completed` status), and return `paymentStatus` from the computed value. Journal each tender, not only the full-payment transition. Replace `'unknown'` with a hard failure if `tenantId` is absent.

---

### P0-5 — Staff order creation has no idempotency; double-submit duplicates orders and stock deductions

**Evidence (confirmed):**
- `module-staff.controller.ts:2128-2392` — the create handler reads `items`, prices them, inserts `transactions`, and calls `deduct_inventory_for_order_items`. There is no idempotency key, no `claim_idempotency_key`, and no unique request constraint.
- The customer path does have a scoped key (`dynamic-module.router.ts:1264-1272`), which highlights the gap.

**Impact:** A double-tap, retry, or flaky network on the POS creates two orders and deducts stock twice. On a busy service floor this is a routine occurrence.

**Smallest credible fix:** Require an `Idempotency-Key` (or client-generated UUID) on staff order creation and route it through the existing `claim_idempotency_key` / `complete_idempotency_key` RPCs, scoped by `tenant:property:module:staff:key`.

---

### P0-6 — Engine E provisioning is non-transactional and not resumable

**Evidence (confirmed):**
- `backend/src/modules/platform/provisioning.service.ts:142-187` — idempotency check returns `created: false` for any existing tenant with the same `stripe_subscription_id`, without verifying that the property group, property, owner, and access row exist.
- `:189-322` — tenant row is inserted first, then property group, then property, then owner user, then `user_property_access`. Each step can fail after the previous ones committed. The function has no transaction/RPC and no compensation for the tenant row.
- `:296-298` — failure to create `user_property_access` is logged and ignored.
- `:301` — `invalidateTenantCache(tenantId, subdomain)` is called without `await`.
- `:311-314` — welcome email is fire-and-forget; on failure the credentials are only logged (redacted in production).

**Impact:** A paid customer can be left with a tenant row that has `billing_status` set but no property and no owner. The webhook's compensation cancels the Stripe subscription (`saas-webhook.controller.ts:147-159`), so the customer is charged, then cancelled, then unable to retry because the tenant row exists. That is a permanent broken tenant.

**Smallest credible fix:** Move provisioning into a single `provision_tenant` SQL function (or a saga with a `provisioning_state` column and idempotent steps). Make the idempotency check verify all child rows, not just the tenant row. Send the welcome email through a durable outbox with a resend action.

---

### P0-7 — `checkout.session.completed` silently ACKs when it cannot provision

**Evidence (confirmed):**
- `saas-webhook.controller.ts:92-95` — if `metadata.tenantId` or `metadata.subdomain` is missing, it logs and `break`s; the outer handler returns `200`.
- `:109-110` — if `resolveSubscription` returns null, it `break`s; `200`.
- `:132-133` — `operatorEmail: session.customer_details?.email ?? ''`, `operatorName: ... ?? ''`. An empty email will fail the `users` insert (or create a broken user), which then triggers the cancel-compensation path.

**Impact:** Stripe considers the event delivered. The customer is charged and never provisioned. There is no retry, no alert, and no operator queue. This is the single most dangerous Engine E failure mode.

**Smallest credible fix:** Throw (→ HTTP 500) on missing metadata or unresolvable subscription so Stripe retries, and add a dead-letter/alert after N retries. Validate the email before calling `provision`, and fall back to `session.customer_email` / `customer.email`.

---

### P0-8 — `incomplete` Stripe subscriptions are mapped to `trialing` (access without payment)

**Evidence (confirmed):**
- `backend/src/services/saas-billing.service.ts:487-499`, specifically `:494`: `incomplete: 'trialing', // payment not yet confirmed — stay in trial-like state`.
- `tenantAccess.middleware.ts` allows `active` and `trialing`; `past_due` is read-only; `suspended`/`cancelled` are blocked.
- `saas-webhook.controller.ts:131` passes `SaasBillingService.mapStripeToBillingStatus(subscription.status)` into `provision`.

**Impact:** A subscription whose first invoice is `incomplete` (SCA pending, failed payment, etc.) gets full access. If the payment never completes, the tenant keeps using the product until Stripe eventually marks it `incomplete_expired` (which maps to `cancelled`). That is a revenue leak and a collections problem.

**Smallest credible fix:** Map `incomplete` to `past_due` (read-only) or `suspended` (blocked), and only grant `active`/`trialing` on `active`/`trialing`. Add a webhook test for `incomplete`.

---

### P0-9 — Loyalty redemption is never reversed; discount consumption can leak on pricing failure

**Evidence (confirmed):**
- `backend/src/engines/discount-reversal.ts:124-129` — `else if (discount.type === 'loyalty')` logs `Loyalty point redemption was consumed but reversal is not implemented`.
- `backend/src/routes/dynamic-module.router.ts:1139` declares `appliedDiscounts` as `undefined`; `:1341` calls `calculatePricing`; `:1355` assigns `appliedDiscounts = pricing.discounts`. If `calculatePricing` throws after a coupon/gift-card/loyalty redemption (the pipeline can throw on an invariant violation), `rollbackFailedOrder` receives `undefined` and reverses nothing.
- `discount-resolvers.ts:98-107` / `:190-194` / `:258-266` consume the discount with `p_order_id: null` during pricing, before the order exists.

**Impact:** Points, coupons, and gift-card balances can be consumed without a completed order. Loyalty is guaranteed to leak on any failed/cancelled/refunded order; coupon/gift card leak on pricing exceptions.

**Smallest credible fix:** Implement `reverse_loyalty_redemption` and call it from `reverseDiscounts`. Change the pricing pipeline to return consumed redemptions even on failure (or use a reservation/hold pattern) so `rollbackFailedOrder` can always reverse. Prefer consuming only after the order row exists.

---

### P0-10 — `IdempotencyGuard.executeOnce` is not atomic and fails open

**Evidence (confirmed):**
- `backend/src/engines/idempotency-guard.ts:104-139` — `SELECT` then branch.
- `:141-155` — `upsert(..., { onConflict: 'key' })` with `status: 'processing'`. This **overwrites a completed key back to `processing`**, so a concurrent duplicate can re-execute an already-completed operation.
- `:157-164` — on claim error it logs and **proceeds without idempotency protection** (`better to process than to block entirely`).
- `payments.stripe_payment_intent_id` has no unique index (verified in `pg_indexes`), so the `payments` check-then-insert at `payment.controller.ts:621-647` can create duplicate rows under concurrency. `payment_ledger.webhook_id` does have a unique index (`uq_payment_ledger_webhook`), which is the only backstop.

**Impact:** Concurrent Stripe deliveries (Stripe does retry) can double-process `payment_intent.succeeded`; the ledger unique index prevents a double ledger row but not a duplicate `payments` row. Other operations (state transitions, refunds) have no such backstop.

**Smallest credible fix:** Claim with an atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING` RPC, never downgrade `completed`, and fail closed on claim errors (return 409/500 so the caller retries). Add a unique index on `payments.stripe_payment_intent_id` (partial, where not null).

---

### P0-11 — Refund path can double-refund

**Evidence (confirmed):**
- `payment.controller.ts:1700-1709` computes `alreadyRefunded` from `payment_ledger` refund rows. For card refunds, the refund row is written by the `charge.refunded` webhook, not synchronously.
- `:1745-1749` calls `stripe.refunds.create` **without an idempotency key**, before any local refund record exists.
- `:1754-1759` updates `payments` (status/notes) but does not persist a refund amount that the cap query reads.
- If the webhook is delayed or lost (see P0-12), a second refund request sees the old `alreadyRefunded` and can refund the full remaining amount again.
- For cash/manual refunds, `:1773-1815` writes the engine ledger and `payment_ledger` inside a `try`; if either fails it throws **after** the `payments` update, so a retry has no refund record and can refund again.

**Impact:** Real money leaves the account twice. This is a P0 for any deployment that processes card refunds.

**Smallest credible fix:** Insert a local `refund_intent`/`payment_ledger` row (with the amount) **before** calling Stripe, pass a deterministic `idempotencyKey` to `stripe.refunds.create`, and make the cap query authoritative on that local row. For cash/manual, wrap the ledger + payment update in a transaction.

---

### P0-12 — Per-property Stripe webhook is subject to the tenant billing gate

**Evidence (confirmed):**
- `backend/src/app.ts:87-92` mounts the SaaS webhook with `skipTenantGate`.
- `backend/src/app.ts:97-105` mounts the per-property webhook **without** `skipTenantGate`; it only sets `rawBody` and calls `next()`. The request then flows through `express.json`, CSRF (exempt path), `app.use('/api', tenantGate, resolveProperty, publicRoutes)`, and `apiRouter`.
- `tenantAccess.middleware.ts:38-39` documents that only the SaaS webhook is exempt; `:301` and `:417` honor `req.skipTenantGate`.
- `payment.routes.ts:9` mounts `POST /webhook/stripe` on the payments router.

**Impact:** Payment/refund webhooks for a suspended/cancelled tenant (or when platform-root resolution fails) return 402/404 instead of processing. Stripe retries, then gives up. Payment state and the ledger diverge. This interacts with P0-11 to make double-refunds more likely.

**Smallest credible fix:** Add `skipTenantGate` to the per-property webhook mount (it resolves its own tenant from the signed event). Keep the tenant resolution inside `handleStripeWebhook`.

---

### P1-1 — `recordManualPayment` proceeds when the reference cannot be resolved

**Evidence (confirmed):**
- `payment.controller.ts:1296-1304` — `try { resolveReferenceTenantProperty } catch { /* proceed with request context */ }`.
- `:1314` — `authoritativeAmount` stays `null`, so the under-tender check is skipped and `isFullPayment` is `true` (`:1331`).
- `:1341-1358` inserts a `completed` `payments` row for the submitted amount against the (unverified) `referenceId`.
- `:1389` then calls `updateReferencePaymentStatus`, which throws if the transaction does not exist — leaving the inserted payment row (and, for cash/card, the ledger row) behind.

**Impact:** Staff can record arbitrary "payments" against non-existent or other references, inflating revenue and creating orphan ledger rows. The rollback only covers ledger-write failure, not reference-resolution failure.

**Smallest credible fix:** Fail closed (`400/404`) when the reference cannot be resolved. Remove the "unit-test mock" carve-out from production code; mock the resolver in tests instead.

---

### P1-2 — `postRoomCharge` / `settleFolioBalance` are non-transactional, non-idempotent, and allow overpayment

**Evidence (confirmed):**
- `payment.controller.ts:2035-2077` — inserts `payment_ledger`, then `payments`, then updates the order. No transaction; a failure after the ledger insert leaves a charge with no payment row.
- No idempotency: concurrent `postRoomCharge` calls (or a retry after the final status update fails) both pass the `order.status` check at `:1985-1987` and create two `charge` entries for the same order. `settleFolioBalance` has no order-status check at all, so two sequential settlements both succeed.
- `:2170-2207` — `settleFolioBalance` inserts the ledger entry, then ignores the `payments` insert error (`await supabase.from('payments').insert(...)` with no error check).
- `:2220-2226` — computes `remainingBalance` with `Math.max(0, ...)` but never rejects `amount > remainingBalance`, so overpayment is silently accepted and the excess is not tracked as a credit.

**Impact:** Double charges on folio, lost payment rows, and unrecorded overpayments. For a hotel folio this is a direct guest-billing dispute.

**Smallest credible fix:** Wrap both in a single SQL RPC (charge + payment + status update), add an idempotency key, and reject settlements above the outstanding balance (or record the excess as a credit).

---

### P1-3 — Membership renewal uses the global Stripe client and expires on the first failure

**Evidence (confirmed):**
- `backend/src/jobs/membership-renewal.job.ts:4` imports `stripeClient` from `config/stripe.ts`, which is constructed from the platform `STRIPE_SECRET_KEY` (`config/stripe.ts:4-6`).
- `:169-178` creates and pays the invoice through that global client.
- `:229-233` marks the membership `EXPIRED` after a single failed attempt; there is no retry/dunning.
- `:260-264` queries `pool_memberships` across all tenants.

**Impact:** Tenants that have their own Stripe account (`tenant_payment_settings`) will have renewals fail (the platform account does not own their subscription), and the membership is immediately expired. Even for platform-billed tenants, a transient Stripe error expires the membership.

**Smallest credible fix:** Resolve the tenant's Stripe client from `tenant_payment_settings` (the same `getStripeInstance` used by payments), and add bounded retries with dunning before expiring.

---

### P1-4 — Multi-tenant branding/SEO is fetched from platform-root settings

**Evidence (confirmed):**
- `frontend/src/app/layout.tsx:25-36` — `getSiteSettings()` fetches `${baseUrl}/api/settings` with `next: { revalidate: 60 }` and **no tenant/property headers**.
- `app.ts:195` mounts `/api/settings` with `resolveTenant` + `resolveProperty`; with no headers/subdomain, `resolveTenant` falls back to the platform-root tenant (`tenantAccess.middleware.ts:359-367`).

**Impact:** Every tenant's public site renders the platform-root branding, site name, SEO metadata, and theme. This is a visible multi-tenant correctness failure and can leak the platform operator's contact details.

**Smallest credible fix:** Resolve the tenant from the request host in `layout.tsx` (or call a server-side helper that reads the `Host` header) and pass `X-Tenant-Slug`/`X-Property-Slug` to `/api/settings`.

---

### P1-5 — Stored XSS surface in builder links and JSON-LD

**Evidence (confirmed):**
- `frontend/src/components/module-builder/DynamicModuleRenderer.tsx:402` `src={background.video.url}`, `:449` `src={layer.content.src}`, `:737` `<a href={props.href}>`, `:863` `href={props.primaryUrl || '#'}`, `:878` `href={props.secondaryUrl || '#'}`, `:922` `<img src={card.image}>`, `:1318` `src={item.image_url}`. No scheme validation (`javascript:`, `data:`) anywhere in the file.
- `frontend/src/lib/structured-data.tsx:277-287` and `frontend/src/components/common/StructuredData.tsx:29` inject `JSON.stringify(schema)` via `dangerouslySetInnerHTML` without escaping `</script>`.
- Builder writes go through `PUT /api/admin/modules/:id` (`admin.routes.ts:76`), which requires `module:{slug}:manage` (`modules.controller.ts:470-484`), so the attacker is a tenant admin/manager, not an anonymous user.

**Impact:** A tenant admin (or a compromised admin session) can inject `javascript:` links or a `</script><script>...` payload into the public site, attacking that tenant's customers. If module settings are shared/global, the blast radius is larger.

**Smallest credible fix:** Add a URL sanitizer that allows only `http:`, `https:`, `mailto:`, and relative paths for `href`/`src`, and escape JSON-LD with `.replace(/</g, '\\u003c')` before injection.

---

### P1-6 — Public module catalog is tenant-enumerable and returns full `settings`

**Evidence (confirmed):**
- `app.ts:207-209` mounts `/api/modules` and `/api/modules/:slug` with `resolveTenant` + `resolveProperty`, no auth.
- `tenantAccess.middleware.ts:325-329` resolves `X-Tenant-Slug` as `subdomain`.
- `modules.controller.ts:31-34` selects `*`; `:58-61` scopes to `req.tenant?.id` or global.
- Local data shows `modules.settings` contains `layout`, `icon`, `showInNavigation`, `show_in_nav` (no secrets today, but the handler will return whatever is added later).

**Impact:** An unauthenticated attacker can enumerate tenant slugs and dump each tenant's module catalog and layout. Today the content is mostly presentational; tomorrow it may include integration config.

**Smallest credible fix:** Return an explicit public projection (`id, slug, name, icon, sort_order, show_in_main`) instead of `*`, and require a signed/tenant-bound context for anything richer.

---

### P1-7 — `modules.slug` has no unique constraint; staff order creation fetches by slug unscoped

**Evidence (confirmed):**
- `pg_constraint` on `public.modules`: only `modules_pkey` (PRIMARY KEY (id)). No unique index on `slug` or `(tenant_id, slug)`.
- `module-staff.controller.ts:2142-2146` — `createModuleOrder` fetches the module by `slug` with `.single()`, no tenant filter.
- `module-staff.controller.ts:49-67` — `resolveStaffModule` adds a tenant filter only when `callerTenantId` is truthy.
- `propertyAccess.middleware.ts:238-277` — the cross-tenant guard is skipped when `userTenantId` is falsy.

**Impact:** Two tenants with the same slug (e.g. `menu`, `restaurant`) cause `.single()` to error (PGRST116) or, if only one row exists, route staff of Tenant B into Tenant A's module. The middleware usually catches the latter, but a JWT without `tenantId` bypasses the check.

**Smallest credible fix:** Add `UNIQUE (tenant_id, slug)` (and a separate unique index for global rows where `tenant_id IS NULL`), scope the controller fetch by `req.user.tenantId`, and fail closed when `userTenantId` is missing.

---

### P1-8 — Install bypass flags are `true` in `frontend/.env.local`

**Evidence (confirmed):**
- `frontend/.env.local` contains `NEXT_PUBLIC_INSTALL_BYPASS=true` and `NEXT_PUBLIC_ADMIN_SETUP_BYPASS=true`.
- `frontend/src/proxy.ts:181` and `frontend/src/app/[property]/admin/layout.tsx:61` treat these as redirect bypasses.
- The backend install gate is independent and solid (`install.controller.ts:39`, `:211-212`), so this is not a backend auth bypass — but it will hide the setup flow and let users into admin shells that expect a configured tenant.

**Impact:** If `.env.local` is copied to a deployment (a common mistake), the frontend bypasses onboarding while the backend is unconfigured, producing confusing failures and potentially exposing admin UI shells.

**Smallest credible fix:** Remove the bypass flags from the committed/example env and require an explicit `NODE_ENV=development` guard in code.

---

### P1-9 — Backend `.env` points at a remote Supabase project

**Evidence (confirmed):**
- `backend/.env` `DATABASE_URL` = `postgresql://postgres.<project-ref>:...@<pooler-host>.pooler.supabase.com:6543/postgres`.
- `backend/.env` is gitignored (`backend/.gitignore:2`), so it is not a repo leak, but `npm run dev` connects to that remote project unless the developer overrides env.
- The local test stack uses `backend/.env.test` (`127.0.0.1:15432`).

**Impact:** A developer running the app locally can read/write production data, and background workers (scheduler, compensation worker) start against production. This is an operational safety issue, not a code defect.

**Smallest credible fix:** Point `backend/.env` at the local stack, keep remote credentials in a separate `.env.production` that is never loaded by `npm run dev`, and add a startup guard that refuses to start with `NODE_ENV=development` against a non-local `DATABASE_URL`.

---

### P1-10 — Dependency vulnerabilities

**Evidence (confirmed, `npm audit`):**
- Backend: **38 vulnerabilities (16 high, 21 moderate, 1 low)** — including `axios`, `body-parser`, `brace-expansion`, `compression`, `decode-uri-component`, `engine.io`, `follow-redirects`, `intuit-oauth`, `js-yaml`, `multer`, `nodemailer`, `query-string`, `sharp`, `source-map-js`, `vite`, `zod`.
- Frontend: **23 vulnerabilities (6 high, 17 moderate)**.
- Most have non-breaking fixes; `nodemailer`, `multer`, and `zod` require major bumps.

**Impact:** Known CVEs in HTTP parsing, file upload, email, and build tooling. Some are dev-only, but `multer`/`nodemailer`/`axios` are runtime.

**Smallest credible fix:** Run `npm audit fix` for the non-breaking set, then schedule the major bumps (`multer`, `nodemailer`, `zod`) with regression tests.

---

## 4. Major issues (not launch-blocking in isolation, but should be fixed before GA)

1. **Service-role client is the default data path.** `getSupabase()` returns the service-role client (`backend/src/database/supabase.ts:6-20`). 762 `getSupabase(` call sites vs 22 `getScopedClient(`. Tenant isolation depends on every developer remembering to add `.eq('tenant_id', ...)`. The `getScopedClient` migration is ~3% done. This is the root cause of most isolation findings.
2. **`transactions` is excluded from `TENANT_SCOPED_TABLES`.** `security/scoped-client.ts:33-65` explicitly leaves the unified table out. The comment is honest ("needs its own dedicated review"), but the result is that the most important table has no automatic scoping.
3. **`engine_v2_*` feature flags gate nothing.** `engines/feature-flags.ts:32-36` defines five flags; `isEnabled` is called only inside that file (`:63`, `:66`, `:135`, `:153`) and by unrelated 2FA code. No pricing/ledger/state-machine path checks them. The platform UI exposes GET/POST flags (`platform-admin.controller.ts:803-833`) but the frontend has no UI. Either wire them or delete them.
4. **`order_payment_splits` is dead.** The table exists in the baseline schema, has 0 rows locally, and **no backend `src` code references it**. Split-bill is implemented ad hoc via `payments` rows + `allowPartial` flags. Docs that claim table-backed split-bill support are wrong.
5. **`deduct_inventory_for_order_items` ignores `is_optional`.** The function selects `COALESCE(is_optional, false)` (`pg_get_functiondef`), then computes `v_required := quantity_required * quantity` for every ingredient without checking it. Optional ingredients are deducted anyway.
6. **Order numbers can collide.** `module-staff.controller.ts:2327` uses `ORD-${Date.now().toString(36).toUpperCase().slice(-5)}`. At busy counters, two orders in the same millisecond (or with the same last 5 base36 chars) collide; there is no unique constraint.
7. **`updateTenantBillingStatus` / `cancelTenant` ignore local update errors.** `platform-admin.controller.ts:759-762` and `:304-344` sync Stripe first, then update the tenant row without checking the error. A failed local update leaves Stripe suspended and the tenant active (or vice versa).
8. **`getOrCreateCustomer` reuses a Stripe customer by email globally.** `saas-billing.service.ts:265-281` lists customers by email with no tenant metadata filter. Two tenants sharing an operator email share a billing customer.
9. **Billing portal returns to the platform URL.** `saas-billing.service.ts:292` uses `this.frontendUrl` (`FRONTEND_URL`, default `https://v2platform.com`) + `returnPath`, not the tenant subdomain. Tenant admins are bounced to the platform site.
10. **Public checkout uniqueness checks are races.** `platform-admin.controller.ts:570-595` checks email and subdomain with a `SELECT`, then inserts later in `provision`. Concurrent signups can both pass.
11. **`getTenantBySlug` exposes `billing_status`.** `platform-admin.controller.ts:785-796` returns `{ id, subdomain, billing_status }` unauthenticated. Low sensitivity, but it is tenant metadata.
12. **Socket.IO `order:join` is an IDOR.** `socket/index.ts:229-234` lets any authenticated socket join `order:{orderId}` with no ownership/tenant check. The emitted payload is limited to `{ id, status, fulfillmentStatus, tableNumber }` (`engines/order-status.service.ts:424-435`), so the leak is modest, but it is still an authorization gap.
13. **Public module routes bypass the billing gate.** `/api/modules` and `/api/modules/:slug` use `resolveTenant`/`resolveProperty` but not `tenantGate` (`app.ts:207-209`), so suspended tenants' catalogs are still served.
14. **`recordCashPayment` is the good path; `recordManualPayment` is not.** `recordCashPayment` (`payment.controller.ts:1163-1284`) requires the ledger settlement and rolls back on failure. `recordManualPayment` (`:1285-1395`) swallows reference-resolution errors (P1-1). The two paths should share one implementation.
15. **`getEntityBalance` is not tenant-scoped.** `engines/financial-ledger.ts:612` takes only `entityId`. UUID guessing is hard, but the API is unsafe by construction.
16. **`invalidateTenantCache` is fire-and-forget in provisioning.** `provisioning.service.ts:301` (and `platform-admin.controller.ts:764`) call it without `await`, so a cache refresh can race the response.
17. **`operatorEmail`/`operatorName` can be empty.** `saas-webhook.controller.ts:132-133` falls back to `''`; `provision` then inserts an empty email user or fails and cancels the subscription.
18. **Fiscal document issuance is non-fatal.** `payment.controller.ts:678-698` logs and continues if fiscal issuance fails. In markets where fiscalization is mandatory, a paid order can exist without a fiscal document.
19. **`billing_history` writes are best-effort.** `saas-webhook.controller.ts:333-366` swallows insert errors; the idempotency check depends on this table. A failed write means a retry re-runs the handler.
20. **No distributed claim on most cron jobs.** Only `membership_renewal` uses `job_runs` (`jobs/membership-renewal.job.ts:59-82`). Backup, reminders, loyalty maintenance, capacity expiry, and report scheduler can run on every instance. In a multi-instance deployment this duplicates work and, for reminders/emails, sends duplicates.
21. **`modules.slug` uniqueness and `createModuleOrder` scoping** (see P1-7) also affect the public `getModule` handler: `.maybeSingle()` on a duplicated slug returns a 500.
22. **Frontend service-role key sits in `.env.local`.** It is not `NEXT_PUBLIC_*` and there is no `createClient` in `frontend/src` (claim 2 is effectively fixed), but storing `SUPABASE_SERVICE_KEY` and `STRIPE_SAAS_WEBHOOK_SECRET` in the frontend project is unnecessary blast-radius. Move them to the backend only.

---

## 5. Minor issues

- `backend/src/engines/discount-resolvers.ts:255` hardcodes `100 points = $1`; `loyalty_settings` redemption rate is ignored.
- `:239-253` dry-run does not check whether loyalty redemption is enabled; a disabled program still quotes a discount.
- `bookable_units` / `accommodation_add_ons` lookups in `catalog-pricing.service.ts:86-105` are not scoped by module/tenant; a known UUID from another module can be priced.
- `catalog-pricing.service.ts:225` uses `priceMap.get(resolvedId) ?? 0`; a null-priced row becomes a free item.
- `payment.controller.ts:1291` falls back to `req.tenant?.id` for tenant; `auth.middleware` tenant binding makes this mostly safe, but the fallback is inconsistent with the JWT-only rule used elsewhere.
- `payment.controller.ts:1337` reads `site_settings` (`key='payments'`) globally for the currency fallback; not tenant-scoped.
- `payment.controller.ts:2065` labels a room charge as `reference_type: 'order'` in `payments` but `reference_type: 'room_folio'` in `payment_ledger`; reconciliation has to know both.
- `payment.controller.ts:2232` returns `remainingBalance` but no `overpaid`/credit field.
- `platform-admin.controller.ts:566` parses `billingCycle` but the zod schema may not validate it against the allowed set (inspect `:31-34`); an arbitrary string reaches Stripe.
- `saas-webhook.controller.ts:117` skips `canceled`/`incomplete_expired` but does not handle `unpaid`/`paused` explicitly (they fall through to `updateBillingStatus`).
- `modules.controller.ts:58` uses `req.tenant?.id` for unauthenticated callers; that is header-derived (see P1-6).
- `dynamic-modules.loader.ts:90` still reads `x-tenant-id` as a fallback; `:100` selects the single row when no tenant is resolved. TenantGate normally prevents this, but the carve-out is a latent cross-tenant routing risk.
- `socket/index.ts:311-318` `join:unit` accepts any slug; the room is tenant-namespaced, so cross-tenant leak is prevented, but there is no module-existence check.
- `install.controller.ts` stores `install.token` and `install.machine_id`; the token is checked as immutable, but there is no rotation/expiry path.
- Backend lint: **0 errors, 1,502 warnings**, overwhelmingly `@typescript-eslint/no-explicit-any`. This is a maintainability tax, not a runtime bug, but it hides real type errors.
- `frontend/src/lib/sanitize.ts` uses DOMPurify client-side and a tag-strip fallback during SSR; the fallback is weaker than DOMPurify. Confirm no server-rendered CMS HTML path relies on it.
- `frontend/src/app/layout.tsx:175` injects a static `themeScript`; it is not user-controlled today, but it is another `dangerouslySetInnerHTML` to keep audited.

---

## 6. Claim verification table

The following are the claims carried into this audit (from the prior review / remediation notes). Status: **Still true**, **Fixed**, **Partly fixed**, **Could not verify**.

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | Backend uses the service-role Supabase client everywhere, so RLS is bypassed. | **Still true** | `database/supabase.ts:6-20`; 762 `getSupabase(` vs 22 `getScopedClient(`. |
| 2 | The frontend bundles/uses a Supabase service-role key. | **Fixed (source)** | No `createClient`/`SERVICE_KEY`/`service_role` in `frontend/src`. Key remains in `.env.local` (non-public). |
| 3 | `engine_v2_*` feature flags gate engine behavior. | **Still true (they gate nothing)** | `engines/feature-flags.ts` defines 5 flags; `isEnabled` only called inside that file + 2FA. No engine path reads them. |
| 4 | Tenant resolution trusts `X-Tenant-ID`/`X-Tenant-Slug` and can cross tenants. | **Partly fixed** | `auth.middleware.ts` `tenantBindingViolation` rejects header/JWT mismatch for non-platform operators; `resolveTenant` still trusts headers for public routes (`tenantAccess.middleware.ts:304-329`). |
| 5 | The install gate can be bypassed to create a second super admin. | **Fixed** | `install.controller.ts:39` defaults off; `:211-212` 409 if initialized; `superAdminExists()` fails closed (`:105-151`); POST blocked. Frontend bypass flags are redirect-only. |
| 6 | SaaS Stripe webhooks are accepted without signature verification. | **Fixed** | `saas-webhook.controller.ts:30-45` uses `constructWebhookEvent` and fails closed if the secret is missing. |
| 7 | Stripe `incomplete` subscriptions grant access. | **Still true** | `saas-billing.service.ts:494` maps `incomplete → trialing`; `tenantGate` allows `trialing`. |
| 8 | Tenant provisioning is non-transactional / partial failure strands the tenant. | **Still true** | `provisioning.service.ts:142-187`, `:189-322`; retry no-ops on existing `stripe_subscription_id`. |
| 9 | Staff order path lacks ledger/payment rows at creation. | **Still true** | `module-staff.controller.ts:2329-2367` (no payments/ledger), `:2952-3004` (ledger only on full pay). |
| 10 | `IdempotencyGuard` is not atomic and fails open. | **Still true** | `engines/idempotency-guard.ts:104-164` (check-then-upsert, overwrites completed, proceeds on claim error). |
| 11 | Loyalty redemption is never reversed. | **Still true** | `discount-reversal.ts:124-129` logs "not implemented". |
| 12 | Split-bill is implemented via `order_payment_splits`. | **False / overstated** | Table exists; 0 rows locally; no backend `src` reference. Split-bill uses `payments` rows + `allowPartial`. |
| 13 | All public tables have RLS enabled. | **False** | 230/239; 9 without RLS (list in P0-2). |
| 14 | `users` RLS causes infinite recursion. | **Still true** | `pg_policies` `users_self_read`/`users_admin_write` subquery `users`; live anon/authenticated → `500 42P17`. |
| 15 | Integration tests run against the migrated schema. | **False** | `tests/integration/setup.ts` logs "Reusing existing migrated schema"; local DB max applied migration `20261118120000`, 4 behind head; function bodies are ahead of the ledger (see §7). |

---

## 7. Test reality check

### Baseline commands and results

| Command | Result |
|---|---|
| `backend: npx tsc --noEmit` | exit 0 (tests excluded by tsconfig) |
| `frontend: npx tsc --noEmit` | exit 0 (excludes `tests`, `vitest.config.ts`) |
| `backend: npm run lint` | 0 errors, **1,502 warnings** (mostly `no-explicit-any`) |
| `backend: npx vitest run` | **222 files passed, 4,407 passed, 6 skipped, 0 failed** (~16s) |
| `backend: npm run test:integration` | **26 files passed, 4 skipped; 364 passed, 82 skipped** (251s) |
| `frontend: npx vitest run` | **132 files, 781 tests passed**, 0 failed; coverage ~38.86% statements |
| `backend: npm audit` | **38 vulns (16 high, 21 moderate, 1 low)** |
| `frontend: npm audit` | **23 vulns (6 high, 17 moderate)** |

### What the numbers hide

- **Whole integration suites are skipped:** `data-integrity.test.ts` (`describe.skip` at `:11`, `:416`, `:480`), `push-notification.test.ts:21`, `biometric-auth.test.ts:17`, `auth-mobile.test.ts:15`, `mobile-production-h-l.test.ts:217` (feature flags), `offline-queue.test.ts:17`. The `data-integrity` skips include "Payment Safety" — the exact area with P0 findings.
- **The integration harness reuses an existing schema.** `tests/integration/setup.ts` prints "✅ Reusing existing migrated schema for integration tests"; it does not apply migrations. The local DB is 4 migrations behind repo head (`20261118120000` applied; `20261119100000`–`20261119140000` missing). Worse, the local function bodies already contain the tenant-scoped redemption SQL from `20261119110000` even though that version is not in `supabase_migrations.schema_migrations` — the environment does not match the ledger. Any green integration run is against an unknown schema.
- **No integration coverage for the P0 paths:** staff POS creation/settlement, cross-tenant gift-card/coupon redemption, refund double-spend, provisioning partial failure, webhook concurrency/replay, `incomplete` mapping, RLS recursion, RLS-disabled tables.
- **Unit tests are broad but mock-heavy.** 4,407 passing tests did not catch any of the above because the code paths are mocked or the assertions only check the happy path.
- **Frontend coverage is ~39% statements.** The builder renderer, JSON-LD, and layout settings paths are not meaningfully covered.
- **`tsc --noEmit` excludes tests**, so test type drift is not caught.

**Verdict on tests:** the suite is useful for regression on pure functions, but it is not evidence of production readiness for money movement or tenant isolation.

---

## 8. Adversarial test results

All live probes below were run against the **local** stack. The local DB has 175 tenants and 57 tenants with transactions, so it is a realistic multi-tenant dataset.

| # | Test | Command / probe | Result | Interpretation |
|---|---|---|---|---|
| 1 | Anon read of `users` | PostgREST `GET /rest/v1/users?select=*&limit=1` with anon JWT | `500 42P17 "infinite recursion detected in policy for relation \"users\""` | Broken RLS (P0-3). |
| 2 | Anon read of RLS-disabled tables | `GET /rest/v1/{reservations,expenses,staff_reviews,translations,shift_cash_movements}?select=*&limit=1` | `200 []` for all five | Grant + no RLS confirmed (P0-2). Empty locally; data would be exposed in production. |
| 3 | Anon read of `transactions` | `GET /rest/v1/transactions?select=*&limit=1` | `401 42501 permission denied for table transactions` | Correctly locked down. |
| 4 | Authenticated read of `transactions` | Authenticated JWT (`sub` = real user in tenant `4d854432…`) | `200`, rows all `tenant_id = 4d854432…` | RLS works for `transactions`. |
| 5 | Cross-tenant transaction read | Same JWT, `GET /transactions?id=eq.<tx from tenant 63aad4db…>` | `200 []` | RLS blocks cross-tenant read. |
| 6 | Authenticated read of `payments` / `tenants` / `users` | Same JWT | `500 42P17` for all three | Recursive policies (P0-3). |
| 7 | `modules.slug` uniqueness | `pg_constraint` on `public.modules` | Only `modules_pkey` (PRIMARY KEY (id)) | No unique constraint (P1-7). |
| 8 | `order_payment_splits` usage | `SELECT count(*) FROM order_payment_splits` + repo grep | `0` rows; no `src` references | Dead table (Major 4). |
| 9 | RLS coverage | `pg_class` for 10 key tables | RLS false for `expenses`, `reservations`, `staff_reviews`, `translations`, `shift_cash_movements`, `idempotency_records`, `checkout_compensation_*`, `engine_fulfillment_capabilities` | P0-2. |
| 10 | Anon grants | `information_schema.role_table_grants` | `anon` SELECT on the five tables above | P0-2. |
| 11 | Redemption tenant scoping | `pg_get_functiondef` for `redeem_giftcard_atomic` / `apply_coupon_atomic` | Both select by `code` only; no `tenant_id` predicate | P0-1 (confirmed by inspection; not demonstrated live because the local dataset is single-tenant for gift cards and has no coupons). |
| 12 | Migration ledger vs schema | `supabase_migrations.schema_migrations` max = `20261118120000`; `pg_get_functiondef` shows `20261119110000` body | Ledger and schema disagree | Test-integrity finding (§7). |
| 13 | Backend dev env target | `backend/.env` `DATABASE_URL` | Remote `aws-1-ap-northeast-1.pooler.supabase.com` | P1-9. |

**Not run live (and why):** cross-tenant redemption with real rows (would require creating a second tenant's gift card/coupon; the audit is read-only), concurrent Stripe webhook delivery (needs Stripe-signed payloads / a running server configured to local), and provisioning partial-failure injection (would mutate the local DB). These are marked **confirmed by code inspection** rather than live-demonstrated.

---

## 9. Dependency-ordered gap list (with effort)

Order matters: later items assume earlier ones.

| # | Gap | Depends on | Effort | Owner hint |
|---|---|---|---|---|
| 1 | Enable RLS + policies on the 9 tables; revoke anon grants | — | 1–2 d | DB |
| 2 | Fix recursive `users`/`payments`/`tenants` policies with `SECURITY DEFINER` helpers or JWT claims | 1 | 0.5–1 d | DB |
| 3 | Add tenant predicate to `redeem_giftcard_atomic` / `apply_coupon_atomic` / `redeem_loyalty_points_atomic`; add `(tenant_id, code)` unique indexes | 1 | 1 d | DB + backend |
| 4 | Unique index on `payments.stripe_payment_intent_id` (partial) | — | 0.5 d | DB |
| 5 | Atomic idempotency claim RPC; never downgrade `completed`; fail closed on claim error | 4 | 1 d | Backend |
| 6 | Refund idempotency: local refund intent before Stripe, deterministic Stripe idempotency key, transactional cash/manual refund | 4, 5 | 2–3 d | Backend |
| 7 | Staff POS: write `payments` + `payment_ledger` for every tender; journal partials; return real `paymentStatus`; add creation idempotency; scope module fetch | 3, 4, 5 | 3–5 d | Backend |
| 8 | `recordManualPayment` fail closed; unify with `recordCashPayment` | 5 | 1 d | Backend |
| 9 | `postRoomCharge` / `settleFolioBalance`: single RPC, idempotency, reject overpayment | 7 | 2 d | Backend + DB |
| 10 | Per-property webhook `skipTenantGate`; add unique webhook idempotency | 5 | 0.5 d | Backend |
| 11 | Engine E provisioning: transactional RPC or resumable saga; verify child rows on retry; durable welcome email | 2 | 3–5 d | Backend + DB |
| 12 | `checkout.session.completed` fail loud on missing metadata/unresolvable subscription; email fallback | 11 | 0.5 d | Backend |
| 13 | Map `incomplete → past_due/suspended`; add dunning | 11 | 1 d | Backend |
| 14 | Membership renewal uses tenant Stripe client; bounded retries before `EXPIRED` | 13 | 1–2 d | Backend |
| 15 | Loyalty reversal + discount reservation/consumption ordering | 3, 5 | 1–2 d | Backend + DB |
| 16 | Frontend tenant-aware settings/branding; URL scheme sanitizer; JSON-LD escaping | 2 | 1–2 d | Frontend |
| 17 | Module slug uniqueness + scoped fetch; public module projection | 3 | 0.5–1 d | DB + backend |
| 18 | Secrets/env hygiene; audit fixes; lint debt | — | 1–2 d | Ops |
| 19 | Test integrity: apply migrations in CI, unskip `data-integrity` payment tests, add P0 regression tests | 1–18 | 3–5 d | QA |

**Rough total:** ~25–40 engineer-days for a credible paid pilot, assuming one backend, one DB, and one frontend engineer working in parallel.

---

## 10. What could not be assessed, and why

- **Production data and production schema state.** I had no authorized access to the remote Supabase project; the `DATABASE_URL` in `backend/.env` points at it, but I did not query it. The four unapplied migrations (`20261119100000`–`20261119140000`) may or may not be applied in production. Everything schema-related here is from the local stack.
- **Live Stripe behavior.** No live keys, no Stripe CLI forwarding, no signed webhook fixtures. Webhook logic was assessed by reading `saas-webhook.controller.ts` and `payment.controller.ts`; the exact Stripe status transitions for SCA/3DS and the retry schedule were not exercised.
- **Email deliverability and template rendering.** The welcome email is fire-and-forget; I did not send email or verify SPF/DKIM.
- **Load, performance, and concurrency at scale.** The unit/integration suites run sequentially; I did not run k6/artillery or multi-instance tests. The idempotency and refund races are reasoned from code, not reproduced under load.
- **Mobile apps.** The Flutter/mobile clients are outside this repo; the skipped `auth-mobile`, `biometric-auth`, `offline-queue`, and `push-notification` suites mean I cannot assert mobile behavior.
- **DNS/subdomain routing.** `resolveTenant` supports subdomains, but no wildcard domain is configured locally; I tested header-based resolution only.
- **Backup/restore and disaster recovery.** The daily backup job exists (`scheduler.service.ts`), but I did not run a restore.
- **Fiscalization.** `fiscalDocumentService.issueForTransaction` is called non-fatally; I did not exercise a fiscal provider.
- **Third-party channels (Flutterwave, etc.).** The channel webhook router is mounted at `/webhooks/channels` (`app.ts:398`); I did not audit its signature verification or idempotency.
- **Whether the RLS-disabled tables contain sensitive rows in production.** Local tables were empty. The configuration is confirmed; the data-exposure magnitude is environment-dependent.
- **The exact prior 13-claim list.** The claims in §6 were reconstructed from the remediation notes and the code comments in this repo (P0-1, P0-3, claim 2, split-bill, flags, RLS, etc.). If the original list had additional items, they are not represented here.

---

## Appendix A — Evidence index (file:line)

| Area | Evidence |
|---|---|
| Service-role client | `backend/src/database/supabase.ts:6-20` |
| Scoped-client table list / `transactions` exclusion | `backend/src/security/scoped-client.ts:33-65` |
| Feature flags defined, unused | `backend/src/engines/feature-flags.ts:32-36`, `:63-153` |
| Tenant resolution / header trust | `backend/src/middleware/tenantAccess.middleware.ts:304-367` |
| Tenant binding guard | `backend/src/middleware/auth.middleware.ts` (`tenantBindingViolation`) |
| Install gate | `backend/src/modules/install/install.controller.ts:39`, `:105-151`, `:211-212`, `:247` |
| SaaS webhook signature | `backend/src/modules/platform/saas-webhook.controller.ts:30-45` |
| SaaS webhook idempotency | `:71-75`, `:287-305`, `:333-366` |
| `incomplete → trialing` | `backend/src/services/saas-billing.service.ts:487-499` |
| Provisioning steps | `backend/src/modules/platform/provisioning.service.ts:142-322` |
| Customer order creation | `backend/src/routes/dynamic-module.router.ts:1133-1272`, `:1341-1355`, `:1616-1732` |
| Pricing pipeline | `backend/src/engines/pricing-pipeline.ts` |
| Catalog pricing | `backend/src/services/catalog-pricing.service.ts:43-257` |
| Discount resolvers | `backend/src/engines/discount-resolvers.ts:98-107`, `:190-194`, `:258-266` |
| Discount reversal | `backend/src/engines/discount-reversal.ts:99-138` |
| Idempotency guard | `backend/src/engines/idempotency-guard.ts:94-183` |
| Financial ledger | `backend/src/engines/financial-ledger.ts:612` |
| Staff create order | `backend/src/modules/staff/module-staff.controller.ts:2128-2392` |
| Staff pay order | `:2925-3108` |
| Staff module resolution | `:49-67` |
| Payment intent | `backend/src/modules/payments/payment.controller.ts:222-328` |
| Payment webhook | `:506-720` |
| Manual payment | `:1285-1395` |
| Refund | `:1654-1929` |
| Room charge / folio | `:1967-2235` |
| Per-property webhook mount | `backend/src/app.ts:97-105` |
| SaaS webhook mount | `backend/src/app.ts:87-92` |
| Public modules mount | `backend/src/app.ts:207-209` |
| Module update RBAC | `backend/src/modules/admin/modules.controller.ts:436-539` |
| Module property access | `backend/src/middleware/propertyAccess.middleware.ts:226-277` |
| Membership renewal | `backend/src/jobs/membership-renewal.job.ts:59-277` |
| Socket order room | `backend/src/socket/index.ts:229-234`, `:437-439` |
| Frontend layout settings | `frontend/src/app/layout.tsx:25-36` |
| Builder renderer links | `frontend/src/components/module-builder/DynamicModuleRenderer.tsx:402`, `:449`, `:737`, `:863`, `:878`, `:922`, `:1318` |
| JSON-LD injection | `frontend/src/lib/structured-data.tsx:277-287`, `frontend/src/components/common/StructuredData.tsx:29` |
| Install bypass flags | `frontend/src/proxy.ts:181`, `frontend/src/app/[property]/admin/layout.tsx:61` |
| Redemption migration | `supabase/migrations/20261119110000_redemption_functions_tenant_scope.sql:24-207` |

---

## Appendix B — Reproduce the live checks

```powershell
# Local stack (from backend/.env.test)
# DATABASE_URL=postgresql://postgres:<local-password>@127.0.0.1:15432/postgres
# SUPABASE_URL=http://127.0.0.1:15421
# JWT secret for the local stack:
#   super-secret-jwt-token-with-at-least-32-characters-long

# RLS-disabled tables
docker exec supabase_db_v2-ecosystem psql -U postgres -d postgres -c \
  "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false;"

# Anon grants
docker exec supabase_db_v2-ecosystem psql -U postgres -d postgres -c \
  "select grantee, table_name, string_agg(privilege_type,',') from information_schema.role_table_grants where table_schema='public' and grantee='anon' group by 1,2;"

# RLS recursion (mint anon/authenticated HS256 tokens with the local secret)
# GET http://127.0.0.1:15421/rest/v1/users?select=*&limit=1
#   -> 500 42P17

# modules.slug constraint
docker exec supabase_db_v2-ecosystem psql -U postgres -d postgres -c \
  "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.modules'::regclass and contype in ('u','p');"

# Migration ledger
docker exec supabase_db_v2-ecosystem psql -U postgres -d postgres -c \
  "select version from supabase_migrations.schema_migrations order by version desc limit 8;"
```

---

---

## Appendix C — Audit hygiene note

During the audit, the backend was started once with its default `backend/.env` (which points at the remote Supabase project) to inspect startup behavior, then stopped within about a minute. No deliberate writes were issued. Startup performed read-only loads (dynamic modules, permission cache) and registered cron jobs; the checkout-compensation background worker polls every 30 seconds and may have performed one poll. This is itself evidence for finding P1-9: the default dev configuration targets production. Subsequent live checks used only the local stack (`backend/.env.test`).

*End of report.*
