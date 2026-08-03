-- =============================================================================
-- Migration: Complete RLS Coverage
-- Date: 2026-05-18
-- Purpose: Enable Row Level Security on all tables that were missing policies.
--          54 tables covered across 3 risk tiers (high / medium / low).
--          All policies follow the established pattern in this codebase:
--            Staff/admin check: EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN (...))
-- =============================================================================


-- =============================================================================
-- HIGH RISK — Auth, permissions, financial audit, biometrics
-- =============================================================================

-- password_history
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own password history" ON password_history;
DROP POLICY IF EXISTS "Admins can view all password history" ON password_history;
DROP POLICY IF EXISTS "System can insert password history" ON password_history;
CREATE POLICY "Users can view their own password history"
    ON password_history FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "Admins can view all password history"
    ON password_history FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "System can insert password history"
    ON password_history FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- biometric_credentials
ALTER TABLE biometric_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own biometric credentials" ON biometric_credentials;
DROP POLICY IF EXISTS "Admins can view biometric credentials" ON biometric_credentials;
CREATE POLICY "Users can manage their own biometric credentials"
    ON biometric_credentials FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view biometric credentials"
    ON biometric_credentials FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- security_audit_log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view security audit log" ON security_audit_log;
DROP POLICY IF EXISTS "System can insert security audit log" ON security_audit_log;
CREATE POLICY "Admins can view security audit log"
    ON security_audit_log FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "System can insert security audit log"
    ON security_audit_log FOR INSERT
    WITH CHECK (true);

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- two_factor_pending
ALTER TABLE two_factor_pending ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own 2FA pending" ON two_factor_pending;
CREATE POLICY "Users can manage their own 2FA pending"
    ON two_factor_pending FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- permissions
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage permissions" ON permissions;
DROP POLICY IF EXISTS "Staff can view permissions" ON permissions;
CREATE POLICY "Admins can manage permissions"
    ON permissions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Staff can view permissions"
    ON permissions FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
    );

-- roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Staff can view roles" ON roles;
CREATE POLICY "Admins can manage roles"
    ON roles FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Staff can view roles"
    ON roles FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Staff can view role permissions" ON role_permissions;
CREATE POLICY "Admins can manage role permissions"
    ON role_permissions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Staff can view role permissions"
    ON role_permissions FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage user permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
CREATE POLICY "Admins can manage user permissions"
    ON user_permissions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Users can view their own permissions"
    ON user_permissions FOR SELECT
    USING (user_id = auth.uid());

-- user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Admins can manage user roles"
    ON user_roles FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    USING (user_id = auth.uid());

-- app_permissions
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage app permissions" ON app_permissions;
DROP POLICY IF EXISTS "Staff can view app permissions" ON app_permissions;
CREATE POLICY "Admins can manage app permissions"
    ON app_permissions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Staff can view app permissions"
    ON app_permissions FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- app_role_permissions
ALTER TABLE app_role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage app role permissions" ON app_role_permissions;
DROP POLICY IF EXISTS "Staff can view app role permissions" ON app_role_permissions;
CREATE POLICY "Admins can manage app role permissions"
    ON app_role_permissions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Staff can view app role permissions"
    ON app_role_permissions FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- gift_card_ledger
ALTER TABLE gift_card_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own gift card ledger" ON gift_card_ledger;
DROP POLICY IF EXISTS "Staff can manage gift card ledger" ON gift_card_ledger;
CREATE POLICY "Users can view their own gift card ledger"
    ON gift_card_ledger FOR SELECT
    USING (
        gift_card_id IN (
            SELECT id FROM gift_cards
            WHERE purchased_by = auth.uid()
               OR recipient_email = (SELECT email FROM users WHERE id = auth.uid())
        )
    );
CREATE POLICY "Staff can manage gift card ledger"
    ON gift_card_ledger FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
    );

-- pos_reconciliation
ALTER TABLE pos_reconciliation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and managers can manage POS reconciliation" ON pos_reconciliation;
CREATE POLICY "Admins and managers can manage POS reconciliation"
    ON pos_reconciliation FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );

