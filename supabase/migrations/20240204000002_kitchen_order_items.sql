-- Fix priority column type if it was created as integer (fix for previous migration)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kitchen_orders' AND column_name = 'priority' AND data_type = 'integer') THEN
        ALTER TABLE kitchen_orders ALTER COLUMN priority TYPE VARCHAR(50) USING 'NORMAL';
        ALTER TABLE kitchen_orders ALTER COLUMN priority SET DEFAULT 'NORMAL';
    END IF;
END $$;

-- Ensure users table has role column key for policies
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';

-- Add kitchen order items table
CREATE TABLE IF NOT EXISTS kitchen_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES kitchen_orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    modifications JSONB DEFAULT '[]',
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    prepared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_kitchen_order_items_order ON kitchen_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_items_status ON kitchen_order_items(status);

-- Add additional columns to kitchen_orders if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'started_by') THEN
        ALTER TABLE kitchen_orders ADD COLUMN started_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'ready_at') THEN
        ALTER TABLE kitchen_orders ADD COLUMN ready_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'ready_by') THEN
        ALTER TABLE kitchen_orders ADD COLUMN ready_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'completed_by') THEN
        ALTER TABLE kitchen_orders ADD COLUMN completed_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'cancelled_at') THEN
        ALTER TABLE kitchen_orders ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'cancelled_by') THEN
        ALTER TABLE kitchen_orders ADD COLUMN cancelled_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE kitchen_orders ADD COLUMN cancellation_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kitchen_orders' AND column_name = 'kitchen_notes') THEN
        ALTER TABLE kitchen_orders ADD COLUMN kitchen_notes TEXT;
    END IF;
END $$;

-- Create view for kitchen display performance
CREATE OR REPLACE VIEW kitchen_performance_view AS
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_orders,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) FILTER (WHERE status = 'COMPLETED') AS avg_completion_minutes,
    COUNT(*) FILTER (WHERE priority = 'RUSH') AS rush_orders,
    COUNT(*) FILTER (WHERE priority = 'VIP') AS vip_orders
FROM kitchen_orders
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- RLS policies
ALTER TABLE kitchen_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view kitchen order items"
    ON kitchen_order_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'chef', 'kitchen_staff', 'server')
        )
    );

CREATE POLICY "Staff can insert kitchen order items"
    ON kitchen_order_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'server')
        )
    );

CREATE POLICY "Kitchen staff can update order items"
    ON kitchen_order_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'chef', 'kitchen_staff')
        )
    );
