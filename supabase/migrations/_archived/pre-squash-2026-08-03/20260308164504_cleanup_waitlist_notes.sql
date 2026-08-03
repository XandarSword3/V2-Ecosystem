-- Clean notes that are just "type:xxx" with no actual note content
UPDATE waitlist_entries SET notes = NULL WHERE notes ~ '^type:\w+$';

-- Clean notes that have "type:xxx | actual notes" - keep only actual notes
UPDATE waitlist_entries SET notes = TRIM(REGEXP_REPLACE(notes, '^type:\w+\s*\|\s*', ''))
WHERE notes ~ '^type:\w+\s*\|';

-- Ensure type column is properly set from notes before we clear them
UPDATE waitlist_entries SET type = 'shared_capacity_access'
WHERE notes IS NOT NULL AND notes LIKE '%type:shared_capacity_access%' AND (type IS NULL OR type = 'menu_service');
