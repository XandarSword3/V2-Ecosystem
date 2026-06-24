-- Migration: Add qr_code column to restaurant_tables
-- Date: 2026-02-23

ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS qr_code TEXT;
