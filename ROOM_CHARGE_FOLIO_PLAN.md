# Room Charge Folio — Implementation Plan

Room charge today: a button in `PaymentDialog.tsx` that posts `method: 'room_charge'`
to `/payments/record-manual`, which the backend's Zod schema rejects outright — the
method isn't in the allowed enum. No folio, no room linkage, nothing behind it.

Decision: build it as a real folio — charges tied to an actual checked-in stay, a
running balance, settled before check-out. Not a lightweight stub.

## Scope decisions (locked in for this pass)

- **v1 covers Engine A → Engine B only**: POS orders (restaurant, etc.) charged to
  an accommodation booking. Spa/activities (Engine C/D) charging to a room is the
  same pattern later, not blocking this.
- **"The room" = a specific booking, not the unit.** A `transactions` row with
  `engine_type = 'time_exclusive_reservation'` and `status = 'checked_in'`. Not the
  `accommodation_units` row — a unit gets reused by different guests over time, so
  charging the unit would leak balance across stays.
- **No PIN/manager-approval step in v1.** No existing precedent for that pattern
  anywhere else in the app (checked — nothing gates voids/discounts/overrides on a
  PIN today), and staff already have to be authenticated to reach this screen.
  Revisit if this becomes an actual abuse vector in practice.
- **No auto-settle at check-out in v1.** Check-out blocks with a balance-due error;
  staff explicitly settles first, then re-attempts check-out. Smaller surface area
  for v1; auto-settle-and-checkout-in-one-step is a reasonable v2 UX nicety.
- **Disputed charges: out of scope for v1 UI.** The ledger's audit trail (staff_id +
  timestamp per entry, already how `payment_ledger` works) is enough for manual
  resolution outside the app for now.

## Phase 0 — Verify (do first, ~10 min, before any of the below)

- [ ] Query the **live** Supabase `payments` table's actual columns. Migrations show
      no `method`, `processed_by`, `processed_at`, or `notes` columns, but
      `recordManualPayment` (payment.controller.ts) inserts into all four, for every
      manual payment method — not just room_charge.
- [ ] **If those columns don't exist live**: this is a P0 bug affecting cash, whish,
      omt, and other_transfer payments today, not just room_charge. Needs its own fix
      before or alongside this work — building folio settlement on a broken payments
      insert just moves the crash one level up.
- [ ] Confirm `transactions.customer_id` is actually populated on Engine B bookings
      created through the current booking flow (only confirmed the column exists,
      not that it's reliably filled in).

## Phase 1 — Data model (no new tables)

- Room = `transactions` row, `engine_type = 'time_exclusive_reservation'`,
  `status = 'checked_in'`.
- Folio ledger = reuse `payment_ledger` (already exists, already append-only/audited,
  currently unused for anything but gateway webhooks):
  - `reference_type = 'room_folio'`
  - `reference_id = <the booking's transactions.id>`
  - `event_type = 'charge'` (a POS order charged to the room) or `'settlement'`
    (guest pays down the balance)
  - `amount`, `status`, `metadata` (put the source order id here for charges)
- Balance = `SUM(charge.amount) - SUM(settlement.amount)` where
  `reference_id = booking id AND status = 'completed'`.
- Migration needed: index on `payment_ledger(reference_type, reference_id)` —
  checked, doesn't exist today (only `gateway_reference_id` and `webhook_id` are
  indexed), and every balance lookup will filter on exactly those two columns.

## Phase 2 — Backend

1. `GET /staff/modules/:slug/checked-in-rooms?search=` — search currently
   `checked_in` Engine B bookings by unit name or guest name/phone. Powers the
   room picker in the payment dialog.
2. `POST /payments/room-charge` — body `{ orderId, bookingId }`. Validates the
   booking is `checked_in`, writes a `payment_ledger` charge entry, marks the
   Engine A order paid (same downstream effect `recordManualPayment` already has).
3. `GET /bookings/:bookingId/folio-balance` — sums the ledger. Used by the
   payment dialog (to show balance-so-far) and the check-out screen.
4. Add `room_charge` back to `recordManualPaymentSchema`'s method enum — but only
   after #1-3 exist, so it's wired to something real instead of just re-opening
   the same crash with no linkage behind it.
5. **The actual enforcement**: in `updateModuleBookingStatus`
   (`module-staff.controller.ts`, the `checked_out` case) — before calling
   `engineService.transitionState(..., 'check_out', ...)`, query the folio balance
   for `bookingId`. If it's > 0, return 409 with the balance instead of allowing
   the transition. Note: the engine definition's `check_out` transition already
   *describes* this guard in prose ("balance is settled") — nothing in
   `engine-service.ts` enforces guards programmatically, so this has to be a
   direct check in the controller, not a framework-level hook.

## Phase 3 — Frontend

- `PaymentDialog.tsx`: "Room Charge" becomes two steps instead of one button —
  search/pick a checked-in room (autocomplete against Phase 2 endpoint #1), confirm,
  then charge (endpoint #2).
- `MultiDayBookingDashboard.tsx` (the two "Check Out" buttons, currently firing
  `updateBookingStatus(booking.id, 'checked_out')` with no balance awareness at
  all) — catch the new 409, show the outstanding balance, offer a "settle &
  check out" action (records a `settlement` ledger entry) before retrying.
- Lower priority: surface the running folio balance somewhere in the booking
  detail view, so staff see it building up rather than only hitting it as a
  surprise at check-out.

## Phase 4 — Rollout

- One migration: the `payment_ledger` index above. No new tables.
- Manual test pass: charge a POS order to a room → confirm it shows in the
  folio balance → attempt check-out (should block with the balance) → settle →
  check-out (should succeed).

## Explicitly out of scope for v1

- Room charge from Engine C/D (spa, activities) — same pattern, later.
- Guest-facing view of their own folio.
- Splitting one folio charge across multiple guests in a shared room.
- Auto-settlement against a card on file at check-out.
