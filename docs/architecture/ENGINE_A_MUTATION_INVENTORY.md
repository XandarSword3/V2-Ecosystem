# Engine A Mutation-Path Inventory

**Status:** Phase 5 closure artifact — the complete inventory of every write path
that mutates Engine A (`instant_transaction`) state, verified against the Phase 5
invariants. Generated from a repository-wide write-site audit (every
insert/update/delete/rpc per table), classified per path, with each gap fixed or
explicitly flagged.

## The invariants every path must satisfy

1. **One stock authority.** Physical inventory (`inventory_items.current_stock`,
   via `deduct_stock_fifo`) is mutated at **creation only**, by
   `deduct_inventory_for_order_items`. Compensation is `restore_inventory_for_order_items`
   on cancel/add-item rollback. Nothing else — confirmation, fulfillment moves,
   payment, completion — may touch stock.
2. **No confirmed-without-resources window.** Generic allocation
   (`resource_allocations`) runs **pre-flight before the confirm write**; the
   confirm UPDATE and its `ensure_fulfillment_on_confirm` trigger never run if
   allocation fails.
3. **Exactly-once consumption.** Resources are consumed when the fulfillment
   layer **enters** the handoff-reaching state, never on the leaving move —
   completing an order never re-consumes.
4. **Compensation.** Cancellation restores creation-time stock AND releases
   allocations; every failed write after a successful pre-flight/mutation
   compensates (release/restore/delete).
5. **Payment ≠ completion.** Payment records settlement (`metadata.payment_status`).
   `transactions.status` is written **only** by the state-machine choke point
   (`changeInstantTransactionOrderStatus`), which enforces the fulfillment
   completion gate.
6. **Fulfillment is canonical.** Fulfillment moves write the `fulfillments`
   table; `transactions.status` never carries fulfillment meaning.

## Layer map (the five facts that must never impersonate each other)

| Fact | Table(s) | Written by |
|---|---|---|
| Transaction | `transactions` (status, amount, metadata) | choke point; creation; payment settlement (metadata only) |
| Fulfillment | `fulfillments`, `fulfillment_events` (append-only) | DB trigger on confirm; `transition_fulfillment` RPC |
| Resource reservation | `resource_allocations`, `resource_allocation_events` (append-only) | `allocate_resources` / `consume_resources` / `release_resources` RPCs |
| Physical inventory | `inventory_items`, `inventory_batches`, `inventory_transactions` | `deduct_inventory_for_order_items` (creation) / `restore_*` (compensation) only |
| Money | `payment_ledger`, `engine_financial_ledger`, fiscal tables | payment/ledger/fiscal services |

## Every Engine A write path

### Customer path

| # | Route / site | Layer writes | Timing | Invariants |
|---|---|---|---|---|
| C1 | `POST /orders` (dynamic-module.router.ts) | `transactions` insert (pending), `order_items` insert, `deduct_inventory_for_order_items`, `create_order_customization_snapshot` | creation | 1, 2 (no-window: stock deducted before row exists; allocation happens at confirm) |
| C2 | `PATCH /orders/:id/status` → choke point | `transactions.status`, `fulfillments` (via trigger + `transition_fulfillment`), `allocate_resources` (pre-flight) | confirm/fulfillment/cancel | 1, 2, 3, 4, 6 |
| C3 | `POST /orders/:id/items` (customer-route add-item) | `order_items` insert, `transactions` amount/tax/service_charge, `deduct_inventory_for_order_items` + `restore_*` compensation, `allocate_resources` (incremental, idempotent) | post-confirm | 1, 2 (allocation refresh), 6 (served-order guard) — **fixed this turn** |
| C4 | `POST /orders/:id/items/:itemId/review` | reviews only | post-completion | money/customer layer, no state mutation |

### Staff path

| # | Route / site | Layer writes | Timing | Invariants |
|---|---|---|---|---|
| S1 | `POST /staff/modules/:slug/orders` (createModuleOrder) | `transactions` insert (**confirmed** directly), `order_items` insert, `deduct_inventory_for_order_items`, `create_order_customization_snapshot`, `allocateForConfirmation` (pre-flight) | creation | 1, 2 (no-window on the direct-confirm path), 4 |
| S2 | `PATCH/PUT /staff/modules/:slug/orders/:orderId/status` → choke point | same as C2 | any move | 1–4, 6 |
| S3 | `PATCH /staff/modules/:slug/orders/:orderId/items/:itemId/status` (KDS item bumps) | `fulfillments` via `transition_fulfillment`, resource lifecycle driver (`handleLifecycleMove`: consume at handoff) | fulfillment | 1, 3, 6 |
| S4 | `POST /staff/modules/:slug/orders/:orderId/items` (addModuleOrderItem) | `order_items` insert, `transactions` amount/tax/metadata, `deduct_inventory_for_order_items` + `restore_*` compensation, `allocateForConfirmation` (incremental) | post-confirm | 1, 2, 6 (served-order guard) — **fixed this turn** |
| S5 | `POST /staff/modules/:slug/orders/:orderId/pay` (payModuleOrder) | `transactions.metadata` (**settlement only — no status**), gated completion via choke point, `engine_financial_ledger`, loyalty | any non-cancelled state | 5 — **fixed this turn** |
| S6 | `POST /staff/modules/:slug/orders/:orderId/split` | booking engine only (time_exclusive_reservation) | — | not Engine A |
| S7 | `POST /staff/modules/:slug/orders/:orderId/print` | read-only | — | — |

