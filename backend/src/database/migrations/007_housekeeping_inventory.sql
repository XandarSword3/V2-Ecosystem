-- Migration: 007_housekeeping_inventory.sql
-- Description: Add housekeeping task management and inventory tracking
-- Date: 2026-01-17

-- ============================================
-- HOUSEKEEPING SYSTEM
-- ============================================

-- Housekeeping task types/templates
CREATE TABLE IF NOT EXISTS housekeeping_task_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    estimated_minutes INTEGER DEFAULT 30,
    checklist JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    applies_to VARCHAR(50) DEFAULT 'chalet' CHECK (applies_to IN ('chalet', 'pool', 'restaurant', 'common_area', 'other')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Housekeeping tasks
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type_id UUID REFERENCES housekeeping_task_types(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('chalet', 'pool', 'restaurant', 'common_area', 'other')),
    location_id UUID, -- Reference to chalet_id or other location
    location_name VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'verified', 'cancelled')),
    assigned_to UUID REFERENCES users(id),
    assigned_by UUID REFERENCES users(id),
    scheduled_date DATE,
    scheduled_time TIME,
    due_date TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    checklist_completed JSONB DEFAULT '[]',
    notes TEXT,
    photos JSONB DEFAULT '[]',
    booking_id UUID, -- Related booking if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Housekeeping schedules (recurring tasks)
CREATE TABLE IF NOT EXISTS housekeeping_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type_id UUID REFERENCES housekeeping_task_types(id),
    location_type VARCHAR(50) NOT NULL,
    location_id UUID,
    location_name VARCHAR(100),
    frequency VARCHAR(30) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'on_checkout', 'on_checkin')),
    day_of_week INTEGER[], -- 0=Sunday, 1=Monday, etc.
    time_of_day TIME DEFAULT '09:00:00',
    assigned_to UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    last_generated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Housekeeping logs (audit trail)
CREATE TABLE IF NOT EXISTS housekeeping_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES housekeeping_tasks(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    notes TEXT,
    performed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVENTORY SYSTEM
-- ============================================

-- Inventory categories
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES inventory_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES inventory_categories(id),
    unit VARCHAR(30) DEFAULT 'unit' CHECK (unit IN ('unit', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'case', 'dozen')),
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(10,2) DEFAULT 10,
    max_stock_level DECIMAL(10,2),
    reorder_point DECIMAL(10,2) DEFAULT 5,
    reorder_quantity DECIMAL(10,2) DEFAULT 20,
    cost_per_unit DECIMAL(10,2),
    supplier VARCHAR(200),
    supplier_sku VARCHAR(100),
    location VARCHAR(100), -- Storage location
    is_perishable BOOLEAN DEFAULT false,
    expiry_tracking BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_restock_date TIMESTAMP WITH TIME ZONE,
    last_count_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('restock', 'consume', 'adjust', 'waste', 'transfer', 'return', 'count')),
    quantity DECIMAL(10,2) NOT NULL,
    quantity_before DECIMAL(10,2) NOT NULL,
    quantity_after DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reference_type VARCHAR(50), -- 'order', 'manual', 'waste_report'
    reference_id UUID,
    reason VARCHAR(255),
    notes TEXT,
    batch_number VARCHAR(50),
    expiry_date DATE,
    performed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory alerts
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiring', 'expired', 'overstock')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link menu items to inventory (for auto-deduction)
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_required DECIMAL(10,3) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(menu_item_id, inventory_item_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_assigned ON housekeeping_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_scheduled ON housekeeping_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_location ON housekeeping_tasks(location_type, location_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_logs_task ON housekeeping_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock ON inventory_items(current_stock, min_stock_level);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_item ON inventory_alerts(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_unread ON inventory_alerts(is_read, is_resolved);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default housekeeping task types
INSERT INTO housekeeping_task_types (name, description, estimated_minutes, checklist, priority, applies_to) VALUES
    ('Checkout Cleaning', 'Full cleaning after guest checkout', 60, 
     '["Strip beds and replace linens", "Clean bathroom thoroughly", "Vacuum and mop floors", "Restock amenities", "Check for damages", "Final inspection"]', 
     'high', 'chalet'),
    ('Daily Turndown', 'Evening turndown service', 20,
     '["Turn down beds", "Close curtains", "Refresh towels", "Empty trash", "Leave chocolates"]',
     'normal', 'chalet'),
    ('Pool Area Cleaning', 'Clean and maintain pool area', 45,
     '["Skim pool surface", "Check chemical levels", "Clean deck area", "Arrange furniture", "Restock towels", "Empty bins"]',
     'high', 'pool'),
    ('Restaurant Deep Clean', 'Weekly deep cleaning', 120,
     '["Deep clean kitchen", "Sanitize all surfaces", "Clean grease traps", "Organize storage", "Check equipment"]',
     'high', 'restaurant'),
    ('Quick Tidy', 'Light cleaning and tidy up', 15,
     '["Empty trash", "Wipe surfaces", "Straighten furniture"]',
     'low', 'common_area')
ON CONFLICT DO NOTHING;

-- Default inventory categories
INSERT INTO inventory_categories (name, description, sort_order) VALUES
    ('Food & Beverages', 'Restaurant and bar supplies', 1),
    ('Cleaning Supplies', 'Cleaning products and equipment', 2),
    ('Linens & Towels', 'Bed linens, towels, and textiles', 3),
    ('Amenities', 'Guest amenities and toiletries', 4),
    ('Pool Supplies', 'Pool chemicals and accessories', 5),
    ('Maintenance', 'Maintenance and repair supplies', 6)
ON CONFLICT DO NOTHING;

-- Sample inventory items
INSERT INTO inventory_items (sku, name, category_id, unit, current_stock, min_stock_level, reorder_point, reorder_quantity, cost_per_unit)
SELECT 
    'CLN-001', 'All-Purpose Cleaner', id, 'l', 25, 10, 5, 20, 8.99
FROM inventory_categories WHERE name = 'Cleaning Supplies'
ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (sku, name, category_id, unit, current_stock, min_stock_level, reorder_point, reorder_quantity, cost_per_unit)
SELECT 
    'LIN-001', 'Bath Towels', id, 'unit', 100, 30, 20, 50, 12.50
FROM inventory_categories WHERE name = 'Linens & Towels'
ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (sku, name, category_id, unit, current_stock, min_stock_level, reorder_point, reorder_quantity, cost_per_unit)
SELECT 
    'AMN-001', 'Shampoo Bottles', id, 'unit', 200, 50, 30, 100, 2.50
FROM inventory_categories WHERE name = 'Amenities'
ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for housekeeping
CREATE POLICY "Staff can view housekeeping tasks" ON housekeeping_tasks
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

CREATE POLICY "Staff can manage housekeeping tasks" ON housekeeping_tasks
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

-- Policies for inventory
CREATE POLICY "Staff can view inventory" ON inventory_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

CREATE POLICY "Admin can manage inventory" ON inventory_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Staff can view inventory transactions" ON inventory_transactions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

CREATE POLICY "Staff can create inventory transactions" ON inventory_transactions
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));
