-- Re-seed Super Admin and Roles
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql/new

-- Step 1: Ensure user_roles has a unique constraint (Good practice)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_id_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);
  END IF;
END $$;

-- Step 2: Ensure roles exist
INSERT INTO roles (name, display_name, description, business_unit) VALUES
  ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
  ('customer', 'Customer', 'Registered customer', NULL),
  ('restaurant_admin', 'Restaurant Admin', 'Restaurant management', 'restaurant'),
  ('restaurant_staff', 'Restaurant Staff', 'Restaurant operations', 'restaurant'),
  ('snack_bar_admin', 'Snack Bar Admin', 'Snack bar management', 'snack_bar'),
  ('snack_bar_staff', 'Snack Bar Staff', 'Snack bar operations', 'snack_bar'),
  ('chalet_admin', 'Chalet Admin', 'Chalet management', 'chalets'),
  ('chalet_staff', 'Chalet Staff', 'Chalet operations', 'chalets'),
  ('pool_admin', 'Pool Admin', 'Pool management', 'pool'),
  ('pool_staff', 'Pool Staff', 'Pool operations', 'pool')
ON CONFLICT (name) DO NOTHING;

-- Step 3: Create/Update Super Admin User (admin@v2resort.com / admin123)
-- Password 'admin123' hashed with bcrypt (12 rounds)
INSERT INTO users (email, password_hash, full_name, email_verified, is_active)
VALUES (
  'admin@v2resort.com', 
  '$2a$12$IBfoxad7JE8i3DNQrQ2VJuxCNhqUPYmCFiferKoJBewbHBp7XbCsG', 
  'System Administrator', 
  true, 
  true
)
ON CONFLICT (email) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  full_name = 'System Administrator';

-- Step 4: Link User to Super Admin Role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM users u, roles r 
WHERE u.email = 'admin@v2resort.com' AND r.name = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