### Payment paths

| # | Site | Layer writes | Invariants |
|---|---|---|---|
| P1 | `updateReferencePaymentStatus` (payment.controller.ts) | `transactions.payment_status` only — comment pins status to the state machine | 5 |
| P2 | `payment_intent.*` webhook branches | `transactions.status` (`payment_failed` / `cancelled`) — **booking/ticket reference types only**; no Engine A order ever creates a Stripe intent (orders settle via staff cash or room-charge → P1) | 5 (unreachable for Engine A today; if card intents are ever added to orders, `payment_intent.canceled → cancelled` must route through the choke point for compensation) |
| P3 | `processRefundById` | `transactions` cancel via choke point (discounts reversed once), `payments`, ledger | 4, 5 |

### DB-level triggers / functions

| # | Function | Writes | Invariants |
|---|---|---|---|
| T1 | `ensure_fulfillment_on_confirm` trigger | `fulfillments` insert atomically with confirm UPDATE (snapshotted mode/destination) | 2 (atomicity), 6 |
| T2 | `transition_fulfillment` / `ensure_fulfillment` RPCs | `fulfillments` + append-only events | 3, 6 |
| T3 | `allocate_resources` / `consume_resources` / `release_resources` | `resource_allocations` + append-only events (idempotent: `ON CONFLICT (transaction_id, kind, resource_ref) DO NOTHING`; consume/release snapshot rows pre-update) | 3, 4 |
| T4 | `deduct_inventory_for_order_items` / `restore_inventory_for_order_items` | `inventory_items` (FIFO), `inventory_batches`, `inventory_transactions` | 1 |

## Gaps found by this audit — all closed this turn

1. **`payModuleOrder` wrote `status: 'completed'` directly** (S5) — payment
   impersonated completion: bypassed the fulfillment gate, consumption at
   handoff, and fiscal issuance. Now: settlement writes metadata only;
   completion is attempted through the capability-gated choke point; a 400
   refusal defers completion (paid-but-not-served), a 500 is logged and never
   fails the settled payment; the response reports canonical fulfillment state.
2. **Staff `addModuleOrderItem` (S4)** — `order_items` insert omitted NOT NULL
   `tenant_id`/`property_id` (insert silently failed for every add), and added
   items never deducted stock or allocated resources. Now: server-side pricing
   of the full item set, insert with tenant/property, stock deduction through
   the one authority with full compensation, incremental idempotent
   re-allocation, and a served-order guard (no items past handoff).
3. **Customer-route add-item `POST /orders/:id/items` (C3)** — same gap class:
   priced and inserted but never deducted or allocated. Now mirrors S4.

## Flagged (explicitly out of scope / tracked)

- **Customization inventory on add-item.** Neither add-item path snapshots
  modifiers via `create_order_customization_snapshot` (the staff UI sends no
  modifiers; the customer route prices them but does not snapshot). A future
  modifier-bearing add-item must call the same RPC with the same rollback.
- **Staff add-item pricing snapshot.** The staff path re-prices the full set
  and replaces `metadata.pricing`; the customer path appends incrementally and
  records a ledger *adjustment* (by design — its comment documents why the call
  is side-effect-free for discounts). Both are internally consistent.
- **Webhook status writes** (P2) are booking-only today; flagged so a future
  Engine A card-payment flow routes cancellation through the choke point.

## Mechanical enforcement

The source guards in
`backend/tests/unit/engines/order-lifecycle.invariant.test.ts` (Engine A gate)
pin every rule above:

- fulfillment-path code (choke point + KDS item path) never calls a stock-deduction RPC;
- `payModuleOrder` and `addModuleOrderItem` never write `transactions.status`;
- the pay path routes completion through `changeInstantTransactionOrderStatus` and never fails a settled payment on a gate error;
- both add-item paths use the one authority RPC with compensation and refresh allocation;
- the choke point allocates before it writes confirmation.

Phase 5 is closed on this evidence: every Engine A mutation path is inventoried,
classified, and either verified against the invariants or fixed to satisfy them.
