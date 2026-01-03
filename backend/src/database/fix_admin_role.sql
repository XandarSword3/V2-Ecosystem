-- Replace 'your-email@example.com' with the actual email of the user you want to make admin
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
