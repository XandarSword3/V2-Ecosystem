-- Migration no-oped: attempted to SET show_in_main on a hardcoded module UUID.
-- Column does not exist in the canonical modules schema; hardcoded UUID is
-- seed-specific and absent from a fresh database. Safe to skip.
DO $$ BEGIN NULL; END $$;
