-- ============================================================================
-- Migration: Enforce proper RLS policies
-- Date: 2026-02-08
-- 
-- Replaces 68 wide-open USING (true) policies with role-based access control.
-- Keeps 5 legitimate service_role policies (currencies, email_bounces,
-- email_suppression_list, webhook_failures, chargebacks) untouched.
--
-- Policy categories:
--   A. Public read (anon + authenticated SELECT) — config/display data
--   B. Staff operational (staff/admin read + modify)
--   C. Admin-only (full access for admin/manager roles)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HELPER FUNCTION: user_has_role(role_name)
-- ============================================================================
-- Checks JWT metadata first (fast, no table lookup), then falls back to
-- the users table role column. Handles 'super_admin' as alias for 'admin'.
-- SECURITY DEFINER so it can query the users table on behalf of the caller.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  jwt_role text;
  check_role text;
BEGIN
  -- Normalise super_admin → admin
  check_role := CASE WHEN role_name = 'super_admin' THEN 'admin' ELSE role_name END;

  -- Fast path: check JWT user_metadata
  jwt_role := auth.jwt() -> 'user_metadata' ->> 'role';
  IF jwt_role IS NOT NULL THEN
    IF jwt_role = check_role THEN RETURN true; END IF;
    IF check_role = 'admin' AND jwt_role = 'super_admin' THEN RETURN true; END IF;
    RETURN false;
  END IF;

  -- Fallback: check users table
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (
      role = check_role
      OR (check_role = 'admin' AND role = 'super_admin')
    )
  );
END;
$$;

COMMENT ON FUNCTION public.user_has_role(text) IS
  'RLS helper — returns true when the calling user holds the given role. '
  'Checks auth.jwt() metadata first, falls back to users table.';


-- ============================================================================
-- 2. DROP ALL WIDE-OPEN POLICIES
-- ============================================================================

-- --- From 20260204100000_unified_customization_system ---
DROP POLICY IF EXISTS "customization_groups_read"   ON customization_groups;
DROP POLICY IF EXISTS "customization_options_read"   ON customization_options;
DROP POLICY IF EXISTS "entity_customizations_read"   ON entity_customizations;
DROP POLICY IF EXISTS "order_customizations_all"     ON order_customizations;

-- --- From 20260201200000_terminology_fix ---
DROP POLICY IF EXISTS "Allow public read access to terminology"  ON terminology_overrides;
DROP POLICY IF EXISTS "Allow admin write access to terminology"  ON terminology_overrides;

-- --- From 20260126170000_enhanced_housekeeping_system ---
DROP POLICY IF EXISTS "housekeeping_sla_read"          ON housekeeping_sla;
DROP POLICY IF EXISTS "housekeeping_inspections_read"   ON housekeeping_inspections;
DROP POLICY IF EXISTS "housekeeping_supplies_read"      ON housekeeping_supplies;

-- --- From 20260126160000_inventory_recipes_bom ---
DROP POLICY IF EXISTS "inventory_recipes_read"      ON inventory_recipes;
DROP POLICY IF EXISTS "inventory_ingredients_read"   ON inventory_recipe_ingredients;
DROP POLICY IF EXISTS "inventory_wastage_read"       ON inventory_wastage;
DROP POLICY IF EXISTS "inventory_variance_read"      ON inventory_variance;
DROP POLICY IF EXISTS "inventory_suppliers_read"     ON inventory_suppliers;
DROP POLICY IF EXISTS "inventory_po_read"            ON inventory_purchase_orders;
DROP POLICY IF EXISTS "inventory_batches_read"       ON inventory_batches;

-- --- From 20260117160000_loyalty_compatibility ---
DROP POLICY IF EXISTS "Anyone can read loyalty settings" ON loyalty_settings;

-- --- From 20260128000000_gap_remediation ---
DROP POLICY IF EXISTS "gap_rem_modifiers_all"  ON menu_modifier_groups;
DROP POLICY IF EXISTS "gap_rem_options_all"     ON menu_modifier_options;
DROP POLICY IF EXISTS "gap_rem_cash_all"        ON cash_drawers;
DROP POLICY IF EXISTS "gap_rem_cash_tx_all"     ON cash_transactions;
DROP POLICY IF EXISTS "gap_rem_waitlist_all"    ON waitlist_entries;
DROP POLICY IF EXISTS "gap_rem_2fa_all"         ON two_factor_auth;

