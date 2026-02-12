-- Ensure the trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS session_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES pool_sessions(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_required DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    unit VARCHAR(50), -- e.g., 'ml', 'g', 'pcs'
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, inventory_item_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_session_ingredients_session ON session_ingredients(session_id);

-- Trigger for updated_at
CREATE TRIGGER update_session_ingredients_updated_at
    BEFORE UPDATE ON session_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
