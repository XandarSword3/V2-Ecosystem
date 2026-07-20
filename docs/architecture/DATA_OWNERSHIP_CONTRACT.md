# Data Ownership Contract

Status: **frozen** as of the Stage 3 tenant-isolation contract freeze (July 2026).

## How this was determined

Static text parsing of the 190 migration files cannot answer this question
reliably. The backfill and constraint logic in
`20260624010000_audit_isolation_remediation.sql` builds its `ALTER TABLE`
statements dynamically (`EXECUTE format('ALTER TABLE %I ...', r.table_name)`
inside a loop over `information_schema.tables`) — the table names never
appear as literal text, so a regex or AST pass over the `.sql` files cannot
see which tables it actually touched, and that migration's own error
handling (`EXCEPTION WHEN OTHERS THEN RAISE NOTICE ...`) silently swallows
per-table failures. A first pass at this contract based on text-parsing the
migrations concluded 197 tables still had a nullable `tenant_id`. That
number was wrong.

What follows instead was produced by replaying all 190 migrations, in
order, against a disposable Postgres 16 instance seeded with the
Supabase-equivalent roles and `auth` schema stub, then reading the
resulting `information_schema` directly. That gives the real effect of the
dynamic loops without needing production database credentials. It is not a
substitute for checking actual production data (a table can be correctly
`NOT NULL` in schema and still be wrong if production somehow has rows that
predate the constraint), but it is ground truth for schema *shape*, which
static parsing is not.

## Shared tables — platform-wide by design (closed list)

These have no `tenant_id` and no `property_id`. They are not scoped to a
customer because they aren't customer data — they're platform reference
data or the tenant registry itself.

| Table | What it is |
|---|---|
| `tenants` | The tenant registry. This table can't reference itself. |
| `plans` | SaaS billing plan definitions (Starter/Pro/Enterprise, Stripe price IDs) |
| `currencies` | Global currency reference data |
| `supported_languages` | Global list of platform-supported locales |
| `system_config` | Platform-wide key/value config |
| `system_defaults` | Platform-wide default settings |
| `translation_keys` | Platform-wide catalog of translatable string keys |
| `translation_memory` | Platform-wide translation reuse cache (deliberately shared for efficiency across tenants) |

This list does not grow casually — a table landing here means someone
decided it's the same for every customer on the platform. That's a product
decision, not an implementation detail.

## Tenant-scoped tables — the default

Every other table with a `tenant_id` column is customer data and must be
locked to one tenant. Verified: **201 of 203** tenant-scoped tables already
have `tenant_id NOT NULL` with a foreign key to `tenants`, enforced by the
June 24 remediation. The full verified list is checked in at
`backend/scripts/tenant-scope-schema.json` — treat that file as the source
of truth for "is this table tenant-scoped," including for the Stage 4 CI
check.

### The one deliberate exception: `users`

`users.tenant_id` is nullable, and that's correct. It's protected by a real
constraint, not an oversight:

```sql
CHECK ((scope = ANY (ARRAY['super_admin', 'platform_admin'])) OR tenant_id IS NOT NULL)
```

Platform-level staff accounts aren't scoped to a customer. Every other
`scope` value requires `tenant_id`. Leave this alone.

### The one gap this stage closes: `property_groups`

`property_groups.tenant_id` was nullable with **no** protecting constraint
and no code found anywhere relying on the NULL state — it was just never
finished. `properties.tenant_id` is even derived from it
(`UPDATE properties SET tenant_id = property_groups.tenant_id ...` in the
June 24 migration), so a NULL here can propagate. Closed in
`20260720120000_freeze_property_groups_tenant_scoping.sql` (Stage 4).

## Flagged, not resolved: indirectly-scoped tables

These 7 tables have no `tenant_id` column of their own — they're scoped
only by joining through a parent row. That's weaker than a direct column:
every query path has to remember the join, and one that forgets it doesn't
error, it just silently returns cross-tenant rows.

| Table | Scoped via |
|---|---|
| `content_translations` | `entity_id`/`entity_type` (polymorphic — no typed FK at all) |
| `guest_language_preferences` | `guest_id` → `guests.tenant_id` |
| `membership_plans` | `module_id` → `modules.tenant_id` |
| `memberships` | `module_id` → `modules.tenant_id` |
| `property_languages` | `property_id` → `properties.tenant_id` |
| `translation_bundles` | `property_id` → `properties.tenant_id` (and `property_id` itself is nullable) |
| `translations` | `property_id` → `properties.tenant_id` (and `property_id` itself is nullable) |

Fixing this means adding a direct, denormalized `tenant_id` to each and
backfilling it — schema work, not a constraint flip. Out of scope for this
stage. Whoever picks this up next should treat it the same way Stage 2
treated the ~20 un-audited `x-property-id` controllers: flagged, not
fixed, not the same as safe.

## Flagged, not resolved: a real contradiction between schema and code

`modules.tenant_id` and `seasonal_pricing_rules.tenant_id` are both
`NOT NULL`. But the application code explicitly queries
`tenant_id.eq.<id>,tenant_id.is.null` against both tables, expecting the
`IS NULL` branch to mean "global, visible to every tenant":

- `backend/src/middleware/moduleGuard.middleware.ts`
- `backend/src/modules/admin/modules.controller.ts`
- `backend/src/modules/admin/translations.controller.ts` (queries `modules`)
- `backend/src/services/seasonal-pricing.service.ts`

Given the `NOT NULL` constraint, that branch can never match a row. Either:

1. The "global system module" / "global default pricing" feature is
   currently dead — no tenant ever sees a platform-provided default,
   because no row can have `tenant_id IS NULL` — or
2. There's a de facto substitute (e.g. every tenant gets its own copy of
   default modules/pricing seeded at provisioning, so the `IS NULL` branch
   was already unreachable by design and just never got cleaned out of the
   code).

This wasn't resolved because it's a product question, not a data question
— restoring "global" would mean loosening a constraint that's currently
protecting real tenant isolation on those two tables, and this stage isn't
the place to make that call unilaterally. Needs a decision before either
side changes.

## Terminology note: two different meanings of "customer"

The schema itself already uses `customer_id` — on `memberships` and
`reviews` — to mean *the guest holding the membership / leaving the
review*, not the SaaS tenant. That's a different axis entirely from
everything else in this document, which uses "customer" to mean "the
tenant, i.e. the business paying for the platform." Don't conflate the
two when reading migration or controller code that mentions `customer_id`.

## Secondary axis: `property_id`

Out of scope for this stage (which is about the tenant/customer axis) but
worth recording: 3 tables have a nullable `property_id` —
`service_locations`, `translation_bundles`, `translations`. Plausibly
legitimate (some content is tenant-wide, not tied to one property), not
independently verified here.