-- --- From 20260202195646_advanced_features_tier3 (44 policies) ---
DROP POLICY IF EXISTS "retention_policies_admin"       ON gdpr_retention_policies;
DROP POLICY IF EXISTS "processing_activities_admin"     ON gdpr_processing_activities;
DROP POLICY IF EXISTS "guests_admin"                    ON guests;
DROP POLICY IF EXISTS "segments_admin"                  ON guest_segments;
DROP POLICY IF EXISTS "segment_members_admin"           ON segment_members;
DROP POLICY IF EXISTS "marketing_email_templates_admin" ON marketing_email_templates;
DROP POLICY IF EXISTS "campaigns_admin"                 ON marketing_campaigns;
DROP POLICY IF EXISTS "journeys_admin"                  ON email_journeys;
DROP POLICY IF EXISTS "journey_steps_admin"             ON journey_steps;
DROP POLICY IF EXISTS "enrollments_admin"               ON journey_enrollments;
DROP POLICY IF EXISTS "campaign_sends_admin"            ON campaign_sends;
DROP POLICY IF EXISTS "messaging_channels_admin"        ON messaging_channels;
DROP POLICY IF EXISTS "guest_prefs_admin"               ON guest_messaging_preferences;
DROP POLICY IF EXISTS "conversations_admin"             ON conversations;
DROP POLICY IF EXISTS "messages_admin"                  ON messages;
DROP POLICY IF EXISTS "message_templates_admin"         ON message_templates;
DROP POLICY IF EXISTS "chatbot_intents_admin"           ON chatbot_intents;
DROP POLICY IF EXISTS "report_templates_admin"          ON report_templates;
DROP POLICY IF EXISTS "saved_reports_admin"             ON saved_reports;
DROP POLICY IF EXISTS "report_scheduled_admin"          ON report_scheduled;
DROP POLICY IF EXISTS "report_executions_admin"         ON report_executions;
DROP POLICY IF EXISTS "dashboard_widgets_admin"         ON dashboard_widgets;
DROP POLICY IF EXISTS "demand_forecasts_admin"          ON demand_forecasts;
DROP POLICY IF EXISTS "pricing_rules_admin"             ON pricing_rules;
DROP POLICY IF EXISTS "rate_recommendations_admin"      ON rate_recommendations;
DROP POLICY IF EXISTS "market_events_admin"             ON market_events;
DROP POLICY IF EXISTS "competitor_rates_admin"          ON competitor_rates;
DROP POLICY IF EXISTS "group_reservations_admin"        ON group_reservations;
DROP POLICY IF EXISTS "group_room_blocks_admin"         ON group_room_blocks;
DROP POLICY IF EXISTS "group_bookings_admin"            ON group_bookings;
DROP POLICY IF EXISTS "group_events_admin"              ON group_events;
DROP POLICY IF EXISTS "group_contracts_admin"           ON group_contracts;
DROP POLICY IF EXISTS "group_invoices_admin"            ON group_invoices;
DROP POLICY IF EXISTS "group_payments_admin"            ON group_payments;
DROP POLICY IF EXISTS "group_activities_admin"          ON group_activities;
DROP POLICY IF EXISTS "registrations_admin"             ON pre_arrival_registrations;
DROP POLICY IF EXISTS "reg_documents_admin"             ON registration_documents;
DROP POLICY IF EXISTS "digital_signatures_admin"        ON digital_signatures;
DROP POLICY IF EXISTS "mobile_keys_admin"               ON mobile_keys;
DROP POLICY IF EXISTS "mobile_key_log_admin"            ON mobile_key_access_log;
DROP POLICY IF EXISTS "parity_config_admin"             ON rate_parity_config;
DROP POLICY IF EXISTS "parity_checks_admin"             ON rate_parity_checks;
DROP POLICY IF EXISTS "parity_results_admin"            ON rate_parity_results;
DROP POLICY IF EXISTS "parity_alerts_admin"             ON rate_parity_alerts;


-- ============================================================================
-- 3A. PUBLIC READ — anon + authenticated can SELECT config/display data
-- ============================================================================

-- Customization system (public catalog data)
CREATE POLICY "public_read_customization_groups"
  ON customization_groups FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_customization_options"
  ON customization_options FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_entity_customizations"
  ON entity_customizations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Loyalty settings (public config)
CREATE POLICY "public_read_loyalty_settings"
  ON loyalty_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Terminology overrides (localisation data — public read)
CREATE POLICY "public_read_terminology"
  ON terminology_overrides FOR SELECT
  TO anon, authenticated
  USING (true);


-- ============================================================================
-- 3B. STAFF OPERATIONAL — staff/admin/manager can read + modify
-- ============================================================================

