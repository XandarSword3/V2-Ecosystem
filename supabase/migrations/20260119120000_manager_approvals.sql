-- Migration: Manager approvals workflow system
-- Enables refund, discount, void, and override approval workflow

CREATE TABLE IF NOT EXISTS manager_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('refund', 'discount', 'void', 'override', 'price_adjustment', 'comp')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  amount DECIMAL(10,2),
  original_amount DECIMAL(10,2), -- For price adjustments, store original price
  percentage DECIMAL(5,2), -- For percentage-based discounts
  description TEXT NOT NULL,
  reason TEXT, -- Detailed reason for the request
  reference_type VARCHAR(50), -- 'restaurant_order', 'chalet_booking', 'pool_ticket', etc.
  reference_id UUID,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'), -- Auto-expire pending approvals
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_manager_approvals_status ON manager_approvals(status);
CREATE INDEX IF NOT EXISTS idx_manager_approvals_type ON manager_approvals(type);
CREATE INDEX IF NOT EXISTS idx_manager_approvals_requested_by ON manager_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_manager_approvals_reviewed_by ON manager_approvals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_manager_approvals_created_at ON manager_approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_approvals_pending ON manager_approvals(status, created_at) WHERE status = 'pending';

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_manager_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_manager_approvals_updated_at ON manager_approvals;
CREATE TRIGGER trigger_manager_approvals_updated_at
  BEFORE UPDATE ON manager_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_approvals_updated_at();

-- Create notification preferences for managers
CREATE TABLE IF NOT EXISTS manager_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approval_requests BOOLEAN DEFAULT true,
  approval_responses BOOLEAN DEFAULT true,
  urgent_orders BOOLEAN DEFAULT true,
  inventory_alerts BOOLEAN DEFAULT true,
  staff_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE manager_approvals IS 'Stores approval requests for refunds, discounts, voids, and price overrides';
COMMENT ON COLUMN manager_approvals.expires_at IS 'Approval requests expire after 24 hours if not reviewed';
