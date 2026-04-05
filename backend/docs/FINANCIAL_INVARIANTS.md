# Financial Invariants

> **V2 Resort Platform — Financial Correctness Guarantees**  
> This document specifies every financial invariant enforced by the engine framework.  
> Violations of these invariants are treated as CRITICAL bugs.

---

## 1. Pricing Invariants

### INV-P1: Total Amount Formula

```
totalAmount = max(0, subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount)
```

- **Enforced by**: `PricingPipeline.validateInvariant()` (runtime), DB CHECK constraint on `engine_financial_ledger`
- **Tolerance**: |actual - expected| < 0.02 (floating-point rounding)
- **Violation behavior**: Runtime → logged at ERROR level; DB → INSERT rejected

### INV-P2: Non-Negative Total

```
totalAmount >= 0
```

- **Enforced by**: `Math.max(0, ...)` in pipeline, DB CHECK constraint
- **Rationale**: Discounts cannot produce a negative payment

### INV-P3: Tax Calculation

```
taxAmount = max(0, subtotal - preBasketDiscount) × taxRate
```

- **Enforced by**: PricingPipeline step 3
- **Rationale**: Pre-tax discounts (coupons) reduce the taxable amount

### INV-P4: Discount Order

```
Discounts are applied in strict order: coupon → gift card → loyalty
Each discount is capped at the remaining balance at that step.
```

- **Enforced by**: PricingPipeline steps 2, 7
- **Rationale**: Gift cards and loyalty operate on the post-tax total; coupons on pre-tax subtotal

### INV-P5: Subtotal Calculation

```
subtotal = Σ (unitPrice + unitAdjustment) × quantity
```

- **Enforced by**: PricingPipeline step 1
- **Rationale**: unitAdjustment captures modifiers/add-ons per unit

### INV-P6: Rounding

```
All monetary amounts in PricingResult are rounded to `config.decimalPlaces`
using `config.rounding` strategy (round | floor | ceil).
Rounding happens ONLY at the final output step, not at intermediate steps.
```

- **Enforced by**: PricingPipeline step 11
- **Rationale**: Intermediate rounding causes accumulation errors

---

## 2. Ledger Invariants

### INV-L1: Completeness

```
Every financial mutation MUST be recorded in engine_financial_ledger.
No direct writes to order/booking/session tables for financial amounts.
```

- **Enforced by**: FinancialLedgerService, workflow contracts
- **Status**: Implemented — requires feature flag `engine_v2_ledger`

### INV-L2: Immutability

```
Ledger entries are NEVER updated or deleted.
Corrections are recorded as new entries (type: 'adjustment' or 'void').
```

- **Enforced by**: Application code (no UPDATE queries on ledger), planned DB trigger
- **Rationale**: Audit compliance — financial records must be tamper-evident

### INV-L3: Balance Consistency

```
For any entity:
  net_balance = SUM(charge_amounts + deposit_amounts) 
              - SUM(refund_amounts + void_amounts + deposit_release_amounts)
              + SUM(adjustment_amounts)
```

- **Enforced by**: `FinancialLedgerService.getEntityBalance()`
- **Verification**: Can be checked at any time via `get_entity_ledger_balance()` DB function

### INV-L4: Idempotent Writes

```
Each ledger entry has a unique idempotency_key.
Duplicate keys are rejected by the UNIQUE constraint on engine_financial_ledger.idempotency_key.
```

- **Enforced by**: DB UNIQUE constraint, IdempotencyGuard
- **Rationale**: Prevents double charging on webhook retry

### INV-L5: Invariant at Write

```
The FinancialLedgerService validates INV-P1 BEFORE writing.
Entries that violate the total formula are rejected (LedgerInvariantError thrown).
```

- **Enforced by**: `FinancialLedgerService.validateInvariant()`
- **Exception**: Refunds and voids have simplified structure (exempt from formula check)

---

## 3. State Machine Invariants

