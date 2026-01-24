-- Seasonal Pricing Rules Table
CREATE TABLE IF NOT EXISTS seasonal_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    start_date VARCHAR(5) NOT NULL, -- MM-DD format
    end_date VARCHAR(5) NOT NULL, -- MM-DD format
    price_multiplier DECIMAL(4, 2) NOT NULL DEFAULT 1.0,
    applicable_to TEXT[] NOT NULL DEFAULT ARRAY['chalets'],
    specific_items UUID[], -- Optional specific item IDs
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_active ON seasonal_pricing_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_priority ON seasonal_pricing_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_dates ON seasonal_pricing_rules(start_date, end_date);

-- Insert default seasonal pricing rules
INSERT INTO seasonal_pricing_rules (name, start_date, end_date, price_multiplier, applicable_to, priority, is_active)
VALUES 
    ('Summer Peak Season', '07-01', '08-31', 1.40, ARRAY['chalets', 'pool'], 10, true),
    ('Easter Holiday', '04-01', '04-15', 1.25, ARRAY['chalets', 'pool', 'restaurant'], 15, true),
    ('Christmas & New Year', '12-20', '01-05', 1.50, ARRAY['chalets', 'pool', 'restaurant'], 20, true),
    ('Spring Break', '03-15', '03-31', 1.20, ARRAY['chalets', 'pool'], 8, true),
    ('Winter Low Season', '01-15', '02-28', 0.85, ARRAY['chalets'], 5, true),
    ('Autumn Special', '10-01', '10-31', 0.90, ARRAY['chalets', 'pool'], 5, true)
ON CONFLICT DO NOTHING;

-- Price history table for analytics
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type VARCHAR(50) NOT NULL,
    item_id UUID NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2) NOT NULL,
    applied_rules JSONB DEFAULT '[]',
    booking_date DATE NOT NULL,
    check_in_date DATE NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for price history
CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_dates ON price_history(check_in_date);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON price_history(recorded_at);

-- View for seasonal pricing analysis
CREATE OR REPLACE VIEW seasonal_pricing_analysis AS
SELECT 
    spr.name AS rule_name,
    spr.start_date,
    spr.end_date,
    spr.price_multiplier,
    spr.applicable_to,
    COUNT(ph.id) AS times_applied,
    AVG(ph.final_price - ph.base_price) AS avg_price_adjustment,
    SUM(ph.final_price - ph.base_price) AS total_revenue_impact
FROM seasonal_pricing_rules spr
LEFT JOIN price_history ph ON 
    ph.applied_rules::text LIKE '%' || spr.name || '%'
    AND ph.recorded_at >= NOW() - INTERVAL '90 days'
WHERE spr.is_active = true
GROUP BY spr.id, spr.name, spr.start_date, spr.end_date, spr.price_multiplier, spr.applicable_to
ORDER BY spr.priority DESC;

-- RLS policies
ALTER TABLE seasonal_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seasonal pricing rules"
    ON seasonal_pricing_rules FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Staff can view seasonal pricing rules"
    ON seasonal_pricing_rules FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'staff', 'receptionist')
        )
    );

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view price history"
    ON price_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'staff', 'receptionist')
        )
    );

CREATE POLICY "System can insert price history"
    ON price_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Function to automatically record price when booking
CREATE OR REPLACE FUNCTION record_booking_price()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO price_history (
        item_type,
        item_id,
        base_price,
        final_price,
        applied_rules,
        booking_date,
        check_in_date
    ) VALUES (
        'chalets',
        NEW.chalet_id,
        COALESCE(NEW.base_price, NEW.total_price),
        NEW.total_price,
        COALESCE(NEW.pricing_rules_applied, '[]'::jsonb),
        CURRENT_DATE,
        NEW.check_in_date
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add columns to chalet_bookings if not exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chalet_bookings' AND column_name = 'base_price') THEN
        ALTER TABLE chalet_bookings ADD COLUMN base_price DECIMAL(10, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chalet_bookings' AND column_name = 'pricing_rules_applied') THEN
        ALTER TABLE chalet_bookings ADD COLUMN pricing_rules_applied JSONB DEFAULT '[]';
    END IF;
END $$;

-- Create trigger for price recording
DROP TRIGGER IF EXISTS trigger_record_booking_price ON chalet_bookings;
CREATE TRIGGER trigger_record_booking_price
    AFTER INSERT ON chalet_bookings
    FOR EACH ROW
    EXECUTE FUNCTION record_booking_price();
