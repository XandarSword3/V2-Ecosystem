-- Create accommodation_unit_price_rules if it doesn't exist yet.
-- The original CREATE TABLE lived in an archived migration (20260224100000)
-- as chalet_price_rules and never made it into the active chain.
CREATE TABLE IF NOT EXISTS accommodation_unit_price_rules (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id          UUID,
    name             TEXT,
    start_date       DATE,
    end_date         DATE,
    price            DECIMAL(10,2),
    price_multiplier DECIMAL(3,2),
    is_active        BOOLEAN       DEFAULT true,
    priority         INTEGER       DEFAULT 0,
    created_at       TIMESTAMPTZ   DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- Make start_date and end_date nullable to allow permanent pricing rules
-- (no-ops if table was just created above with nullable columns)
ALTER TABLE accommodation_unit_price_rules ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE accommodation_unit_price_rules ALTER COLUMN end_date DROP NOT NULL;
