-- ============================================================================
-- Migration: Secure restrictive RLS policies
-- Date: 2026-05-03
-- 
-- Addresses the "emergency-schema" tables that were previously USING (true).
-- Ensures that sensitive financial and security tables are role-restricted.
-- ============================================================================

BEGIN;

-- 1. Drop existing permissive policies
DROP POLICY IF EXISTS "gap_rem_modifiers_all"  ON menu_modifier_groups;
DROP POLICY IF EXISTS "gap_rem_options_all"     ON menu_modifier_options;
DROP POLICY IF EXISTS "gap_rem_cash_all"        ON cash_drawers;
DROP POLICY IF EXISTS "gap_rem_cash_tx_all"     ON cash_transactions;
DROP POLICY IF EXISTS "gap_rem_waitlist_all"    ON waitlist_entries;
DROP POLICY IF EXISTS "gap_rem_2fa_all"         ON two_factor_auth;
DROP POLICY IF EXISTS "allow_all_support_inquiries" ON support_inquiries;
DROP POLICY IF EXISTS "allow_all_faqs" ON faqs;

-- 2. Implement restrictive policies

-- Menu Modifiers (Staff/Admin)
CREATE POLICY "staff_admin_manage_modifier_groups"
  ON menu_modifier_groups FOR ALL
  TO authenticated
  USING (public.user_has_role('staff') OR public.user_has_role('manager') OR public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('staff') OR public.user_has_role('manager') OR public.user_has_role('admin'));

CREATE POLICY "staff_admin_manage_modifier_options"
  ON menu_modifier_options FOR ALL
  TO authenticated
  USING (public.user_has_role('staff') OR public.user_has_role('manager') OR public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('staff') OR public.user_has_role('manager') OR public.user_has_role('admin'));

-- Cash Management (Manager/Admin Only - sensitive financial)
CREATE POLICY "manager_admin_manage_cash_drawers"
  ON cash_drawers FOR ALL
  TO authenticated
  USING (public.user_has_role('manager') OR public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('manager') OR public.user_has_role('admin'));

CREATE POLICY "manager_admin_manage_cash_transactions"
  ON cash_transactions FOR ALL
  TO authenticated
  USING (public.user_has_role('manager') OR public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('manager') OR public.user_has_role('admin'));

-- Waitlist (Staff/Admin)
CREATE POLICY "staff_admin_manage_waitlist"
  ON waitlist_entries FOR ALL
  TO authenticated
  USING (public.user_has_role('staff') OR public.user_has_role('manager') OR public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('staff') OR public.user_has_role('manager') OR public.user_has_role('admin'));

-- Two-Factor Auth (Owner/Admin Only)
CREATE POLICY "user_admin_manage_2fa"
  ON two_factor_auth FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.user_has_role('admin'))
  WITH CHECK (auth.uid() = user_id OR public.user_has_role('admin'));

-- Support Inquiries (Owner Read/Create, Staff Manage)
CREATE POLICY "user_read_create_support"
  ON support_inquiries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.user_has_role('staff') OR public.user_has_role('admin'));

CREATE POLICY "user_create_support"
  ON support_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "staff_manage_support"
  ON support_inquiries FOR UPDATE
  TO authenticated
  USING (public.user_has_role('staff') OR public.user_has_role('admin'));

-- FAQs (Public Read, Admin Manage)
CREATE POLICY "public_read_faqs"
  ON faqs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admin_manage_faqs"
  ON faqs FOR ALL
  TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

COMMIT;
