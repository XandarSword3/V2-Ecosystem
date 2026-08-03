-- Migration: add_served_status_to_enum
-- Created: 2026-01-18
-- Purpose: Add 'served' status to order_status enum for dine-in orders
-- This fixes the 500 error when marking orders as served in the Kitchen Display System

-- Add 'served' status to order_status enum
-- Note: PostgreSQL requires exact syntax for adding enum values
-- The 'IF NOT EXISTS' clause prevents errors if already added
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'served' AFTER 'ready';

-- Also add 'active' to ticket_status if not exists (for pool entry tracking)
-- This is required for the pool ticket entry/exit functionality
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'active' AND enumtypid = 'ticket_status'::regtype) THEN
        ALTER TYPE ticket_status ADD VALUE 'active' AFTER 'valid';
    END IF;
EXCEPTION WHEN others THEN
    -- Ignore if already exists or type doesn't exist yet
    NULL;
END $$;
