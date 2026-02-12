-- Migration: 008_comprehensive_fix
-- Description: Implements schemas for Menu Modifiers, Cash Management, Waitlist, and User Enhancements
-- Date: 2026-01-28

-- ==========================================
-- 1. MENU MODIFIERS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.menu_modifier_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    min_selection INTEGER DEFAULT 0,
    max_selection INTEGER DEFAULT 1,
    required BOOLEAN DEFAULT false,
    multi_select BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_modifier_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_item_modifiers (
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    is_required_override BOOLEAN, -- Optional override
    PRIMARY KEY (menu_item_id, modifier_group_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON public.menu_modifier_options(group_id);
CREATE INDEX IF NOT EXISTS idx_item_modifiers_item ON public.menu_item_modifiers(menu_item_id);

-- ==========================================
-- 2. CASH MANAGEMENT (POS)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.cash_drawers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    station_id TEXT DEFAULT 'main',
    start_amount DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) NOT NULL,
    expected_amount DECIMAL(10,2), -- Calculated from sales
    actual_amount DECIMAL(10,2),   -- Entered at close
    status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    closing_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drawer_id UUID NOT NULL REFERENCES public.cash_drawers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.restaurant_orders(id),
    type TEXT CHECK (type IN ('sale', 'refund', 'drop', 'payout', 'open', 'close')) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    performed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. WAITLIST SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    party_size INTEGER NOT NULL,
    type TEXT CHECK (type IN ('restaurant', 'pool')) NOT NULL,
    status TEXT CHECK (status IN ('waiting', 'notified', 'seated', 'cancelled', 'expired')) DEFAULT 'waiting',
    quoted_wait_time INTEGER, -- Minutes
    notified_at TIMESTAMPTZ,
    seated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist_entries(status);

-- ==========================================
-- 4. USER ENHANCEMENTS & SECURITY
-- ==========================================

-- Add 2FA and Bookmarks columns to users if they don't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bookmarks JSONB DEFAULT '[]'::jsonb;

-- Track failed logins for security
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address TEXT NOT NULL,
    email TEXT,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. MENU & ORDER ENHANCEMENTS
-- ==========================================

-- Support multiple images and scheduling
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS availability_schedule JSONB DEFAULT NULL; 
-- Example: {"monday": {"start": "09:00", "end": "11:00"}, ...}

-- Support coupon stacking
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS applied_coupons JSONB DEFAULT '[]'::jsonb;

-- ==========================================
-- 6. PERMISSIONS & RLS
-- ==========================================

-- Create permissions for new modules
INSERT INTO public.app_permissions (slug, description, module_slug) VALUES
('modifiers:view', 'View Menu Modifiers', 'restaurant'),
('modifiers:manage', 'Manage Menu Modifiers', 'restaurant'),
('cash:view', 'View Cash Drawers', 'finance'),
('cash:manage', 'Manage Cash Drawers', 'finance'),
('waitlist:view', 'View Waitlist', 'restaurant'),
('waitlist:manage', 'Manage Waitlist', 'restaurant')
ON CONFLICT (slug) DO NOTHING;

-- Assign to super_admin
INSERT INTO public.app_role_permissions (role_name, permission_slug)
SELECT 'super_admin', slug FROM public.app_permissions 
WHERE slug IN ('modifiers:manage', 'cash:manage', 'waitlist:manage')
ON CONFLICT DO NOTHING;

-- Enable RLS (Row Level Security) - Basic Policies
ALTER TABLE public.menu_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_drawers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Public Read for Menu Modifiers (Everyone can see the menu)
DROP POLICY IF EXISTS "Public modifiers read" ON public.menu_modifier_groups;
CREATE POLICY "Public modifiers read" ON public.menu_modifier_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public options read" ON public.menu_modifier_options;
CREATE POLICY "Public options read" ON public.menu_modifier_options FOR SELECT USING (true);

-- Admin Manage for Modifiers
DROP POLICY IF EXISTS "Admin modifiers manage" ON public.menu_modifier_groups;
CREATE POLICY "Admin modifiers manage" ON public.menu_modifier_groups 
FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'manager'))));

-- Notify completion
NOTIFY pgrst, 'reload schema';
