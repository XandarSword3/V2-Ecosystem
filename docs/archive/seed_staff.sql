-- Seed staff users
BEGIN;

-- Common password hash for 'staff123' generated with bcryptjs
-- Hash: $2a$10$k4LTVvyEECUKizB343L/V.GgL.j99N5ViZ9v5mmP5qGncserWJMuC

-- CTE to hold the staff data to be inserted
WITH new_users (email, full_name, role_name) AS (
  VALUES 
    ('restaurant.staff@v2resort.com', 'Restaurant Staff', 'restaurant_staff'),
    ('restaurant.manager@v2resort.com', 'Restaurant Manager', 'restaurant_manager'),
    ('restaurant.admin@v2resort.com', 'Restaurant Admin', 'restaurant_admin'),
    ('kitchen.staff@v2resort.com', 'Kitchen Staff', 'kitchen_staff'),
    ('pool.staff@v2resort.com', 'Pool Staff', 'pool_staff'),
    ('pool.admin@v2resort.com', 'Pool Admin', 'pool_admin'),
    ('chalet.staff@v2resort.com', 'Chalet Staff', 'chalet_staff'),
    ('chalet.manager@v2resort.com', 'Chalet Manager', 'chalet_manager'),
    ('chalet.admin@v2resort.com', 'Chalet Admin', 'chalet_admin'),
    ('snack.staff@v2resort.com', 'Snack Bar Staff', 'snack_bar_staff'),
    ('snack.admin@v2resort.com', 'Snack Bar Admin', 'snack_bar_admin')
),
inserted_users AS (
  INSERT INTO users (email, password_hash, full_name, is_active, email_verified)
  SELECT 
    email, 
    '$2a$10$k4LTVvyEECUKizB343L/V.GgL.j99N5ViZ9v5mmP5qGncserWJMuC', 
    full_name, 
    true, 
    true
  FROM new_users
  WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = new_users.email
  )
  RETURNING id, email
)
INSERT INTO user_roles (user_id, role_id)
SELECT 
  iu.id, 
  r.id
FROM inserted_users iu
JOIN new_users nu ON iu.email = nu.email
JOIN roles r ON nu.role_name = r.name;

COMMIT;
