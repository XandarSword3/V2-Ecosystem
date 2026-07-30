# Cross-cutting: Security / Tenant Isolation

## Source of truth (read these, don't restate them)

- `CLAUDE.md` (repo root) — the enforcement rules and failure mode
- `docs/architecture/DATA_OWNERSHIP_CONTRACT.md` — shared vs.
  tenant-scoped tables, known open gaps
- `docs/architecture/ROUTE_SCOPING_CONTRACT.md` — `x-tenant-id` /
  `x-property-id` resolution and verification
- `docs/architecture/MODULE_ENGINE_CONTRACT.md` — engine_type /
  template_type legacy aliases
- `backend/scripts/check-tenant-scoped-writes.js` — CI guard
  (`npm run check:tenant-writes`), heuristic not exhaustive

## Merged 2026-07-25

`security/contract-freeze-stage1-6` merged into `main` (fast-forward,
`79b2b92c..bba5fade`). Added the three contract docs above, the CI
check script, and two migrations freezing `modules.engine_type` and
property-group tenant scoping. Verified zero new test failures
(backend and frontend suites identical pass/fail counts before and
after, run locally). Both `security/contract-freeze-stage1-6` and the
already-merged `security/phase0-tenant-isolation` deleted from origin
post-merge.

## Status

- [ ] Confirm `check:tenant-writes` is wired into CI (`.github/workflows/ci.yml`
      was touched by the merge — verify the step runs on PRs, not just locally)
- [ ] 2FA: mandatory enrollment flow blocked on a silent upsert
      failure in `two-factor.service.ts` (missing tenant_id/property_id
      columns) — per prior session, still open as of 2026-07-14
