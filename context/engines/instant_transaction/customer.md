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

Not yet worked in a session that updated this file. Populate with
real current-task notes instead of leaving this placeholder once you
start.
