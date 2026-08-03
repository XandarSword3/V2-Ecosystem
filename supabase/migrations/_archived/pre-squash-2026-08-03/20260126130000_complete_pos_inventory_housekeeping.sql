-- Complete POS, Inventory, Housekeeping System
-- Migration: 20260126130000_complete_pos_inventory_housekeeping.sql

-- ============================================
-- 1. POS / TAB SYSTEM
-- ============================================

-- restaurant_tabs removed (legacy: referenced restaurant_tables)

-- Payment splits (linked to transactions)
CREATE TABLE IF NOT EXISTS order_payment_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_payment_intent_id VARCHAR(255),
    gift_card_id UUID REFERENCES gift_cards(id),
    loyalty_points_used INT DEFAULT 0,
    payer_name VARCHAR(100),
    payer_seat INT,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Close of day reconciliation
CREATE TABLE IF NOT EXISTS pos_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_date DATE NOT NULL,
    shift_type VARCHAR(20) DEFAULT 'full_day', -- 'morning', 'evening', 'full_day'
    opened_by UUID REFERENCES users(id),
    closed_by UUID REFERENCES users(id),
    
    -- Cash drawer
    cash_opening DECIMAL(10,2) DEFAULT 0,
    cash_closing DECIMAL(10,2),
    cash_expected DECIMAL(10,2),
    cash_variance DECIMAL(10,2),
    
    -- Totals
    total_sales DECIMAL(10,2) DEFAULT 0,
    total_cash DECIMAL(10,2) DEFAULT 0,
    total_card DECIMAL(10,2) DEFAULT 0,
    total_gift_card DECIMAL(10,2) DEFAULT 0,
    total_loyalty DECIMAL(10,2) DEFAULT 0,
    total_refunds DECIMAL(10,2) DEFAULT 0,
    total_discounts DECIMAL(10,2) DEFAULT 0,
    total_tips DECIMAL(10,2) DEFAULT 0,
    
    -- Order counts
    orders_count INT DEFAULT 0,
    void_count INT DEFAULT 0,
    refund_count INT DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'pending_review', 'closed', 'disputed')),
    notes TEXT,
    variance_explanation TEXT,
    
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. INVENTORY SYSTEM - FIFO/LIFO & Variance
-- ============================================

-- Stock batches for FIFO/LIFO
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id),
    batch_number VARCHAR(50),
    quantity DECIMAL(10,4) NOT NULL,
    remaining_quantity DECIMAL(10,4) NOT NULL,
    cost_per_unit DECIMAL(10,4),
    supplier_id UUID,
    purchase_order_id UUID,
    received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE,
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired', 'disposed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wastage tracking
CREATE TABLE IF NOT EXISTS inventory_wastage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id),
    batch_id UUID REFERENCES inventory_batches(id),
    quantity DECIMAL(10,4) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('expired', 'spoiled', 'damaged', 'preparation_error', 'theft', 'other')),
    notes TEXT,
    photo_url TEXT,
    cost_impact DECIMAL(10,2),
    reported_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Variance tracking
CREATE TABLE IF NOT EXISTS inventory_variance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id),
    count_date DATE NOT NULL,
    system_quantity DECIMAL(10,4) NOT NULL,
    actual_quantity DECIMAL(10,4) NOT NULL,
    variance_quantity DECIMAL(10,4) NOT NULL, -- actual - system
    variance_percentage DECIMAL(5,2),
    variance_cost DECIMAL(10,2),
    reason TEXT,
    counted_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'investigated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    payment_terms VARCHAR(100),
    lead_time_days INT DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase orders
CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES inventory_suppliers(id),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'received', 'cancelled')),
    total_amount DECIMAL(10,2),
    expected_delivery DATE,
    received_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    quantity_ordered DECIMAL(10,4) NOT NULL,
    quantity_received DECIMAL(10,4) DEFAULT 0,
    unit_cost DECIMAL(10,4),
    total_cost DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. HOUSEKEEPING - STATE MACHINE & SLA
