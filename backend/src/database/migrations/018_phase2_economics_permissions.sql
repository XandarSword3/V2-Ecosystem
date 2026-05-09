-- Insert the permission
INSERT INTO permissions (slug, name, resource, action)
VALUES ('economics:read', 'View Economics', 'economics', 'read')
ON CONFLICT (slug) DO NOTHING;

-- Grant to super_admin and manager roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p
WHERE r.name IN ('super_admin', 'manager')
AND p.slug = 'economics:read'
ON CONFLICT DO NOTHING;
