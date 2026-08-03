-- Fix can_check_in() to query accommodation_units with current column names.
--
-- Root cause: 20260308161924_add_housekeeping_advanced_tables.sql ran after the rename migration,
-- so its conditional `IF EXISTS chalets` hit the ELSE branch and created a stub that always
-- returns FALSE. This migration replaces that stub with the real implementation.
--
-- Note: housekeeping_tasks.unit_id is the current column name (renamed by 20260603000001).

CREATE OR REPLACE FUNCTION can_check_in(p_unit_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_unit RECORD;
  v_pending_count INTEGER;
BEGIN
  SELECT cleaning_status, is_blocked INTO v_unit
  FROM accommodation_units WHERE id = p_unit_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_unit.is_blocked THEN RETURN FALSE; END IF;
  IF v_unit.cleaning_status != 'clean' THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM housekeeping_tasks
  WHERE unit_id = p_unit_id
    AND status IN ('pending', 'in_progress', 'rework_needed');

  RETURN v_pending_count = 0;
END;
$$ LANGUAGE plpgsql;