-- ============================================

-- Unit/Room states
ALTER TABLE accommodation_units ADD COLUMN IF NOT EXISTS clean_state VARCHAR(30) DEFAULT 'clean' CHECK (clean_state IN ('clean', 'dirty', 'cleaning', 'inspected', 'out_of_service', 'blocked'));
ALTER TABLE accommodation_units ADD COLUMN IF NOT EXISTS last_cleaned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE accommodation_units ADD COLUMN IF NOT EXISTS last_inspected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE accommodation_units ADD COLUMN IF NOT EXISTS maintenance_notes TEXT;

-- SLA configuration
CREATE TABLE IF NOT EXISTS housekeeping_sla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    max_duration_minutes INT NOT NULL,
    warning_threshold_minutes INT,
    escalation_after_minutes INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default SLAs
INSERT INTO housekeeping_sla (task_type, priority, max_duration_minutes, warning_threshold_minutes, escalation_after_minutes) VALUES
('checkout_clean', 'high', 60, 45, 75),
('checkout_clean', 'urgent', 45, 30, 60),
('stayover_clean', 'normal', 30, 20, 45),
('deep_clean', 'low', 120, 90, 150),
('inspection', 'high', 15, 10, 20)
ON CONFLICT DO NOTHING;

-- Task SLA tracking
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT FALSE;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS sla_breach_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS escalated_to UUID REFERENCES users(id);
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;

-- Inspection results
CREATE TABLE IF NOT EXISTS housekeeping_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES housekeeping_tasks(id),
    unit_id UUID REFERENCES accommodation_units(id),
    inspector_id UUID REFERENCES users(id),
    passed BOOLEAN NOT NULL,
    score INT CHECK (score >= 0 AND score <= 100),
    checklist_results JSONB, -- {"bathroom": true, "bedroom": true, "kitchen": false}
    photos JSONB, -- Array of photo URLs
    issues_found TEXT,
    reinspection_required BOOLEAN DEFAULT FALSE,
    inspected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. COUPONS - STACKING & ABUSE PREVENTION
-- ============================================

-- Extend coupons table
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT FALSE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS stack_priority INT DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_user_limit INT DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN DEFAULT FALSE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_items INT DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS eligible_tiers TEXT[]; -- Loyalty tiers
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS excluded_items UUID[]; -- Menu item IDs
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS category_scope TEXT; -- 'all', 'category:uuid', 'item:uuid'
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS service_scope TEXT DEFAULT 'all'; -- 'all', 'restaurant', 'booking'

-- Coupon usage tracking (for abuse prevention)
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    user_id UUID REFERENCES users(id),
    order_id UUID,
    discount_applied DECIMAL(10,2),
    ip_address INET,
    device_fingerprint VARCHAR(255),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'coupon_usage'
    ) THEN
        ALTER TABLE coupon_usage ADD COLUMN IF NOT EXISTS ip_address INET;
        ALTER TABLE coupon_usage ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_ip ON coupon_usage(coupon_id, ip_address);

-- ============================================
-- 5. GIFT CARDS - LIABILITY ACCOUNTING
-- ============================================

ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS liability_recorded BOOLEAN DEFAULT FALSE;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS revenue_recognized DECIMAL(10,2) DEFAULT 0;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS breakage_recorded DECIMAL(10,2) DEFAULT 0;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS is_physical BOOLEAN DEFAULT FALSE;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;

-- Gift card liability ledger
CREATE TABLE IF NOT EXISTS gift_card_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id UUID NOT NULL REFERENCES gift_cards(id),
    entry_type VARCHAR(30) NOT NULL CHECK (entry_type IN ('issued', 'redeemed', 'refund', 'expired', 'breakage', 'adjustment')),
    amount DECIMAL(10,2) NOT NULL,
    liability_change DECIMAL(10,2) NOT NULL, -- Positive = increase liability, Negative = decrease
    revenue_change DECIMAL(10,2) DEFAULT 0,
    balance_after DECIMAL(10,2) NOT NULL,
    reference_id UUID, -- Order ID, etc.
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. LOYALTY - EXPIRY & ANTI-GAMING
-- ============================================

