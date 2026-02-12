-- Fix gender_restriction column - expand from VARCHAR(5) to VARCHAR(10) to accommodate 'female' (6 chars)
ALTER TABLE pool_sessions ALTER COLUMN gender_restriction TYPE VARCHAR(10);