-- Order customizations: staff and admin only
CREATE POLICY "staff_manage_order_customizations"
  ON order_customizations FOR ALL
  TO authenticated
  USING  (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'))
  WITH CHECK (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

-- Housekeeping: staff/admin can read, admin can modify
CREATE POLICY "staff_read_housekeeping_sla"
  ON housekeeping_sla FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_housekeeping_inspections"
  ON housekeeping_inspections FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_housekeeping_supplies"
  ON housekeeping_supplies FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

-- Inventory: staff/admin can read
CREATE POLICY "staff_read_inventory_recipes"
  ON inventory_recipes FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_inventory_ingredients"
  ON inventory_recipe_ingredients FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_inventory_wastage"
  ON inventory_wastage FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_inventory_variance"
  ON inventory_variance FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_inventory_suppliers"
  ON inventory_suppliers FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_inventory_po"
  ON inventory_purchase_orders FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_read_inventory_batches"
  ON inventory_batches FOR SELECT
  TO authenticated
  USING (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

-- Menu modifier groups and options: staff/admin manage
CREATE POLICY "staff_manage_modifier_groups"
  ON menu_modifier_groups FOR ALL
  TO authenticated
  USING  (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'))
  WITH CHECK (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_manage_modifier_options"
  ON menu_modifier_options FOR ALL
  TO authenticated
  USING  (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'))
  WITH CHECK (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

-- Cash drawers and transactions: staff/admin
CREATE POLICY "staff_manage_cash_drawers"
  ON cash_drawers FOR ALL
  TO authenticated
  USING  (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'))
  WITH CHECK (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

CREATE POLICY "staff_manage_cash_transactions"
  ON cash_transactions FOR ALL
  TO authenticated
  USING  (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'))
  WITH CHECK (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));

-- Waitlist: staff/admin
CREATE POLICY "staff_manage_waitlist"
  ON waitlist_entries FOR ALL
  TO authenticated
  USING  (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'))
  WITH CHECK (user_has_role('staff') OR user_has_role('manager') OR user_has_role('admin'));


-- ============================================================================
-- 3C. ADMIN ONLY — full access restricted to admin / manager roles
-- ============================================================================

-- Terminology overrides: admin write
CREATE POLICY "admin_manage_terminology"
  ON terminology_overrides FOR ALL
  TO authenticated
  USING      (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Two-factor auth: admin only (security-sensitive)
CREATE POLICY "admin_manage_2fa"
  ON two_factor_auth FOR ALL
  TO authenticated
  USING      (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

-- GDPR tables
CREATE POLICY "admin_manage_gdpr_retention"
  ON gdpr_retention_policies FOR ALL TO authenticated
  USING (user_has_role('admin')) WITH CHECK (user_has_role('admin'));

CREATE POLICY "admin_manage_gdpr_processing"
  ON gdpr_processing_activities FOR ALL TO authenticated
  USING (user_has_role('admin')) WITH CHECK (user_has_role('admin'));

-- Guest / CRM tables
CREATE POLICY "admin_manage_guests"
  ON guests FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_guest_segments"
  ON guest_segments FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_segment_members"
  ON segment_members FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Marketing / Campaign tables
CREATE POLICY "admin_manage_email_templates"
  ON marketing_email_templates FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_campaigns"
  ON marketing_campaigns FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_journeys"
  ON email_journeys FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_journey_steps"
  ON journey_steps FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_enrollments"
  ON journey_enrollments FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_campaign_sends"
  ON campaign_sends FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Messaging tables
CREATE POLICY "admin_manage_messaging_channels"
  ON messaging_channels FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_guest_msg_prefs"
  ON guest_messaging_preferences FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_conversations"
  ON conversations FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager') OR user_has_role('staff'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager') OR user_has_role('staff'));

CREATE POLICY "admin_manage_messages"
  ON messages FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager') OR user_has_role('staff'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager') OR user_has_role('staff'));

CREATE POLICY "admin_manage_message_templates"
  ON message_templates FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_chatbot_intents"
  ON chatbot_intents FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Reporting tables
CREATE POLICY "admin_manage_report_templates"
  ON report_templates FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_saved_reports"
  ON saved_reports FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_scheduled_reports"
  ON report_scheduled FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_report_executions"
  ON report_executions FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_dashboard_widgets"
  ON dashboard_widgets FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Revenue management tables
CREATE POLICY "admin_manage_demand_forecasts"
  ON demand_forecasts FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_pricing_rules"
  ON pricing_rules FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_rate_recommendations"
  ON rate_recommendations FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_market_events"
  ON market_events FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_competitor_rates"
  ON competitor_rates FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Group reservations / events tables
CREATE POLICY "admin_manage_group_reservations"
  ON group_reservations FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_group_room_blocks"
  ON group_room_blocks FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_group_bookings"
  ON group_bookings FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_group_events"
  ON group_events FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_group_contracts"
  ON group_contracts FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_group_invoices"
  ON group_invoices FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_group_payments"
  ON group_payments FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_group_activities"
  ON group_activities FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Pre-arrival / digital check-in tables
CREATE POLICY "admin_manage_registrations"
  ON pre_arrival_registrations FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_reg_documents"
  ON registration_documents FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_digital_signatures"
  ON digital_signatures FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Mobile keys
CREATE POLICY "admin_manage_mobile_keys"
  ON mobile_keys FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_mobile_key_log"
  ON mobile_key_access_log FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

-- Rate parity tables
CREATE POLICY "admin_manage_parity_config"
  ON rate_parity_config FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_parity_checks"
  ON rate_parity_checks FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_parity_results"
  ON rate_parity_results FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));

CREATE POLICY "admin_manage_parity_alerts"
  ON rate_parity_alerts FOR ALL TO authenticated
  USING (user_has_role('admin') OR user_has_role('manager'))
  WITH CHECK (user_has_role('admin') OR user_has_role('manager'));


-- ============================================================================
-- 4. GRANT USAGE on helper function to relevant roles
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO anon, authenticated;

COMMIT;
