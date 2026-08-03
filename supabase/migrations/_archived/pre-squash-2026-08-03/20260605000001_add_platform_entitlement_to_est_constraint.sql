-- Add platform_entitlement to engine_state_transitions engine_type CHECK constraint.
-- The original constraint (20260524000000_engine_framework_constraints.sql) only listed
-- the 4 tenant-facing engines, which would reject any Engine E (platform_entitlement)
-- state transition records written to this table.
--
-- Idempotent: DROP IF EXISTS + exception-wrapped ADD to survive re-runs.

DO $$ BEGIN
  ALTER TABLE engine_state_transitions
    DROP CONSTRAINT IF EXISTS engine_state_transitions_engine_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE engine_state_transitions
    ADD CONSTRAINT chk_est_engine_type CHECK (engine_type IN (
      'instant_transaction',
      'time_exclusive_reservation',
      'shared_capacity_access',
      'ongoing_entitlement',
      'platform_entitlement'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
