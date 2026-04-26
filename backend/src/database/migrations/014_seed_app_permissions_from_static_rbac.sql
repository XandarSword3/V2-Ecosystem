-- Migration: Seed app_permissions/app_role_permissions from static RBAC definitions
-- Phase 3: Dynamic RBAC activation

CREATE TABLE IF NOT EXISTS app_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    module_slug VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) NOT NULL,
    permission_slug VARCHAR(255) NOT NULL REFERENCES app_permissions(slug) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_name, permission_slug)
);

-- Permission universe from security/permissions.ts (static bootstrap)
INSERT INTO app_permissions (slug, description, module_slug)
VALUES
('user:read:self', 'Seeded from static permissions.ts', NULL),
('user:update:self', 'Seeded from static permissions.ts', NULL),
('user:read:any', 'Seeded from static permissions.ts', NULL),
('user:update:any', 'Seeded from static permissions.ts', NULL),
('user:delete:any', 'Seeded from static permissions.ts', NULL),
('user:manage:roles', 'Seeded from static permissions.ts', NULL),
('restaurant:menu:read', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:menu:write', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:order:create', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:order:read:own', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:order:read:all', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:order:update', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:category:manage', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:table:manage', 'Seeded from static permissions.ts', 'restaurant'),
('restaurant:stats:read', 'Seeded from static permissions.ts', 'restaurant'),
('chalet:read', 'Seeded from static permissions.ts', 'chalets'),
('chalet:write', 'Seeded from static permissions.ts', 'chalets'),
('chalet:booking:create', 'Seeded from static permissions.ts', 'chalets'),
('chalet:booking:read:own', 'Seeded from static permissions.ts', 'chalets'),
('chalet:booking:read:all', 'Seeded from static permissions.ts', 'chalets'),
('chalet:booking:update', 'Seeded from static permissions.ts', 'chalets'),
('chalet:booking:cancel', 'Seeded from static permissions.ts', 'chalets'),
('chalet:pricing:manage', 'Seeded from static permissions.ts', 'chalets'),
('chalet:stats:read', 'Seeded from static permissions.ts', 'chalets'),
('pool:session:read', 'Seeded from static permissions.ts', 'pool'),
('pool:session:manage', 'Seeded from static permissions.ts', 'pool'),
('pool:ticket:create', 'Seeded from static permissions.ts', 'pool'),
('pool:ticket:read:own', 'Seeded from static permissions.ts', 'pool'),
('pool:ticket:read:all', 'Seeded from static permissions.ts', 'pool'),
('pool:ticket:validate', 'Seeded from static permissions.ts', 'pool'),
('pool:stats:read', 'Seeded from static permissions.ts', 'pool'),
('snack:menu:read', 'Seeded from static permissions.ts', 'snack'),
('snack:menu:write', 'Seeded from static permissions.ts', 'snack'),
('snack:order:create', 'Seeded from static permissions.ts', 'snack'),
('snack:order:read:all', 'Seeded from static permissions.ts', 'snack'),
('snack:order:update', 'Seeded from static permissions.ts', 'snack'),
('payment:create', 'Seeded from static permissions.ts', 'payments'),
('payment:read:own', 'Seeded from static permissions.ts', 'payments'),
('payment:read:all', 'Seeded from static permissions.ts', 'payments'),
('payment:refund', 'Seeded from static permissions.ts', 'payments'),
('payment:record:cash', 'Seeded from static permissions.ts', 'payments'),
('loyalty:read:self', 'Seeded from static permissions.ts', 'loyalty'),
('loyalty:read:any', 'Seeded from static permissions.ts', 'loyalty'),
('loyalty:earn', 'Seeded from static permissions.ts', 'loyalty'),
('loyalty:redeem', 'Seeded from static permissions.ts', 'loyalty'),
('loyalty:adjust', 'Seeded from static permissions.ts', 'loyalty'),
('loyalty:settings:manage', 'Seeded from static permissions.ts', 'loyalty'),
('giftcard:purchase', 'Seeded from static permissions.ts', 'giftcards'),
('giftcard:redeem', 'Seeded from static permissions.ts', 'giftcards'),
('giftcard:manage', 'Seeded from static permissions.ts', 'giftcards'),
('coupon:use', 'Seeded from static permissions.ts', 'coupons'),
('coupon:manage', 'Seeded from static permissions.ts', 'coupons'),
('support:ticket:create', 'Seeded from static permissions.ts', 'support'),
('support:ticket:read:own', 'Seeded from static permissions.ts', 'support'),
('support:ticket:read:all', 'Seeded from static permissions.ts', 'support'),
('support:ticket:respond', 'Seeded from static permissions.ts', 'support'),
('review:create', 'Seeded from static permissions.ts', 'reviews'),
('review:read', 'Seeded from static permissions.ts', 'reviews'),
('review:moderate', 'Seeded from static permissions.ts', 'reviews'),
('housekeeping:task:read', 'Seeded from static permissions.ts', 'housekeeping'),
('housekeeping:task:update', 'Seeded from static permissions.ts', 'housekeeping'),
('housekeeping:task:manage', 'Seeded from static permissions.ts', 'housekeeping'),
('inventory:read', 'Seeded from static permissions.ts', 'inventory'),
('inventory:update', 'Seeded from static permissions.ts', 'inventory'),
('inventory:manage', 'Seeded from static permissions.ts', 'inventory'),
('admin:dashboard:read', 'Seeded from static permissions.ts', 'admin'),
('admin:settings:manage', 'Seeded from static permissions.ts', 'admin'),
('admin:modules:manage', 'Seeded from static permissions.ts', 'admin'),
('admin:cms:manage', 'Seeded from static permissions.ts', 'admin'),
('admin:reports:read', 'Seeded from static permissions.ts', 'admin'),
('admin:audit:read', 'Seeded from static permissions.ts', 'admin'),
('device:register', 'Seeded from static permissions.ts', NULL),
('notification:send', 'Seeded from static permissions.ts', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Backfill role mappings from any existing role_permissions bridge when available.
INSERT INTO app_role_permissions (role_name, permission_slug)
SELECT r.name, p.slug
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.slug IS NOT NULL
ON CONFLICT (role_name, permission_slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
