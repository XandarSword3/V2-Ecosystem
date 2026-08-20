-- Migration: staff employment records + per-shift pay-rate snapshot
-- Date: 2026-08-18
-- Backs the staff-profile management surface (admin users detail page) and
-- resolves the wage/pay_rate split for payroll.
--
-- staff_profiles is the *staff record* referenced by Architecture Designing.md:
-- engine-specific sub-roles (department) and employment data live here, NOT on
-- the users row. users.scope remains the single source of truth for the
-- authorization tier.
--
-- Wage semantics (this is the rule payroll logic must follow):
--   * staff_profiles.base_wage  = the staff member's CURRENT base rate. It is
--     the source of truth for any newly scheduled shift.
--   * staff_shifts.pay_rate     = a POINT-IN-TIME snapshot of base_wage taken
--     when the shift row is created. It is historical record only and must
--     never be read as the live rate.

-- 1. Staff employment records (1:1 with users, tenant-scoped).
CREATE TABLE IF NOT EXISTS staff_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  employee_id varchar(50),
  position varchar(100),
  department varchar(100),
  employment_type varchar(20),
  hire_date date,
  base_wage numeric(10,2),
  wage_currency char(3) NOT NULL DEFAULT 'USD',
  emergency_contact_name varchar(255),
  emergency_contact_phone varchar(20),
  emergency_contact_relationship varchar(50),
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT staff_profiles_user_id_key UNIQUE (user_id),
  CONSTRAINT staff_profiles_employment_type_check CHECK (
    employment_type IS NULL OR employment_type IN ('full_time', 'part_time', 'seasonal', 'contract')
  ),
  CONSTRAINT staff_profiles_base_wage_check CHECK (base_wage IS NULL OR base_wage >= 0)
);

COMMENT ON TABLE staff_profiles IS 'Staff employment records (position, department, wage, emergency contact). 1:1 with users.';
COMMENT ON COLUMN staff_profiles.base_wage IS 'Current base wage rate. Source of truth for new shifts; staff_shifts.pay_rate snapshots it at scheduling time.';
COMMENT ON COLUMN staff_profiles.department IS 'Engine-specific sub-role (front_desk, housekeeping, restaurant, etc.) — lives on the staff record, not the user row.';

CREATE INDEX IF NOT EXISTS idx_staff_profiles_tenant_id ON staff_profiles(tenant_id);

-- 2. Per-shift pay-rate snapshot on staff_shifts.
ALTER TABLE staff_shifts
  ADD COLUMN IF NOT EXISTS pay_rate numeric(10,2);

COMMENT ON COLUMN staff_shifts.pay_rate IS 'Point-in-time snapshot of staff_profiles.base_wage at shift creation. Historical record only.';

-- 3. Tenant isolation RLS (tenant-only table — no property_id dimension).
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_profiles_isolation" ON "public"."staff_profiles"
  USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));
