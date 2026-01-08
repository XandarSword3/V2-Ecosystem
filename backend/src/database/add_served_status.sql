-- Add 'served' to order_status enum
-- Run this in Supabase SQL Editor

DO $$ BEGIN
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'served' AFTER 'ready';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
