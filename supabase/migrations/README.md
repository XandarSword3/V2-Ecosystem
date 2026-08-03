# Supabase Migrations

**Baseline:** `20260803090000_baseline_schema.sql` — the entire schema as a single
file, generated via `supabase db dump` directly against the live database on
2026-08-03. This is what's actually deployed right now: 211 tables, 88
functions/RPCs, 516 RLS policies, 29 enums, 387 indexes.

All future schema changes are new migrations layered on top of this file,
timestamped after `20260803090000`.

## Why this exists

The migration chain that used to live here (203 files, Jan 1 - Aug 3 2026) had
drifted from the live schema in real ways — see `/areas/code-audit.md`: dead
Drizzle ORM layer, tables referenced in code with no corresponding migration,
undefined RPC calls, duplicate-named migrations. Replaying the chain no longer
reliably told you what was actually in the database. The baseline above is
pulled from the database itself, so it can't drift from itself.

The old files are archived at `_archived/pre-squash-2026-08-03/` for history —
don't run them, they're superseded by the baseline.

## Remote migration history

The remote project's migration tracking table has been repaired to match: the
203 old versions are marked `reverted` (no local file, not expected to be
replayed) and `20260803090000` is marked `applied` (schema already matches,
nothing to execute). `supabase migration list` should show one clean matched
row.
