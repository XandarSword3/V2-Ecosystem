# Workflow Contracts

> **V2 Resort Platform — Formal Workflow Specifications**  
> Every engine workflow is documented here with exact preconditions, postconditions,  
> side effects, compensation logic, and interaction contracts.

---

## 1. Contract Structure

Every workflow contract specifies:

| Field | Description |
|-------|-------------|
| **Preconditions** | What must be true BEFORE the operation |
| **Postconditions** | What must be true AFTER the operation |
| **Side Effects** | What other systems are affected |
| **Compensation** | How to undo this operation if a later step fails |
| **Idempotency** | How duplicate requests are handled |
| **Actors** | Who can trigger this workflow |

---

## 2. Engine A — Instant Transaction Workflows

### 2.1 Create Order

```
Preconditions:
  - Valid module_id with template_type = 'menu_service'
  - Line items with valid item IDs, prices, quantities
  - Customer authenticated (optional, for loyalty/coupons)
  
Steps:
  1. Validate line items against menu catalog
  2. Calculate pricing via engine pipeline
  3. Set initial state = 'pending'
  4. Persist order to database
  5. Write ledger entry (type: 'charge')
  6. Apply coupon if provided (atomic RPC)
  7. Redeem gift card if provided (atomic RPC)
  8. Redeem loyalty points if provided (atomic RPC)
  
Postconditions:
  - Order exists with status = 'pending'
  - Ledger entry exists with complete pricing breakdown
  - Coupon usage count incremented (if coupon used)
  - Gift card balance decremented (if gift card used)
  - Loyalty points decremented (if loyalty redeemed)
  
Side Effects:
  - None at creation (loyalty earn happens on completion)
  
Compensation:
  - Delete order record
  - Void ledger entry
  - Restore coupon usage count
  - Credit back gift card balance
  - Restore loyalty points
  
Idempotency Key: {tenantId}:instant_transaction:{orderId}:create
```

### 2.2 Confirm Order

```
Preconditions:
  - Order exists with status = 'pending'
  - Payment verified (or cash/pay-later)
  
Steps:
  1. Validate state transition: pending → confirmed (action: 'confirm')
  2. Update order status in database
  3. Write audit trail entry
  4. Deduct inventory (interaction contract: deduct_inventory_on_purchase)
  5. Notify kitchen (interaction contract: notify_kitchen_on_confirm)
  
Postconditions:
  - Order status = 'confirmed'
  - Audit trail records transition
  - Inventory decremented for all items
  
Compensation:
  - Revert order status to 'pending'
  - Restore inventory quantities
  
Idempotency Key: {tenantId}:instant_transaction:{orderId}:confirm
```

### 2.3 Complete Order

```
Preconditions:
  - Order exists with status = 'ready' or 'delivered'
  
Steps:
  1. Validate state transition: ready/delivered → completed
  2. Update order status
  3. Write audit trail entry
  4. Earn loyalty points (interaction contract: earn_loyalty_on_purchase)
  5. Write loyalty event to engine_loyalty_events (duplicate prevention)
  
Postconditions:
  - Order status = 'completed' (terminal)
  - Loyalty points earned (exactly once)
  - No further state transitions possible
  
Compensation:
  - N/A (completion is the final step)
  
Idempotency Key: {tenantId}:instant_transaction:{orderId}:complete
```

### 2.4 Cancel Order

```
Preconditions:
  - Order exists with status IN ('pending', 'confirmed', 'preparing')
  
Steps:
  1. Validate state transition: current → cancelled
  2. Update order status
  3. Write audit trail entry
  4. Write refund ledger entry (if payment was collected)
  5. Restore coupon usage count (if coupon was used)
  6. Credit back gift card balance (if gift card was used)
  7. Restore loyalty points (if loyalty was redeemed)
  8. Restore inventory (if already deducted)
  
Postconditions:
  - Order status = 'cancelled' (terminal)
  - All financial effects reversed
  - Inventory restored
  
Idempotency Key: {tenantId}:instant_transaction:{orderId}:cancel
```

---

## 3. Engine B — Time-Exclusive Reservation Workflows

### 3.1 Create Booking

```
Preconditions:
  - Valid module_id with template_type = 'multi_day_booking'
  - Valid date range (check_in_date < check_out_date)
  - Resource (chalet) exists and is active
  - No overlapping booking for the same resource (DB constraint enforced)
  
Steps:
  1. Calculate pricing (nights × rate + extras)
  2. Check availability (interaction contract: block_availability_on_confirm)
  3. Set initial state = 'pending'
  4. Persist booking to database
  5. Write ledger entry (type: 'deposit' if deposit required, else 'charge')
  
Postconditions:
  - Booking exists with status = 'pending'
  - Date range reserved (overlap constraint active)
  - Ledger entry recorded
  
Compensation:
  - Delete booking record
  - Void ledger entry
  - Release availability block
  
Idempotency Key: {tenantId}:time_exclusive_reservation:{bookingId}:create
```

### 3.2 Check In