-- reconciliation_log
ALTER TABLE reconciliation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and managers can view reconciliation log" ON reconciliation_log;
DROP POLICY IF EXISTS "System can insert reconciliation log" ON reconciliation_log;
CREATE POLICY "Admins and managers can view reconciliation log"
    ON reconciliation_log FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );
CREATE POLICY "System can insert reconciliation log"
    ON reconciliation_log FOR INSERT
    WITH CHECK (true);

-- loyalty_profiles
ALTER TABLE loyalty_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own loyalty profile" ON loyalty_profiles;
DROP POLICY IF EXISTS "Staff can manage loyalty profiles" ON loyalty_profiles;
CREATE POLICY "Users can view their own loyalty profile"
    ON loyalty_profiles FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "Staff can manage loyalty profiles"
    ON loyalty_profiles FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
    );

-- user_credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
DROP POLICY IF EXISTS "Staff can manage user credits" ON user_credits;
CREATE POLICY "Users can view their own credits"
    ON user_credits FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "Staff can manage user credits"
    ON user_credits FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
    );


-- =============================================================================
-- MEDIUM RISK — Bookings, orders, sessions, operational tables
-- =============================================================================

-- chalet_add_ons non-canonical — no-op

-- chalet_amenities non-canonical — no-op

-- chalet_blocked_dates non-canonical — no-op

-- chalet_images non-canonical — no-op

-- accommodation_unit_price_rules
ALTER TABLE accommodation_unit_price_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view unit price rules" ON accommodation_unit_price_rules;
DROP POLICY IF EXISTS "Admins can manage unit price rules" ON accommodation_unit_price_rules;
CREATE POLICY "Staff can view unit price rules"
    ON accommodation_unit_price_rules FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "Admins can manage unit price rules"
    ON accommodation_unit_price_rules FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Staff can manage sessions" ON sessions;
CREATE POLICY "Users can view their own sessions"
    ON sessions FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "Staff can manage sessions"
    ON sessions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- pool_memberships non-canonical — no-op

-- capacity_windows
ALTER TABLE capacity_windows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own capacity windows" ON capacity_windows;
DROP POLICY IF EXISTS "Public can view capacity windows" ON capacity_windows;
DROP POLICY IF EXISTS "Staff can manage capacity windows" ON capacity_windows;
CREATE POLICY "Public can view capacity windows"
    ON capacity_windows FOR SELECT
    USING (true);
CREATE POLICY "Staff can manage capacity windows"
    ON capacity_windows FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- membership_members non-canonical — no-op

-- staff_shifts
ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view their own shifts" ON staff_shifts;
DROP POLICY IF EXISTS "Managers can manage all shifts" ON staff_shifts;
CREATE POLICY "Staff can view their own shifts"
    ON staff_shifts FOR SELECT
    USING (staff_id = auth.uid());
CREATE POLICY "Managers can manage all shifts"
    ON staff_shifts FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );

-- shift_swap_requests
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view shift swap requests they are part of" ON shift_swap_requests;
DROP POLICY IF EXISTS "Managers can manage all shift swap requests" ON shift_swap_requests;
CREATE POLICY "Staff can view shift swap requests they are part of"
    ON shift_swap_requests FOR SELECT
    USING (
        requesting_staff_id = auth.uid() OR target_staff_id = auth.uid()
    );
CREATE POLICY "Managers can manage all shift swap requests"
    ON shift_swap_requests FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );

-- manager_approvals
ALTER TABLE manager_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view approvals relevant to them" ON manager_approvals;
DROP POLICY IF EXISTS "Managers can manage approvals" ON manager_approvals;
CREATE POLICY "Staff can view approvals relevant to them"
    ON manager_approvals FOR SELECT
    USING (
        requested_by = auth.uid()
        OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                   WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );
CREATE POLICY "Managers can manage approvals"
    ON manager_approvals FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );

-- manager_notification_settings
ALTER TABLE manager_notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can manage their own notification settings" ON manager_notification_settings;
DROP POLICY IF EXISTS "Admins can view all manager notification settings" ON manager_notification_settings;
CREATE POLICY "Managers can manage their own notification settings"
    ON manager_notification_settings FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all manager notification settings"
    ON manager_notification_settings FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- inventory_purchase_order_items
