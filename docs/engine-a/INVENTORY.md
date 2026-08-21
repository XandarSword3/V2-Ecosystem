# Engine A — Repository Inventory (Phase 0)

> **Rule: code beats documentation.** Every "implemented" claim below names a
> concrete path. If a claim has no code path behind it, treat it as *not*
> implemented. This inventory was reconciled against `main` at commit
> `8e06f8c4` (2026-08) and must be re-run whenever Engine A work lands.

Scope: the **generic one-time-commerce engine** (Engine A, `instant_transaction`)
plus the subsystems it composes: pricing, state, transaction/Saga, ledger,
payments, inventory/resource, customization, loyalty, promotions, reviews,
staff/POS, fiscal, reporting, and reconciliation.

---

## 1. Engine definitions

| Path | What |
|---|---|
| `backend/src/engines/types.ts` | `EngineDefinition`, state machine, pricing config, interaction contract, data extraction types. Engine type registry + legacy template aliases (`menu_service` → `instant_transaction`, etc.). |
| `backend/src/engines/registry.ts` | Engine → definition lookup (`getEngine`, `getEngineByTemplate`, `createStateMachine`). |
| `backend/src/engines/definitions/instant-transaction.ts` | **Engine A** definition. Currently hospitality-shaped: states `pending → confirmed → preparing → ready → delivered → completed`, `notify_kitchen_on_confirm` interaction, `deduct_inventory_on_purchase`, `earn_loyalty_on_purchase`. |
| `backend/src/engines/definitions/ongoing-entitlement.ts` | Engine D (entitlement/subscription). |
| `backend/src/engines/definitions/platform-entitlement.ts` | Engine E (SaaS platform entitlement). |
| `backend/src/engines/definitions/shared-capacity-access.ts` | Engine C (capacity/session access). |
| `backend/src/engines/definitions/time-exclusive-reservation.ts` | Engine B (reservation/booking). |

## 2. Engine framework (generic)

| Path | What |
|---|---|
| `backend/src/engines/state-machine.ts` | Generic `StateMachine` (guards, side effects, actor checks, terminal states). |
| `backend/src/engines/engine-service.ts` | Bridge: `calculatePricing`, `transitionState`, `recordToLedger`, `recordRefundToLedger`, `executeAtomicOperation` (Saga). |
| `backend/src/engines/pricing-pipeline.ts` | **Single pricing authority.** Tax (multi-rate), CMS fees, coupon → gift card → loyalty order, invariant validation (`total = subtotal + tax + fees − discount`). |
| `backend/src/engines/discount-resolvers.ts` | Coupon / gift card / loyalty resolvers (RPC-backed). |
| `backend/src/engines/discount-reversal.ts` | `linkDiscountsToOrder`, `reverseDiscounts` — compensation for coupons/gift cards on cancel/refund. |
| `backend/src/engines/transaction-manager.ts` | Saga executor with compensation steps, failed-compensation tracking. |
| `backend/src/engines/idempotency-guard.ts` | Idempotency-key guard for critical mutations. |
| `backend/src/engines/financial-ledger.ts` | **Append-only unified ledger** (`engine_financial_ledger`): charge/refund/adjustment/void/deposit/deposit_release, invariant pre-write validation. ⚠ Currency falls back to `'EUR'`. |
| `backend/src/engines/inventory-side-effects.ts` | Inventory deduction/restore side effects wired to state transitions (`deduct_inventory_for_order`, `restore_inventory_for_order`). |
| `backend/src/engines/observability.ts` | Structured events, metrics counters, DB audit trail writer (state transitions, pricing, ledger, anomalies). |
| `backend/src/engines/order-status.service.ts` | `changeInstantTransactionOrderStatus`, `resolveAction`, `actorForUser` — bridges staff actions to the state machine. |
| `backend/src/engines/feature-flags.ts` | Per-tenant feature flags (`engine_v2_*`). |

## 3. Routes / controllers

