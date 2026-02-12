-- =============================================
-- Gap Remediation Migration
-- Covers: Menu Modifiers, Cash Drawer (POS), Waitlist, and 2FA
-- =============================================

-- 1. Menu Modifiers
CREATE TABLE IF NOT EXISTS menu_modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS menu_modifier_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id UUID REFERENCES menu_modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS menu_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    modifier_group_id UUID REFERENCES menu_modifier_groups(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(menu_item_id, modifier_group_id)
);

-- 2. Cash Drawer (POS & Finance)
CREATE TABLE IF NOT EXISTS cash_drawers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT,
    opened_by_user_id UUID REFERENCES users(id),
    closed_by_user_id UUID REFERENCES users(id),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    starting_balance DECIMAL(10,2) DEFAULT 0,
    current_balance DECIMAL(10,2) DEFAULT 0,
    ending_balance DECIMAL(10,2),
    discrepancy DECIMAL(10,2),
    status TEXT DEFAULT 'open', -- open, closed
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawer_id UUID REFERENCES cash_drawers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    order_id UUID, -- Optional link to order
    type TEXT NOT NULL, -- sale, refund, pay_in, pay_out
    amount DECIMAL(10,2) NOT NULL,
    reason_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Waitlist
CREATE TABLE IF NOT EXISTS waitlist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id),
    customer_name TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    phone_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'waiting', -- waiting, seated, cancelled, no_show
    estimated_wait_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    seated_at TIMESTAMPTZ
);

-- 4. User Enhancements for 2FA
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'two_factor_enabled') THEN
        ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'two_factor_secret') THEN
        ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'backup_codes') THEN
        ALTER TABLE users ADD COLUMN backup_codes JSONB; -- Store as JSON array
    END IF;
    
    -- New tables for 2FA pending setups if not exists (Service relied on this)
    CREATE TABLE IF NOT EXISTS two_factor_pending (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        secret TEXT NOT NULL,
        backup_codes JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS two_factor_auth (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        secret TEXT NOT NULL,
        backup_codes JSONB,
        enabled_at TIMESTAMPTZ DEFAULT NOW()
    );

END $$;

-- 5. RLS Policies (Basic Open Access for Demo/Admin, refine in prod)
ALTER TABLE menu_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawers ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_auth ENABLE ROW LEVEL SECURITY;

-- Simple policies to allow all access for demo
CREATE POLICY "gap_rem_modifiers_all" ON menu_modifier_groups FOR ALL USING (true);
CREATE POLICY "gap_rem_options_all" ON menu_modifier_options FOR ALL USING (true);
CREATE POLICY "gap_rem_cash_all" ON cash_drawers FOR ALL USING (true);
CREATE POLICY "gap_rem_cash_tx_all" ON cash_transactions FOR ALL USING (true);
CREATE POLICY "gap_rem_waitlist_all" ON waitlist_entries FOR ALL USING (true);
CREATE POLICY "gap_rem_2fa_all" ON two_factor_auth FOR ALL USING (true);