```
Preconditions:
  - Booking exists with status = 'confirmed'
  - Current date is within booking date range
  
Steps:
  1. Validate state transition: confirmed → checked_in
  2. Update booking status
  3. Write audit trail entry
  4. Record actual check-in time
  
Postconditions:
  - Booking status = 'checked_in'
  - Check-in timestamp recorded
  
Idempotency Key: {tenantId}:time_exclusive_reservation:{bookingId}:check_in
```

### 3.3 Check Out

```
Preconditions:
  - Booking exists with status = 'checked_in'
  
Steps:
  1. Validate state transition: checked_in → checked_out
  2. Calculate final charges (minibar, damages, extras)
  3. Update booking status
  4. Write audit trail entry
  5. Write final ledger entry (if additional charges)
  6. Earn loyalty points (interaction contract: earn_loyalty_on_payment)
  7. Trigger housekeeping (interaction contract: trigger_housekeeping_on_checkout)
  
Postconditions:
  - Booking status = 'checked_out' (terminal)
  - Final billing complete
  - Loyalty points earned
  - Housekeeping notified
  
Idempotency Key: {tenantId}:time_exclusive_reservation:{bookingId}:check_out
```

### 3.4 Cancel Booking

```
Preconditions:
  - Booking exists with status IN ('pending', 'confirmed')
  
Steps:
  1. Validate state transition: current → cancelled
  2. Calculate cancellation fee (if applicable)
  3. Update booking status
  4. Write audit trail entry
  5. Write refund ledger entry (full or partial)
  6. Release availability (interaction contract: release_availability_on_cancel)
  
Postconditions:
  - Booking status = 'cancelled' (terminal)
  - Availability released
  - Refund processed (minus cancellation fee)
  
Idempotency Key: {tenantId}:time_exclusive_reservation:{bookingId}:cancel
```

---

## 4. Engine C — Shared Capacity Access Workflows

### 4.1 Purchase Ticket/Session

```
Preconditions:
  - Valid module_id with template_type = 'session_access'
  - Facility is open and has capacity
  
Steps:
  1. Calculate pricing (entry fee + extras)
  2. Set initial state = 'valid'
  3. Persist session to database
  4. Write ledger entry (type: 'charge')
  5. Apply discounts (coupon, gift card, loyalty)
  
Postconditions:
  - Session exists with status = 'valid'
  - Ledger entry recorded
  - Ticket/session can be used for entry
  
Compensation:
  - Delete session record
  - Void ledger entry
  - Restore discounts
  
Idempotency Key: {tenantId}:shared_capacity_access:{sessionId}:create
```

### 4.2 Validate Entry

```
Preconditions:
  - Session exists with status = 'valid'
  - Facility has available capacity (interaction contract: check_capacity_on_entry)
  
Steps:
  1. Validate state transition: valid → active (action: 'validate_entry')
  2. Check capacity (current_occupancy < max_capacity)
  3. Increment current_occupancy
  4. Update session status
  5. Write audit trail entry
  6. Record entry time
  
Postconditions:
  - Session status = 'active'
  - current_occupancy incremented by guest count
  - Entry time recorded
  
Compensation:
  - Revert session status to 'valid'
  - Decrement current_occupancy
  
Idempotency Key: {tenantId}:shared_capacity_access:{sessionId}:validate_entry
```

### 4.3 Record Exit

```
Preconditions:
  - Session exists with status = 'active'
  
Steps:
  1. Validate state transition: active → used (action: 'record_exit')
  2. Decrement current_occupancy (interaction contract: decrement_capacity_on_exit)
  3. Update session status
  4. Write audit trail entry
  5. Record exit time and duration
  6. Earn loyalty points (interaction contract: earn_loyalty_on_purchase)
  
Postconditions:
  - Session status = 'used' (terminal)
  - current_occupancy decremented
  - Duration calculated
  - Loyalty points earned
  
Idempotency Key: {tenantId}:shared_capacity_access:{sessionId}:record_exit
```

---

## 5. Engine D — Ongoing Entitlement Workflows

### 5.1 Create Subscription

```
Preconditions:
  - Valid module_id with template_type = 'subscription'
  - Customer identified
  - Billing information available
  
Steps:
  1. Calculate initial pricing (first period)
  2. Set initial state = 'pending'
  3. Persist subscription to database
  4. Write ledger entry (type: 'charge')
  5. Setup recurring billing (interaction contract)
  
Postconditions:
  - Subscription exists with status = 'pending'
  - First period payment recorded
  - Recurring billing configured
  
Idempotency Key: {tenantId}:ongoing_entitlement:{subscriptionId}:create
```

### 5.2 Activate Subscription

```
Preconditions:
  - Subscription exists with status = 'pending'
  - Payment confirmed
  
Steps:
  1. Validate state transition: pending → active
  2. Update subscription status
  3. Write audit trail entry
  4. Grant facility access (interaction contract: grant_facility_access_on_activate)
  5. Earn loyalty points for first period
  
Postconditions:
  - Subscription status = 'active'
  - Facility access granted
  - Loyalty points earned for current period
  
Idempotency Key: {tenantId}:ongoing_entitlement:{subscriptionId}:activate
```