ALTER TABLE loyalty_profiles ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE loyalty_profiles ADD COLUMN IF NOT EXISTS points_expiring_soon INT DEFAULT 0;
ALTER TABLE loyalty_profiles ADD COLUMN IF NOT EXISTS next_expiry_date DATE;
ALTER TABLE loyalty_profiles ADD COLUMN IF NOT EXISTS tier_progress_points INT DEFAULT 0;
ALTER TABLE loyalty_profiles ADD COLUMN IF NOT EXISTS tier_qualifying_spend DECIMAL(10,2) DEFAULT 0;

-- Loyalty point expiry tracking
CREATE TABLE IF NOT EXISTS loyalty_point_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    points INT NOT NULL,
    remaining_points INT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(50) NOT NULL, -- 'order', 'bonus', 'referral', 'promotion'
    source_id UUID,
    is_expired BOOLEAN DEFAULT FALSE,
    expired_at TIMESTAMP WITH TIME ZONE
);

-- Anti-gaming: Track suspicious activity
CREATE TABLE IF NOT EXISTS loyalty_fraud_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    flag_type VARCHAR(50) NOT NULL, -- 'rapid_redemption', 'split_orders', 'refund_abuse'
    severity VARCHAR(20) DEFAULT 'warning', -- 'warning', 'suspend', 'ban'
    details JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. REPORTS - AGGREGATION TABLES
-- ============================================

-- Daily sales aggregates (for fast reporting)
CREATE TABLE IF NOT EXISTS report_daily_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    net_revenue DECIMAL(12,2) DEFAULT 0, -- After refunds/discounts
    total_orders INT DEFAULT 0,
    completed_orders INT DEFAULT 0,
    cancelled_orders INT DEFAULT 0,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    total_discounts DECIMAL(10,2) DEFAULT 0,
    total_refunds DECIMAL(10,2) DEFAULT 0,
    total_tips DECIMAL(10,2) DEFAULT 0,
    cash_revenue DECIMAL(10,2) DEFAULT 0,
    card_revenue DECIMAL(10,2) DEFAULT 0,
    gift_card_revenue DECIMAL(10,2) DEFAULT 0,
    loyalty_redemptions DECIMAL(10,2) DEFAULT 0,
    new_customers INT DEFAULT 0,
    returning_customers INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hourly metrics
CREATE TABLE IF NOT EXISTS report_hourly_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    orders_count INT DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    avg_prep_time_minutes INT,
    peak_concurrent_orders INT DEFAULT 0,
    staff_on_duty INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- Product performance
CREATE TABLE IF NOT EXISTS report_product_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    catalog_item_id UUID REFERENCES catalog_items(id),
    quantity_sold INT DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    profit DECIMAL(10,2) DEFAULT 0,
    margin_percentage DECIMAL(5,2),
    waste_quantity DECIMAL(10,2) DEFAULT 0,
    waste_cost DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, catalog_item_id)
);

-- ============================================
-- 8. FUNCTIONS FOR BUSINESS LOGIC
-- ============================================

-- FIFO stock deduction function
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
    p_item_id UUID,
    p_quantity DECIMAL,
    p_reason VARCHAR,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_remaining DECIMAL := p_quantity;
    v_total_cost DECIMAL := 0;
    v_batches_used JSONB := '[]'::JSONB;
