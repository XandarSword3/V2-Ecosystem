# Engine A — Canonical Domain Model & Invariants (Phase 1)

This is the specification the implementation must satisfy. It deliberately
separates **what the domain is** (below) from **how the code is organized**
(the adapters). Nothing here is a UI checklist.

## 1. Semantic identity

> A customer/business performs a **one-time commercial transaction** involving
> products/services/resources, resulting in downstream **fulfillment** and
> **economic consequences**.

Engine A is *not*: restaurant, menu, kitchen, shipping, warehouse, repair shop.
Those are **implementations** of Engine A capabilities.

## 2. Core entities

### Business context
- `tenant` — owning organization.
- `legalEntity` — fiscal identity (jurisdiction, tax IDs, address).
- `property` / `location` — physical or virtual place of operation.
- `module` — a mounted Engine A instance (engine type + capability package + config).
- `businessConfiguration` — commercial/fiscal/customer/payment policies.

### Commerce
- `product` — sellable definition (lifecycle: draft → active → temporarily unavailable → sold out → archived).
- `variant` / `sku` — concrete sellable units.
- `modifier` / `customizationOption` — optional selections that may affect price, inventory, snapshot.
- `catalog` — scoped product grouping (category).
- `transaction` — the commercial record (draft → pending → confirmed → completed → cancelled).
- `transactionLine` — immutable sold-line snapshot.
- `commercialSnapshot` — the frozen "what was sold, at what price, under what terms".

### Money
- `money` — `{ amount, currency }` with deterministic minor-unit semantics.
- `currency`, `exchangeRate`, `roundingPolicy`, `settlement`.
- Every monetary record carries an explicit currency; no implicit defaults.

### Commitment
- `resource` — tracked inventory, untracked resource, serialized resource, component.
- `resourceSpec` — sellable unit → required resources (recipe/BOM/parts list are implementations).
- `allocation`, `consumption`, `reservation` (where applicable).

### Fulfillment
- `fulfillment`, `fulfillmentItem`, `fulfillmentGroup` (one transaction → many groups).
- `fulfillmentMode` — none | pickup | on-premise | local delivery | shipment | digital delivery | service execution.
- `destination` — none | address | pickup location | service location | on-premise location | room | digital account/channel.
- `handoff` — who/what/when/where/proof/destination/acknowledgement.
- `tracking` — generic; carrier specifics live in adapters.

### Execution
- `workCenter`, `workItem`, `operator`, `executionState` — generic; KDS/warehouse/workshop are adapters.

### Economics
- `payment` (lifecycle: created → pending → authorized → captured → failed → cancelled → partially_refunded → refunded → disputed → chargeback).
- `financialLedgerEntry` (append-only), `refund`, `adjustment`, `void`, `cogsEvent`, `revenueProjection`.

### Compliance
- `fiscalProfile` (per legal entity/jurisdiction), `fiscalDocument`, `fiscalDocumentNumber`, `taxComponent`, `creditNote`, `debitNote`, `eInvoiceSubmission`, `fiscalArchive`.

### Customer
- `customer`, `account`, `loyaltyMembership`, `loyaltyEvent`, `review`, `serviceIssue`.

### Audit
- `auditEvent`, `actor`, `reason`, `correlationId`.

## 3. Authoritative source per fact

| Fact | Authority | Must never be derived from |
|---|---|---|
| What was sold | Immutable transaction/commercial snapshot | Live catalog |
| Price | Pricing pipeline result snapshot | Client, invoice service, reporting |
| Payment | Payment subsystem | Ledger, transaction amount |
| Financial mutations | Financial ledger (append-only) | Direct table writes |
| Inventory movement | Inventory/resource ledger | Metadata, order status |
| Loyalty movement | Loyalty events/ledger | Payment events |
| Fulfillment | Fulfillment subsystem | Transaction status |
| Legal/fiscal document | Fiscal document subsystem | Re-pricing |
| Accounting output | Projection/export from ledger | Anything else |
| Audit | Append-only audit trail | Logs |

