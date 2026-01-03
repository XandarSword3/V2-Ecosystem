-- =====================================================
-- CHECK ADMIN USERS SCRIPT
-- Run this in Supabase SQL Editor to find your admin users
-- =====================================================

SELECT 
    u.email,
    u.full_name,
    r.name as role_name,
    r.display_name as role_display_name,
    u.is_active,
    u.last_login_at
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name IN ('super_admin', 'admin')
ORDER BY u.email;

-- If the list is empty, or your email is not there, run the script below:

/*
-- UNCOMMENT AND RUN THIS TO FORCE-ADD SUPER_ADMIN ROLE TO YOUR EMAIL
-- Replace 'your-email@example.com' with your actual email address

DO $$
DECLARE
  target_email TEXT := 'your-email@example.com';
  user_id UUID;
  role_id UUID;
BEGIN
  -- Get User ID
  SELECT id INTO user_id FROM users WHERE email = target_email;
  
  -- Get Super Admin Role ID
  SELECT id INTO role_id FROM roles WHERE name = 'super_admin';

  -- Insert or Update
  IF user_id IS NOT NULL AND role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (user_id, role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'User % set to super_admin', target_email;
  ELSE
    RAISE NOTICE 'User or Role not found. Please check the email address.';
  END IF;
END $$;
*/
