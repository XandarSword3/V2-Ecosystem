-- Add platform_entitlement to engine_state_transitions engine_type CHECK constraint.
-- The original CHECK in 20260524000000 was defined inline (no explicit name),
-- so PostgreSQL auto-generated a constraint name. This migration drops whichever
-- name exists and replaces it with an explicit chk_est_engine_type covering all 5 engines.

DO $est_fix$
BEGIN
  ALTER TABLE engine_state_transitions
    DROP CONSTRAINT IF EXISTS engine_state_transitions_engine_type_check;

  ALTER TABLE engine_state_transitions
    DROP CONSTRAINT IF EXISTS chk_est_engine_type;

  ALTER TABLE engine_state_transitions
    ADD CONSTRAINT chk_est_engine_type
    CHECK (engine_type IN (
      'instant_transaction',
      'time_exclusive_reservation',
      'shared_capacity_access',
      'ongoing_entitlement',
      'platform_entitlement'
    ));
END
$est_fix$;