ALTER TABLE inventory_purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view inventory purchase order items" ON inventory_purchase_order_items;
DROP POLICY IF EXISTS "Admins can manage inventory purchase order items" ON inventory_purchase_order_items;
CREATE POLICY "Staff can view inventory purchase order items"
    ON inventory_purchase_order_items FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "Admins can manage inventory purchase order items"
    ON inventory_purchase_order_items FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );


-- =============================================================================
-- LOW RISK — Config, catalog, reporting, telemetry
-- =============================================================================

-- catalog_items
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active menu items" ON catalog_items;
DROP POLICY IF EXISTS "Staff can manage menu items" ON catalog_items;
CREATE POLICY "Public can view active menu items"
    ON catalog_items FOR SELECT
    USING (is_available = true);
CREATE POLICY "Staff can manage menu items"
    ON catalog_items FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- catalog_categories
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active menu categories" ON catalog_categories;
DROP POLICY IF EXISTS "Staff can manage menu categories" ON catalog_categories;
CREATE POLICY "Public can view active menu categories"
    ON catalog_categories FOR SELECT
    USING (is_active = true);
CREATE POLICY "Staff can manage menu categories"
    ON catalog_categories FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- menu_item_modifiers
ALTER TABLE menu_item_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view menu item modifiers" ON menu_item_modifiers;
DROP POLICY IF EXISTS "Staff can manage menu item modifiers" ON menu_item_modifiers;
CREATE POLICY "Public can view menu item modifiers"
    ON menu_item_modifiers FOR SELECT
    USING (true);
CREATE POLICY "Staff can manage menu item modifiers"
    ON menu_item_modifiers FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- menu_item_ingredients
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view menu item ingredients" ON menu_item_ingredients;
DROP POLICY IF EXISTS "Admins can manage menu item ingredients" ON menu_item_ingredients;
CREATE POLICY "Staff can view menu item ingredients"
    ON menu_item_ingredients FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "Admins can manage menu item ingredients"
    ON menu_item_ingredients FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- pool_daily_capacity non-canonical — no-op

-- site_settings
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can manage site settings" ON site_settings;
CREATE POLICY "Public can view site settings"
    ON site_settings FOR SELECT
    USING (true);
CREATE POLICY "Admins can manage site settings"
    ON site_settings FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage email templates" ON email_templates;
DROP POLICY IF EXISTS "Staff can view email templates" ON email_templates;
CREATE POLICY "Admins can manage email templates"
    ON email_templates FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "Staff can view email templates"
    ON email_templates FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- housekeeping_logs
ALTER TABLE housekeeping_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage housekeeping logs" ON housekeeping_logs;
CREATE POLICY "Staff can manage housekeeping logs"
    ON housekeeping_logs FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );

-- housekeeping_schedules
ALTER TABLE housekeeping_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view housekeeping schedules" ON housekeeping_schedules;
DROP POLICY IF EXISTS "Managers can manage housekeeping schedules" ON housekeeping_schedules;
CREATE POLICY "Staff can view housekeeping schedules"
    ON housekeeping_schedules FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "Managers can manage housekeeping schedules"
    ON housekeeping_schedules FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );

-- inventory_bom
ALTER TABLE inventory_bom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view inventory BOM" ON inventory_bom;
DROP POLICY IF EXISTS "Admins can manage inventory BOM" ON inventory_bom;
CREATE POLICY "Staff can view inventory BOM"
    ON inventory_bom FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "Admins can manage inventory BOM"
    ON inventory_bom FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- inventory_consumption
ALTER TABLE inventory_consumption ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view inventory consumption" ON inventory_consumption;
DROP POLICY IF EXISTS "System can insert inventory consumption" ON inventory_consumption;
CREATE POLICY "Staff can view inventory consumption"
    ON inventory_consumption FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "System can insert inventory consumption"
    ON inventory_consumption FOR INSERT
    WITH CHECK (true);

-- loyalty_fraud_flags
ALTER TABLE loyalty_fraud_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage loyalty fraud flags" ON loyalty_fraud_flags;
CREATE POLICY "Admins can manage loyalty fraud flags"
    ON loyalty_fraud_flags FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- loyalty_point_batches
