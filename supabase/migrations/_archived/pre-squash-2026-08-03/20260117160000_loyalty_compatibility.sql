-- Loyalty Compatibility Migration
-- Creates loyalty_accounts view and loyalty_settings table for controller compatibility

-- Create loyalty_settings table
CREATE TABLE IF NOT EXISTS loyalty_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    points_per_dollar DECIMAL(10,2) DEFAULT 1.0,
    min_redemption_points INTEGER DEFAULT 100,
    points_expiry_days INTEGER DEFAULT 365,
    enable_tier_benefits BOOLEAN DEFAULT true,
    enable_birthday_bonus BOOLEAN DEFAULT true,
    birthday_bonus_points INTEGER DEFAULT 100,
    referral_bonus_points INTEGER DEFAULT 500,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO loyalty_settings (points_per_dollar, min_redemption_points, points_expiry_days)
SELECT 1.0, 100, 365
WHERE NOT EXISTS (SELECT 1 FROM loyalty_settings LIMIT 1);

-- Create loyalty_accounts as a view of loyalty_members for backward compatibility
CREATE OR REPLACE VIEW loyalty_accounts AS
SELECT 
    id,
    user_id,
    tier_id,
    total_points,
    available_points,
    lifetime_points,
    member_since,
    last_activity,
    created_at,
    updated_at
FROM loyalty_members;

-- Create a function to handle inserts on the view
CREATE OR REPLACE FUNCTION insert_loyalty_account()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO loyalty_members (
        id, user_id, tier_id, total_points, available_points, 
        lifetime_points, member_since, last_activity, created_at, updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.user_id,
        NEW.tier_id,
        COALESCE(NEW.total_points, 0),
        COALESCE(NEW.available_points, 0),
        COALESCE(NEW.lifetime_points, 0),
        COALESCE(NEW.member_since, NOW()),
        COALESCE(NEW.last_activity, NOW()),
        COALESCE(NEW.created_at, NOW()),
        COALESCE(NEW.updated_at, NOW())
    )
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to handle updates on the view
CREATE OR REPLACE FUNCTION update_loyalty_account()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE loyalty_members SET
        tier_id = NEW.tier_id,
        total_points = NEW.total_points,
        available_points = NEW.available_points,
        lifetime_points = NEW.lifetime_points,
        last_activity = NEW.last_activity,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for the view (only if they don't exist)
DROP TRIGGER IF EXISTS loyalty_accounts_insert_trigger ON loyalty_accounts;
CREATE TRIGGER loyalty_accounts_insert_trigger
    INSTEAD OF INSERT ON loyalty_accounts
    FOR EACH ROW EXECUTE FUNCTION insert_loyalty_account();

DROP TRIGGER IF EXISTS loyalty_accounts_update_trigger ON loyalty_accounts;
CREATE TRIGGER loyalty_accounts_update_trigger
    INSTEAD OF UPDATE ON loyalty_accounts
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_account();

-- Enable RLS on loyalty_settings
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Anyone can read loyalty settings"
    ON loyalty_settings FOR SELECT
    USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update loyalty settings"
    ON loyalty_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
        )
    );
