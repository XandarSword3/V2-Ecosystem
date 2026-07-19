# Route-Scoping Contract

Status: **frozen** as of the Stage 2 tenant-isolation contract freeze (July 2026).

## Gate exemptions

Every route that runs without the standard `tenantGate` (= `resolveTenant` +
`validateTenantBilling`) is listed here, with a reason. This is the only
place new exemptions get added — not a one-off `skipTenantGate` call
introduced ad hoc when a route starts failing.

| Route                              | Exemption                          | Reason |
|-------------------------------------|-------------------------------------|--------|
| `/health`, `/api/health`, `/health/ready`, `apiRouter /health` | No tenant concept at all | Infra health checks, not tenant-scoped |
| `/api/webhooks/stripe/saas`         | `skipTenantGate` (raw body)         | Stripe webhook — needs raw body before `express.json()`; authenticated via Stripe signature, not tenant context |
| `/api/v1/payments/webhook/stripe`   | `skipTenantGate` (raw body)         | Same — per-property Stripe webhook |
| `/webhooks/channels`                | Mounted outside `apiRouter`, no gate | Channel-manager webhooks, authenticated by channel signature |
| `/api/install`                      | No `resolveTenant` at all           | Runs before any tenant exists in the DB |
| `/api/settings`, `/api/branding`, `/api/modules`, `/api/modules/:slug` | `resolveTenant` + `resolveProperty`, but **no** `validateTenantBilling` | Public read endpoints — a suspended tenant's storefront must still resolve (so guests see *something*, e.g. a "temporarily unavailable" state at the property/module layer, not a hard 402 on the page that would explain the outage) |

Everything else goes through `tenantGate` — either directly (`app.use('/api', tenantGate, ...)`)
or via `apiRouter.use(tenantGate)`.

## resolveTenant / validateTenantBilling: no more passthrough

Resolved: the "no tenant resolved → allow through" branch in
`validateTenantBilling` has been removed. It's now a hard 404, matching the
fail-closed pattern `resolveTenant` already uses for every other
can't-identify-a-tenant case. It was a leftover from before the product was
fully multi-tenant, not a deliberate exception — there's no remaining
legitimate reason for it to fail open.

## The `x-property-id` header

**The rule is enforced by validation, not by convention.** The frontend only
ever sends this header from `/admin` and `/staff` paths (see
`settings-context.tsx`) — but that's a frontend habit, not what actually
protects anything. The real boundary is `validatePropertyAccess`
(`backend/src/middleware/propertyAccess.middleware.ts`), which:

1. Ignores the header entirely if it's missing or not a valid UUID
2. Lets `super_admin` through unchecked (by design — spans all tenants)
3. Otherwise verifies the named property belongs to `req.tenant.id`
4. Then verifies the authenticated user has an access grant for that property

Any router that lets a controller read `x-property-id` **must** apply
`authenticate` + `validatePropertyAccess` ahead of it. Reading the raw header
without that pair running first is not a smaller version of the contract —
it's not following it at all.

### Not yet audited (flagged, not resolved, in this stage)

`req.headers['x-property-id']` is read directly in ~20 controller files
across reporting, revenue, admin, manager, users, inventory, coupons,
analytics, giftcards, loyalty, and reviews. Spot-checking one
(`reporting.routes.ts`) confirms it does apply `authenticate` +
`validatePropertyAccess` router-wide — but that was one file out of ~15+
route files feeding those controllers. This stage did not verify the other
routers wire in the same pair. That verification is the concrete next step
before this contract can be called fully enforced rather than fully
documented — if even one of those routers is missing the pair, it's a live
cross-property read, not a documentation gap.
