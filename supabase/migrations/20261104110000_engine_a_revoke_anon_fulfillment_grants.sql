-- ═══════════════════════════════════════════════════════════════════════════
-- Engine A — revoke anon's baseline default grants on fulfillment tables
--
-- Reproducibility fix found by the isolated-stack audit (2026-11-04): a
-- migration-built database granted `anon` 12 privileges (INSERT / UPDATE /
-- DELETE / TRUNCATE / REFERENCES / TRIGGER) on `fulfillments` and
-- `fulfillment_events`, while the hosted DB has 0. Root cause: hardening
-- migration 20260821150000 only did `REVOKE SELECT` — the remaining
-- privileges came from the baseline's ALTER DEFAULT PRIVILEGES and were
-- revoked manually on hosted, outside the migration chain. This migration
-- makes the chain itself reproduce the hosted posture.
--
-- Scope note: engine_financial_ledger / engine_state_transitions each still
-- carry one anon SELECT on hosted (legacy residue, not covered by the RLS
-- test); intentionally left untouched here to avoid diverging from hosted.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL PRIVILEGES ON TABLE "public"."fulfillments" FROM "anon";
REVOKE ALL PRIVILEGES ON TABLE "public"."fulfillment_events" FROM "anon";
