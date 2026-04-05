-- Split from 20260224000000_atomic_safety_functions.sql
-- Shared prerequisites and verification notices

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pool_sessions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pool_sessions' AND column_name = 'module_id'
  ) THEN
    ALTER TABLE pool_sessions ADD COLUMN module_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Atomic safety functions created successfully:';
  RAISE NOTICE '  - purchase_pool_ticket_atomic (H2 fix)';
  RAISE NOTICE '  - create_chalet_booking_with_addons (H4/M3 fix)';
  RAISE NOTICE '  - reverse_coupon_usage (M4 fix)';
END $$;