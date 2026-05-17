-- Module Templates System
-- Pre-built layouts for each engine type to accelerate module creation

CREATE TABLE IF NOT EXISTS module_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    engine_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    thumbnail_url TEXT,
    layout JSONB NOT NULL DEFAULT '[]',
    default_settings JSONB NOT NULL DEFAULT '{}',
    seed_data JSONB DEFAULT NULL,
    is_official BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_templates_engine ON module_templates(engine_type);
CREATE INDEX IF NOT EXISTS idx_module_templates_category ON module_templates(category);
CREATE INDEX IF NOT EXISTS idx_module_templates_active ON module_templates(is_active) WHERE is_active = true;

ALTER TABLE module_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY module_templates_read ON module_templates FOR SELECT USING (is_active = true);
CREATE POLICY module_templates_admin_write ON module_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

-- Seed official templates for each engine type

INSERT INTO module_templates (name, description, engine_type, category, is_official, layout, default_settings, seed_data) VALUES
-- Restaurant (instant_transaction)
(
    'Classic Restaurant',
    'Full-featured restaurant module with menu categories, ordering, and kitchen display.',
    'instant_transaction',
    'food_beverage',
    true,
    '[
        {"id":"hero-1","type":"hero_v2","label":"Restaurant Hero","props":{"eyebrow":"WELCOME TO","title":"Our Restaurant","subtitle":"Fresh ingredients, exceptional flavors","primaryButton":"View Menu","align":"center"},"style":{"width":"100%"}},
        {"id":"grid-1","type":"grid","label":"Menu Grid","props":{"columns":"3","dataSource":"menu","title":"Our Menu"},"style":{"width":"100%"},"children":[]},
        {"id":"cta-1","type":"cta","label":"Order CTA","props":{"title":"Ready to Order?","buttonText":"Place Order","align":"center"},"style":{"width":"100%"}}
    ]'::jsonb,
    '{"show_in_nav": true, "allow_ordering": true, "kitchen_display": true, "accept_tips": true}'::jsonb,
    '{"menu_categories": ["Appetizers", "Main Course", "Desserts", "Beverages"]}'::jsonb
),

-- Hotel/Chalet (time_exclusive_reservation)
(
    'Boutique Hotel',
    'Elegant hotel booking module with room gallery, availability calendar, and guest services.',
    'time_exclusive_reservation',
    'accommodation',
    true,
    '[
        {"id":"hero-1","type":"hero_v2","label":"Hotel Hero","props":{"eyebrow":"LUXURY STAY","title":"Your Perfect Getaway","subtitle":"Experience comfort and elegance","primaryButton":"Book Now","align":"center"},"style":{"width":"100%"}},
        {"id":"calendar-1","type":"calendar","label":"Availability","props":{"title":"Check Availability"},"style":{"width":"100%"}},
        {"id":"features-1","type":"features","label":"Amenities","props":{"title":"Room Amenities","features":"[{\"icon\":\"Wifi\",\"title\":\"Free Wi-Fi\",\"description\":\"High-speed internet\"},{\"icon\":\"Coffee\",\"title\":\"Mini Bar\",\"description\":\"Complimentary refreshments\"},{\"icon\":\"Tv\",\"title\":\"Smart TV\",\"description\":\"Streaming services included\"}]"},"style":{"width":"100%"}},
        {"id":"testimonials-1","type":"testimonials_carousel","label":"Guest Reviews","props":{"title":"What Our Guests Say","subtitle":"REVIEWS"},"style":{"width":"100%"}}
    ]'::jsonb,
    '{"show_in_nav": true, "check_in_time": "15:00", "check_out_time": "11:00", "require_deposit": true, "deposit_percentage": 30}'::jsonb,
    '{"room_types": ["Standard", "Deluxe", "Suite", "Presidential"]}'::jsonb
),

