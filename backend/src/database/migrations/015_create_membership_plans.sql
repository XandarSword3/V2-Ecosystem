-- Migration: Create membership_plans table and seed defaults
-- Phase 4.4

CREATE TABLE IF NOT EXISTS membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(30),
    price NUMERIC(10,2) NOT NULL,
    interval VARCHAR(20) NOT NULL CHECK (interval IN ('monthly', 'quarterly', 'yearly')),
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_module_id ON membership_plans(module_id);
CREATE INDEX IF NOT EXISTS idx_membership_plans_active ON membership_plans(is_active);

INSERT INTO membership_plans (name, type, price, interval, features, is_active)
VALUES
('Individual Monthly', 'INDIVIDUAL', 49.99, 'monthly', '["maxMembers:1","dailyAccessLimit:1","guestPasses:2","discount:10"]'::jsonb, true),
('Individual Yearly', 'INDIVIDUAL', 449.99, 'yearly', '["maxMembers:1","dailyAccessLimit:1","guestPasses:24","discount:15"]'::jsonb, true),
('Family Monthly', 'FAMILY', 99.99, 'monthly', '["maxMembers:5","dailyAccessLimit:unlimited","guestPasses:4","discount:15"]'::jsonb, true),
('Family Yearly', 'FAMILY', 899.99, 'yearly', '["maxMembers:5","dailyAccessLimit:unlimited","guestPasses:48","discount:20"]'::jsonb, true),
('Corporate Yearly', 'CORPORATE', 2499.99, 'yearly', '["maxMembers:20","dailyAccessLimit:unlimited","guestPasses:100","discount:25"]'::jsonb, true),
('VIP Yearly', 'VIP', 999.99, 'yearly', '["maxMembers:2","dailyAccessLimit:unlimited","guestPasses:unlimited","discount:30"]'::jsonb, true)
ON CONFLICT DO NOTHING;
