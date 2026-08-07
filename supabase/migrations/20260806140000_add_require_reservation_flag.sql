-- Migration: Add require_reservation flag to modules table
-- Date: 2026-08-06
-- Purpose: Allow modules to opt out of reservation-based workflows (e.g., kiosk, room service, pickup)

-- Add require_reservation column to modules table
ALTER TABLE modules
ADD COLUMN IF NOT EXISTS require_reservation BOOLEAN DEFAULT TRUE;

-- Add comment to document the flag
COMMENT ON COLUMN modules.require_reservation IS 'If true, this module requires reservations and seating workflow (e.g., restaurant). If false, orders can be placed without reservations (e.g., kiosk, room service, pickup).';
