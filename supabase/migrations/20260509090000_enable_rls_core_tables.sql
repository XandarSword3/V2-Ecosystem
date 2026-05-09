BEGIN;

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_property_isolation ON modules
  FOR ALL
  USING (property_id IN (
    SELECT property_id FROM user_property_access 
    WHERE user_id = auth.uid()
  ));

ALTER TABLE restaurant_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY restaurant_orders_property_isolation ON restaurant_orders
  FOR ALL
  USING (property_id IN (
    SELECT property_id FROM user_property_access 
    WHERE user_id = auth.uid()
  ));

ALTER TABLE chalet_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY chalet_bookings_property_isolation ON chalet_bookings
  FOR ALL
  USING (property_id IN (
    SELECT property_id FROM user_property_access 
    WHERE user_id = auth.uid()
  ));

ALTER TABLE pool_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY pool_tickets_property_isolation ON pool_tickets
  FOR ALL
  USING (property_id IN (
    SELECT property_id FROM user_property_access 
    WHERE user_id = auth.uid()
  ));

COMMIT;
