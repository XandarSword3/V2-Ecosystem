-- Seed staff users
-- SECURITY FIX: Each staff account now has a unique bcrypt hash (salt rounds: 12)
-- Default password for all: staff123 (Change upon first login!)
BEGIN;

-- CTE to hold the staff data to be inserted
WITH new_users (email, password_hash, full_name, role_name) AS (
  VALUES 
    ('staff@v2resort.com', '$2a$12$AXUU8b7c3Fm2ssynQBubteO9kevhuBs1OIJlJgmGK8BeEbYixPXEu', 'General Staff', 'staff'),
    ('restaurant.staff@v2resort.com', '$2a$12$4vdXFJ1rKuLELQXJzyD9.OCOPsgA1ecaR9dE6UVEMBFTGoLtVCFne', 'Restaurant Staff', 'restaurant_staff'),
    ('restaurant.manager@v2resort.com', '$2a$12$XlIMPnZ0ypOH.YDvJmvkm.7xJfGt0l6PI6b1e0MbmIBv4kNEdbw1u', 'Restaurant Manager', 'manager'),
    ('restaurant.admin@v2resort.com', '$2a$12$bpEMhzuIWZMFk65s5HWQI.EIa9jv7kdDEqTkfQbGuRW.HDDzM9TEK', 'Restaurant Admin', 'restaurant_admin'),
    ('kitchen.staff@v2resort.com', '$2a$12$bvmLrm7yHsKdSb01nGaIUepPrHdXfLPvaGK46J8J0.7BD0gcphioC', 'Kitchen Staff', 'kitchen_staff'),
    ('pool.staff@v2resort.com', '$2a$12$zw2y7hCHtuMIXeZaNrUMce8bS1fdWgGTAuVWakAmtS..9HSeLMJ86', 'Pool Staff', 'pool_staff'),
    ('pool.admin@v2resort.com', '$2a$12$hDoo4o6aQ9YkZVCFJW4eIOJgLxZFCXNfq2q1jRb0DS51HT2S.utde', 'Pool Admin', 'pool_admin'),
    ('chalet.staff@v2resort.com', '$2a$12$JZT2ioCDnW7S.n7lI5rnI.QM4IxWzvhxr058xoKVpf0ny4iplS6/O', 'Chalet Staff', 'chalet_staff'),
    ('chalet.manager@v2resort.com', '$2a$12$1iL7tcn66Zx94KfNdBF.w.1sKSgBbH4./28YtaOW63CM16QP.NZiq', 'Chalet Manager', 'manager'),
    ('chalet.admin@v2resort.com', '$2a$12$.Bbmgici7C1x7Lo0iFCXT.KqaOZR.S5CvAhiuitYpCIE3izWuM6U6', 'Chalet Admin', 'chalet_admin'),
    ('snack.staff@v2resort.com', '$2a$12$aFJCzKu.FABJpEXOZ6XICe661/RhFRnqUfWs6mzb5TdglvhGGTD4S', 'Snack Bar Staff', 'snack_bar_staff'),
    ('snack.admin@v2resort.com', '$2a$12$e1Nk8jLMuYy0fq3xyy/gN.Nnrbt.GVtNhf3OkzaFPUuNDlfI7MIkW', 'Snack Bar Admin', 'snack_bar_admin')
),
inserted_users AS (
INSERT INTO users (email, password_hash, full_name, is_active, email_verified)
SELECT 
  email, 
  password_hash, 
  full_name, 
  true, 
  true
FROM new_users
ON CONFLICT (email) DO UPDATE SET
  email_verified = true,
  is_active = true
RETURNING id, email
)
INSERT INTO user_roles (user_id, role_id)
SELECT 
  iu.id, 
  r.id
FROM inserted_users iu
JOIN new_users nu ON iu.email = nu.email
JOIN roles r ON nu.role_name = r.name
ON CONFLICT ON CONSTRAINT uq_user_roles_user_role DO NOTHING;

COMMIT;
