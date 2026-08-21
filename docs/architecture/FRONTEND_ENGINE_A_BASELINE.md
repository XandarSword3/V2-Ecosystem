# Frontend Engine A — F0 Forensic Baseline

**Status:** F0 of the parallel frontend plan (see `Frontend Plan For Engine A.md`).
Verified against the actual repository on this date — the plan's assumptions
were written before several Stage 6 migrations landed, so this baseline
corrects them and classifies every Engine A surface.

## Verified facts (correcting the plan)

| Claim in the plan | Verified reality |
|---|---|
| "107 pages, 8 layouts" | **121 pages, 7 layouts** today (the plan predates later additions). |
| "the cart page is 927 lines and performs its own tax/service/delivery calculations" | The dynamic cart (`[property]/[slug]/cart/page.tsx`) is **1134 lines**, but it **already consumes the backend pricing preview** (`pricingBreakdown?.taxAmount`, `taxBreakdown`, `feeBreakdown` from `resolveAndPriceCatalogItems`/`calculatePricing`). What remains local is presentation-level aggregation (`calculateSubtotal`, `preDiscountTotal = subtotal + tax + totalFees`) — F5-permitted preview math, not authoritative totals. |
| "The frontend must stop using `transactions.status` to infer fulfillment" | **Already done for the KDS surface.** `components/staff/types.ts` defines `FulfillmentStatus`, `canonicalFulfillmentState()`, and a canonical `statusFlow`; `KitchenView` board columns key off `fulfillmentStatus` (queued/in_progress/ready/handed_off), never `status`. The backend `getModuleOrders` returns `fulfillmentStatus` and the socket carries it. **Still legacy:** admin orders page, confirmation page, POS templates, scanner, manager dashboard. |

## The layered state rule (Stage 6) — what the frontend must honor

```
transaction layer:  pending → confirmed → completed/cancelled   (transactions.status)
fulfillment layer:  queued → in_progress → ready → handed_off    (fulfillments.status)
```

A frontend component keys on ONE layer. Fulfillment presentation (KDS
columns, dispatch, tracking) uses `fulfillmentStatus`; transaction
presentation (payment, confirmation) uses `status`. Never both, never
inferred.

## Classification (KEEP / MIGRATE / REWRITE / GENERICIZE / DEPRECATE)

### KEEP (already canonical — Engine A correct)
- `components/staff/types.ts` — canonical fulfillment types + legacy mapper
- `components/staff/KitchenView.tsx` — canonical board columns, handoff gating, offline queue
- `components/staff/DispatchBoard.tsx` — dispatch owns `ready → handed_off`
- `lib/engine-a/types.ts` — **new** F1 canonical domain layer (this baseline)
- Dynamic cart + confirmation — already consume backend pricing preview

### MIGRATE (functional, but infer fulfillment from legacy statuses)
- `app/[property]/admin/[slug]/orders/page.tsx` — legacy status model
  (pending/confirmed/preparing/ready/delivered/cancelled) with its own
  status labels and direct `updateStatus` calls → canonical fulfillmentStatus
  + canonical transitions
- `app/[property]/[slug]/confirmation/page.tsx` — legacy composites in
  status cases (`'ready'`, `'delivered'`, `'preparing'`) and the
  staff-name/`['ready','delivered','completed']` check
- `components/pos-templates/CustomerPOSTemplate.tsx` / `StaffPOSTemplate.tsx`
- `app/[property]/staff/scanner/page.tsx`, `app/[property]/staff/manager/page.tsx`

### GENERICIZE (vertical vocabulary in shared code)
- `components/staff/*` — hospitality terms are fine AT the adapter boundary
  (KitchenView is the hospitality adapter surface); ensure shared
  `components/staff/types.ts` helpers stay vocabulary-free (they are)

### DEPRECATE / DELETE (candidates only — nothing removed yet)
- Legacy composite statuses (`preparing`/`delivered`) as *transport* values:
  after Stage 6, backends should emit canonical states; the mapper in
  `staff/types.ts` remains for pre-Stage-6 rows and old socket events

## F1 started (this turn)

- `frontend/src/lib/engine-a/types.ts` — canonical domain contracts:
  `EngineType`, `TransactionState`, `FulfillmentState`, `CanonicalOrderState`,
  `FulfillmentMode`, `FulfillmentOption`, `EngineACapabilities`,
  `Money`, `PricingResult`, `PaymentState`, plus type guards
  (`isFulfillmentState`, `isTransactionState`, `isFulfillmentMode`)
- `src/types/index.ts` re-exports the domain layer; `FulfillmentStatus` is
  now **derived** from `FulfillmentState` so the wire type can't drift
- `components/staff/types.ts` + `KitchenView.tsx` typed against the canonical
  layer — the typecheck immediately caught unvalidated socket strings being
  assigned to `fulfillmentStatus`, which is exactly the F1 win

## Next parallel steps (F1 continuation, not blocked on backend)

1. Migrate the admin orders page to canonical `fulfillmentStatus` + canonical
   transitions (highest-value surface; the KDS already proves the pattern).
2. Migrate the confirmation page's legacy status cases through
   `canonicalFulfillmentState()`.
3. Add a frontend source guard (like the backend's) that generic Engine A
   components never reference the legacy composites `'preparing'`/`'delivered'`
   except inside the mapper in `components/staff/types.ts`.
