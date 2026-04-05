# Engine Architecture

> **V2 Resort Platform — Formal Engine Framework Specification**  
> Version 2.0 | Last Updated: 2025

---

## 1. Executive Summary

The V2 Resort platform reduces ALL hospitality commerce to **four economic patterns** (engines). Every "module" in the system (restaurant, chalets, pool, spa, gym, etc.) is a **configuration instance** of one of these four engines.

This document is the formal specification of the engine framework architecture, covering:
- Engine taxonomy and classification
- State machine contracts
- Unified pricing pipeline
- Transactional atomicity (saga pattern)
- Idempotency guarantees
- Financial ledger architecture
- Observability infrastructure
- Feature flag rollout strategy

---

## 2. Engine Taxonomy

### 2.1 The Four Engines

| Engine | Type Identifier | Commercial Entity | Database Template | Example Modules |
|--------|----------------|-------------------|-------------------|-----------------|
| **A** | `instant_transaction` | Order | `menu_service` | Restaurant, Snack Bar, Room Service |
| **B** | `time_exclusive_reservation` | Booking | `multi_day_booking` | Chalets, Hotel Rooms, Conference Rooms |
| **C** | `shared_capacity_access` | Session/Ticket | `session_access` | Pool, Gym, Spa, Event Access |
| **D** | `ongoing_entitlement` | Subscription | `subscription` | Memberships, Season Passes |

### 2.2 Classification Criteria

Every hospitality commerce interaction maps to exactly one engine based on:

1. **Temporal Model**: Instantaneous vs time-bounded vs ongoing
2. **Resource Model**: Exclusive vs shared vs personal entitlement
3. **Capacity Model**: Unlimited vs finite vs time-slotted
4. **Billing Model**: One-time vs per-use vs recurring

---

## 3. State Machine Architecture

### 3.1 Design Principles

