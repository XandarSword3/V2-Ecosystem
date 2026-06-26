# V2 Ecosystem - Database Column Audit Report
*Generated: 6/25/2026, 6:16:16 PM*

## 🗄️ Table: `accommodation_units`
### ❌ Missing Column: `current_tasks`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `priority`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `sla_due`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `status`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `task_type`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `unit_number`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping.controller.ts`

---

## 🗄️ Table: `alert_history`
### ❌ Missing Column: `definition`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\analytics\alert.service.ts`

### ❌ Missing Column: `kpi_code`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\analytics\alert.service.ts`

---

## 🗄️ Table: `audit_logs`
### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\controllers\audit.controller.ts`

### ❌ Missing Column: `remetadata`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\users\gdpr.controller.ts`

### ❌ Missing Column: `remetadata_id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\users\gdpr.controller.ts`

### ❌ Missing Column: `users`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\controllers\audit.controller.ts`

---

## 🗄️ Table: `backups`
### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\services\backup.service.ts`

---

## 🗄️ Table: `capacity_windows`
### ❌ Missing Column: `customer_id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `status`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `tickets`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `user`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

---

## 🗄️ Table: `channel_rate_mappings`
### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\channels\channel.service.ts`

---

## 🗄️ Table: `channel_room_mappings`
### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\channels\channel.service.ts`

---

## 🗄️ Table: `chargebacks`
### ❌ Missing Column: `description`
- Referenced in: `[SUPABASE SELECT] backend\src\services\chargeback.service.ts`

### ❌ Missing Column: `payment`
- Referenced in: `[SUPABASE SELECT] backend\src\services\chargeback.service.ts`

### ❌ Missing Column: `stripe_payment_intent_id`
- Referenced in: `[SUPABASE SELECT] backend\src\services\chargeback.service.ts`

### ❌ Missing Column: `user_id`
- Referenced in: `[SUPABASE SELECT] backend\src\services\chargeback.service.ts`

---

## 🗄️ Table: `competitor_rates`
### ❌ Missing Column: `date`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\revenue\revenue.service.ts`

---

## 🗄️ Table: `coupon_usage`
### ❌ Missing Column: `count`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\promotions\promotions.controller.ts`

### ❌ Missing Column: `created_at`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\promotions\promotions.controller.ts`

### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\coupons\coupon.controller.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\coupons\coupon.controller.ts`

---

## 🗄️ Table: `coupons`
### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\coupons\coupon.controller.ts`

---

## 🗄️ Table: `dashboard_widgets`
### ❌ Missing Column: `saved_report`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reporting\reporting.service.ts`

### ❌ Missing Column: `template`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reporting\reporting.service.ts`

---

## 🗄️ Table: `demand_forecasts`
### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\revenue\revenue.service.ts`

---

## 🗄️ Table: `gift_card_ledger`
### ❌ Missing Column: `transaction_type`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\promotions\promotions.controller.ts`

---

## 🗄️ Table: `housekeeping_supplies`
### ❌ Missing Column: `current_stock`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `inventory_item`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `unit`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

---

## 🗄️ Table: `inventory_purchase_orders`
### ❌ Missing Column: `items`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

---

## 🗄️ Table: `inventory_recipes`
### ❌ Missing Column: `cost_per_unit`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `current_stock`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `ingredients`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `inventory_item`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `is_optional`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `quantity`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `unit`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

---

## 🗄️ Table: `inventory_variance`
### ❌ Missing Column: `cost_per_unit`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `counter`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `item`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `sku`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

### ❌ Missing Column: `unit`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

---

## 🗄️ Table: `journey_steps`
### ❌ Missing Column: `clicks_count`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `opens_count`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `sends_count`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `subject`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

---

## 🗄️ Table: `loyalty_members`
### ❌ Missing Column: `color`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\loyalty\loyalty.controller.ts`

### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\loyalty\loyalty.controller.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\loyalty\loyalty.controller.ts`

### ❌ Missing Column: `tier`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\loyalty\loyalty.controller.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\users\gdpr.controller.ts`

### ❌ Missing Column: `user`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\loyalty\loyalty.controller.ts`

---

## 🗄️ Table: `marketing_campaigns`
### ❌ Missing Column: `clicked_count`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `html_content`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `opened_count`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `text_content`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `unsubscribed_count`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

### ❌ Missing Column: `variables`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

---

## 🗄️ Table: `marketing_email_templates`
### ❌ Missing Column: `version`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\marketing\marketing.service.ts`

---

## 🗄️ Table: `memberships`
### ❌ Missing Column: `users`
- Referenced in: `[SUPABASE SELECT] backend\src\routes\dynamic-module.router.ts`

---

## 🗄️ Table: `menu_item_ingredients`
### ❌ Missing Column: `quantity_needed`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory.controller.ts`

---

## 🗄️ Table: `mobile_keys`
### ❌ Missing Column: `confirmation_number`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `room_number`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

---

## 🗄️ Table: `modules`
### ❌ Missing Column: `config`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\bookings\bookings.service.ts`

---

## 🗄️ Table: `order_items`
### ❌ Missing Column: `product_id`
- Referenced in: `[SUPABASE SELECT] backend\src\engines\inventory-side-effects.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\inventory\inventory-advanced.controller.ts`

---

## 🗄️ Table: `payments`
### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\integrations\quickbooks\quickbooks.service.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\integrations\quickbooks\quickbooks.service.ts`

