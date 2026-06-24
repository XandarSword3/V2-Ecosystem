# Database Isolation Audit Report

Generated on: 2026-06-24T07:45:07.113Z

## Summary Metrics

| Metric | Count | Percentage |
| --- | --- | --- |
| **Total Tables** | 207 | 100% |
| **Fully Isolated (Tenant & Property Columns)** | 189 | 91.3% |
| **Tenant Column Only** | 12 | 5.8% |
| **Property Column Only** | 0 | 0.0% |
| **Missing Both Columns** | 6 | 2.9% |
| **RLS Enabled** | 207 | 100.0% |
| **RLS Disabled** | 0 | 0.0% |

## Detailed Table Breakdown

| Table Name | RLS Enabled | Policies | Has `tenant_id` | Has `property_id` | Isolation Type |
| --- | --- | --- | --- | --- | --- |
| `accommodation_unit_price_rules` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `accommodation_units` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `alert_definitions` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `alert_history` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `app_permissions` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `app_role_permissions` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `audit_logs` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `backups` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `biometric_credentials` | 🟢 Yes | 3 | ✅ Yes | ❌ No | Tenant Only |
| `booking_reviews` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `campaign_sends` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `cancellation_policies` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `capacity_windows` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `cash_drawers` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `cash_transactions` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `catalog_categories` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `catalog_items` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `channel_availability_updates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `channel_connections` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `channel_rate_mappings` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `channel_rate_updates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `channel_reservations` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `channel_room_mappings` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `channel_sync_log` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `chargebacks` | 🟢 Yes | 5 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `chatbot_intents` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `competitor_rates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `conversations` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `coupon_usage` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `coupons` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `currencies` | 🟢 Yes | 4 | ❌ No | ❌ No | None |
| `customization_dual_write_log` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `customization_events` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `customization_groups` | 🟢 Yes | 5 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `customization_metrics` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `customization_options` | 🟢 Yes | 5 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `dashboard_widgets` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `demand_forecasts` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `device_tokens` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `digital_signatures` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `email_bounces` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `email_journeys` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `email_suppression_list` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `email_templates` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `engine_compensation_log` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `engine_feature_flags` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `engine_financial_ledger` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `engine_idempotency_keys` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `engine_loyalty_events` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `engine_state_transitions` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `entity_customizations` | 🟢 Yes | 5 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `faqs` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gdpr_consents` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gdpr_cookie_consents` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gdpr_data_sharing_log` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gdpr_deletion_requests` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gdpr_export_requests` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gdpr_processing_activities` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gdpr_retention_policies` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gift_card_ledger` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gift_card_templates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gift_card_transactions` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `gift_cards` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_activities` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_bookings` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_contracts` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_events` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_invoices` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_payments` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_rate_templates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_report_schedules` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_reservations` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_room_blocks` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `group_settings` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `guest_messaging_preferences` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `guest_rfm_scores` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `guest_segments` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `guests` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_inspections` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_logs` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_schedules` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_sla` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_supplies` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_task_comments` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_task_types` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `housekeeping_tasks` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_alerts` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_batches` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_bom` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_categories` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_consumption` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_items` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_purchase_order_items` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_purchase_orders` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_recipe_ingredients` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_recipes` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_suppliers` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_transactions` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_variance` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `inventory_wastage` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `journey_enrollments` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `journey_steps` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_analytics` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_devices` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_hardware_events` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_items` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_key_stock` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_screen_content` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_screen_flows` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_sessions` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `kiosk_transactions` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_fraud_flags` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_members` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_point_batches` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_profiles` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_redemptions` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_rewards` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_settings` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_tiers` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `loyalty_transactions` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `manager_approvals` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `manager_notification_settings` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `market_events` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `marketing_campaigns` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `marketing_email_templates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `menu_item_ingredients` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `menu_item_modifiers` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `menu_modifier_groups` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `menu_modifier_options` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `message_templates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `messages` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `messaging_channels` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `metric_definitions` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `mobile_key_access_log` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `mobile_keys` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `module_templates` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `modules` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `notification_broadcasts` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `notification_logs` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `notification_templates` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `notifications` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `order_customizations` | 🟢 Yes | 5 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `order_items` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `order_payment_splits` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `password_history` | 🟢 Yes | 4 | ✅ Yes | ❌ No | Tenant Only |
| `payment_ledger` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `payments` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `permissions` | 🟢 Yes | 3 | ✅ Yes | ❌ No | Tenant Only |
| `plans` | 🟢 Yes | 3 | ❌ No | ❌ No | None |
| `pos_reconciliation` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `pre_arrival_registrations` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `price_history` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `pricing_rules` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `product_reviews` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `properties` | 🟢 Yes | 4 | ✅ Yes | ❌ No | Tenant Only |
| `property_benchmarks` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `property_groups` | 🟢 Yes | 2 | ✅ Yes | ❌ No | Tenant Only |
| `property_settings` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `rate_parity_alerts` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `rate_parity_checks` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `rate_parity_config` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `rate_parity_results` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `rate_recommendations` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `reconciliation_log` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `ref_type_telemetry` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `registration_documents` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `report_daily_sales` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `report_executions` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `report_hourly_metrics` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `report_product_performance` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `report_scheduled` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `report_templates` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `reviews` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `role_permissions` | 🟢 Yes | 3 | ✅ Yes | ❌ No | Tenant Only |
| `roles` | 🟢 Yes | 3 | ✅ Yes | ❌ No | Tenant Only |
| `saved_queries` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `saved_reports` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `seasonal_pricing_rules` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `security_audit_log` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `segment_members` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `session_reviews` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `sessions` | 🟢 Yes | 3 | ✅ Yes | ❌ No | Tenant Only |
| `shared_inventory_allocations` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `shift_swap_requests` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `site_settings` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `staff_shifts` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `support_inquiries` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `supported_languages` | 🟢 Yes | 2 | ❌ No | ❌ No | None |
| `system_config` | 🟢 Yes | 2 | ❌ No | ❌ No | None |
| `system_defaults` | 🟢 Yes | 2 | ❌ No | ❌ No | None |
| `system_settings` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `tenants` | 🟢 Yes | 2 | ❌ No | ❌ No | None |
| `terminology_overrides` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `time_clock_adjustments` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `token_blacklist` | 🟢 Yes | 2 | ✅ Yes | ❌ No | Tenant Only |
| `transactions` | 🟢 Yes | 2 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `translations` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `two_factor_auth` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `two_factor_pending` | 🟢 Yes | 2 | ✅ Yes | ❌ No | Tenant Only |
| `user_credits` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `user_group_access` | 🟢 Yes | 1 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `user_permissions` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `user_property_access` | 🟢 Yes | 3 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `user_roles` | 🟢 Yes | 3 | ✅ Yes | ❌ No | Tenant Only |
| `users` | 🟢 Yes | 3 | ✅ Yes | ❌ No | Tenant Only |
| `waitlist_entries` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
| `webhook_failures` | 🟢 Yes | 4 | ✅ Yes | ✅ Yes | Both (Tenant & Property) |