ALTER TABLE loyalty_point_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own loyalty point batches" ON loyalty_point_batches;
DROP POLICY IF EXISTS "Staff can manage loyalty point batches" ON loyalty_point_batches;
CREATE POLICY "Users can view their own loyalty point batches"
    ON loyalty_point_batches FOR SELECT
    USING (
        user_id = auth.uid()
    );
CREATE POLICY "Staff can manage loyalty point batches"
    ON loyalty_point_batches FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
    );

-- backups
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage backups" ON backups;
CREATE POLICY "Admins can manage backups"
    ON backups FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- cancellation_policies
ALTER TABLE cancellation_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view cancellation policies" ON cancellation_policies;
DROP POLICY IF EXISTS "Admins can manage cancellation policies" ON cancellation_policies;
CREATE POLICY "Public can view cancellation policies"
    ON cancellation_policies FOR SELECT
    USING (true);
CREATE POLICY "Admins can manage cancellation policies"
    ON cancellation_policies FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- customization_dual_write_log
ALTER TABLE customization_dual_write_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view customization dual write log" ON customization_dual_write_log;
DROP POLICY IF EXISTS "System can insert customization dual write log" ON customization_dual_write_log;
CREATE POLICY "Admins can view customization dual write log"
    ON customization_dual_write_log FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "System can insert customization dual write log"
    ON customization_dual_write_log FOR INSERT
    WITH CHECK (true);

-- guest_pass_usage non-canonical — no-op

-- metric_definitions
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view metric definitions" ON metric_definitions;
DROP POLICY IF EXISTS "Admins can manage metric definitions" ON metric_definitions;
CREATE POLICY "Staff can view metric definitions"
    ON metric_definitions FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "Admins can manage metric definitions"
    ON metric_definitions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );

-- ref_type_telemetry
ALTER TABLE ref_type_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view ref type telemetry" ON ref_type_telemetry;
DROP POLICY IF EXISTS "System can insert ref type telemetry" ON ref_type_telemetry;
CREATE POLICY "Admins can view ref type telemetry"
    ON ref_type_telemetry FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin'))
    );
CREATE POLICY "System can insert ref type telemetry"
    ON ref_type_telemetry FOR INSERT
    WITH CHECK (true);

-- report_daily_sales
ALTER TABLE report_daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view daily sales reports" ON report_daily_sales;
DROP POLICY IF EXISTS "System can insert daily sales reports" ON report_daily_sales;
CREATE POLICY "Staff can view daily sales reports"
    ON report_daily_sales FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "System can insert daily sales reports"
    ON report_daily_sales FOR INSERT
    WITH CHECK (true);

-- report_hourly_metrics
ALTER TABLE report_hourly_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view hourly metrics reports" ON report_hourly_metrics;
DROP POLICY IF EXISTS "System can insert hourly metrics reports" ON report_hourly_metrics;
CREATE POLICY "Staff can view hourly metrics reports"
    ON report_hourly_metrics FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "System can insert hourly metrics reports"
    ON report_hourly_metrics FOR INSERT
    WITH CHECK (true);

-- report_product_performance
ALTER TABLE report_product_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view product performance reports" ON report_product_performance;
DROP POLICY IF EXISTS "System can insert product performance reports" ON report_product_performance;
CREATE POLICY "Staff can view product performance reports"
    ON report_product_performance FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff', 'manager'))
    );
CREATE POLICY "System can insert product performance reports"
    ON report_product_performance FOR INSERT
    WITH CHECK (true);

-- time_clock_adjustments
ALTER TABLE time_clock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view their own time clock adjustments" ON time_clock_adjustments;
DROP POLICY IF EXISTS "Managers can manage all time clock adjustments" ON time_clock_adjustments;
CREATE POLICY "Staff can view their own time clock adjustments"
    ON time_clock_adjustments FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM staff_shifts WHERE staff_shifts.id = time_clock_adjustments.shift_id AND staff_shifts.staff_id = auth.uid())
    );
CREATE POLICY "Managers can manage all time clock adjustments"
    ON time_clock_adjustments FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager'))
    );