### ❌ Missing Column: `method`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\gdpr\gdpr.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\payments\payment.controller.ts`

### ❌ Missing Column: `notes`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\payments\payment.controller.ts`

### ❌ Missing Column: `processed_at`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\gdpr\gdpr.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\payments\payment.controller.ts`

---

## 🗄️ Table: `permissions`
### ❌ Missing Column: `remetadata`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\services\role.service.ts`

---

## 🗄️ Table: `pre_arrival_registrations`
### ❌ Missing Column: `address`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `check_in`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `check_out`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `confirmation_number`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `first_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `last_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `metadata_id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `started_at`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

---

## 🗄️ Table: `property_benchmarks`
### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\multi-property\multi-property.service.ts`

### ❌ Missing Column: `property_code`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\multi-property\multi-property.service.ts`

---

## 🗄️ Table: `rate_recommendations`
### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\revenue\revenue.service.ts`

---

## 🗄️ Table: `report_scheduled`
### ❌ Missing Column: `category`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reporting\reporting.service.ts`

### ❌ Missing Column: `template`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reporting\reporting.service.ts`

---

## 🗄️ Table: `reviews`
### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reviews\reviews.service.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reviews\reviews.service.ts`

### ❌ Missing Column: `is_approved`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reviews\reviews.service.ts`

### ❌ Missing Column: `profile_image_url`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reviews\reviews.service.ts`

### ❌ Missing Column: `service_type`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reviews\reviews.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\users\gdpr.controller.ts`

---

## 🗄️ Table: `roles`
### ❌ Missing Column: `permission`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\services\role.service.ts`

---

## 🗄️ Table: `saved_reports`
### ❌ Missing Column: `category`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reporting\reporting.service.ts`

### ❌ Missing Column: `template`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\reporting\reporting.service.ts`

---

## 🗄️ Table: `shift_swap_requests`
### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

### ❌ Missing Column: `original_shift`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

### ❌ Missing Column: `requester`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

### ❌ Missing Column: `staff`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

### ❌ Missing Column: `target`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

---

## 🗄️ Table: `site_settings`
### ❌ Missing Column: `id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\modules.controller.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\scripts\seed-footer.ts`

---

## 🗄️ Table: `staff_shifts`
### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

### ❌ Missing Column: `staff`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\staff.controller.ts`

---

## 🗄️ Table: `support_inquiries`
### ❌ Missing Column: `assignee`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\support\support.controller.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\support\support.controller.ts`

---

## 🗄️ Table: `tenants`
### ❌ Missing Column: `plan`
- Referenced in: `[SUPABASE SELECT] backend\src\middleware\tenantAccess.middleware.ts`

---

## 🗄️ Table: `transactions`
### ❌ Missing Column: `capacity`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `ends_at`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\analytics\guest-segmentation.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `max_capacity`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\messaging\messaging.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `phone`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\analytics\guest-segmentation.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `room_number`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\mobile-checkin\mobile-checkin.service.ts`

### ❌ Missing Column: `session`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `starts_at`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `total_amount`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\manager\shifts.controller.ts`

### ❌ Missing Column: `unit`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `unit_id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `user`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\staff\module-staff.controller.ts`

### ❌ Missing Column: `user_id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\analytics\guest-segmentation.service.ts`

### ❌ Missing Column: `users`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\analytics\guest-segmentation.service.ts`

---

## 🗄️ Table: `translations`
### ❌ Missing Column: `key_id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\i18n\i18n.service.ts`

### ❌ Missing Column: `key_path`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\i18n\i18n.service.ts`

---

## 🗄️ Table: `user_property_access`
### ❌ Missing Column: `email`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\multi-property\multi-property.service.ts`

### ❌ Missing Column: `full_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\multi-property\multi-property.service.ts`

---

## 🗄️ Table: `user_roles`
### ❌ Missing Column: `display_name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\users\user.controller.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\scripts\check-db.ts`

### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\auth\oauth.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\users\user.controller.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\scripts\check-db.ts`

### ❌ Missing Column: `role`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\users\user.controller.ts`

---

## 🗄️ Table: `users`
### ❌ Missing Column: `action`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`

### ❌ Missing Column: `department`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `description`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`

### ❌ Missing Column: `fraud_flag`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\promotions\promotions.controller.ts`

### ❌ Missing Column: `fraud_reason`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\promotions\promotions.controller.ts`

### ❌ Missing Column: `loyalty_points`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\promotions\promotions.controller.ts`

### ❌ Missing Column: `loyalty_tier`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\promotions\promotions.controller.ts`

### ❌ Missing Column: `name`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\services\user.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\giftcards\giftcard.controller.ts`

### ❌ Missing Column: `notification_preferences`
- Referenced in: `[SUPABASE SELECT] backend\src\services\notification-preferences.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\services\sms.service.ts`

### ❌ Missing Column: `permission`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\services\user.service.ts`

### ❌ Missing Column: `permission_id`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`

### ❌ Missing Column: `remetadata`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`

### ❌ Missing Column: `resource`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`

### ❌ Missing Column: `shift_end`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `shift_start`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\housekeeping\housekeeping-advanced.controller.ts`

### ❌ Missing Column: `slug`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\services\user.service.ts`
- Referenced in: `[SUPABASE SELECT] backend\src\modules\admin\users.controller.ts`

---

## 🗄️ Table: `webhook_failures`
### ❌ Missing Column: `metadata`
- Referenced in: `[SUPABASE SELECT] backend\src\services\webhook-retry.service.ts`

---