| Path | What |
|---|---|
| `backend/src/routes/dynamic-module.router.ts` | **The Engine A surface (~3,600 lines).** `POST /orders`, `POST /orders/:id/items`, status change, KDS socket emit, reservations, service locations, categories, items, modifiers, reviews, public order status. |
| `backend/src/routes/dynamic-modules.loader.ts` | Loads mounted modules into the dynamic router. |
| `backend/src/modules/payments/payment.controller.ts` | Stripe intents, cash/manual payments, room charge/folio, loyalty-on-payment, ledger write, discount reversal on refund. |
| `backend/src/modules/payments/payment.routes.ts` / `payment.v1.routes.ts` | Payment routes (v1 routes also call engine service). |
| `backend/src/modules/payments/reference-type-adapter.ts` | `normalizeReferenceType` — payment ↔ transaction reference normalization. |
| `backend/src/modules/payments/loyalty-integration.ts` | `awardLoyaltyPointsForPayment`. |
| `backend/src/modules/staff/module-staff.controller.ts` | Staff operations: quick order (priced through engine + ledger), order dispatch board, shifts, schedule, ratings, comps, voids. |
| `backend/src/modules/admin/pricing.controller.ts` | Admin pricing preview through `calculatePricing`. |
| `backend/src/modules/finance/*` | Cash drawer (open/close, expected/actual), expenses, invoice service (legacy). |
| `backend/src/modules/pos/*` | POS hardware routes. |
| `backend/src/modules/inventory/*` | Inventory CRUD, batches, BOM, adjustments, consumption, alerts. |
| `backend/src/modules/customization/*` | Customization groups/options with inventory linkage and locking. |
| `backend/src/modules/loyalty/*` | Loyalty membership, points, tiers, redemption, import. |
| `backend/src/modules/reviews/*` | Product + staff reviews, rating aggregation. |
| `backend/src/modules/economics/*` | Business metrics/analytics service. |
| `backend/src/modules/reservations/*` | Reservations, table assignment, check-in, no-show. |

## 4. Database (supabase/migrations)

| Item | Path |
|---|---|
| Baseline schema (all core tables) | `supabase/migrations/20260803090000_baseline_schema.sql` — `transactions`, `order_items`, `catalog_items`, `catalog_categories`, `engine_financial_ledger`, `inventory_*` (items/batches/bom/consumption/transactions/alerts), `gift_card_transactions`, `coupon_usage`, `cash_transactions`, `service_locations`, `reservations`, `customization_*`, `loyalty_*`, `reviews`, `expenses`, `engine_feature_flags`, etc. |
| Inventory deduction at order creation | `20260803120000_deduct_inventory_at_order_creation.sql` |
| Inventory restoration on cancel | `20260805072810_add_restore_inventory_for_order.sql` |
| Reservations + auto-assignment | `20260806110000_add_reservations_and_auto_assignment.sql` |
| Reviews | `20260806120000_add_reviews.sql` |
| Expenses | `20260806130000_add_expenses_table.sql` |
| Shift/cash drawer | `20260807120000_shift_cash_drawer.sql` |
| Loyalty scoping/batches | `20260808000000_loyalty_earn_scoping_and_batches.sql` |
| Unified inventory deduction + auto-86 | `20260808151500_unified_inventory_deduction_and_auto_86.sql` |
| Room charge folio + payments fix | `20260808160000_room_charge_folio_and_payments_fix.sql` |
| Customization inventory locking | `20260810150000_add_for_update_locks_to_customization_inventory.sql` |
| Customization integration into deduction | `20260810151000_integrate_customizations_into_deduct_inventory_for_order.sql` |
| Metadata on order items | `20260810160000_add_metadata_to_order_items.sql` |
| Customization snapshot tenant/property | `20260810170000_fix_customization_snapshot_tenant_property.sql` … `20260814120000_repair_customization_snapshot_signature.sql` |
| FIFO deduction fix | `20260810174000_fix_fifo_deduction.sql` |
| Atomic adjust-stock RPC | `20260813090000_add_adjust_stock_atomic_rpc.sql` |
| Loyalty exactly-once earn + RPC idempotency | `20260816000000_loyalty_transaction_unique_earn_and_rpc_idempotency.sql` |
| Staff profiles | `20260818000000_staff_profiles.sql` |
| User scope backfill | `20260818000001_backfill_users_scope.sql` |

