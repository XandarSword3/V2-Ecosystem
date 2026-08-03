-- Ensure Roles Exist for Admin Creation Fix
INSERT INTO roles (name, display_name, description) VALUES 
('admin', 'Administrator', 'Full access to system'),
('staff', 'Staff', 'Access to POS and assigned modules'),
('customer', 'Customer', 'Default user role')
ON CONFLICT (name) DO NOTHING;

-- Seed default permissions
INSERT INTO permissions (slug, name, description, resource, action) VALUES
('inventory_manage', 'Manage Inventory', 'Create/Edit inventory', 'inventory', 'manage'),
('housekeeping_manage', 'Manage Housekeeping', 'Assign tasks', 'housekeeping', 'manage'),
('reports_view', 'View Reports', 'Access revenue reports', 'reports', 'view')
ON CONFLICT (slug) DO NOTHING;
