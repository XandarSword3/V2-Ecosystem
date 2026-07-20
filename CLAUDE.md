# Instructions for AI agents working in this repo

This repo is multi-tenant. A prior incident (see
`docs/architecture/DATA_OWNERSHIP_CONTRACT.md`) shipped a bug where a
database write silently omitted the tenant identifier and broke in
production instead of failing in CI. The isolation boundary between
customers is the single most important property of this codebase.

## Before touching tenant/route/table-scoping code

If your change touches any of the following, **read all three contract
docs first, in full, before writing code**:

- `docs/architecture/MODULE_ENGINE_CONTRACT.md` — the 5 engines,
  `engine_type`, `template_type` legacy aliases
- `docs/architecture/ROUTE_SCOPING_CONTRACT.md` — how `x-tenant-id` /
  `x-property-id` are supposed to be resolved and verified
- `docs/architecture/DATA_OWNERSHIP_CONTRACT.md` — which tables are
  shared vs. tenant-scoped, and the known open gaps

This applies to: auth/tenant-resolution middleware, any controller that
reads `x-tenant-id` or `x-property-id`, anything that writes to a
tenant-scoped table (which is the default — see the data ownership
contract for the short list of exceptions), and anything touching
`engine_type` / `template_type` / module resolution.

These docs are marked **frozen** for a reason: they represent decisions
made after finding real cross-tenant data leaks, not arbitrary style
preferences. Do not "helpfully" work around a constraint documented as
frozen (e.g. loosening a `NOT NULL`, reading a header directly instead of
through the verified JWT claim, inventing a 6th engine type) without
the human explicitly deciding to change the contract itself. If a task
seems to require that, stop and say so instead of finding a way around
it.

## The concrete failure mode to avoid

Tenant identity must come from the verified JWT (`req.tenant.id` /
`req.user`), never from a client-supplied header, a query param, or a
request body field, even when it seems obviously correct in context.
Every write to a tenant-scoped table must set `tenant_id` explicitly —
`npm run check:tenant-writes` (backend) catches the common shape of this
in CI, but it's heuristic, not a substitute for actually reading the
contract.

## Every PR

Check the box in the PR template confirming you read the relevant
contract docs before this PR is opened — not after review comments ask
you to.
