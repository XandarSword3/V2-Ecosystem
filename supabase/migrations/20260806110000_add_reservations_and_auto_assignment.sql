-- Migration: Add reservations table and auto-assignment columns
-- Date: 2026-08-06

-- 1. Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  module_id UUID NOT NULL,
  service_location_id UUID NULL,
  party_size INT NOT NULL,
  reserved_for TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 90,
  status VARCHAR(32) NOT NULL DEFAULT 'booked', -- booked | seated | completed | no_show | cancelled
  guest_name VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(64),
  notes TEXT,
  assigned_staff_id UUID NULL,
  created_by UUID NULL,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for hostess day view and occupancy joins
CREATE INDEX IF NOT EXISTS idx_reservations_module_date ON reservations(module_id, reserved_for);
CREATE INDEX IF NOT EXISTS idx_reservations_location_status ON reservations(service_location_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_property ON reservations(tenant_id, property_id);

-- 2. Add assigned_staff_id to service_locations
ALTER TABLE service_locations 
ADD COLUMN IF NOT EXISTS assigned_staff_id UUID NULL;

-- 3. Add module_id to staff_shifts
ALTER TABLE staff_shifts 
ADD COLUMN IF NOT EXISTS module_id UUID NULL;

-- Index on staff_shifts for active shift lookups per module
CREATE INDEX IF NOT EXISTS idx_staff_shifts_active_module ON staff_shifts(module_id, status) WHERE status = 'active';
