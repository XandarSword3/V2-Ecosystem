-- Migration: Add order_id to product_reviews and create staff_reviews table
-- Date: 2026-08-06

-- 1. Ensure product_reviews has order_id column and nullable user_id for guest reviews
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS order_id UUID NULL;
ALTER TABLE product_reviews ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_reviews_order ON product_reviews(order_id);

-- 2. Staff reviews table
CREATE TABLE IF NOT EXISTS staff_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL,
  order_id UUID NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_reviews_staff ON staff_reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_reviews_tenant_prop ON staff_reviews(tenant_id, property_id);
