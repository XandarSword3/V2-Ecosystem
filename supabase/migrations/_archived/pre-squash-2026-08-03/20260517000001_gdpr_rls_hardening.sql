-- GDPR Compliance Hardening: RLS on remaining core tables
-- Ensures user data is protected via row-level security

-- 1. Users table — protect PII
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own data; staff+ can read all
DROP POLICY IF EXISTS users_self_read ON users;
CREATE POLICY users_self_read ON users FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('staff', 'manager', 'admin', 'super_admin'))
);

-- Only admin+ can modify user records
DROP POLICY IF EXISTS users_admin_write ON users;
CREATE POLICY users_admin_write ON users FOR ALL USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

-- 2. Payments table — protect financial PII
-- NOTE: payments has no direct user FK (links via chalet_booking_id / pool_ticket_id).
-- There is no customer_id or user_id column — staff-only read is the correct policy.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS payments_staff_read ON payments;
        CREATE POLICY payments_staff_read ON payments FOR SELECT USING (
            EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('staff', 'manager', 'admin', 'super_admin'))
        );

        DROP POLICY IF EXISTS payments_admin_write ON payments;
        CREATE POLICY payments_admin_write ON payments FOR ALL USING (
            EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
        );
    END IF;
END $$;

-- 3. Reviews table — users can see their own, staff can see all
-- NOTE: reviews table uses customer_id (not user_id) as the user FK column.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
        ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS reviews_public_read ON reviews;
        CREATE POLICY reviews_public_read ON reviews FOR SELECT USING (
            status = 'approved'
            OR customer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('staff', 'manager', 'admin', 'super_admin'))
        );

        DROP POLICY IF EXISTS reviews_owner_write ON reviews;
        CREATE POLICY reviews_owner_write ON reviews FOR INSERT WITH CHECK (customer_id = auth.uid());

        DROP POLICY IF EXISTS reviews_admin_manage ON reviews;
        CREATE POLICY reviews_admin_manage ON reviews FOR ALL USING (
            EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
        );
    END IF;
END $$;

-- 4. Activity log — only staff+ can read audit trails
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_log') THEN
        ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS activity_log_staff_read ON activity_log;
        CREATE POLICY activity_log_staff_read ON activity_log FOR SELECT USING (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('manager', 'admin', 'super_admin'))
        );

        -- System can always write
        DROP POLICY IF EXISTS activity_log_system_write ON activity_log;
        CREATE POLICY activity_log_system_write ON activity_log FOR INSERT WITH CHECK (true);
    END IF;
END $$;

COMMENT ON POLICY users_self_read ON users IS 'GDPR: Users can read own data; staff+ can read all';
COMMENT ON POLICY users_admin_write ON users IS 'GDPR: Only admin+ or self can modify user records';
