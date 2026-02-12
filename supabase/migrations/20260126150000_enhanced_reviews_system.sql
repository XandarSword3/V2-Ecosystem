-- Enhanced Reviews System Migration
-- Supports reviews for products, bookings, and sessions

-- Product Reviews Table
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Booking Reviews Table (with aspect ratings)
CREATE TABLE IF NOT EXISTS booking_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  location_rating INTEGER CHECK (location_rating >= 1 AND location_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, booking_id)
);

-- Session Reviews Table (for pool sessions, etc.)
CREATE TABLE IF NOT EXISTS session_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  session_type VARCHAR(50) NOT NULL, -- 'pool', 'spa', etc.
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON product_reviews(is_approved);

CREATE INDEX IF NOT EXISTS idx_booking_reviews_booking ON booking_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_unit ON booking_reviews(unit_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_user ON booking_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_approved ON booking_reviews(is_approved);

CREATE INDEX IF NOT EXISTS idx_session_reviews_session ON session_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_session_reviews_type ON session_reviews(session_type);
CREATE INDEX IF NOT EXISTS idx_session_reviews_user ON session_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_session_reviews_approved ON session_reviews(is_approved);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_reviews_updated_at ON product_reviews;
CREATE TRIGGER product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_review_updated_at();

DROP TRIGGER IF EXISTS booking_reviews_updated_at ON booking_reviews;
CREATE TRIGGER booking_reviews_updated_at
  BEFORE UPDATE ON booking_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_review_updated_at();

DROP TRIGGER IF EXISTS session_reviews_updated_at ON session_reviews;
CREATE TRIGGER session_reviews_updated_at
  BEFORE UPDATE ON session_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_review_updated_at();

-- Row Level Security
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_reviews ENABLE ROW LEVEL SECURITY;

-- Product reviews policies
DROP POLICY IF EXISTS product_reviews_select_approved ON product_reviews;
CREATE POLICY product_reviews_select_approved ON product_reviews
  FOR SELECT TO authenticated
  USING (is_approved = true OR user_id = auth.uid());

DROP POLICY IF EXISTS product_reviews_insert ON product_reviews;
CREATE POLICY product_reviews_insert ON product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS product_reviews_admin ON product_reviews;
CREATE POLICY product_reviews_admin ON product_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.roles @> '["admin"]'
    )
  );

-- Booking reviews policies
DROP POLICY IF EXISTS booking_reviews_select_approved ON booking_reviews;
CREATE POLICY booking_reviews_select_approved ON booking_reviews
  FOR SELECT TO authenticated
  USING (is_approved = true OR user_id = auth.uid());

DROP POLICY IF EXISTS booking_reviews_insert ON booking_reviews;
CREATE POLICY booking_reviews_insert ON booking_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS booking_reviews_admin ON booking_reviews;
CREATE POLICY booking_reviews_admin ON booking_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.roles @> '["admin"]'
    )
  );

-- Session reviews policies
DROP POLICY IF EXISTS session_reviews_select_approved ON session_reviews;
CREATE POLICY session_reviews_select_approved ON session_reviews
  FOR SELECT TO authenticated
  USING (is_approved = true OR user_id = auth.uid());

DROP POLICY IF EXISTS session_reviews_insert ON session_reviews;
CREATE POLICY session_reviews_insert ON session_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS session_reviews_admin ON session_reviews;
CREATE POLICY session_reviews_admin ON session_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.roles @> '["admin"]'
    )
  );

-- Function to calculate product average rating
CREATE OR REPLACE FUNCTION get_product_rating(p_product_id UUID)
RETURNS TABLE(average_rating NUMERIC, review_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(rating)::NUMERIC, 1) as average_rating,
    COUNT(*) as review_count
  FROM product_reviews
  WHERE product_id = p_product_id
  AND is_approved = true;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate unit average rating
CREATE OR REPLACE FUNCTION get_unit_rating(p_unit_id UUID)
RETURNS TABLE(
  average_rating NUMERIC, 
  review_count BIGINT,
  cleanliness NUMERIC,
  location NUMERIC,
  value NUMERIC,
  service NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(rating)::NUMERIC, 1) as average_rating,
    COUNT(*) as review_count,
    ROUND(AVG(cleanliness_rating)::NUMERIC, 1) as cleanliness,
    ROUND(AVG(location_rating)::NUMERIC, 1) as location,
    ROUND(AVG(value_rating)::NUMERIC, 1) as value,
    ROUND(AVG(service_rating)::NUMERIC, 1) as service
  FROM booking_reviews
  WHERE unit_id = p_unit_id
  AND is_approved = true;
END;
$$ LANGUAGE plpgsql;
