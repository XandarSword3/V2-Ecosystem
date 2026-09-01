# F3 Exit Report — Customer Application Shell Modernization

**Status:** F3 COMPLETE & CERTIFIED
**Date:** 2026-09-01
**Branch:** engine-a-implementation

---

## 1. What was built & migrated

### F3.1: Core Customer Presentation Shells (`frontend/src/components/shells/`)

| Shell / Component | Responsibility | Boundary / Non-Responsibility |
|---|---|---|
| **`CustomerShell.tsx`** | Global theme injection (`ThemeInjector`), accessibility skip links (`#main-content`), optional header/footer layout slots, presentation error boundary. | No business logic, no cart calculations, no fulfillment state machines, no identity banners or notification bridges. |
| **`ModuleContext.tsx`** | Scoped module context (`module`, `propertySlug`, `slug`, `capabilities`, `isLoading`, `isDisabled`, `isNotFound`, `layout`). Derives canonical `EngineACapabilities` directly from `CANONICAL_ENGINE_A_CAPABILITIES` (`lib/engine-a/types.ts`) without maintaining a duplicate mode/destination table. | Consumes module resolution from route layer; does not duplicate module loading. |
| **`ModuleShell.tsx`** | Presentation and status framing consuming `ModuleContext`. Handles loading skeleton, disabled/inactive friendly notice, 404 recovery state, and breadcrumbs/header slots. | Does not make routing decisions or query data independently. |
| **`CommerceShell.tsx`** | Layout and slot composition for Engine A (`instant_transaction`) storefronts. Houses top toolbar slot (search, categories), fulfillment selector slot, and floating/sticky cart trigger affordance. Scopes cart item count strictly to the active module context. | Does not duplicate catalog fetching, customization, search, or pricing arithmetic (owned by `MenuService` and pricing authority). |
| **`AccountShell.tsx`** | Responsive tabbed navigation shell for customer account sub-surfaces (`orders`, `tracking`, `loyalty`, `gift-cards`, `reviews`, `support`). Includes guest vs. authenticated presentation banner and support for custom account tabs (`onTabChange`). Integrated into `[property]/profile/page.tsx`. | Does not own order lifecycle state machines, loyalty accrual, or refund workflows. |

### F3.2: Single-Pipeline Route Integration

- **`frontend/src/app/[property]/[slug]/page.tsx`**:
  - Replaced ad-hoc layout logic with `ModuleProvider` + `ModuleShell` + `CommerceShell`.
  - Preserved `DynamicModuleRenderer` for Visual Builder custom layouts.
  - Preserved `MenuService` for default `instant_transaction` modules, wrapping it seamlessly in `CommerceShell`.
  - Preserved other engine renderers (`BookingService`, `SessionService`).
- **`frontend/src/app/[property]/[slug]/layout.tsx`**:
  - Dynamic canonical URL and metadata generation based on request context (eliminating hardcoded production URLs).
  - Cleanly wraps children in `CustomerShell`.
- **`frontend/src/app/[property]/[slug]/error.tsx`**:
  - Added route-level Next.js error boundary with recovery action.
- **`frontend/src/app/[property]/profile/page.tsx`**:
  - Mounted `AccountShell` around the profile page, providing guest prompt for unauthenticated users and responsive tab navigation for authenticated users.

---

## 2. Invariant Verification Matrix

| Verification Gate | Requirement | Result |
|---|---|---|
| **Single Module Resolver** | Route -> `ModuleProvider` -> `ModuleShell` -> children | Verified ✅ |
| **CustomerShell** | Pure presentation: theme, skip-link, error boundary, slots | Verified ✅ |
| **ModuleShell** | Skeleton loading, inactive/disabled recovery, 404 recovery | Verified ✅ |
| **CommerceShell** | Top toolbar slot, fulfillment slot, module-scoped cart trigger | Verified ✅ |
| **AccountShell Integration** | Mounted on real account surface (`profile`), guest/auth support | Verified ✅ |
| **Canonical Engine A Capabilities** | Consumes `CANONICAL_ENGINE_A_CAPABILITIES` (6 modes: on_premise, pickup, local_delivery, digital_delivery, shipment, service_execution) | Verified ✅ |
| **Module-Correct Cart Scoping** | Module A item x2, Module B item x3 -> Module A shell shows 2 | Verified ✅ |
| **Visual Builder Coexistence** | Custom layout -> `DynamicModuleRenderer` renders unchanged | Verified ✅ |
| **Legacy / Engine Coexistence** | `MenuService` renders inside `CommerceShell` without data mutation | Verified ✅ |
| **Non-Altering Invariants** | Catalog pricing, customizations, cart, inventory flags unchanged | Verified ✅ |
| **Dynamic Metadata & JSON-LD** | Canonical URL and breadcrumb schema from request context | Verified ✅ |
| **Route Error Boundary** | `[property]/[slug]/error.tsx` Next.js boundary with recovery CTA | Verified ✅ |
| **Architecture Guard** | `node tools/engine-architecture-guard.js` (328 files scanned) | **0 violations** ✅ |
| **TypeScript Compilation** | `npx tsc --noEmit` | **0 errors** ✅ |
| **Unit & Coexistence Suite** | `tests/components/CustomerShells.test.tsx` | **17 / 17 passing** ✅ |

---

## 3. Next Phases in the Engine A Plan

### Next Frontend Phase:
**F4: Catalog / Product / Customization Frontend** (Aligning with Main Phase 8–9).
- Replace vertical assumptions in item detail / modifier presentation with generic Engine A catalog contracts.
- Connect with unified customization system (`CustomizationSelector`).

### Next Main Plan Phases:
- **Main Phase 8–9**: Catalog lifecycle, SKU/inventory linking, variants, and customization authority.
- **Main Phase 11–12**: Identity, roles, customer lifecycle, and assisted commerce.
