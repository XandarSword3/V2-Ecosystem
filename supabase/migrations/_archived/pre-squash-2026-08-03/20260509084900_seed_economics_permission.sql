-- Seed economics:read into the correct app_permissions / app_role_permissions tables
-- The permission cache reads app_permissions and app_role_permissions (not permissions/role_permissions)
-- app_permissions schema: slug, description, module_slug

INSERT INTO app_permissions (slug, description, module_slug)
VALUES ('economics:read', 'View Economics Reporting', 'economics')
ON CONFLICT (slug) DO NOTHING;

-- Grant to super_admin and manager roles
INSERT INTO app_role_permissions (role_name, permission_slug)
VALUES 
  ('super_admin', 'economics:read'),
  ('manager', 'economics:read')
ON CONFLICT DO NOTHING;
