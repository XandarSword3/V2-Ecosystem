-- Security Audit Log Table
-- Migration for Sprint 1: Security features

-- Create security audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    description TEXT NOT NULL,
    metadata JSONB,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_target_user ON security_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip_address ON security_audit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_composite ON security_audit_log(event_type, created_at DESC);

-- System settings table for storing configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    encrypted BOOLEAN DEFAULT false,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Password history table for preventing password reuse
CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user password history lookup
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id, created_at DESC);

-- Add last_password_change to users if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_password_change'
    ) THEN
        ALTER TABLE users ADD COLUMN last_password_change TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add 2FA enforcement columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'two_factor_required'
    ) THEN
        ALTER TABLE users ADD COLUMN two_factor_required BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add failed login tracking to users
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
    ) THEN
        ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'locked_until'
    ) THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_failed_login'
    ) THEN
        ALTER TABLE users ADD COLUMN last_failed_login TIMESTAMPTZ;
    END IF;
END $$;

-- Insert default password policy settings
INSERT INTO system_settings (key, value, category, description)
VALUES 
    ('password.minLength', '8', 'security', 'Minimum password length'),
    ('password.maxLength', '128', 'security', 'Maximum password length'),
    ('password.requireUppercase', 'true', 'security', 'Require uppercase letters'),
    ('password.requireLowercase', 'true', 'security', 'Require lowercase letters'),
    ('password.requireNumbers', 'true', 'security', 'Require numbers'),
    ('password.requireSpecialChars', 'true', 'security', 'Require special characters'),
    ('password.preventCommonPasswords', 'true', 'security', 'Prevent common passwords'),
    ('password.passwordHistoryCount', '5', 'security', 'Number of previous passwords to remember'),
    ('password.maxAge', '90', 'security', 'Password expiration in days (0 = never)'),
    ('password.minAge', '1', 'security', 'Minimum days before password can be changed')
ON CONFLICT (key) DO NOTHING;

-- Insert default session settings
INSERT INTO system_settings (key, value, category, description)
VALUES 
    ('session.timeoutMinutes', '30', 'security', 'Session timeout in minutes'),
    ('session.warningMinutes', '25', 'security', 'Show warning before timeout'),
    ('session.maxConcurrent', '5', 'security', 'Maximum concurrent sessions per user')
ON CONFLICT (key) DO NOTHING;

-- Insert default lockout settings
INSERT INTO system_settings (key, value, category, description)
VALUES 
    ('lockout.maxAttempts', '5', 'security', 'Maximum failed login attempts'),
    ('lockout.durationMinutes', '15', 'security', 'Account lockout duration'),
    ('lockout.captchaThreshold', '3', 'security', 'Show CAPTCHA after this many attempts')
ON CONFLICT (key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE security_audit_log IS 'Security audit log for tracking all security-related events';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings stored as key-value pairs';
COMMENT ON TABLE password_history IS 'Password history for preventing password reuse';
