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

## F1 — canonical domain layer + migration (completed this turn)

### Domain layer (created earlier)
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

### Migrations completed (this turn)

1. **admin/[slug]/orders/page.tsx** — already migrated: uses
   `canonicalFulfillmentState()`, `getModeStateConfig()`, `resolveColumnKey()`.
   Replaced hospitality icon `ChefHat` with neutral `Loader2` in statusConfig.
   Replaced `UtensilsCrossed` with `Package` in header/empty states.

2. **admin/orders/page.tsx** (global) — already migrated: same canonical
   helpers, same layered state pattern. Replaced `ChefHat`→`Loader2` in
   statusConfig, `UtensilsCrossed`→`Package` in header/stats cards.

3. **confirmation/page.tsx** — already migrated: status pill and
   rate-your-server gate use `canonicalFulfillmentState()`. No legacy
   composites remain.

4. **POS templates** (CustomerPOSTemplate, StaffPOSTemplate) — already
   migrated: both use `canonicalFulfillmentState()` with mode-aware
   presentation.

5. **staff/scanner/page.tsx** — multi-engine scanner (not Engine A
   fulfillment board). Correctly uses engine-specific statuses with a
   documented comment. No migration needed.

### Legacy type fixes (this turn)

6. **staff/manager/page.tsx** — Quick Actions section used
   `template_type === 'menu_service'` etc. for icon mapping. Migrated to
   `engine_type === 'instant_transaction'` etc. with canonical engine
   types. Replaced `ChefHat` import with `Trophy` for
   `ongoing_entitlement`.

7. **lib/offline/offline-hydration.ts** — `ActiveModule.engine_type` was
   typed as legacy union (`'menu_service' | 'multi_day_booking' | ...`).
   Migrated to canonical union (`'instant_transaction' | ...`).
   Renamed `TEMPLATE_HYDRATION` → `ENGINE_HYDRATION` with canonical keys.
   Removed `membership_access` entry (no offline hydration needed for
   platform_entitlement).

8. **admin/reviews/page.tsx** — `serviceConfig` used `menu_service` as
   key. Migrated to `instant_transaction`. Replaced `UtensilsCrossed`
   with `Package`.

### Status

All F1 baseline migration tasks are **complete**. The frontend now:
- Consumes canonical `FulfillmentState` (never infers from `status`)
- Uses `getModeStateConfig()` for mode-derived board columns/actions
- Uses `canonicalFulfillmentState()` for cross-layer state resolution
- Keys icons on `engine_type`, never `template_type`
- Has no legacy template type references in runtime code
  (the `template_type === 'menu_service'` fallback in admin/orders is
  a DB backward-compat filter, not a business logic violation)

Typecheck: `npx tsc --noEmit` passes clean.

## F1 carry-over certification items

Recorded in `docs/architecture/F1_CARRY_OVER_TESTS.md`. Seven items
(catalog lifecycle E2E, customer→staff workflow, fulfillment mode selection,
multi-tenant isolation, offline staff queue, loyalty lifecycle, fiscal
document generation) are deferred to their respective later phases.

---

## F2 — Frontend authorization / scope architecture (in progress)

### Backend model (source of truth)

Scope (JWT): `super_admin > platform_admin > tenant_owner > tenant_admin >
property_manager > property_staff > customer`

Roles (backward-compat, derived from scope):
`super_admin, admin, manager, staff, customer, guest`

Permissions (granular strings): `resource:action[:scope]`

Module-scoped: `module:{slug}:view|order|manage|admin`

Middleware: `authenticate` → `authorize(roles)` → `requirePermission(perm)`

### Frontend F2 deliverables (this turn)

1. **`lib/authorization.tsx`** — `useAuthorization()` hook + `Perm` constants
   + `ROLE_PERMISSIONS` matrix (mirrors backend exactly). Provides:
   - `hasPermission(perm)`, `hasAnyPermission(perms)`, `hasAllPermissions(perms)`
   - `canDo(resource, action)` convenience
   - Module-scoped: `canViewModule(slug)`, `canOrderModule(slug)`, etc.
   - Scope flags: `isSuperAdmin`, `isAdmin`, `isManager`, `isStaff`
   - Accepts optional `overridePropertyId` for layout-level use
     (before PropertyProvider wraps children)

2. **`config/admin-navigation.ts`** — `NavItem`/`NavChild` interfaces
   extended with optional `permissions?: string[]`. `filterNavigationByRole()`
   now accepts a third `userPermissions` parameter; nav items are visible
   if EITHER roles OR permissions match (OR logic). Key items now have
   permission attributes:
   - Audit Logs → `admin:audit:read`
   - Loyalty → `loyalty:read:any`, `loyalty:settings:manage`
   - Gift Cards → `giftcard:manage`
   - Coupons → `coupon:manage`
   - Reviews → `review:moderate`
   - Housekeeping → `housekeeping:task:manage`
   - Inventory → `inventory:manage`, `inventory:read`
   - Modules → `admin:modules:manage`
   - Settings → `admin:settings:manage`
   - Users → `user:read:any`
   - Reports → `admin:reports:read`

3. **`app/[property]/admin/layout.tsx`** — imports `useAuthorization()`,
   passes `auth.permissions` to `filterNavigationByRole()`.

4. **`app/[property]/staff/layout.tsx`** — imports `useAuthorization()`,
   replaces manual `staffRoles.includes(role)` check with `auth.isStaff`.

5. **`app/[property]/staff/manager/page.tsx`** — replaces manual
   `user.roles.some(r => ['admin', 'super_admin', 'manager'].includes(r))`
   with `auth.isManager`.

6. **Admin orders pages** (both global and `[slug]`) — order action buttons
   (Confirm/Reject/Advance) are now gated on `auth.hasPermission(Perm.ORDER_UPDATE)`.
   Staff without `order:update` see orders but cannot modify them.

### F2 carry-over items (next turn)

- KDS/Dispatch: gate handoff actions on `order:update`
- Staff POS: gate order creation on `order:create`, settlement on `payment:record:cash`
- Catalog controls: gate menu item CRUD on `catalog:write`
- Frontend source guard (F1 carry-over)

Typecheck: `npx tsc --noEmit` passes clean.
