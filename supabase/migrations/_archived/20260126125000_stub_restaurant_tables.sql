-- Stub: create restaurant_tables before 20260126130000_complete_pos_inventory_housekeeping.sql
-- which references it in a FK constraint on restaurant_tabs.table_id.
--
-- 20260204000001_restaurant_tables.sql is the canonical definition. It uses
-- CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS throughout, so it
-- will handle this pre-existing table gracefully: the CREATE is a no-op,
-- and each ADD COLUMN IF NOT EXISTS is also a no-op for columns already present.
-- The only thing skipped is the UNIQUE constraint on `number` — acceptable for
-- a legacy table that will be purged as part of the restaurant module cleanup.

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    number          INTEGER,
    name            VARCHAR(100),
    capacity        INTEGER,
    min_capacity    INTEGER      NOT NULL DEFAULT 1,
    status          VARCHAR(50)  NOT NULL DEFAULT 'AVAILABLE',
    section         VARCHAR(100) NOT NULL DEFAULT 'Main',
    position        JSONB        NOT NULL DEFAULT '{"x": 0, "y": 0, "rotation": 0, "width": 60, "height": 60, "shape": "rectangle"}',
    features        JSONB        DEFAULT '[]',
    last_status_change          TIMESTAMPTZ,
    last_status_changed_by      UUID,
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);