**No parallel calculation engines.** If two code paths compute the same economic
fact, one of them is wrong.

## 4. Core invariants

### Financial
- **F1 (pricing):** `totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee − totalDiscount`, clamped at 0. Enforced in `pricing-pipeline.ts` and `financial-ledger.ts` (pre-write), plus DB `chk_ledger_total_invariant`.
- **F2 (currency):** every monetary record carries an explicit 3-letter currency; the same economic fact never changes currency along its lifecycle.
- **F3 (no float drift):** money arithmetic is minor-unit integer or deterministic decimal rounding; final rounding per configured `roundingPolicy`.
- **F4 (historical price):** once a transaction is committed, later product/price/tax/promotion changes never rewrite its snapshot.
- **F5 (ledger immutability):** ledger entries are append-only; corrections are new `adjustment`/`void` entries.
- **F6 (ledger authority):** no financial mutation (charge/refund/adjustment/void/deposit) happens without a ledger entry.

### State
- **S1:** every state transition goes through the state machine (no direct status writes).
- **S2:** transaction state and fulfillment state are distinct; a transaction can be economically complete while fulfillment continues.
- **S3:** side-effect failure never silently blocks; failed compensations are recorded and reviewable.

### Inventory / resources
- **R1:** every deduction/restoration is an inventory_transactions row (audit) with `stock_before`/`stock_after`.
- **R2:** deduction and restoration are idempotent and concurrency-safe (FOR UPDATE).
- **R3:** consumption is driven by the resource-consumption spec, never by ad-hoc metadata parsing.

### Loyalty / promotions / stored value
- **L1:** earn exactly once per transaction; redeem exactly once; reversal exactly once.
- **L2:** coupon (price reduction) ≠ gift card (stored value/liability) ≠ loyalty (reward currency) — they may stack in pricing order but are distinct facts.

### Fiscal
- **G1:** fiscal documents are generated from the immutable transaction snapshot + payment facts + fiscal profile — never by re-pricing.
- **G2:** document numbers come from controlled, concurrency-safe series (unique per series/year/type).
- **G3:** issuance is immutable; corrections are credit/debit notes.

### Isolation & audit
- **I1:** every Engine A write is scoped by tenant → property → module; cross-scope access is denied (defense-in-depth beyond RLS).
- **A1:** every state transition, pricing calculation, ledger write, and anomaly is recorded (observability).

## 5. Capability contract (Phase 2 — declarative)

`EngineDefinition` gains explicit capability sections:

```ts
transactionModel      // commercial transaction states (generic)
commitmentModel       // resource/inventory semantics
fulfillmentDefinition // modes + destination kinds + grouping + tracking + handoff
executionDefinition   // work centers/items/operators
economicCapabilities  // payments, ledger, refunds, COGS
customerCapabilities  // loyalty, reviews, recovery
fiscalCapabilities    // document types, numbering, jurisdiction profile
returnCapabilities    // returns/exchanges/replacements
```

Adapters declare capabilities; the generic core never hard-codes a vertical's
vocabulary (kitchen/table/recipe/parcel are adapter words).

## 6. Failure semantics

Every multi-system operation is either atomic or Saga-compensated:
- payment succeeded but ledger failed → ledger recovery task, no false "paid".
- inventory committed but payment failed → compensation restores inventory.
- fiscal document issued but transaction rolled back → document voided/credit-note path, never silently kept.
- loyalty earned then payment refunded → exactly-once reversal.
- duplicate webhook → idempotency key, no duplicate mutation.

A failure that cannot be compensated becomes an **exception** with owner,
severity, context, recommended action, resolution — never a swallowed error.

## 7. Definition of done (per capability)

A capability is *implemented* only when: (a) it has a code path, (b) it is
enforced by tests (unit or integration), (c) it participates in the canonical
domain (snapshot/ledger/audit), and (d) an operator can actually perform the
business task it models. "A page loads" is not done.
