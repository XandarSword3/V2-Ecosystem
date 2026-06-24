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
  ('menu_service_staff', 'Menu Service Staff', 'Menu service operations', 'menu_service'),
  ('menu_service_admin', 'Menu Service Admin', 'Menu service management', 'menu_service'),
  ('kiosk_staff', 'Kiosk Staff', 'Kiosk operations', 'kiosk'),
  ('kiosk_admin', 'Kiosk Admin', 'Kiosk management', 'kiosk'),
  ('accommodation_staff', 'Accommodation Staff', 'Accommodation operations', 'accommodation'),
  ('accommodation_admin', 'Accommodation Admin', 'Accommodation management', 'accommodation'),
  ('housekeeping_staff', 'Housekeeping Staff', 'Housekeeping operations', 'accommodation'),
  ('capacity_staff', 'Capacity Staff', 'Shared access operations', 'capacity'),
  ('capacity_admin', 'Capacity Admin', 'Shared access management', 'capacity'),
  ('beverage_staff', 'Beverage Staff', 'Beverage service operations', 'menu_service'),
  ('kitchen_staff', 'Kitchen Staff', 'Kitchen operations', 'menu_service'),
  ('chef', 'Chef', 'Kitchen lead operations', 'menu_service'),
  ('server', 'Server', 'Front-of-house service operations', 'menu_service'),
  ('front_desk', 'Front Desk', 'Guest reception operations', 'admin')
ON CONFLICT (name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  business_unit = EXCLUDED.business_unit,
  updated_at = NOW();
