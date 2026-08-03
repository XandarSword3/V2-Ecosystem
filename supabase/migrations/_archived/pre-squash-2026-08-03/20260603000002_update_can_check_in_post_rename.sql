-- Update can_check_in() after housekeeping_tasks.chalet_id → unit_id rename
-- (20260603000001_rename_chalet_id_to_unit_id.sql). The previous version of this
-- function (20260601000001_fix_can_check_in_function.sql) queried chalet_id which
-- no longer exists after the column rename above.

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
