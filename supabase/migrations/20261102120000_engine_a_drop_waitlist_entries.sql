-- ═══════════════════════════════════════════════════════════════════════════
-- Engine A — Admin Plan Phase 3 (waitlist removal, amended decision)
--
-- Per "Implementation Engine A admin pages.md" Phase 3 (2026-11-02
-- confirmation against "Main Plan For Engine A.md" Phase 31 conflict):
-- the walk-in waitlist is a cross-cutting demand-capture / capacity-
-- sequencing concern, NOT Engine A's to build. Frontend pages, nav, staff
-- and customer routes, socket hook and tests were removed in the same
-- change; this drop completes the removal.
--
-- If a walk-in queue is ever built, it must be a cross-cutting capability
-- with its own canonical storage — not a resurrection of this table.
-- (No live data reuse possible: table has been UI-deleted for months.)
--
-- RLS: all waitlist_entries policies are attached to the table and are
-- dropped implicitly by DROP TABLE. No functions, views, or triggers
-- reference waitlist_entries.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS "public"."waitlist_entries";
