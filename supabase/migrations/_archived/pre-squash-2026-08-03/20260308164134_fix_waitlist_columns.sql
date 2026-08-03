-- Add proper type and notified_at columns to waitlist_entries
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'menu_service';
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Backfill type from notes field where it was previously stored
UPDATE waitlist_entries
SET type = CASE
    WHEN notes LIKE 'type:shared_capacity_access%' THEN 'shared_capacity_access'
    ELSE 'menu_service'
END
WHERE type IS NULL OR type = 'menu_service';

-- Clean notes field: remove the type prefix that was stored there
UPDATE waitlist_entries
SET notes = TRIM(REGEXP_REPLACE(notes, '^type:\w+\s*\|\s*', ''))
WHERE notes LIKE 'type:%';

-- Set empty notes to NULL after cleanup
UPDATE waitlist_entries SET notes = NULL WHERE notes = '';

-- Index for efficient type and module filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_type ON waitlist_entries(type);
CREATE INDEX IF NOT EXISTS idx_waitlist_module_status ON waitlist_entries(module_id, status);
