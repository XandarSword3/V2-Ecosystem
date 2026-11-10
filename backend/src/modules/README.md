# Backend Modules

43 module directories under `src/modules/`, each typically containing a
controller, service, and routes file. Tenant modules are served
engine-agnostically through the dynamic module router (`/api/v1/{module-slug}/…`,
loaded from DB `modules` rows at boot via `routes/dynamic-modules.loader.ts`);
only first-party platform surfaces have fixed mounts.

Fixed mounts (`app.ts` → `apiRouter` at `/api/v1`, unless noted):

## Module Inventory

| Directory | Live mount | Description |
|-----------|------------|-------------|
| `admin/` | `/api/v1/admin` | Admin dashboard, module management, settings, analytics |
| `analytics/` | `/api/v1/analytics` | Advanced reporting, snapshots, alerts, ad-hoc queries |
| `auth/` | `/api/v1/auth` plus `/api/install` above | Authentication (login, register, JWT, OAuth, 2FA) |
| `bookings/` | `/api/v1/bookings` | Booking modification, cancellation, recalculation |
| `catalog/` | — (internal service) | Canonical product lifecycle (draft → active → sold out) |
| `channels/` | `/api/v1/channels`, `/webhooks/channels` (outside `/api`) | OTA channel integration (webhook receiver) |
| `coupons/` | `/api/v1/coupons` | Coupon creation/validation (redemption via engine pricing pipeline) |
| `customization/` | `/api/v1/customizations` | Unified engine-agnostic customization system |
| `devices/` | `/api/v1/devices` | Mobile device registration and management |
| `economics/` | `/api/v1/economics` | Per-module/tenant profitability and cost economics |
| `finance/` | `/api/v1/finance` | Financial operations and reporting |
| `fiscal/` | `/api/v1/fiscal` | Engine-integrated fiscal documents, numbering, jurisdiction adapters; staff-managed lifecycle (profiles, issue/cancel/submit) mounted 2026-11-10 |
| `fulfillment/` | — (internal service) | Fulfillment selection/contract resolution for the engine layer |
| `gdpr/` | `/api/v1/gdpr` | GDPR compliance (data export, deletion, access logging) |
| `giftcards/` | `/api/v1/giftcards` | Gift card issuance, balance, redemption |
| `groups/` | `/api/v1/groups` | Group booking management |
| `housekeeping/` | `/api/v1/housekeeping` | Cleaning schedules, task assignment, bulk import |
| `i18n/` | `/api/v1/i18n` | Internationalization management |
| `install/` | `/api/install` (top-level, before auth) | First-tenant setup/self-host onboarding |
| `integrations/` | `/api/v1/integrations/quickbooks` (disabled in practice) | External accounting integrations |
| `inventory/` | `/api/v1/inventory` | Stock tracking, recipes, inventory-module linking |
| `loyalty/` | `/api/v1/loyalty` | Loyalty program (points, tiers, redemption) |
| `manager/` | `/api/v1/manager` | Manager-level operations and approvals |
| `marketing/` | `/api/v1/marketing` | Marketing campaigns and email lists |
| `messaging/` | `/api/v1/messaging` | Guest/staff messaging |
| `mobile-checkin/` | `/api/v1/mobile-checkin` | Mobile check-in/check-out |
| `multi-property/` | `/api/v1/multi-property` | Multi-property management (group admins) |
| `parity/` | `/api/v1/rate-parity` | Rate parity monitoring across channels |
| `payments/` | `/api/v1/payments`, `/api/v1/payments/platform` | Payment processing (Stripe, platform payments) |
| `platform/` | `/api/v1/platform` | Platform super-admin: tenants, plans, billing, subscriptions |
| `pos/` | `/api/v1/pos` | POS hardware integration (printers, drawers) |
| `promotions/` | — deleted 2026-11-10 | Dormant duplicate coupon module (never imported) removed per user decision; coupon flow lives in `coupons/` + engine pricing pipeline, gift cards in `giftcards/`, loyalty in `loyalty/` |
| `public/` | `/api` (top-level, `tenantGate` + `resolveProperty`) | Public, property-scoped customer surface |
| `reporting/` | `/api/v1/reporting` | Report generation and distribution |
| `reservations/` | dynamic router | Reservation flows for time-capacity engines |
| `resource/` | — (internal service) | Shared resource consumption/allocation engine service |
| `revenue/` | `/api/v1/revenue` | Revenue management and forecasting |
| `reviews/` | `/api/v1/reviews` | Review collection and moderation |
| `shared/` | — (internal helpers) | Per-engine bulk-import parsers |
| `staff/` | `/api/v1/staff`, `/api/v1/{module-slug}` (dynamic) | Staff ops on mounted modules; dynamic per-module staff order routes |
| `support/` | `/api/v1/support` | Support ticket system |
| `templates/` | `/api/v1/templates` | Module templates selectable by engine type |
| `users/` | `/api/v1/users` | User profile and preference management |

Other top-level mounts outside `/api/v1`: `/api/docs` (OpenAPI delivery),
terminology/translation/search/unsubscribe routers (mounted from `app.ts`).

## Notes

- Tenant module orders are engine-agnostic: the dynamic module router resolves
  the module by slug and dispatches on `engine_type`, not on a feature-module
  name. Do not add new per-vertical routes alongside it.
- `fiscal` HTTP routes are written but unmounted; the fiscal *services* are live
  through `engines/order-status.service.ts` and `payments`.
- `promotions` module was fully dormant and was deleted 2026-11-10; the OpenAPI
  `/promotions/*` paths were removed with it. Live flows: `/coupons` (admin),
  `.giftcards` (admin), `/loyalty` (admin), redemption via the pricing pipeline.
- `routes/v1.routes.ts` was deleted 2026-11-10 (never imported by `app.ts`).
- QuickBooks integration (`integrations/`) is disabled in `app.ts` mounting —
  see that module for its state.