31 migration files total (incl. `README.md`, `_archived/`).

Key RPCs (SECURITY DEFINER, concurrency-safe): `deduct_inventory_for_order_items`,
`deduct_inventory_for_order`, `restore_inventory_for_order`, `adjust_stock_atomic`,
customization inventory lock/release, loyalty earn/redeem (unique constraint per
transaction), cash drawer open/close.

## 5. Feature flags

`engine_feature_flags` table + `backend/src/engines/feature-flags.ts`:
`engine_v2_pricing`, `engine_v2_state_machine`, `engine_v2_ledger`,
`engine_v2_idempotency`, `engine_v2_full`.

## 6. Tests

| Area | Evidence |
|---|---|
| Engine unit tests | `backend/tests/unit/engines/` — pricing-pipeline, engine-service, financial-ledger, idempotency-guard, observability, state-machine, registry, transaction-manager, feature-flags, workflow-integration. |
| Engine A integration | `backend/tests/integration/engine-a-order-lifecycle.integration.test.ts` (real DB, real HTTP): order_items written, inventory deducted on confirm, forward-only item status, auto-advance to ready/delivered, inventory restored on cancel, tenant isolation. |
| Other integration | `backend/tests/integration/` — auth, permissions, cross-tenant (phase1), stripe provisioning, offline queue, data integrity. |
| E2E (Playwright) | `tests/e2e/engine-a-customer-checkout.spec.ts`, `engine-a-staff-settlement.spec.ts`, plus `tests/phase3/01-engine-a-instant-transactions.spec.ts` referenced by CI. |
| Frontend unit | `frontend/` vitest suite + critical route coverage gate. |
| CI | `.github/workflows/ci.yml` — quality gate (lint, tenant-writes, no-mock-integration, **legacy terminology audit**, typechecks), unit, integration (real Postgres), build, E2E smoke + phase3, nightly full E2E, deploy, production smoke. |

## 7. Legacy / fallback implementations (known)

| Path | Status |
|---|---|
| `backend/src/services/invoice.service.ts` | Legacy fiscal: **random `uuidv4` invoice numbers, independently recomputed totals.** Must be superseded by the fiscal engine, not extended. |
| `catalog_items.metadata.recipe` | Hospitality-shaped resource spec embedded in JSONB metadata. |
| `GET /modifiers` | Stub returning `[]` ("`catalog_modifiers` was never created"). |
| `transactions` table | Hospitality-shaped state values (`preparing`, `ready`, `delivered`) written directly by the router in places, bypassing the state machine (e.g. `PATCH /transactions/:id/complete` writes `status: 'completed'` directly). |
| Ledger currency | `entry.currency || 'EUR'` fallback; `transactions.currency` defaults to `'USD'`. Inconsistent. |

## 8. Gaps vs. the Engine A completion plan (Phase 0 verdict)

1. **No fiscal engine**: no fiscal profiles, document series, or snapshot-sourced
   fiscal documents. Invoice service is a parallel calculation engine (violates
   "no parallel calculation engines").
2. **No Money model**: currency is a loose column, not an invariant.
3. **Core is hospitality-shaped**: Engine A's canonical state machine contains
   `preparing/ready/delivered`; the core definition names `kitchen`.
4. **No fulfillment abstraction**: no modes/destinations/groups/tracking/handoff.
5. **No resource-consumption abstraction**: `recipe` in metadata JSONB.
6. **No capacity management**.
7. **No architecture CI gate** for the generic core (only legacy terminology).
8. **No non-hospitality reference implementations**.
9. **No reconciliation engine / exception center / transaction timeline**.
10. **No onboarding wizard** (only `frontend/src/app/install/page.tsx`).
11. **Payments run beside the engine flow** rather than through a unified
    economic flow with the ledger as authority.
12. **Cart** is client-side; no server-side cart/commitment workspace.

---

*Next: `docs/engine-a/DOMAIN.md` defines the canonical domain model and the
authoritative-source table this inventory must stay consistent with.*