BEGIN
    -- Process batches in FIFO order (oldest first)
    FOR v_batch IN 
        SELECT * FROM inventory_batches 
        WHERE item_id = p_item_id 
        AND status = 'active' 
        AND remaining_quantity > 0
        ORDER BY received_date ASC, created_at ASC
    LOOP
        IF v_remaining <= 0 THEN
            EXIT;
        END IF;
        
        DECLARE
            v_deduct DECIMAL := LEAST(v_batch.remaining_quantity, v_remaining);
            v_cost DECIMAL := v_deduct * COALESCE(v_batch.cost_per_unit, 0);
        BEGIN
            -- Update batch
            UPDATE inventory_batches 
            SET remaining_quantity = remaining_quantity - v_deduct,
                status = CASE WHEN remaining_quantity - v_deduct <= 0 THEN 'depleted' ELSE 'active' END
            WHERE id = v_batch.id;
            
            v_remaining := v_remaining - v_deduct;
            v_total_cost := v_total_cost + v_cost;
            v_batches_used := v_batches_used || jsonb_build_object(
                'batch_id', v_batch.id,
                'quantity', v_deduct,
                'cost', v_cost
            );
        END;
    END LOOP;
    
    -- Update item current stock
    UPDATE inventory_items 
    SET current_stock = current_stock - (p_quantity - v_remaining),
        updated_at = NOW()
    WHERE id = p_item_id;
    
    -- Record transaction
    INSERT INTO inventory_transactions (
        item_id, transaction_type, quantity, 
        stock_before, stock_after, 
        reference_type, notes, performed_by, cost_impact
    )
    SELECT p_item_id, 'out', p_quantity - v_remaining,
           current_stock + (p_quantity - v_remaining), current_stock,
           p_reason, 'FIFO deduction', p_user_id, v_total_cost
    FROM inventory_items WHERE id = p_item_id;
    
    RETURN jsonb_build_object(
        'success', v_remaining = 0,
        'deducted', p_quantity - v_remaining,
        'remaining_needed', v_remaining,
        'total_cost', v_total_cost,
        'batches', v_batches_used
    );
END;
$$ LANGUAGE plpgsql;

-- validate_coupon_with_stacking: first-order check now uses transactions table
CREATE OR REPLACE FUNCTION validate_coupon_with_stacking(
    p_code VARCHAR,
    p_user_id UUID,
    p_order_subtotal DECIMAL,
    p_existing_coupons UUID[]
) RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_usage_count INT;
    v_user_usage INT;
    v_is_first_order BOOLEAN;
