-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE, -- e.g., 'restaurant.orders.view'
  description TEXT,
  module_slug TEXT NOT NULL, -- e.g., 'restaurant'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Create user_permissions table (for overrides)
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN DEFAULT TRUE, -- TRUE = Grant, FALSE = Revoke (override role)
  PRIMARY KEY (user_id, permission_id)
);

-- Index for fast permission lookups
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module_slug);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- Seed basic permissions for existing modules
INSERT INTO permissions (slug, description, module_slug) VALUES
  -- Restaurant
  ('restaurant.view', 'Access Restaurant module', 'restaurant'),
  ('restaurant.manage', 'Full management of Restaurant', 'restaurant'),
  ('restaurant.orders.view', 'View restaurant orders', 'restaurant'),
  ('restaurant.orders.manage', 'Manage restaurant orders', 'restaurant'),
  ('restaurant.menu.manage', 'Manage restaurant menu', 'restaurant'),
  
  -- Pool
  ('pool.view', 'Access Pool module', 'pool'),
  ('pool.manage', 'Full management of Pool', 'pool'),
  ('pool.orders.view', 'View pool orders', 'pool'),
  ('pool.orders.manage', 'Manage pool orders', 'pool'),
  
  -- Chalets
  ('chalets.view', 'Access Chalets module', 'chalets'),
  ('chalets.manage', 'Full management of Chalets', 'chalets'),
  
  -- Snack Bar
  ('snack-bar.view', 'Access Snack Bar module', 'snack-bar'),
  ('snack-bar.manage', 'Full management of Snack Bar', 'snack-bar'),
  ('snack-bar.orders.view', 'View snack bar orders', 'snack-bar'),
  ('snack-bar.orders.manage', 'Manage snack bar orders', 'snack-bar'),

  -- Admin
  ('admin.view', 'Access Admin Dashboard', 'admin'),
  ('admin.users.manage', 'Manage Users', 'admin'),
  ('admin.roles.manage', 'Manage Roles & Permissions', 'admin'),
  ('admin.settings.manage', 'Manage Site Settings', 'admin')
ON CONFLICT (slug) DO NOTHING;
