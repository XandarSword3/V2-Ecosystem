# Module–Engine Contract

Status: **frozen** as of the Stage 1 tenant-isolation contract freeze (July 2026).

## The 5 canonical engines

Every module in the platform maps to exactly one of these. There is no sixth.
New engines are a product decision, not something a contributor adds by
introducing a new string.

| Engine type                   | Purpose                                       |
|--------------------------------|-----------------------------------------------|
| `instant_transaction`          | POS / immediate one-shot purchases            |
| `time_exclusive_reservation`   | Bookings that hold exclusive time (units, appointments) |
| `shared_capacity_access`       | Access shared across concurrent holders (classes, pools) |
| `ongoing_entitlement`          | Standing access — subscriptions, memberships  |
| `platform_entitlement`         | Engine E — internal-only, SaaS billing/tenant provisioning. Omitted from public docs. |

`modules.engine_type` is `NOT NULL` and `CHECK`-constrained to exactly these
five values (see `20260719120000_freeze_modules_engine_type.sql`). Every new
module **must** set `engine_type` at creation time. There is no fallback path
anymore — code that used to read `m.engine_type || resolveEngineType(m.template_type)`
has been deleted (`analytics.controller.ts`, `metrics-layer.service.ts`).

## Fulfillment modes are never engine types (hard rule)

A **fulfillment mode** is a capability of an engine — not an engine. One
engine (Engine A / `instant_transaction`) may expose several fulfillment
modes, each backed by its own adapter state machine, through the per-mode
bindings in its capability contract (`capabilities.fulfillment.modeMachines`):

| Engine A mode            | Adapter machine                              |
|---------------------------|----------------------------------------------|
| `on_premise` / `pickup` / `local_delivery` | hospitality adapter (`queued → in_progress → ready → handed_off`) |
| `digital_delivery`        | digital adapter (`provisioning → provisioned → delivered → completed`) |

Adding a fulfillment mode NEVER adds an `EngineType`. `digital_delivery` was
briefly registered as an engine (a mistake this phase removed) — it is now a
**mode** of `instant_transaction`, proved at runtime by the same-engine
cross-mode tests and the mode-scoped validator: a `digital_delivery` row is
validated only against the digital binding, a hospitality row only against
the hospitality binding. The architecture gate enforces this: the engine
registry must contain exactly the five canonical engines, and no value in the
fulfillment-mode registry may ever appear in `EngineType`.

Future modes (`shipment`, `service_execution`, …) extend the mode registry
and the engine's bindings — they do not create engines.

## `template_type`: frozen, read-only legacy compat

`modules.template_type` is kept only so nothing that still joins on it breaks.
No new code may read or write it. It is not deprecated-with-a-plan-to-remove;
it is frozen indefinitely as a compat column, full stop.

## The 8 legacy aliases: closed list

These are the only `template_type` values that have ever existed in this
codebase. This list does not grow. A 9th alias is a product decision that
gets a new row in this table and an explicit migration — not a quiet addition
to one of the mapping objects below.

| Legacy alias          | Canonical engine              |
|------------------------|--------------------------------|
| `menu_service`          | `instant_transaction`          |
| `multi_day_booking`     | `time_exclusive_reservation`   |
| `session_access`        | `shared_capacity_access`       |
| `subscription`          | `ongoing_entitlement`          |
| `membership_access`     | `ongoing_entitlement`          |
| `class_scheduling`      | `shared_capacity_access`       |
| `appointment_booking`   | `time_exclusive_reservation`   |
| `saas_subscription`     | `platform_entitlement`         |

### Known duplication (not resolved in this stage)

This exact mapping is currently duplicated **five times** in the backend:

- `backend/src/security/template-permission-presets.ts` (`LEGACY_ALIASES`) — missing `saas_subscription`
- `backend/src/modules/analytics/metrics-layer.service.ts` (now deleted as part of Stage 1 — was missing `saas_subscription`, defaulted unknown types to `instant_transaction` silently)
- `backend/src/routes/dynamic-module.router.ts`, **three separate inline copies** (lines ~2271, ~2324, ~2546) — the first two are missing `saas_subscription`; only the third has it

The three copies inside `dynamic-module.router.ts` disagreeing with each
other is a real bug surface: which copy runs depends on which code path a
request takes. This wasn't in Stage 1's scope to fix (it's a refactor, not a
freeze), but it should be next: consolidate into one exported
`LEGACY_TEMPLATE_ALIASES` map that every one of these five call sites
imports, so there's exactly one place this list can ever be edited.

## Rule for new modules

Every new module sets `engine_type` explicitly at creation time, using one of
the 5 canonical values above. It never derives it from `template_type` —
that direction of resolution only ever existed for backfilling old rows.