- **No ad-hoc state changes**: ALL state transitions go through the formal state machine
- **Actor-gated transitions**: Every transition declares which actors (system/staff/customer/admin) can trigger it
- **Guard functions**: Runtime conditions evaluated before transition execution
- **Side effects**: Post-transition operations (fire-and-forget, don't block)
- **Terminal states**: States with no outgoing transitions (completed, cancelled, etc.)
- **Immutable audit trail**: Every transition is logged to `engine_state_transitions`

### 3.2 Engine A — Instant Transaction

```
States: pending → confirmed → preparing → ready → delivered → completed
                                            └───────────────→ completed (shortcut)
Cancel paths: pending → cancelled, confirmed → cancelled, preparing → cancelled
```

| Transition | From | To | Actors | Guard |
|-----------|------|-----|--------|-------|
| confirm | pending | confirmed | staff, system | Payment verified |
| start_preparing | confirmed | preparing | staff | Kitchen capacity |
| mark_ready | preparing | ready | staff | — |
| deliver | ready | delivered | staff | — |
| complete_delivery | delivered | completed | staff, system | — |
| complete | ready | completed | staff | Direct pickup |
| cancel_pending | pending | cancelled | staff, customer, admin | — |
| cancel_confirmed | confirmed | cancelled | staff, admin | Refund required |
| cancel_preparing | preparing | cancelled | staff, admin | Refund + inventory restore |

**Terminal States**: `completed`, `cancelled`

### 3.3 Engine B — Time-Exclusive Reservation

```
States: pending → confirmed → checked_in → checked_out
        pending → checked_in (walk-in shortcut)
Cancel/no-show paths: pending/confirmed → cancelled, pending/confirmed → no_show
```

| Transition | From | To | Actors | Guard |
|-----------|------|-----|--------|-------|
| confirm | pending | confirmed | staff, system | Availability check |
| check_in | confirmed | checked_in | staff | Within booking dates |
| walk_in_check_in | pending | checked_in | staff | Availability + immediate |
| check_out | checked_in | checked_out | staff, system | — |
| cancel_pending | pending | cancelled | staff, customer, admin | — |
| cancel_confirmed | confirmed | cancelled | staff, admin | Release availability |
| no_show_pending | pending | no_show | system | Past check-in date |
| no_show_confirmed | confirmed | no_show | system | Past check-in date |

**Terminal States**: `checked_out`, `cancelled`, `no_show`

### 3.4 Engine C — Shared Capacity Access

```
States: valid → active → used
Cancel/expire: valid → cancelled, valid → expired
```

| Transition | From | To | Actors | Guard |
|-----------|------|-----|--------|-------|
| validate_entry | valid | active | staff, system | Capacity available |
| record_exit | active | used | staff, system | — |
| cancel | valid | cancelled | staff, admin | Before entry |
| expire | valid | expired | system | Past expiry time |

**Terminal States**: `used`, `expired`, `cancelled`

### 3.5 Engine D — Ongoing Entitlement

```
States: pending → active ⇄ paused → expired → cancelled
        active → active (renewal)
```

| Transition | From | To | Actors | Guard |
|-----------|------|-----|--------|-------|
| activate | pending | active | staff, system | Payment confirmed |
| renew | active | active | system | Billing successful |
| pause | active | paused | staff, customer, admin | — |
| resume | paused | active | staff, customer, admin | — |
| expire_active | active | expired | system | Grace period elapsed |
| expire_paused | paused | expired | system | Pause limit reached |
| reactivate | expired | active | staff, admin | Re-payment confirmed |
| cancel_pending | pending | cancelled | staff, customer, admin | — |
| cancel_active | active | cancelled | staff, customer, admin | Pro-rata refund |
| cancel_paused | paused | cancelled | staff, admin | — |
| cancel_expired | expired | cancelled | staff, admin | Final cleanup |

**Terminal States**: `cancelled` (expired is NOT terminal — can reactivate)

---

## 4. Unified Pricing Pipeline

### 4.1 Pipeline Steps

Every financial calculation flows through these 11 steps in order:

```
Step  1: Calculate subtotal (Σ unitPrice × quantity + adjustments)
Step  2: Apply pre-tax discounts (coupons — subtracted before tax)
Step  3: Calculate tax ((subtotal - preBasketDiscount) × taxRate)
Step  4: Calculate service charge (subtotal × serviceChargeRate, conditional)
Step  5: Calculate delivery fee (fixed amount, conditional)
Step  6: Pre-discount total = subtotal + tax + serviceCharge + deliveryFee
Step  7: Apply post-tax discounts (gift cards → loyalty, capped at remaining)
Step  8: Calculate totals (totalDiscount, totalAmount = max(0, pre - discounts))
Step  9: Calculate loyalty points earned (NOT redeemed — separate step)
Step 10: Calculate deposit (for reservation-type engines)
Step 11: Round all amounts and validate invariant
```

### 4.2 Financial Invariants

```
INVARIANT 1: totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount
INVARIANT 2: totalAmount >= 0 (never negative)
INVARIANT 3: Each discount is capped at remaining balance
INVARIANT 4: Tax is calculated on (subtotal - preBasketDiscount)
INVARIANT 5: All amounts rounded to configured decimal places at output
INVARIANT 6: Rounding tolerance: |actual - expected| < 0.02
```

### 4.3 Per-Engine Pricing Configuration

| Feature | Engine A | Engine B | Engine C | Engine D |
|---------|----------|----------|----------|----------|
| Tax | ✅ | ✅ | ✅ | ✅ |
| Service Charge | ✅ (dine-in) | ❌ | ❌ | ❌ |
| Delivery Fee | ✅ (delivery) | ❌ | ❌ | ❌ |
| Coupons | ✅ | ✅ | ✅ | ✅ |
| Gift Cards | ✅ | ✅ | ✅ | ❌ |
| Loyalty Redemption | ✅ | ✅ | ✅ | ❌ |
| Loyalty Earning | ✅ | ✅ | ✅ | ✅ |
| Inventory Deduction | ✅ | ❌ | ❌ | ❌ |

---

## 5. Transactional Atomicity

### 5.1 Saga Pattern

The engine framework uses the **Saga pattern** for multi-step operations. Each operation is decomposed into steps, each with a compensating action:

```
Operation: Create Order
  Step 1: Calculate pricing (pure, no compensation needed)
  Step 2: Validate state transition (pure, no compensation needed)
  Step 3: Apply coupon (compensate: restore coupon usage count)
  Step 4: Redeem gift card (compensate: credit back gift card balance)
  Step 5: Redeem loyalty points (compensate: restore loyalty points)
  Step 6: Write to ledger (compensate: write void entry)
  Step 7: Persist entity (compensate: delete entity)
  Step 8: Earn loyalty points (optional, fire-and-forget)
```

### 5.2 Transaction Manager

```typescript
const txManager = getTransactionManager();
const result = await txManager.executeTransaction(steps, context);

if (!result.success) {
  // Steps were automatically compensated in reverse order
  // Failed compensation is logged to engine_compensation_log
  // Requires manual review flag is set
}
```

### 5.3 Compensation Log

Failed compensations are recorded in `engine_compensation_log` for manual review:

| Column | Description |
|--------|-------------|
| tx_id | Transaction identifier |
| step_name | Which step failed to compensate |
| error_message | What went wrong |
| requires_manual_review | Always true for failed compensation |
| resolved_by / resolved_at | Manual resolution tracking |

---

## 6. Idempotency

### 6.1 Architecture

Every financial mutation is protected by an idempotency key:

```
Key format: {tenantId}:{engineType}:{entityId}:{action}:{nonce}
Example:    tenant-123:instant_transaction:order-456:confirm:stripe_pi_789
```

### 6.2 Behavior

| Scenario | Behavior |
|----------|----------|
| First request | Execute, cache result, return 200 |
| Duplicate (completed) | Return cached result, no re-execution |
| Duplicate (processing) | Return 409 Conflict |
| Duplicate (failed) | Allow retry (re-execute) |
| Expired key | Treat as new (keys expire after 24h) |

### 6.3 Payment Webhooks

Payment webhooks (Stripe, etc.) MUST include the payment intent ID as the idempotency nonce. This prevents:
- Double charging on webhook retry
- Double loyalty earning
- Double inventory deduction

---

## 7. Unified Financial Ledger

### 7.1 Architecture

Every financial mutation is recorded in `engine_financial_ledger`:

- **Append-only**: Entries are never updated or deleted
- **Complete breakdown**: Every entry contains the full pricing decomposition
- **Idempotency-keyed**: Prevents duplicate entries
- **DB-invariant-constrained**: CHECK constraint validates totalAmount formula

### 7.2 Transaction Types

| Type | Direction | Description |
|------|-----------|-------------|
| `charge` | + | Initial payment for a transaction |
| `refund` | - | Reversal of a previous charge |
| `adjustment` | ± | Correction to a previous entry |
| `void` | - | Complete cancellation of a charge |
| `deposit` | + | Reservation deposit collected |
| `deposit_release` | - | Deposit returned to customer |

### 7.3 Balance Calculation

```sql
Net Balance = SUM(charges + deposits) - SUM(refunds + voids + deposit_releases) + SUM(adjustments)
```

---

## 8. Observability

### 8.1 Structured Events

Every engine operation emits typed events:

- `state_transition` / `state_transition_rejected`
- `pricing_calculated` / `pricing_invariant_violation`
- `ledger_write` / `ledger_invariant_violation`
- `idempotency_hit` / `idempotency_conflict`
- `transaction_started` / `transaction_completed` / `transaction_failed`
- `capacity_violation` / `booking_overlap_rejected`
- `duplicate_loyalty_prevented`
- `rpc_call` / `rpc_failure`

### 8.2 Metrics

Counters are maintained for:
- State transitions per engine type and action
- Pricing calculations with total amounts
- Ledger writes per transaction type
- Idempotency hits and conflicts
- Transaction success/failure rates
- Anomaly counts (invariant violations, capacity violations, etc.)

### 8.3 Audit Trail

Every state transition is persisted to `engine_state_transitions` with:
- Previous/new state, action, actor
- Context at time of transition
- Guard evaluation results
- Side effects triggered
- Optional transaction ID (for saga correlation)

---

## 9. Feature Flag Rollout

### 9.1 Flags

| Flag | Controls |
|------|----------|
| `engine_v2_pricing` | Unified pricing pipeline |
| `engine_v2_state_machine` | Formal state machine enforcement |
| `engine_v2_ledger` | Financial ledger writes |
| `engine_v2_idempotency` | Idempotency key checking |
| `engine_v2_full` | All features (master switch) |

### 9.2 Rollout Strategy

```
Phase 1: Internal testing (flag disabled for all tenants)
Phase 2: Canary (enable for 1 test tenant)
Phase 3: Limited rollout (enable for 10% of tenants)
Phase 4: Wide rollout (enable for 50% of tenants)
Phase 5: General availability (enable for all, remove v1 code)
```

### 9.3 Per-Tenant Activation

```typescript
const flags = getFeatureFlagService();
const enabled = await flags.isEnabled(tenantId, 'engine_v2_pricing');
```

---

## 10. File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `shared/types/engines.ts` | Type contracts (shared FE/BE) | ~345 |
| `engines/state-machine.ts` | Generic state machine enforcer | ~297 |
| `engines/pricing-pipeline.ts` | Universal pricing calculator | ~391 |
| `engines/definitions/instant-transaction.ts` | Engine A definition | ~200 |
| `engines/definitions/time-exclusive-reservation.ts` | Engine B definition | ~200 |
| `engines/definitions/shared-capacity-access.ts` | Engine C definition | ~200 |
| `engines/definitions/ongoing-entitlement.ts` | Engine D definition | ~200 |
| `engines/registry.ts` | Template → engine mapping | ~113 |
| `engines/engine-service.ts` | High-level controller API | ~286 |
| `engines/discount-resolvers.ts` | Supabase RPC bridges | ~215 |
| `engines/transaction-manager.ts` | Saga pattern atomicity | ~210 |
| `engines/idempotency-guard.ts` | Duplicate prevention | ~240 |
| `engines/financial-ledger.ts` | Unified financial record | ~340 |
| `engines/observability.ts` | Structured events + metrics | ~420 |
| `engines/feature-flags.ts` | Rollout control | ~200 |
| `engines/index.ts` | Barrel export | ~120 |
| `database/migrations/engine-framework-constraints.sql` | DB constraints | ~280 |

---

## 11. Design Decisions

### Why Saga Pattern Instead of DB Transactions?

Supabase client SDK doesn't expose traditional `BEGIN/COMMIT/ROLLBACK`. Each RPC call is its own database transaction. The saga pattern provides operation-level atomicity across multiple RPC calls with automatic compensation.

### Why Separate Idempotency from Ledger?

The idempotency key store serves ALL engine operations (not just financial). It also needs different lifecycle management (TTL-based expiry vs immutable ledger entries).

### Why Engine D Has Limited Discount Support?

Subscriptions are recurring. Gift cards and loyalty redemption are one-time operations that don't map cleanly to recurring billing cycles. Coupons (percentage discounts) make sense for initial subscription pricing. Loyalty earning happens per billing cycle.

### Why `expired` Is Not Terminal for Engine D?

Expired subscriptions can be reactivated (common in SaaS). A cancelled subscription cannot be reactivated — it requires a new subscription. This distinction is intentional.
