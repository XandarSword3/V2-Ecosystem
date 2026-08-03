-- =============================================================
-- 2C: Fix housekeeping accommodation_units ↔ housekeeping_tasks
--     relationship so PostgREST can resolve the embedded join
--     used in getRoomStates():
--       accommodation_units.select(`
--         ...,
--         current_tasks:housekeeping_tasks(id, task_type, ...)
--       `)
--
-- Root cause: housekeeping_tasks.unit_id was a plain UUID column
-- with no FK constraint. PostgREST cannot infer the join without
-- a formal FK. Result: 500 on every GET /housekeeping/room-states.
--
-- Fix: add the FK + also add the four columns the controller
-- writes that were never migrated (override_*, booking_id).
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Add the missing FK from housekeeping_tasks.unit_id to
--    accommodation_units.id.
--    Guarded so it's safe to re-run if the constraint already
--    exists from a future migration.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
    WHERE  tc.table_name    = 'housekeeping_tasks'
      AND  tc.constraint_type = 'FOREIGN KEY'
      AND  kcu.column_name  = 'unit_id'
  ) THEN
    ALTER TABLE housekeeping_tasks
      ADD CONSTRAINT fk_housekeeping_tasks_unit_id
      FOREIGN KEY (unit_id)
      REFERENCES accommodation_units(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Add columns the controller writes that were never migrated.
--    None of these affect GET /room-states, but they prevent
--    500s on POST /tasks/:id/inspect/override and
--    POST /units/:unitId/checkout-clean.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE housekeeping_tasks
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS overridden_by   UUID,
  ADD COLUMN IF NOT EXISTS overridden_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_id      UUID;

-- ─────────────────────────────────────────────────────────────
-- 3. Index to support the embedded join on room-states and the
--    per-unit task look-ups elsewhere in the controller.
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_unit_id
  ON housekeeping_tasks(unit_id);

COMMIT;