### INV-S1: No Ad-Hoc State Changes

```
ALL entity state changes MUST go through the engine state machine.
No direct UPDATE of status columns outside the engine framework.
```

- **Enforced by**: EngineService.transitionState(), workflow contracts
- **Status**: Implemented — controllers wired to engine service

### INV-S2: Terminal State Finality

```
Terminal states have ZERO outgoing transitions.
Once an entity reaches a terminal state, no further transitions are possible.
Exception: Engine D's 'expired' state is NOT terminal (can reactivate or cancel).
```

- **Enforced by**: StateMachine.isTerminal(), StateMachine.validateDefinition()
- **DB enforcement**: State machine definitions are compiled at startup, preventing runtime modification

### INV-S3: Actor Authorization

```
Every transition declares which actors can trigger it.
Attempts by unauthorized actors are rejected with a 409 error.
```

- **Enforced by**: StateMachine.canTransition() actor check

### INV-S4: Guard Compliance

```
Guard functions are evaluated BEFORE transition execution.
If any guard fails, the transition is blocked (no state change, no side effects).
```

- **Enforced by**: StateMachine.canTransition() guard evaluation loop

### INV-S5: Audit Trail Completeness

```
Every successful state transition is recorded in engine_state_transitions.
Records include: previous state, new state, action, actor, context, timestamp.
Audit trail entries are immutable (append-only).
```

- **Enforced by**: EngineObserver.writeAuditTrail()

---

## 4. Idempotency Invariants

### INV-I1: At-Most-Once Execution

```
For any idempotency key, the protected operation executes AT MOST ONCE.
Subsequent requests with the same key return the cached result.
```

- **Enforced by**: IdempotencyGuard.executeOnce()
- **Cache storage**: engine_idempotency_keys table

### INV-I2: Key Uniqueness

```
Idempotency keys are deterministic and scoped:
  format: {tenantId}:{engineType}:{entityId}:{action}:{nonce}
```

- **Enforced by**: IdempotencyGuard.generateKey()
- **DB enforcement**: PRIMARY KEY on engine_idempotency_keys.key

### INV-I3: Key Expiry

```
Idempotency keys expire after 24 hours (configurable).
Expired keys are cleaned up periodically.
After expiry, the same key can be reused (but the nonce should differ).
```

- **Enforced by**: IdempotencyGuard TTL, cleanup_expired_idempotency_keys() DB function

### INV-I4: Failed Operations Allow Retry

```
If the protected operation fails, the idempotency key is marked as 'failed'.
Failed keys DO NOT block retries — the operation can be re-attempted.
```

- **Enforced by**: IdempotencyGuard.executeOnce() catch block

---

## 5. Capacity Invariants (Engine C)

### INV-C1: Non-Negative Occupancy

```
current_occupancy >= 0 at all times.
```

- **Enforced by**: DB CHECK constraint on pools table, check_capacity_nonneg() trigger
- **Violation behavior**: INSERT/UPDATE rejected with exception

### INV-C2: Capacity Limit

```
current_occupancy <= max_capacity (when max_capacity is set).
```

- **Enforced by**: DB trigger check_capacity_nonneg(), runtime guard on validate_entry
- **Violation behavior**: Entry rejected, state transition blocked

### INV-C3: Exit Without Entry Prevention

```
record_exit action is only valid from state 'active'.
An entity in state 'valid' CANNOT transition to 'used' directly.
```

- **Enforced by**: State machine transition graph (no valid → used transition exists)

---

## 6. Booking Invariants (Engine B)

### INV-B1: No Overlapping Bookings

```
For any resource (chalet_id), no two non-cancelled bookings may have overlapping date ranges.
  overlap: booking_a.check_in_date < booking_b.check_out_date 
       AND booking_a.check_out_date > booking_b.check_in_date
```

- **Enforced by**: DB trigger check_booking_overlap() on bookings table
- **Excluded statuses**: 'cancelled', 'no_show'

