-- Migration: Shift cash-drawer support
-- Date: 2026-08-07
-- Backs the POST /staff/shifts/:id/close and POST /staff/shifts/:id/cash
-- endpoints (StaffPOSTemplate cash-drawer flow). Additive only.

-- 1. Cash totals on the shift itself, recorded at close time.
ALTER TABLE staff_shifts
  ADD COLUMN IF NOT EXISTS opening_cash numeric(10,2),
  ADD COLUMN IF NOT EXISTS closing_cash numeric(10,2);

-- 2. Pay-in / pay-out ledger during an open shift.
CREATE TABLE IF NOT EXISTS shift_cash_movements (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  shift_id uuid NOT NULL REFERENCES staff_shifts(id) ON DELETE CASCADE,
  type varchar(10) NOT NULL,
  amount numeric(10,2) NOT NULL,
  note text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  property_id uuid NOT NULL,
  CONSTRAINT shift_cash_movements_type_check CHECK (type IN ('in', 'out')),
  CONSTRAINT shift_cash_movements_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_shift_cash_movements_shift_id ON shift_cash_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_cash_movements_tenant_id ON shift_cash_movements(tenant_id);

COMMENT ON TABLE shift_cash_movements IS 'Pay-in/pay-out cash drawer movements recorded during a staff shift.';
