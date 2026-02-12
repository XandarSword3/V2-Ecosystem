-- Migration: Add settings_version to modules and ensure app_permissions
-- Date: 2026-01-31

-- Add settings_version to modules if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'settings_version') THEN
        ALTER TABLE modules ADD COLUMN settings_version INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'show_in_main') THEN
        ALTER TABLE modules ADD COLUMN show_in_main BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Ensure app_permissions table exists (referenced in controller)
CREATE TABLE IF NOT EXISTS app_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    module_slug VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure app_role_permissions table exists
CREATE TABLE IF NOT EXISTS app_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) NOT NULL,
    permission_slug VARCHAR(100) REFERENCES app_permissions(slug) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_name, permission_slug)
);

-- Ensure user_roles table uses UUIDs as expected by controller (schema 001 uses UUIDs, controller uses rolesData IDs)
-- Migration 001 already created user_roles with UUIDs, so we are good there.

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
