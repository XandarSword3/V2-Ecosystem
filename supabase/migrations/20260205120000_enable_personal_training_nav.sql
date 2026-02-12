-- Enable Personal Training module in navigation
UPDATE modules 
SET show_in_main = true,
    settings = settings || '{"show_in_nav": true}'::jsonb
WHERE id = '4e8a00d8-7ad4-4220-b6cf-6743cd949c0e';