### INV-B2: Date Ordering

```
check_in_date < check_out_date for all bookings.
```

- **Enforced by**: Application validation at booking creation

### INV-B3: Availability Release on Cancel

```
When a booking is cancelled, the availability for that date range MUST be released.
This is an interaction contract (release_availability_on_cancel).
```

- **Enforced by**: Workflow contract, side effect on cancel transitions

---

## 7. Loyalty Invariants

### INV-LY1: Single Earn Per Transaction

```
Loyalty points are earned EXACTLY ONCE per entity (order, booking, session).
Duplicate earn attempts are prevented by engine_loyalty_events unique constraint.
```

- **Enforced by**: UNIQUE(entity_id, event_type) on engine_loyalty_events
- **Background**: Previously had a bug where loyalty was earned at both order creation AND payment confirmation. Fixed by making "when to earn" part of the engine definition.

### INV-LY2: Earn vs Redeem Separation

```
Loyalty point earning is a separate event from loyalty point redemption.
They are tracked independently and never conflated.
```

- **Enforced by**: Separate event_type values ('earn' vs 'redeem') in engine_loyalty_events

### INV-LY3: Points-to-Dollar Conversion

```
Default conversion: 100 loyalty points = $1 (configurable via loyalty_settings)
```

- **Enforced by**: SupabaseLoyaltyResolver.redeem() calculation

---

## 8. Transaction Invariants

### INV-T1: All-or-Nothing

```
Multi-step engine operations either complete ALL steps or compensate ALL completed steps.
Partial completion is not an acceptable end state.
```

- **Enforced by**: TransactionManager.executeTransaction() with saga compensation

### INV-T2: Compensation Best-Effort

```
If compensation fails, it is logged to engine_compensation_log with requires_manual_review = TRUE.
The system does NOT silently ignore failed compensations.
```

- **Enforced by**: TransactionManager.compensate(), recordCompensationFailure()

### INV-T3: Optional Steps Don't Block

```
Steps marked as 'optional' do not trigger compensation on failure.
Example: Loyalty earning failure should not block order completion.
```

- **Enforced by**: TransactionStep.optional flag check in executeTransaction()

---

## 9. Invariant Monitoring

### Metrics to Watch

| Metric | Normal | Alert Threshold | Action |
|--------|--------|-----------------|--------|
| pricing_invariant_violation | 0 | > 0 | Investigate pricing calculation bug |
| ledger_invariant_violation | 0 | > 0 | CRITICAL: Stop financial operations |
| capacity_violation | 0 | > 0 | Check capacity management logic |
| duplicate_loyalty_prevented | Low | Spike | Check loyalty earn trigger points |
| rpc_failure.total | Low | > 5/min | Check Supabase connectivity |
| transaction_failed | Low | > 3/hour | Check saga step reliability |
| compensation_failed | 0 | > 0 | Immediate manual review required |

### Reconciliation Checks

Run periodically (daily) to verify:

1. **Ledger-Entity Reconciliation**: For each entity, verify ledger balance matches entity's stored total
2. **Transition-State Reconciliation**: For each entity, verify current state matches the latest audit trail entry's new_state
3. **Loyalty Balance Reconciliation**: Verify loyalty_events table matches loyalty_points table totals
4. **Capacity Reconciliation**: Verify pools.current_occupancy matches count of active sessions

---

## 10. Violation Response Procedures

### Level 1 — Warning (Log and Continue)

- Single floating-point rounding discrepancy within tolerance
- Optional side effect failure
- Loyalty earn failure (points not critical to transaction)

### Level 2 — Error (Block Operation)

- Financial invariant violation (pricing formula mismatch)
- State machine violation (invalid transition attempt)
- Capacity exceeded
- Booking overlap detected

### Level 3 — Critical (Immediate Response)

- Ledger write failure (financial record gap)
- Compensation failure (partially rolled-back transaction)
- Duplicate financial mutation detected
- Negative balance in any account