-- Pool/Day Pass (shared_capacity_access)
(
    'Day Access Pass',
    'Capacity-managed day pass system for pools, parks, or attractions with real-time availability.',
    'shared_capacity_access',
    'recreation',
    true,
    '[
        {"id":"hero-1","type":"hero_v2","label":"Pool Hero","props":{"eyebrow":"SUN & SWIM","title":"Pool & Beach Access","subtitle":"Reserve your spot under the sun","primaryButton":"Get Tickets","align":"center"},"style":{"width":"100%"}},
        {"id":"stats-1","type":"stats","label":"Availability","props":{"title":"Today''s Status","stats":"[{\"value\":\"Open\",\"label\":\"Status\",\"icon\":\"CheckCircle\"},{\"value\":\"85\",\"label\":\"Spots Left\",\"icon\":\"Users\"},{\"value\":\"9-6PM\",\"label\":\"Hours\",\"icon\":\"Clock\"}]"},"style":{"width":"100%"}},
        {"id":"pricing-1","type":"pricing_table","label":"Pricing","props":{"title":"Ticket Options","plans":"[{\"name\":\"Adult\",\"price\":\"$25\",\"features\":[\"Full day access\",\"Locker included\",\"Towel provided\"]},{\"name\":\"Child\",\"price\":\"$15\",\"features\":[\"Full day access\",\"Kids area\"],\"popular\":false},{\"name\":\"VIP\",\"price\":\"$50\",\"features\":[\"Full day access\",\"Private cabana\",\"Complimentary drinks\"],\"popular\":true}]"},"style":{"width":"100%"}}
    ]'::jsonb,
    '{"show_in_nav": true, "max_capacity": 100, "require_date_selection": true, "allow_walk_in": true}'::jsonb,
    '{"ticket_types": ["Adult", "Child", "Senior", "VIP"]}'::jsonb
),

-- Membership/Subscription (ongoing_entitlement)
(
    'Membership Club',
    'Subscription management with tiered plans, member benefits, and renewal tracking.',
    'ongoing_entitlement',
    'membership',
    true,
    '[
        {"id":"hero-1","type":"hero_v2","label":"Membership Hero","props":{"eyebrow":"JOIN US","title":"Become a Member","subtitle":"Unlock exclusive benefits and savings","primaryButton":"Join Now","align":"center"},"style":{"width":"100%"}},
        {"id":"pricing-1","type":"pricing_table","label":"Plans","props":{"title":"Membership Plans","plans":"[{\"name\":\"Bronze\",\"price\":\"$29/mo\",\"features\":[\"Basic access\",\"1 guest pass/month\"]},{\"name\":\"Silver\",\"price\":\"$59/mo\",\"features\":[\"Full access\",\"3 guest passes/month\",\"10% dining discount\"],\"popular\":true},{\"name\":\"Gold\",\"price\":\"$99/mo\",\"features\":[\"VIP access\",\"Unlimited guests\",\"20% discount on all\",\"Priority booking\"]}]"},"style":{"width":"100%"}},
        {"id":"features-1","type":"features","label":"Benefits","props":{"title":"Member Benefits","features":"[{\"icon\":\"Star\",\"title\":\"Exclusive Access\",\"description\":\"Priority entry to all facilities\"},{\"icon\":\"Gift\",\"title\":\"Member Rewards\",\"description\":\"Earn points on every visit\"},{\"icon\":\"Calendar\",\"title\":\"Flexible Plans\",\"description\":\"Cancel anytime\"}]"},"style":{"width":"100%"}},
        {"id":"cta-1","type":"cta","label":"Join CTA","props":{"title":"Ready to Join?","buttonText":"Start Membership","align":"center"},"style":{"width":"100%"}}
    ]'::jsonb,
    '{"show_in_nav": true, "auto_renew": true, "trial_days": 7, "loyalty_enabled": true}'::jsonb,
    '{"tiers": ["Bronze", "Silver", "Gold", "Platinum"]}'::jsonb
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE module_templates IS 'Pre-built module layouts and configurations for rapid module creation';
