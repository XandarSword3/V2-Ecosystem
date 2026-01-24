-- Migration: Staff shift management system
-- Enables shift scheduling, clock in/out, and time tracking

CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT DEFAULT 0 CHECK (break_minutes >= 0),
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  actual_break_minutes INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'missed', 'cancelled')),
  department VARCHAR(50), -- 'restaurant', 'housekeeping', 'pool', 'front_desk', etc.
  notes TEXT,
  late_reason TEXT, -- If clocked in late
  early_leave_reason TEXT, -- If left early
  overtime_approved BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_id ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON staff_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON staff_shifts(status);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_department ON staff_shifts(department);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_upcoming ON staff_shifts(shift_date, start_time) WHERE status = 'scheduled';

-- Staff shift swap requests
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_shift_id UUID NOT NULL REFERENCES staff_shifts(id) ON DELETE CASCADE,
  requesting_staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_staff_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Who they want to swap with (null = open request)
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'approved')),
  reason TEXT,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Staff who accepted the swap
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Manager who approved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_swaps_requesting ON shift_swap_requests(requesting_staff_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_target ON shift_swap_requests(target_staff_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swap_requests(status);

-- Time clock entries for manual adjustments
CREATE TABLE IF NOT EXISTS time_clock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES staff_shifts(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('clock_in', 'clock_out', 'break_start', 'break_end', 'manual')),
  original_time TIMESTAMPTZ,
  adjusted_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  adjusted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_adjustments_shift ON time_clock_adjustments(shift_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_staff_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_staff_shifts_updated_at ON staff_shifts;
CREATE TRIGGER trigger_staff_shifts_updated_at
  BEFORE UPDATE ON staff_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_shifts_updated_at();

DROP TRIGGER IF EXISTS trigger_shift_swaps_updated_at ON shift_swap_requests;
CREATE TRIGGER trigger_shift_swaps_updated_at
  BEFORE UPDATE ON shift_swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_shifts_updated_at();

COMMENT ON TABLE staff_shifts IS 'Staff work shift schedules with clock in/out tracking';
COMMENT ON TABLE shift_swap_requests IS 'Staff requests to swap shifts with each other';
COMMENT ON TABLE time_clock_adjustments IS 'Manual adjustments to clock in/out times by managers';
