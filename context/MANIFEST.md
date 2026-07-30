# V2-Ecosystem — Cross-Session Context Directory

Working memory shared between chat-planning sessions and Claude Code
execution sessions. Read this file first at the start of any session
that touches more than one engine/scope area. If your session is
scoped to one engine × one role, read only that file plus this index.

## Why this exists

Root `CLAUDE.md` (tenant-isolation contract enforcement) and
`docs/architecture/*_CONTRACT.md` are the frozen architecture source
of truth — never duplicate their content here, only reference them.
This directory is for what contracts don't cover: which file under a
given engine × scope is currently being worked on, what's done,
what's blocked, and why — so a new session doesn't re-derive context
a previous session already paid for.

## Real system model (verified against code, 2026-07-25)

- **5 engines** (`backend/src/engines/registry.ts`, definitions in
  `backend/src/engines/definitions/*.ts`): `instant_transaction`,
  `time_exclusive_reservation`, `shared_capacity_access`,
  `ongoing_entitlement`, `platform_entitlement`.
- **7 scopes** (`backend/src/security/permissions.ts` `UserScope`,
  backed by `supabase/migrations/20260624000000_user_scope_model.sql`):
  `super_admin`, `platform_admin`, `tenant_owner`, `tenant_admin`,
  `property_manager`, `property_staff`, `customer`.
- `scopeToRoles()` in permissions.ts collapses `tenant_owner` and
  `tenant_admin` to the same derived role (`admin`) for legacy route
  guards — so this directory uses one combined `admin.md` per engine
  instead of splitting owner/admin, matching how the code actually
  branches.
- `platform_entitlement` is internal-only (marked so in
  `docs/architecture/MODULE_ENGINE_CONTRACT.md`, omitted from public
  docs). Its "customer" is `tenant_owner` (the signup output), and
  it's operated by `platform_admin`/`super_admin` — not a
  customer/staff/manager/admin workflow like the other four. It gets
  its own two files instead of the four-tier pattern.

## File map

| Path | Covers |
|---|---|
| `context/cross-cutting/security.md` | Tenant isolation, contract docs, `check:tenant-writes` |
| `context/cross-cutting/e2e-coverage.md` | Playwright E2E status across engines |
| `context/cross-cutting/module-builder.md` | Drag-and-drop page builder (DynamicModuleRenderer, BuilderCanvasV2) |
| `context/engines/<engine>/customer.md` | Guest-facing flow for that engine |
| `context/engines/<engine>/property_staff.md` | Staff-facing flow |
| `context/engines/<engine>/property_manager.md` | Manager-facing flow |
| `context/engines/<engine>/admin.md` | tenant_owner + tenant_admin flow |
| `context/engines/platform_entitlement/provisioning.md` | Signup → tenant_owner creation |
| `context/engines/platform_entitlement/operations.md` | platform_admin/super_admin control plane |

`<engine>` ∈ `instant_transaction`, `time_exclusive_reservation`,
`shared_capacity_access`, `ongoing_entitlement`.

## Session protocol

1. On entry: read this MANIFEST, then only the specific engine/scope
   or cross-cutting files your task touches.
2. On exit: update the "Status" section of every file you touched —
   what changed, what's still open, any decision the human made that
   isn't in a contract doc yet.
3. Never restate contract-doc content here — link to it.
4. If a task needs a 6th engine type or a scope not in the list
   above, stop — that's a contract change, not a context-file update
   (see root `CLAUDE.md`).

## Known issue flagged during 2026-07-25 session, not yet fixed

Frontend test suite has regressed hard since 2026-07-14 (was
524/524 green): now 84/110 files failing, 294/536 tests failing.
Confirmed pre-existing on `main` (not caused by any change in this
session) via a before/after test run around the contract-freeze
merge. Root cause not yet investigated — worth a session of its own.
