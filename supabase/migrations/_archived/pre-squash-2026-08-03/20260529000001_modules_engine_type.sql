-- Align modules.engine_type with Architecture Law canonical names.
-- The old module_template_type enum used legacy names (menu_service,
-- multi_day_booking, session_access). The correct names match the
-- transactions.engine_type values defined in the Engine Refit.
--
-- Mapping:
--   menu_service       → instant_transaction
--   multi_day_booking  → time_exclusive_reservation
--   session_access     → shared_capacity_access

ALTER TABLE modules ADD COLUMN IF NOT EXISTS engine_type TEXT;

UPDATE modules SET engine_type = CASE template_type
  WHEN 'menu_service'      THEN 'instant_transaction'
  WHEN 'multi_day_booking' THEN 'time_exclusive_reservation'
  WHEN 'session_access'    THEN 'shared_capacity_access'
  ELSE NULL
END
WHERE engine_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_modules_engine_type ON modules(engine_type);

-- template_type left in place to avoid breaking other consumers.
-- It is deprecated — do not use in new code. Use engine_type.
COMMENT ON COLUMN modules.engine_type IS 'Canonical engine type per Architecture Law. Replaces legacy template_type.';
COMMENT ON COLUMN modules.template_type IS 'DEPRECATED. Use engine_type instead.';
