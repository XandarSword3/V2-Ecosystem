# instant_transaction × customer

One-off purchase flow (e.g. restaurant/snack-style orders) — no
reservation slot, no ongoing access, just buy-now.

## Source

- `backend/src/engines/definitions/instant-transaction.ts` — engine definition
- `backend/src/engines/registry.ts` — `getEngine('instant_transaction')`
- Unified `transactions` table, filtered by `engine_type = 'instant_transaction'`
  (legacy `restaurant_orders`/`snack_orders` tables purged in
  `20260508_legacy_purge_and_transactions_upgrade.sql`)
- Frontend: not yet mapped in this file — first session to work
  customer-facing checkout for this engine should list the actual
  route/component paths here.

## Status

**2026-08-08 session** — three bug fixes, all committed:

- **Confirmation page socket join mismatch (fixed).** Frontend was
  emitting `join:order`/`join:room` — neither matches the backend's
  actual `order:join` handler (`backend/src/socket/index.ts`), so the
  socket never joined the room `emitToOrder` pushes to and the "live"
  badge was running purely off the 5s poll. Now emits
  `socket.emit('order:join', { orderId: itemId })` matching the
  handler's `{ orderId }` payload shape. File:
  `frontend/src/app/[property]/[slug]/confirmation/page.tsx`.
- **`freeServiceLocation` bypassing the consolidated status path
  (fixed).** Was marking transactions `completed` via a raw
  `.update()` and only emitting `location:freed`, skipping
  `order:status`/`emitToOrder` and the audit-log write every other
  status change gets. Now loops each active transaction through
  `changeInstantTransactionOrderStatus(...)`. This is staff-side
  (table-freeing action) but affects what this file's customer-facing
  confirmation page receives live, hence noted here too. File:
  `backend/src/modules/staff/module-staff.controller.ts` — see
  `freeServiceLocation`.
- **Review target validation was existence-only, not
  tenant/relationship-scoped (fixed).** A customer with one order at
  a property could previously submit `targetType: 'staff'` with any
  staff UUID from any tenant on the platform (check only confirmed
  the row existed in `profiles`, not that it belonged here or served
  this customer). Rewrote `createReview` in
  `backend/src/modules/reviews/reviews.controller.ts` to require that
  the target staff member actually has a `staff_id` match on one of
  the reviewer's own transactions at this property (via
  `transactions`), and that a reviewed item/dish has a matching
  `order_items` row on one of those same transactions. This ties
  "verified transaction" to the specific target, not just "any order
  here." No property context (e.g. test env) falls back to
  existence-only checks, same as before.

Backend typecheck (`npx tsc --noEmit`) clean on both touched backend
files. Frontend file not typechecked this session (frontend
`node_modules` not installed in this environment) — change is a
2-line emit-call swap matching the backend handler's payload shape
exactly, low risk.

Not yet mapped: the actual frontend route/component paths for
checkout on this engine — still a placeholder gap from before this
session.
