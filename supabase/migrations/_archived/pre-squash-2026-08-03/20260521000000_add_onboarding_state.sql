-- Migration: 20260521000000_add_onboarding_state.sql
-- Introduce onboarding state tracking and RLS bypass for onboarding settings

-- Ensure site_settings exists (should exist)
CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure the missing updated_by column exists on site_settings (Bug #6)
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN site_settings.updated_by IS 'User who last updated this setting';


-- Insert default onboarding state if it doesn't exist
INSERT INTO site_settings (key, value, description)
VALUES (
    'onboarding_state',
    '{"completed": false, "current_step": "welcome", "steps": {}}'::jsonb,
    'Site-wide onboarding setup progress state'
)
ON CONFLICT (key) DO NOTHING;

-- Add RLS policy to allow authenticated users to read and update the onboarding state
-- (necessary before the first property is fully created and associated with the user)
DROP POLICY IF EXISTS site_settings_onboarding_access ON site_settings;
CREATE POLICY site_settings_onboarding_access ON site_settings
    FOR ALL
    TO authenticated
    USING (key = 'onboarding_state')
    WITH CHECK (key = 'onboarding_state');
