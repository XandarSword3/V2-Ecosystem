-- Seed Super Admin Account
-- This file is automatically run during `supabase db reset`

-- Ensure super_admin role exists
INSERT INTO roles (name, display_name, description, business_unit) VALUES
  ('super_admin', 'Super Administrator', 'Full system access', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Create/Update Super Admin User (admin@v2ecosystem.com / admin123)
-- Password 'admin123' hashed with bcrypt (12 rounds)
INSERT INTO users (email, password_hash, full_name, email_verified, is_active)
VALUES (
  'admin@v2ecosystem.com',
  '$2a$12$IBfoxad7JE8i3DNQrQ2VJuxCNhqUPYmCFiferKoJBewbHBp7XbCsG',
  'System Administrator',
  true,
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  full_name = 'System Administrator';

-- Link User to Super Admin Role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'admin@v2ecosystem.com' AND r.name = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