BEGIN
    SELECT * INTO v_coupon FROM coupons 
    WHERE UPPER(code) = UPPER(p_code) AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon not found');
    END IF;
    
    IF v_coupon.start_date IS NOT NULL AND NOW() < v_coupon.start_date THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon not yet active');
    END IF;
    IF v_coupon.end_date IS NOT NULL AND NOW() > v_coupon.end_date THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon expired');
    END IF;
    
    SELECT COUNT(*) INTO v_usage_count FROM coupon_usage WHERE coupon_id = v_coupon.id;
    IF v_coupon.usage_limit IS NOT NULL AND v_usage_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon usage limit reached');
    END IF;
    
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_user_usage FROM coupon_usage 
        WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
        IF v_coupon.per_user_limit IS NOT NULL AND v_user_usage >= v_coupon.per_user_limit THEN
            RETURN jsonb_build_object('valid', false, 'error', 'You have already used this coupon');
        END IF;
    END IF;
    
    IF v_coupon.min_spend IS NOT NULL AND p_order_subtotal < v_coupon.min_spend THEN
        RETURN jsonb_build_object('valid', false, 'error', 
            format('Minimum spend of %s required', v_coupon.min_spend));
    END IF;
    
    -- First order check uses transactions table
    IF v_coupon.first_order_only AND p_user_id IS NOT NULL THEN
        SELECT NOT EXISTS(
            SELECT 1 FROM transactions
            WHERE customer_id = p_user_id
              AND engine_type = 'instant_transaction'
              AND status = 'completed'
        ) INTO v_is_first_order;
        IF NOT v_is_first_order THEN
            RETURN jsonb_build_object('valid', false, 'error', 'This coupon is for first orders only');
        END IF;
    END IF;
    
    IF array_length(p_existing_coupons, 1) > 0 THEN
        IF NOT v_coupon.stackable THEN
            RETURN jsonb_build_object('valid', false, 'error', 'This coupon cannot be combined with other coupons');
        END IF;
        IF EXISTS(SELECT 1 FROM coupons WHERE id = ANY(p_existing_coupons) AND NOT stackable) THEN
            RETURN jsonb_build_object('valid', false, 'error', 'Cannot add coupon - existing coupon is not stackable');
        END IF;
    END IF;
    
    DECLARE
        v_discount DECIMAL;
    BEGIN
        IF v_coupon.discount_type = 'percentage' THEN
            v_discount := p_order_subtotal * (v_coupon.discount_value / 100);
            IF v_coupon.max_discount IS NOT NULL THEN
                v_discount := LEAST(v_discount, v_coupon.max_discount);
            END IF;
        ELSE
            v_discount := LEAST(v_coupon.discount_value, p_order_subtotal);
        END IF;
        
        RETURN jsonb_build_object(
            'valid', true,
            'coupon_id', v_coupon.id,
            'code', v_coupon.code,
            'discount_type', v_coupon.discount_type,
            'discount_value', v_coupon.discount_value,
            'calculated_discount', v_discount,
            'stackable', v_coupon.stackable,
            'stack_priority', v_coupon.stack_priority
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- Check if unit can be checked into (housekeeping state)
CREATE OR REPLACE FUNCTION can_check_in(p_unit_id UUID) RETURNS JSONB AS $$
DECLARE
    v_unit RECORD;
    v_pending_tasks INT;
BEGIN
    SELECT * INTO v_unit FROM accommodation_units WHERE id = p_unit_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Unit not found');
    END IF;
    
    -- Check clean state
    IF v_unit.clean_state NOT IN ('clean', 'inspected') THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', format('Unit is %s - cannot check in', v_unit.clean_state),
            'clean_state', v_unit.clean_state
        );
    END IF;
    
    -- Check for pending critical tasks
    SELECT COUNT(*) INTO v_pending_tasks 
    FROM housekeeping_tasks 
    WHERE unit_id = p_unit_id 
    AND status IN ('pending', 'in_progress')
    AND priority IN ('high', 'urgent');
    
    IF v_pending_tasks > 0 THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', 'Pending housekeeping tasks',
            'pending_tasks', v_pending_tasks
        );
    END IF;
    
    RETURN jsonb_build_object('allowed', true, 'clean_state', v_unit.clean_state);
END;
$$ LANGUAGE plpgsql;

-- Checkout housekeeping trigger fires on transactions (time_exclusive_reservation)
CREATE OR REPLACE FUNCTION trigger_checkout_housekeeping() RETURNS TRIGGER AS $$
DECLARE
    v_task_type_id UUID;
    v_is_same_day_turnover BOOLEAN;
    v_unit_id UUID;
BEGIN
    -- Only trigger on time_exclusive_reservation transactions transitioning to checked_out
    IF NEW.engine_type = 'time_exclusive_reservation'
       AND (NEW.metadata->>'status') = 'checked_out'
       AND (OLD.metadata->>'status') IS DISTINCT FROM 'checked_out' THEN

        v_unit_id := (NEW.metadata->>'unit_id')::UUID;
        IF v_unit_id IS NULL THEN RETURN NEW; END IF;

        SELECT id INTO v_task_type_id FROM housekeeping_task_types
        WHERE name ILIKE '%checkout%' OR name ILIKE '%cleaning%' LIMIT 1;
        IF v_task_type_id IS NULL THEN RETURN NEW; END IF;

        SELECT EXISTS(
            SELECT 1 FROM transactions
            WHERE engine_type = 'time_exclusive_reservation'
              AND (metadata->>'unit_id')::UUID = v_unit_id
              AND DATE((metadata->>'check_in_date')::TIMESTAMPTZ) = CURRENT_DATE
              AND id != NEW.id
              AND status IN ('confirmed', 'pending')
        ) INTO v_is_same_day_turnover;

        INSERT INTO housekeeping_tasks (
            unit_id, task_type_id, title, priority, scheduled_for, notes, status
        ) VALUES (
            v_unit_id,
            v_task_type_id,
            'Checkout Cleaning - ' || COALESCE(NEW.metadata->>'unit_name', v_unit_id::TEXT),
            CASE WHEN v_is_same_day_turnover THEN 'urgent' ELSE 'high' END,
            NOW(),
            CASE WHEN v_is_same_day_turnover THEN 'URGENT: Same-day turnover!' ELSE NULL END,
            'pending'
        );

        UPDATE accommodation_units SET clean_state = 'dirty' WHERE id = v_unit_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_checkout_housekeeping ON transactions;
