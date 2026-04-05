-- Make start_date and end_date nullable to allow permanent pricing rules
ALTER TABLE chalet_price_rules ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE chalet_price_rules ALTER COLUMN end_date DROP NOT NULL;
