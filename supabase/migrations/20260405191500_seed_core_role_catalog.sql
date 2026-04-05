-- Ensure core role catalog exists for auth and role assignment flows.
-- This keeps admin-created users from ending up without user_roles when
-- requesting module-specific staff/admin roles.
INSERT INTO roles (name, display_name, description, business_unit)
VALUES
  ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
  ('admin', 'Administrator', 'Administrative access', 'admin'),
  ('manager', 'Manager', 'Cross-module management access', 'admin'),
  ('customer', 'Customer', 'Registered customer access', NULL),
  ('staff', 'Staff', 'Generic staff access', NULL),
  ('restaurant_staff', 'Restaurant Staff', 'Restaurant operations', 'restaurant'),
  ('restaurant_admin', 'Restaurant Admin', 'Restaurant management', 'restaurant'),
  ('snack_bar_staff', 'Snack Bar Staff', 'Snack bar operations', 'snack_bar'),
  ('snack_bar_admin', 'Snack Bar Admin', 'Snack bar management', 'snack_bar'),
  ('chalet_staff', 'Chalet Staff', 'Chalet operations', 'chalets'),
  ('chalet_admin', 'Chalet Admin', 'Chalet management', 'chalets'),
  ('housekeeping_staff', 'Housekeeping Staff', 'Housekeeping operations', 'chalets'),
  ('pool_staff', 'Pool Staff', 'Pool operations', 'pool'),
  ('pool_admin', 'Pool Admin', 'Pool management', 'pool'),
  ('bar_staff', 'Bar Staff', 'Bar operations', 'restaurant'),
  ('kitchen_staff', 'Kitchen Staff', 'Kitchen operations', 'restaurant'),
  ('chef', 'Chef', 'Kitchen lead operations', 'restaurant'),
  ('server', 'Server', 'Front-of-house service operations', 'restaurant'),
  ('front_desk', 'Front Desk', 'Guest reception operations', 'admin')
ON CONFLICT (name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  business_unit = EXCLUDED.business_unit,
  updated_at = NOW();
