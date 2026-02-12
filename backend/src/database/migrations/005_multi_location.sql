-- Multi-Location/Property Hierarchy Support
-- Run this migration to add multi-property management

-- Property groups (for chains/management companies)
CREATE TABLE IF NOT EXISTS property_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties update (add group relationship)
ALTER TABLE properties 
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES property_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS property_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS property_type VARCHAR(50) DEFAULT 'hotel', -- hotel, resort, spa, restaurant, etc
    ADD COLUMN IF NOT EXISTS star_rating DECIMAL(2, 1),
    ADD COLUMN IF NOT EXISTS chain_brand VARCHAR(100),
    ADD COLUMN IF NOT EXISTS gds_codes JSONB DEFAULT '{}', -- Sabre, Amadeus, etc
    ADD COLUMN IF NOT EXISTS is_headquarters BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_group ON properties(group_id);
CREATE INDEX IF NOT EXISTS idx_properties_code ON properties(property_code);

-- User property access (which properties a user can access)
CREATE TABLE IF NOT EXISTS user_property_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    access_level VARCHAR(50) NOT NULL DEFAULT 'read', -- read, write, manage, admin
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_primary BOOLEAN DEFAULT false, -- User's primary/default property
    UNIQUE(user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_user_property_user ON user_property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_property_property ON user_property_access(property_id);

-- User group access (access to all properties in a group)
CREATE TABLE IF NOT EXISTS user_group_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES property_groups(id) ON DELETE CASCADE,
    access_level VARCHAR(50) NOT NULL DEFAULT 'read',
    role_in_group VARCHAR(50), -- regional_manager, corporate_admin, etc
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_group_user ON user_group_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_group ON user_group_access(group_id);

-- Cross-property inventory sharing
CREATE TABLE IF NOT EXISTS shared_inventory_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES property_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    room_type VARCHAR(100), -- Standard, Deluxe, Suite, etc (normalized type)
    participating_properties UUID[], -- Array of property IDs
    allocation_method VARCHAR(50) DEFAULT 'proportional', -- proportional, fixed, dynamic
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-property rate templates
CREATE TABLE IF NOT EXISTS group_rate_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES property_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_rate_type VARCHAR(50) DEFAULT 'percentage', -- percentage, fixed
    base_rate_value DECIMAL(10, 2),
    applies_to_properties UUID[], -- NULL = all properties in group
    seasonal_adjustments JSONB, -- Date ranges with multipliers
    day_of_week_adjustments JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consolidated reporting views
CREATE TABLE IF NOT EXISTS group_report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES property_groups(id) ON DELETE CASCADE,
    report_type VARCHAR(100) NOT NULL, -- daily_summary, weekly_performance, monthly_revenue
    report_name VARCHAR(255) NOT NULL,
    include_properties UUID[], -- NULL = all
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly
    schedule_time TIME DEFAULT '08:00',
    schedule_day_of_week INTEGER, -- 0-6, NULL for daily
    schedule_day_of_month INTEGER, -- 1-31, NULL for non-monthly
    recipients TEXT[],
    format VARCHAR(20) DEFAULT 'pdf', -- pdf, excel, csv
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property performance comparisons
CREATE TABLE IF NOT EXISTS property_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES property_groups(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metric VARCHAR(100) NOT NULL, -- revpar, adr, occupancy, revenue
    value DECIMAL(15, 2) NOT NULL,
    group_average DECIMAL(15, 2),
    group_rank INTEGER,
    yoy_change DECIMAL(5, 2), -- Year over year percentage change
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, period_start, period_end, metric)
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_property ON property_benchmarks(property_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_period ON property_benchmarks(period_start, period_end);

-- RLS Policies
ALTER TABLE property_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_property_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_inventory_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_rate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_benchmarks ENABLE ROW LEVEL SECURITY;

-- Function to check user's property access
CREATE OR REPLACE FUNCTION user_has_property_access(user_uuid UUID, property_uuid UUID, required_level VARCHAR DEFAULT 'read')
RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN;
    user_role VARCHAR;
BEGIN
    -- Check if super_admin (has access to everything)
    SELECT role INTO user_role FROM users WHERE id = user_uuid;
    IF user_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- Check direct property access
    SELECT EXISTS (
        SELECT 1 FROM user_property_access upa
        WHERE upa.user_id = user_uuid
        AND upa.property_id = property_uuid
        AND (upa.expires_at IS NULL OR upa.expires_at > NOW())
        AND (
            upa.access_level = required_level
            OR upa.access_level = 'admin'
            OR (required_level = 'read' AND upa.access_level IN ('write', 'manage'))
            OR (required_level = 'write' AND upa.access_level = 'manage')
        )
    ) INTO has_access;
    
    IF has_access THEN
        RETURN TRUE;
    END IF;

    -- Check group-level access
    SELECT EXISTS (
        SELECT 1 FROM user_group_access uga
        JOIN properties p ON p.group_id = uga.group_id
        WHERE uga.user_id = user_uuid
        AND p.id = property_uuid
        AND (uga.expires_at IS NULL OR uga.expires_at > NOW())
    ) INTO has_access;

    RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies using the access function
CREATE POLICY "Users can access authorized properties" ON properties
    FOR SELECT USING (
        user_has_property_access(auth.uid(), id, 'read')
        OR NOT EXISTS (SELECT 1 FROM user_property_access) -- Allow if no access control set up
    );

CREATE POLICY "Users can access property groups they belong to" ON property_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_group_access uga
            WHERE uga.user_id = auth.uid()
            AND uga.group_id = property_groups.id
        )
        OR EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
        )
    );

CREATE POLICY "Users can view their own property access" ON user_property_access
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can manage property access" ON user_property_access
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to shared inventory pools" ON shared_inventory_pools
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_group_access uga
            WHERE uga.user_id = auth.uid()
            AND uga.group_id = shared_inventory_pools.group_id
            AND uga.access_level IN ('manage', 'admin')
        )
    );

CREATE POLICY "Admin access to group rate templates" ON group_rate_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_group_access uga
            WHERE uga.user_id = auth.uid()
            AND uga.group_id = group_rate_templates.group_id
            AND uga.access_level IN ('manage', 'admin')
        )
    );

-- Triggers
CREATE TRIGGER update_property_groups_timestamp
    BEFORE UPDATE ON property_groups
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();

CREATE TRIGGER update_shared_inventory_timestamp
    BEFORE UPDATE ON shared_inventory_pools
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();

CREATE TRIGGER update_group_rate_templates_timestamp
    BEFORE UPDATE ON group_rate_templates
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();