CREATE TRIGGER trg_checkout_housekeeping
    AFTER UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_checkout_housekeeping();

-- deduct_inventory_for_order removed (legacy: referenced order_items)

-- Daily sales aggregation from unified transactions table
CREATE OR REPLACE FUNCTION aggregate_daily_sales(p_date DATE) RETURNS VOID AS $$
BEGIN
    INSERT INTO report_daily_sales (
        date, total_revenue, net_revenue, total_orders, completed_orders,
        cancelled_orders, average_order_value, total_discounts, total_refunds,
        total_tips, cash_revenue, card_revenue, gift_card_revenue,
        loyalty_redemptions, new_customers, returning_customers
    )
    SELECT
        p_date,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'cancelled'),
        COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0),
        COALESCE(SUM(discount_amount), 0),
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0),
        0,
        COALESCE(SUM(CASE WHEN (metadata->>'payment_method') = 'cash' AND status = 'completed' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN (metadata->>'payment_method') = 'card' AND status = 'completed' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN (metadata->>'payment_method') = 'gift_card' AND status = 'completed' THEN amount ELSE 0 END), 0),
        0,
        (SELECT COUNT(DISTINCT customer_id) FROM transactions
         WHERE DATE(created_at) = p_date AND customer_id IS NOT NULL AND engine_type = 'instant_transaction'
         AND NOT EXISTS(SELECT 1 FROM transactions t2 WHERE t2.customer_id = transactions.customer_id AND DATE(t2.created_at) < p_date)),
        (SELECT COUNT(DISTINCT customer_id) FROM transactions
         WHERE DATE(created_at) = p_date AND customer_id IS NOT NULL AND engine_type = 'instant_transaction'
         AND EXISTS(SELECT 1 FROM transactions t2 WHERE t2.customer_id = transactions.customer_id AND DATE(t2.created_at) < p_date))
    FROM transactions
    WHERE DATE(created_at) = p_date AND engine_type = 'instant_transaction'
    ON CONFLICT (date) DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        net_revenue = EXCLUDED.net_revenue,
        total_orders = EXCLUDED.total_orders,
        completed_orders = EXCLUDED.completed_orders,
        cancelled_orders = EXCLUDED.cancelled_orders,
        average_order_value = EXCLUDED.average_order_value,
        total_discounts = EXCLUDED.total_discounts,
        total_refunds = EXCLUDED.total_refunds,
        cash_revenue = EXCLUDED.cash_revenue,
        card_revenue = EXCLUDED.card_revenue,
        gift_card_revenue = EXCLUDED.gift_card_revenue,
        loyalty_redemptions = EXCLUDED.loyalty_redemptions,
        new_customers = EXCLUDED.new_customers,
        returning_customers = EXCLUDED.returning_customers,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_created_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_module_status ON transactions(module_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_engine_type ON transactions(engine_type);
-- idx_tabs_table_status removed (legacy: referenced restaurant_tabs)
CREATE INDEX IF NOT EXISTS idx_batches_item_status ON inventory_batches(item_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_unit_status ON housekeeping_tasks(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_batches_user ON loyalty_point_batches(user_id, is_expired);
