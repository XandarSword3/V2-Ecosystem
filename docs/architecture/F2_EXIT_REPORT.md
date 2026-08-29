# F2 Exit Report — Frontend Authorization / Scope Architecture

**Status:** F2 COMPLETE (with documented carry-overs)
**Date:** 2026-08-29
**Branch:** engine-a-implementation

---

## What was migrated

### F2.1: Authorization Contract (`lib/authorization.tsx`)

Formalized the frontend authorization hierarchy as six distinct layers:

```
IDENTITY → SCOPE → DERIVED ROLE → PERMISSION → PROPERTY/MODULE ACCESS → RESOURCE OWNERSHIP
```

Key properties:
- `useAuthorization()` does NOT authorize — it provides presentation hints
- `overridePropertyId` renamed to `displayPropertyId` with explicit documentation that it is a presentation hint only
- Backend remains the sole security authority
- Permission matrix (`ROLE_PERMISSIONS`) is mechanically validated against the backend

### F2.2: Permission Matrix Contract Test (`tools/authorization-contract-test.js`)

- Parses backend `permissions.ts` and frontend `authorization.tsx`
- Detects: frontend-only, backend-only, grants-but-backend-denies, denies-but-backend-grants
- **Result: CONTRACT VALID — no drift detected** ✅

### F2.3: Engine A Operational Authorization

| Surface | What was migrated |
|---|---|
| **KDS** (`KitchenView.tsx`) | Fulfillment advance buttons gated on `ORDER_UPDATE` |
| **Dispatch** (`DispatchBoard.tsx`) | "Mark Delivered" button gated on `ORDER_UPDATE` |
| **Staff POS** (`StaffPOSTemplate.tsx`) | Accept/Cancel/Start Prep/Mark Ready gated on `ORDER_UPDATE` |
| **Admin Orders** (both pages) | Confirm/Reject/Advance gated on `ORDER_UPDATE` |
| **Catalog CRUD** (`menu/page.tsx`) | Add/Edit/Delete gated on `CATALOG_WRITE` |
| **Admin Layout** | Navigation filtered by `auth.permissions` |
| **Staff Layout** | Role check replaced with `auth.isStaff` |
| **Manager Dashboard** | Role check replaced with `auth.isManager` |

### F2.5: Architectural Source Guard (`tools/engine-architecture-guard.js`)

- Scans 321 frontend files for forbidden patterns
- Three checks: legacy template types, hospitality icons in generic surfaces, legacy status vocabulary
- Narrowly allow-listed per file (no blanket `frontend/**` exclusions)
- **Result: ALL CHECKS PASSED** ✅

---

## What remains legacy

### Explicitly allow-listed compatibility boundaries (carried forward from F1)

1. **`template_type === 'menu_service'` in `admin/orders/page.tsx`** — DB backward-compat filter for old rows that lack `engine_type`. This is a data-layer shim, not business logic.

2. **Legacy status composites in `staff/types.ts` mapper** — `canonicalFulfillmentState()` maps `preparing` → `in_progress`, `delivered`/`served` → `handed_off` for pre-Stage-6 rows and old socket events. This is the ONLY place legacy composites are mapped.

### Surfaces not yet migrated to permission-based rendering

These surfaces still use role-based checks or have no authorization gating. They are functional but use the coarser role model:

- `admin/analytics/page.tsx` — no permission gating
- `admin/financial-reports/page.tsx` — no permission gating
- `admin/inventory/page.tsx` — no permission gating
- `admin/loyalty/page.tsx` — no permission gating
- `admin/reports/page.tsx` — no permission gating
- `admin/settings/page.tsx` — no permission gating (nav item is permission-gated, but page itself has no per-action gating)

These are lower priority because:
- They are read-only admin surfaces (no state mutations)
- The backend still enforces permissions on every API call
- The nav item visibility is already permission-gated

---

## What is intentionally outside F2

### F2.6: Authorization E2E Browser Tests

**Deferred to F22 (Full Frontend E2E Certification).**

Reason: E2E browser tests proving "button hidden AND backend rejects direct API attempt" require:
- Running backend with seeded test data
- Multiple user accounts with different scopes/roles
- Playwright fixtures for role-based test scenarios
- Backend API endpoints that return proper 403 responses

These infrastructure requirements are part of the F22 certification phase, not F2.

### F2.4: Tenant/Property/Module Context Testing

**Deferred to F22.**

Reason: Cross-tenant/cross-property authorization testing requires:
- Multiple seeded tenants with overlapping property/module structures
- User accounts with explicit property_access rows
- API calls that demonstrate 403 on cross-tenant access

The frontend correctly reads `scope` and `roles` from the JWT — the backend's `validatePropertyAccess` and `requireModulePropertyAccess` middleware are the real gates.

---

## Frontend/Backend Authorization Contract Differences

| Aspect | Backend | Frontend | Status |
|---|---|---|---|
| Permission source of truth | `RolePermissions` in `permissions.ts` | `ROLE_PERMISSIONS` in `authorization.tsx` | ✅ Mechanically validated |
| Scope → roles mapping | `scopeToRoles()` in `permissions.ts` | `SCOPE_TO_ROLES` in `authorization.tsx` | ✅ In sync |
| Property access validation | `validatePropertyAccess` middleware | `displayPropertyId` (presentation hint) | ✅ Backend authoritative |
| Module access validation | `requireModulePropertyAccess` middleware | `canViewModule/Order/Manage/Admin` | ✅ Backend authoritative |
| Resource ownership | `ownerOrAdmin` middleware | Not modeled (presentation-only) | ✅ Correct — ownership is backend-only |
| Wildcard permissions | `'*'` in `RolePermissions` | `'*'` in `ROLE_PERMISSIONS` + resolver | ✅ In sync |
| Module-scoped perms | `module:{slug}:view\|order\|manage\|admin` | Same pattern in `canViewModule` etc. | ✅ In sync |

**No frontend/backend authorization contract drift detected.**

---

## Next main-plan phase

**Main Phase 11** (Identity, roles and scope) is the primary backend dependency for F2. The frontend authorization layer is now aligned with the backend's scope model.

**Main Phase 20** (Staff/work execution) — the KDS/Dispatch authorization now gates on `ORDER_UPDATE`, but the backend's actual staff route protection needs to be verified against the same permission.

---

## Next frontend phase

**F3: Customer Shell** — establish `CustomerShell` / `ModuleShell` / `CommerceShell` with capability-aware module presentation. The authorization layer (`useAuthorization()`) is now ready to inform capability-aware rendering.

**F1 remaining: Frontend source guard** — the guard is built and passing. It should be integrated into CI (GitHub Actions) as a required check.

---

## Artifacts

| File | Purpose |
|---|---|
| `frontend/src/lib/authorization.tsx` | `useAuthorization()` hook + `Perm` constants + permission matrix |
| `tools/authorization-contract-test.js` | Mechanical validation of frontend vs backend permission matrix |
| `tools/engine-architecture-guard.js` | CI guard for legacy vocabulary in generic Engine A code |
| `docs/architecture/F1_CARRY_OVER_TESTS.md` | 7 deferred F1 certification items |
| `docs/architecture/F2_EXIT_REPORT.md` | This document |