### 5.3 Renew Subscription

```
Preconditions:
  - Subscription exists with status = 'active'
  - Billing cycle reached renewal point
  
Steps:
  1. Validate state transition: active → active (action: 'renew')
  2. Calculate renewal pricing
  3. Process payment
  4. Write ledger entry for new period
  5. Write audit trail entry
  6. Earn loyalty points for new period
  
Postconditions:
  - Subscription remains status = 'active'
  - New billing period started
  - Payment recorded in ledger
  
Idempotency Key: {tenantId}:ongoing_entitlement:{subscriptionId}:renew:{period}
```

### 5.4 Pause/Resume Subscription

```
Preconditions:
  - Pause: status = 'active'; Resume: status = 'paused'
  
Steps:
  1. Validate state transition
  2. Update subscription status
  3. Write audit trail entry
  4. Suspend/restore recurring billing
  5. Suspend/restore facility access
  
Postconditions:
  - Status updated to 'paused' or 'active'
  - Billing suspended/resumed
  - Access suspended/resumed
```

---

## 6. Cross-Engine Interaction Contracts

### 6.1 Loyalty Interactions

| Contract | Engines | Trigger | Idempotent | Failure Mode |
|----------|---------|---------|------------|--------------|
| earn_loyalty_on_purchase | A, C | on_purchase | ✅ | log_and_continue |
| earn_loyalty_on_payment | B | on_payment | ✅ | log_and_continue |
| earn_loyalty_per_billing_cycle | D | on_payment | ✅ | log_and_continue |

**Duplicate Prevention**: The `engine_loyalty_events` table has a unique constraint on `(entity_id, event_type)`. Attempting to earn loyalty twice for the same entity will be silently ignored.

### 6.2 Inventory Interactions

| Contract | Engines | Trigger | Idempotent | Failure Mode |
|----------|---------|---------|------------|--------------|
| deduct_inventory_on_purchase | A | on_purchase | ❌ | block |

### 6.3 Availability Interactions

| Contract | Engines | Trigger | Idempotent | Failure Mode |
|----------|---------|---------|------------|--------------|
| block_availability_on_confirm | B | on_purchase | ❌ | block |
| release_availability_on_cancel | B | on_cancel | ✅ | log_and_continue |

### 6.4 Capacity Interactions

| Contract | Engines | Trigger | Idempotent | Failure Mode |
|----------|---------|---------|------------|--------------|
| check_capacity_on_entry | C | on_check_in | ❌ | block |
| decrement_capacity_on_exit | C | on_check_out | ✅ | log_and_continue |

### 6.5 Notification Interactions

| Contract | Engines | Trigger | Idempotent | Failure Mode |
|----------|---------|---------|------------|--------------|
| notify_kitchen_on_confirm | A | on_purchase | ✅ | log_and_continue |
| trigger_housekeeping_on_checkout | B | on_check_out | ✅ | log_and_continue |

---

## 7. Error Handling Contracts

### 7.1 Error Taxonomy

| Error Type | HTTP Status | Retryable | Compensation |
|-----------|-------------|-----------|--------------|
| `INVALID_STATE_TRANSITION` | 409 | No | None needed |
| `IDEMPOTENCY_CONFLICT` | 409 | Yes (wait) | None needed |
| `LEDGER_INVARIANT_VIOLATION` | 500 | No | None needed |
| `LEDGER_WRITE_FAILED` | 500 | Yes | Compensate prior steps |
| `CAPACITY_EXCEEDED` | 409 | No | None needed |
| `BOOKING_OVERLAP` | 409 | No | None needed |
| `COUPON_INVALID` | 400 | No | None needed |
| `GIFT_CARD_INSUFFICIENT` | 400 | No | None needed |
| `LOYALTY_INSUFFICIENT` | 400 | No | None needed |

### 7.2 Compensation Order

When a multi-step operation fails, compensation happens in **reverse order**:

```
Step 7 fails →
  Compensate Step 6
  Compensate Step 5
  Compensate Step 4
  Compensate Step 3
  Steps 1-2 were pure/read-only (no compensation needed)
```

### 7.3 Compensation Failures

If compensation itself fails:
1. Logged to `engine_compensation_log` with `requires_manual_review = TRUE`
2. Error logged at CRITICAL level
3. Operational alert should fire (external monitoring)
4. Manual resolution required via admin UI

---

## 8. Actor Permissions Summary

| Operation | system | staff | customer | admin |
|-----------|--------|-------|----------|-------|
| Create order/booking/session | ✅ | ✅ | ✅ | ✅ |
| Confirm | ✅ | ✅ | — | ✅ |
| Check in | — | ✅ | — | ✅ |
| Check out | ✅ | ✅ | — | ✅ |
| Cancel (pending) | — | ✅ | ✅ | ✅ |
| Cancel (confirmed+) | — | ✅ | — | ✅ |
| Modify pricing | — | — | — | ✅ |
| View audit trail | — | ✅ | — | ✅ |
| Manage feature flags | — | — | — | ✅ |
