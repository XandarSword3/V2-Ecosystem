-- Migration: Add 'served' status to order_status enum
-- Date: 2026-01-15
-- Description: Add 'served' status for dine-in orders (delivered remains for delivery orders)

-- Add 'served' status to order_status enum (after 'ready')
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'served' AFTER 'ready';

-- Note: PostgreSQL does not support removing enum values once added.
-- If rollback is needed, see ROLLBACK_GUIDE.sql for the workaround procedure.
