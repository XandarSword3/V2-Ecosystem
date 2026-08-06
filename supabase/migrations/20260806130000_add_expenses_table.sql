-- Migration: Add expenses table for Phase 5a (Directional Financials)
-- Date: 2026-08-06

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  module_id UUID NULL,
  category VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_property_date ON expenses(property_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
