# Admin Guide: Settings & Configuration

> Module: ADM-SET | Features: 25 | Role: super_admin | Updated: 2026-02-08

## Overview

The Settings & Configuration module is the centralized control panel for the entire V2 Resort platform. From this module, administrators manage resort identity, visual appearance, payment processing, email templates, notification preferences, multi-language support, security policies, third-party integrations, CMS synchronization, backup/restore operations, maintenance mode, and system health monitoring.

All settings are stored in the Supabase PostgreSQL `settings` table as key-value pairs organized by namespace (e.g., `general.*`, `appearance.*`, `payments.*`). Changes to settings take effect immediately (or after a short Redis cache TTL expiry) and are broadcast via Socket.IO to connected admin clients. Sensitive settings (Stripe keys, SMTP passwords) are encrypted at rest using AES-256.

## Prerequisites

- **Role**: `super_admin` (all settings management is restricted to super_admin)
- **Login**: Navigate to `/admin/login` and authenticate (admin@v2resort.com / admin123)
- **Backend**: Express.js on `localhost:3005`
- **Frontend**: Next.js 14 on `localhost:3000`
- **Database**: Supabase PostgreSQL connected
- **Redis**: Connected for settings caching
- **Stripe Account**: Required for payment configuration
- **SMTP Server**: Required for email template configuration

## Features Covered

| ID | Feature Name | Type | Impact | Status |
|---|---|---|---|---|
| ADM-SET-001 | Resort Name & Branding | Config | High | ✅ Implemented |
| ADM-SET-002 | Logo Upload | Config | Medium | ✅ Implemented |
| ADM-SET-003 | Contact Information | Config | Medium | ✅ Implemented |
| ADM-SET-004 | Theme Selection (6 Themes) | Appearance | High | ✅ Implemented |
| ADM-SET-005 | Color Customization | Appearance | Medium | ✅ Implemented |
| ADM-SET-006 | Font Configuration | Appearance | Low | ✅ Implemented |
| ADM-SET-007 | Stripe API Key Configuration | Payment | Critical | ✅ Implemented |
| ADM-SET-008 | Currency Configuration | Payment | High | ✅ Implemented |
| ADM-SET-009 | Tax Settings | Payment | High | ✅ Implemented |
| ADM-SET-010 | Email Template Management | Communication | High | ✅ Implemented |
| ADM-SET-011 | Notification Settings | Communication | Medium | ✅ Implemented |
| ADM-SET-012 | Language Configuration (5 Locales) | i18n | High | ✅ Implemented |
| ADM-SET-013 | Default Language Setting | i18n | Medium | ✅ Implemented |
| ADM-SET-014 | RTL Layout Configuration | i18n | Medium | ✅ Implemented |
| ADM-SET-015 | Password Policy | Security | High | ✅ Implemented |
| ADM-SET-016 | Session Timeout Configuration | Security | High | ✅ Implemented |
| ADM-SET-017 | IP Whitelist | Security | High | ✅ Implemented |
| ADM-SET-018 | Two-Factor Authentication Settings | Security | High | ✅ Implemented |
| ADM-SET-019 | Google Analytics Integration | Integration | Medium | ✅ Implemented |
| ADM-SET-020 | Social Media Integration | Integration | Low | ✅ Implemented |
| ADM-SET-021 | CMS Sync Configuration | Integration | Medium | ✅ Implemented |
| ADM-SET-022 | Backup & Restore | Operations | Critical | ✅ Implemented |
| ADM-SET-023 | Maintenance Mode | Operations | High | ✅ Implemented |
| ADM-SET-024 | System Health Dashboard | Monitoring | High | ✅ Implemented |
| ADM-SET-025 | Audit Log Viewer | Security | Medium | ✅ Implemented |

## Dashboard Overview

- **URL**: `http://localhost:3000/admin/settings`
- **Layout**: Left sidebar with setting categories; main content area with the active settings panel
- **Categories** (sidebar navigation):
  - 🏢 General
  - 🎨 Appearance
  - 💳 Payments
  - ✉️ Email Templates
  - 🔔 Notifications
  - 🌐 Languages
  - 🔒 Security
  - 🔗 Integrations
  - 📋 CMS Sync
  - 💾 Backup & Restore
  - 🔧 Maintenance
  - 📊 System Health
  - 📜 Audit Logs
- **Save Behavior**: Each settings panel has its own **Save** button; changes are validated before submission
- **Unsaved Changes Warning**: Navigation away from a panel with unsaved changes triggers a confirmation dialog

## CRUD Operations

### General Settings (ADM-SET-001/002/003)

**URL**: `/admin/settings/general`

#### Resort Name & Branding (ADM-SET-001)

| Field | Type | Required | Validation Rules | Default |
|---|---|---|---|---|
| `resort_name` | text | Yes | 2-100 chars | "V2 Resort" |
| `resort_tagline` | text | No | Max 200 chars | — |
| `resort_description` | textarea | No | Max 1000 chars | — |
| `legal_name` | text | No | Business legal name, max 200 chars | — |
| `tax_id` | text | No | VAT/Tax ID number | — |
| `resort_timezone` | select | Yes | IANA timezone list | "Europe/Rome" |
| `date_format` | select | Yes | `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD` | `DD/MM/YYYY` |
| `time_format` | select | Yes | `24h`, `12h` | `24h` |

**API**: `PUT /api/admin/settings/general`

#### Logo Upload (ADM-SET-002)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `logo_primary` | file upload | No | SVG or PNG, max 2MB, recommended 300×80px | V2 Resort default |
| `logo_dark` | file upload | No | Logo variant for dark backgrounds | Same as primary |
| `logo_icon` | file upload | No | Square icon, SVG/PNG, max 1MB, 128×128px | Extracted from primary |
| `favicon` | file upload | No | ICO or PNG, 32×32px or 16×16px | Default |

Files are uploaded to Supabase Storage bucket `branding`. Old files are retained for 30 days before cleanup.

#### Contact Information (ADM-SET-003)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `contact_email` | email | Yes | Valid email format | admin@v2resort.com |
| `contact_phone` | text | No | International format, max 20 chars | — |
| `contact_address` | textarea | No | Max 500 chars | — |
| `contact_city` | text | No | Max 100 chars | — |
| `contact_country` | select | No | ISO 3166-1 country list | — |
| `contact_postal_code` | text | No | Max 20 chars | — |
| `google_maps_url` | URL | No | Valid Google Maps URL | — |
| `website_url` | URL | No | Valid URL | — |
| `support_email` | email | No | Valid email, for customer support | Same as contact_email |

### Appearance Settings (ADM-SET-004/005/006)

**URL**: `/admin/settings/appearance`

#### Theme Selection (ADM-SET-004)

1. Navigate to `/admin/settings/appearance`
2. **Available Themes** (6 pre-configured):

| Theme | Primary Color | Secondary Color | Accent | Style |
|---|---|---|---|---|
| **Default** | `#1976D2` (Blue) | `#FFFFFF` (White) | `#FF9800` (Orange) | Modern, clean |
| **Ocean** | `#006064` (Teal) | `#E0F7FA` (Light Cyan) | `#00BCD4` (Cyan) | Coastal, relaxed |
| **Forest** | `#2E7D32` (Green) | `#F1F8E9` (Light Green) | `#8BC34A` (Lime) | Natural, earthy |
| **Desert** | `#BF360C` (Deep Orange) | `#FBE9E7` (Light Orange) | `#FF5722` (Orange) | Warm, sandy |
| **Mountain** | `#37474F` (Blue Grey) | `#ECEFF1` (Light Grey) | `#607D8B` (Grey) | Rugged, slate |
| **Tropical** | `#F57F17` (Amber) | `#FFFDE7` (Light Yellow) | `#FFEB3B` (Yellow) | Vibrant, sunny |

3. Click a theme card to preview it in the live preview panel on the right
4. Click **Apply Theme** to save
5. Theme change takes effect immediately on all customer-facing pages
6. Admin panel uses a fixed admin theme (not affected by customer theme selection)

#### Color Customization (ADM-SET-005)

For advanced users who want to customize beyond the 6 preset themes:

| Field | Type | Validation | Description |
|---|---|---|---|
| `custom_primary` | color picker | Valid hex | Primary brand color |
| `custom_secondary` | color picker | Valid hex | Background/surface color |
| `custom_accent` | color picker | Valid hex | Call-to-action/highlight color |
| `custom_error` | color picker | Valid hex | Error state color |
| `custom_success` | color picker | Valid hex | Success state color |
| `custom_warning` | color picker | Valid hex | Warning state color |
| `custom_text_primary` | color picker | Valid hex | Main text color |
| `custom_text_secondary` | color picker | Valid hex | Subdued text color |

**Contrast Checker**: The UI shows a live WCAG contrast ratio for text-on-background combinations, flagging combinations below AA standard (4.5:1).

#### Font Configuration (ADM-SET-006)

| Field | Type | Options | Default |
|---|---|---|---|
| `heading_font` | select | Inter, Roboto, Poppins, Playfair Display, Montserrat, Open Sans, Lato, Raleway | Inter |
| `body_font` | select | Same as heading_font | Inter |
| `font_size_base` | select | `14px`, `15px`, `16px`, `17px`, `18px` | `16px` |
| `font_weight_heading` | select | `400`, `500`, `600`, `700`, `800` | `600` |
| `line_height` | select | `1.4`, `1.5`, `1.6`, `1.7`, `1.8` | `1.5` |

### Payment Configuration (ADM-SET-007/008/009)

**URL**: `/admin/settings/payments`

#### Stripe API Key Configuration (ADM-SET-007)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `stripe_publishable_key` | text | Yes | Starts with `pk_test_` or `pk_live_` | — |
| `stripe_secret_key` | password | Yes | Starts with `sk_test_` or `sk_live_` | — |
| `stripe_webhook_secret` | password | Yes | Starts with `whsec_` | — |
| `stripe_mode` | select | Yes | `test`, `live` | `test` |

**Security Notes**:
- Secret key is encrypted with AES-256 before storage; only first and last 4 characters displayed in the UI
- Webhook secret is never displayed after initial save
- Changing from `test` to `live` mode requires a confirmation dialog and re-entry of live keys
- **Test Connection** button verifies Stripe API connectivity before saving

**API**: `PUT /api/admin/settings/payments/stripe`

#### Currency Configuration (ADM-SET-008)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `primary_currency` | select | Yes | ISO 4217 currency codes | `EUR` |
| `additional_currencies` | multi-select | No | Up to 5 additional currencies | — |
| `currency_display_format` | select | Yes | `symbol` (€), `code` (EUR), `both` (€ EUR) | `symbol` |
| `decimal_separator` | select | Yes | `.` or `,` | `.` |
| `thousands_separator` | select | Yes | `,` or `.` or ` ` | `,` |
| `auto_conversion` | toggle | No | Enable auto currency conversion via exchange rate API | `false` |
| `exchange_rate_refresh` | select | Conditional | `hourly`, `daily`, `manual` | `daily` |

#### Tax Settings (ADM-SET-009)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `tax_enabled` | toggle | No | — | `true` |
| `default_tax_rate` | number | Conditional | 0-100 (percentage) | `22` (Italian VAT) |
| `tax_inclusive` | toggle | No | Prices include tax | `true` |
| `tax_label` | text | No | Display label, max 30 chars | "VAT" |
| `tax_id_required` | toggle | No | Require customer tax ID | `false` |
| `tax_exemptions` | multi-select | No | Module or category exemptions | — |

### Email Template Management (ADM-SET-010)

**URL**: `/admin/settings/email-templates`

#### Available Templates

| Template | Trigger | Variables Available |
|---|---|---|
| `welcome` | New customer registration | `{name}`, `{email}`, `{resort_name}` |
| `booking_confirmation` | Booking created | `{name}`, `{module}`, `{date}`, `{time}`, `{booking_id}`, `{total}` |
| `booking_cancellation` | Booking cancelled | `{name}`, `{module}`, `{booking_id}`, `{refund_amount}` |
| `order_confirmation` | Order placed | `{name}`, `{module}`, `{order_id}`, `{items}`, `{total}` |
| `order_ready` | Order ready for pickup/delivery | `{name}`, `{order_id}`, `{module}` |
| `payment_receipt` | Payment processed | `{name}`, `{amount}`, `{payment_method}`, `{transaction_id}` |
| `review_reply` | Admin replies to review | `{name}`, `{module}`, `{admin_reply}` |
| `password_reset` | Password reset requested | `{name}`, `{reset_link}`, `{expiry_time}` |
| `promotion_alert` | Promotion goes live | `{name}`, `{promotion_name}`, `{discount}`, `{expiry}` |
| `gift_card_received` | Gift card purchased for someone | `{recipient_name}`, `{sender_name}`, `{amount}`, `{code}` |

#### Editing Templates

1. Click any template from the list
2. **Editor Fields**:

| Field | Type | Required | Validation |
|---|---|---|---|
| `subject` | text | Yes | Max 200 chars, supports `{variables}` |
| `body_html` | rich text editor | Yes | HTML email body, max 50KB |
| `body_text` | textarea | Yes | Plain text fallback, max 10KB |
| `from_name` | text | No | Sender display name; defaults to resort name |
| `from_email` | email | No | Sender email; defaults to contact email |
| `reply_to` | email | No | Reply-to address |

3. **Preview** button → renders template with sample data in both HTML and plain text views
4. **Send Test** button → sends a test email to the admin's email address
5. **Locale Tabs** → each template has versions for all 5 locales (EN/AR/FR/DE/IT)
6. Click **Save Template** → PUT `/api/admin/settings/email-templates/{template_id}`

### Notification Settings (ADM-SET-011)

**URL**: `/admin/settings/notifications`

| Setting | Type | Options | Default | Description |
|---|---|---|---|---|
| `notify_new_order` | toggle | — | `true` | Admin notification on new orders |
| `notify_new_booking` | toggle | — | `true` | Admin notification on new bookings |
| `notify_low_rating` | toggle | — | `true` | Alert when review ≤ 2 stars |
| `notify_cancellation` | toggle | — | `true` | Alert on booking/order cancellation |
| `notify_payment_failure` | toggle | — | `true` | Alert on failed payment |
| `notify_channels` | multi-select | `email`, `in_app`, `sms` | `email`, `in_app` | Notification delivery channels |
| `admin_notification_emails` | email list | — | super_admin email | Recipients for admin alerts |
| `digest_frequency` | select | `immediate`, `hourly`, `daily` | `immediate` | How often to batch notifications |
| `quiet_hours_start` | time | HH:MM | `23:00` | No notifications after this time |
| `quiet_hours_end` | time | HH:MM | `07:00` | Resume notifications at this time |
| `sound_enabled` | toggle | — | `true` | In-app notification sound |

### Language Configuration (ADM-SET-012/013/014)

**URL**: `/admin/settings/languages`

#### Available Locales (ADM-SET-012)

| Locale | Code | Direction | Status |
|---|---|---|---|
| English | `en` | LTR | ✅ Enabled (Primary) |
| Arabic | `ar` | RTL | ✅ Enabled |
| French | `fr` | LTR | ✅ Enabled |
| German | `de` | LTR | ✅ Enabled |
| Italian | `it` | LTR | ✅ Enabled |

1. Each locale can be enabled/disabled individually
2. At least one locale must remain enabled
3. Disabling a locale hides the language option from the customer-facing language picker

#### Default Language (ADM-SET-013)

| Field | Type | Options | Default |
|---|---|---|---|
| `default_locale` | select | Enabled locales only | `en` |
| `fallback_locale` | select | Enabled locales only | `en` |
| `auto_detect_language` | toggle | — | `true` |

- `auto_detect_language`: Uses browser `Accept-Language` header to auto-select locale on first visit
- `fallback_locale`: Used when requested locale is unavailable or missing translation

#### RTL Layout Configuration (ADM-SET-014)

| Setting | Type | Options | Default |
|---|---|---|---|
| `rtl_locales` | multi-select | From enabled locales | `ar` |
| `rtl_mirror_layout` | toggle | — | `true` |
| `rtl_font_override` | select | Arabic-optimized fonts | "Noto Sans Arabic" |

When a customer selects Arabic, the entire UI flips to RTL layout with `dir="rtl"` on the HTML root, mirrored margins/padding, and right-aligned text.

### Security Settings (ADM-SET-015/016/017/018)

**URL**: `/admin/settings/security`

#### Password Policy (ADM-SET-015)

| Setting | Type | Validation | Default |
|---|---|---|---|
| `min_password_length` | number | 6-32 | `8` |
| `require_uppercase` | toggle | — | `true` |
| `require_lowercase` | toggle | — | `true` |
| `require_number` | toggle | — | `true` |
| `require_special_char` | toggle | — | `true` |
| `password_expiry_days` | number | 0 (never) to 365 | `0` (never) |
| `prevent_reuse_count` | number | 0-24 | `5` |
| `lockout_threshold` | number | 3-10 | `5` |
| `lockout_duration_min` | number | 1-60 | `15` |

Password policy applies to all user accounts (admin and customer).

#### Session Timeout (ADM-SET-016)

| Setting | Type | Validation | Default |
|---|---|---|---|
| `admin_session_timeout_min` | number | 5-480 | `60` |
| `customer_session_timeout_min` | number | 15-10080 | `1440` (24h) |
| `remember_me_duration_days` | number | 1-90 | `30` |
| `concurrent_sessions_max` | number | 1-10 | `3` |
| `force_logout_on_password_change` | toggle | — | `true` |

Session tokens are stored in Redis with TTL matching the configured timeout. JWT refresh tokens are rotated on each use.

#### IP Whitelist (ADM-SET-017)

1. Navigate to `/admin/settings/security` → **IP Whitelist** section
2. **Enable IP Whitelist** toggle (disabled by default)
3. When enabled, only whitelisted IPs can access `/admin/*` routes
4. **Add IP**:

| Field | Type | Required | Validation |
|---|---|---|---|
| `ip_address` | text | Yes | Valid IPv4 or IPv6, or CIDR notation (e.g., `192.168.1.0/24`) |
| `label` | text | No | Descriptive label (e.g., "Office Network") |
| `expires_at` | datetime | No | Optional expiry for temporary access |

5. **Current IP** is auto-detected and offered for one-click addition
6. **Safety**: Cannot remove the last whitelisted IP if the current request comes from it (prevents lockout)
7. **Emergency Override**: Can be disabled via environment variable `DISABLE_IP_WHITELIST=true` on the backend

#### Two-Factor Authentication (ADM-SET-018)

| Setting | Type | Options | Default |
|---|---|---|---|
| `require_2fa_admin` | toggle | — | `false` |
| `require_2fa_customer` | toggle | — | `false` |
| `2fa_methods` | multi-select | `totp` (authenticator app), `email`, `sms` | `totp`, `email` |
| `2fa_grace_period_days` | number | 0-30 | `7` |

- `require_2fa_admin`: When enabled, all admin accounts must set up 2FA on next login
- `2fa_grace_period_days`: Days before 2FA becomes mandatory after enable

### Integration Settings (ADM-SET-019/020/021)

**URL**: `/admin/settings/integrations`

#### Google Analytics (ADM-SET-019)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `ga_enabled` | toggle | No | — | `false` |
| `ga_measurement_id` | text | Conditional | Format: `G-XXXXXXXXXX` | — |
| `ga_track_ecommerce` | toggle | No | Enhanced ecommerce tracking | `true` |
| `ga_anonymize_ip` | toggle | No | GDPR compliance | `true` |
| `ga_cookie_consent_required` | toggle | No | Wait for cookie consent before tracking | `true` |

When enabled, the Google Analytics script is injected into customer-facing pages via Next.js `<Script>` component.

#### Social Media Integration (ADM-SET-020)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `facebook_url` | URL | No | Valid Facebook page URL | — |
| `instagram_url` | URL | No | Valid Instagram profile URL | — |
| `twitter_url` | URL | No | Valid Twitter/X profile URL | — |
| `tiktok_url` | URL | No | Valid TikTok profile URL | — |
| `linkedin_url` | URL | No | Valid LinkedIn page URL | — |
| `youtube_url` | URL | No | Valid YouTube channel URL | — |
| `show_social_links_footer` | toggle | No | Display social links in footer | `true` |
| `show_social_links_contact` | toggle | No | Display on contact page | `true` |
| `facebook_pixel_id` | text | No | Facebook Pixel tracking ID | — |

#### CMS Sync Configuration (ADM-SET-021)

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `cms_sync_enabled` | toggle | No | — | `false` |
| `cms_provider` | select | Conditional | `contentful`, `strapi`, `sanity`, `custom_api` | — |
| `cms_api_url` | URL | Conditional | Valid URL | — |
| `cms_api_key` | password | Conditional | — | — |
| `sync_frequency` | select | Conditional | `real_time`, `hourly`, `daily`, `manual` | `hourly` |
| `sync_content_types` | multi-select | Conditional | Pages, Blog Posts, Announcements, FAQs | — |
| `last_sync_at` | display | — | Read-only, shows last sync timestamp | — |

**Manual Sync** button triggers immediate content synchronization.

### Backup & Restore (ADM-SET-022)

**URL**: `/admin/settings/backup`

#### Create Backup

1. Click **Create Backup Now**
2. Select what to include:

| Component | Description | Default |
|---|---|---|
| Database | Full PostgreSQL dump | ✅ Included |
| Uploaded Files | Images, documents from Supabase Storage | ✅ Included |
| Settings | All configuration values | ✅ Included |
| Email Templates | HTML/text templates | ✅ Included |
| Translations | All locale strings | ✅ Included |

3. Click **Start Backup** → POST `/api/admin/settings/backup`
4. Progress bar shows backup status (database → files → settings → compression)
5. Completed backup appears in the backup list with:
   - Timestamp
   - Size (compressed)
   - Components included
   - Download link (expires in 24h)

#### Scheduled Backups

| Setting | Type | Options | Default |
|---|---|---|---|
| `auto_backup_enabled` | toggle | — | `true` |
| `auto_backup_frequency` | select | `daily`, `weekly`, `monthly` | `daily` |
| `auto_backup_time` | time | HH:MM | `03:00` |
| `auto_backup_retention` | number | 1-90 (days) | `30` |
| `backup_storage` | select | `local`, `supabase_storage`, `s3` | `supabase_storage` |

#### Restore from Backup

1. Click **Restore** on any backup from the list
2. Warning modal: "Restoring from backup will OVERWRITE current data. This action cannot be undone. Are you sure?"
3. Select components to restore (same checklist as backup)
4. Type "RESTORE" to confirm (safety measure)
5. Click **Restore** → POST `/api/admin/settings/restore/{backup_id}`
6. System enters maintenance mode during restore (automatic)
7. After restore: system restarts, admin is logged out, re-login required

### Maintenance Mode (ADM-SET-023)

**URL**: `/admin/settings/maintenance`

| Setting | Type | Validation | Default |
|---|---|---|---|
| `maintenance_mode` | toggle | — | `false` |
| `maintenance_message` | textarea | Max 500 chars | "We're performing scheduled maintenance. We'll be back shortly." |
| `maintenance_estimated_end` | datetime | Must be future | — |
| `allow_admin_access` | toggle | — | `true` |
| `whitelist_ips` | text array | Valid IPs | — |
| `maintenance_page_style` | select | `minimal`, `branded`, `custom_html` | `branded` |
| `custom_maintenance_html` | textarea | Valid HTML, max 50KB | — |
| `show_countdown` | toggle | — | `true` |

**Enabling Maintenance Mode**:
1. Toggle `maintenance_mode` to ON
2. Configure message and estimated end time
3. Click **Enable Maintenance Mode**
4. All customer-facing pages immediately show the maintenance page
5. Admin panel remains accessible (if `allow_admin_access` is true)
6. API endpoints return `503 Service Unavailable` to non-admin clients

### System Health Dashboard (ADM-SET-024)

**URL**: `/admin/settings/health`

#### Health Checks

| Service | What's Checked | Status Indicators |
|---|---|---|
| **Next.js Frontend** | `localhost:3000` responding | 🟢 Running / 🔴 Down |
| **Express.js Backend** | `localhost:3005/health` responding | 🟢 Running / 🔴 Down |
| **Supabase Database** | Connection + query latency | 🟢 < 100ms / 🟡 100-500ms / 🔴 > 500ms or down |
| **Redis** | Connection + PING latency | 🟢 < 10ms / 🟡 10-50ms / 🔴 > 50ms or down |
| **Stripe API** | API key validation + connectivity | 🟢 Connected / 🟡 Degraded / 🔴 Error |
| **Socket.IO** | WebSocket connections count | 🟢 Active / 🔴 No connections |
| **SMTP** | Email server connectivity | 🟢 Connected / 🔴 Error |
| **Supabase Storage** | Bucket accessibility + usage | 🟢 OK / 🟡 >80% full / 🔴 Full or error |

#### System Metrics

| Metric | Description | Update Frequency |
|---|---|---|
| Database Size | Total PostgreSQL database size | Every 5 min |
| Storage Usage | Supabase Storage bytes used / quota | Every 5 min |
| Active Users | Currently authenticated sessions | Real-time (Socket.IO) |
| API Response Time | Average response time (p50, p95, p99) | Every 1 min |
| Error Rate | % of API requests returning 5xx | Every 1 min |
| Cron Job Status | Last run time and status of scheduled tasks | Every 1 min |

#### Alerts

When any service health check fails:
1. Red banner appears at the top of all admin pages
2. Email alert sent to `admin_notification_emails`
3. Alert logged in `system_events` table

### Audit Log Viewer (ADM-SET-025)

**URL**: `/admin/settings/audit-logs`

| Column | Description |
|---|---|
| Timestamp | When the action occurred |
| Actor | Admin user who performed the action |
| Action | What was done (e.g., `settings.updated`, `module.created`, `coupon.deleted`) |
| Entity | What was affected (type + ID) |
| Changes | Before/after JSON diff of changed fields |
| IP Address | IP of the admin who performed the action |

**Filters**: Date range, actor, action type, entity type
**Search**: Full-text search across action descriptions and entity names
**Retention**: Configured via `audit.retention_days` setting (default: 1825 days / 5 years)
**Export**: CSV export of filtered audit log entries

## Configuration Settings

| Setting | Default | Options | Impact |
|---|---|---|---|
| `settings.cache_ttl` | `300` (5 min) | 60-3600 | How long settings are cached in Redis |
| `settings.require_confirmation` | `true` | true/false | Require confirmation modal for critical changes |
| `settings.show_advanced` | `false` | true/false | Show advanced/developer settings |
| `settings.encryption_key_rotation_days` | `90` | 30-365 | How often to rotate encryption key for sensitive settings |
| `audit.retention_days` | `1825` | 365-3650 | How long audit logs are retained |
| `audit.log_read_access` | `false` | true/false | Log read-only access to settings (verbose) |
| `backup.compression_level` | `6` | 1-9 | Gzip compression level for backups |
| `health.check_interval_sec` | `60` | 10-300 | How frequently health checks run |
| `health.alert_cooldown_min` | `15` | 5-60 | Minimum time between repeated alerts for same issue |

## Reports & Analytics

The Settings module contributes to the following reports:

1. **System Health Report** (`/admin/reports/system-health`): Uptime, response times, error rates over time
2. **Audit Activity Report** (`/admin/reports/audit`): Admin action frequency, most active admins, most modified settings
3. **Security Report** (`/admin/reports/security`): Failed login attempts, IP whitelist hits, session timeouts, password changes
4. **Backup Status Report** (`/admin/reports/backups`): Backup history, sizes, success/failure rates

## Integration Points

| System | Direction | Data | Trigger |
|---|---|---|---|
| Stripe | Outbound | API keys for payment processing | Settings saved |
| Google Analytics | Outbound | Measurement ID injected into frontend | GA settings saved |
| SMTP / Email | Outbound | Server config for email delivery | Email settings saved |
| Supabase Storage | Bidirectional | Logo/branding file uploads, backups | File upload or backup |
| Redis | Bidirectional | Settings cache, session management | Settings change |
| Socket.IO | Outbound | Settings change broadcast to admin clients | Any setting updated |
| i18n System | Bidirectional | Locale config, translation loading | Language settings change |
| All Modules | Outbound | Theme, currency, timezone propagated | Appearance/general settings change |
| CMS Provider | Bidirectional | Content sync via configured API | Sync trigger |
| Cron System | Outbound | Backup schedule, health check intervals | Schedule settings change |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Theme changes not visible to customers | Browser cache or CDN cache | Clear browser cache; customer pages use cache-busting query params based on theme update timestamp |
| Stripe "invalid API key" error | Wrong key format or test/live mismatch | Verify key starts with correct prefix (`pk_test_*` or `pk_live_*`); ensure mode matches key type |
| Email templates not sending | SMTP misconfiguration | Use "Send Test" button to diagnose; check SMTP host/port/auth in email settings |
| IP whitelist locked admin out | Admin's IP changed (VPN, ISP) | Set `DISABLE_IP_WHITELIST=true` in backend `.env` and restart; or access from whitelisted IP |
| Maintenance mode stuck | Toggle not saving or cache issue | Access backend directly: `PUT /api/admin/settings` with `{"maintenance_mode": false}` using API tool; or set env `BYPASS_MAINTENANCE=true` |
| Backup failed | Database too large or storage full | Check Supabase Storage quota; reduce backup components; increase `BACKUP_TIMEOUT_MS` |
| Restore failed mid-operation | Connection lost or timeout | System should auto-rollback to pre-restore state; check `system_events` table for restore status |
| Health check showing false positives | Transient network issues | Increase `health.check_interval_sec` or `health.alert_cooldown_min` to reduce noise |
| Audit logs growing too large | High admin activity + long retention | Reduce `audit.retention_days` or disable `audit.log_read_access` |
| Font not loading | Custom font not available in selected locale | EN fonts may not support Arabic characters; check `rtl_font_override` for Arabic locale |
| 2FA setup failing | Time sync issue between server and TOTP app | Ensure server time is NTP-synced; TOTP has 30-second window tolerance |

## Security & Permissions

| Action | Required Role | Additional Notes |
|---|---|---|
| View settings (any section) | `super_admin` | All settings are super_admin only |
| Edit general settings | `super_admin` | — |
| Change theme/appearance | `super_admin` | Affects all customer-facing pages |
| Configure Stripe keys | `super_admin` | Keys encrypted at rest |
| Edit email templates | `super_admin` | — |
| Configure notifications | `super_admin` | — |
| Manage languages | `super_admin` | — |
| Edit security settings | `super_admin` | Password policy, IP whitelist, 2FA |
| Configure integrations | `super_admin` | Third-party service credentials |
| Create/restore backups | `super_admin` | Restore requires typing "RESTORE" to confirm |
| Toggle maintenance mode | `super_admin` | Immediately affects customer access |
| View system health | `super_admin` | — |
| View audit logs | `super_admin` | — |
| Export audit logs | `super_admin` | — |

All settings changes are logged in `audit_logs`. Critical settings changes (Stripe keys, maintenance mode, security settings, backup/restore) trigger immediate email notifications to all configured admin notification emails.

## Related Modules

### Admin Guides
- [Module Builder](./module-builder.md) — Module themes inherit from global appearance settings
- [Coupons & Promotions](./coupons-promotions.md) — Currency and payment settings affect coupon values
- [Reviews & Feedback](./reviews-feedback.md) — Notification settings control review alert delivery
- [Reports & Analytics](./reports-analytics.md) — Timezone and currency settings affect report display

### Customer Guides
- [Account Settings](../customer/account.md) — Customer language/theme preferences
- [Checkout](../customer/checkout.md) — Payment and currency settings affect checkout flow

## Feature Coverage Summary

| Category | Total Features | Implemented | Tested | Documented |
|---|---|---|---|---|
| General (Name/Logo/Contact) | 3 | 3 | 3 | 3 |
| Appearance (Theme/Colors/Fonts) | 3 | 3 | 3 | 3 |
| Payments (Stripe/Currency/Tax) | 3 | 3 | 3 | 3 |
| Communication (Email/Notifications) | 2 | 2 | 2 | 2 |
| Languages (Locales/Default/RTL) | 3 | 3 | 3 | 3 |
| Security (Password/Session/IP/2FA) | 4 | 4 | 4 | 4 |
| Integrations (GA/Social/CMS) | 3 | 3 | 3 | 3 |
| Operations (Backup/Maintenance) | 2 | 2 | 2 | 2 |
| Monitoring (Health/Audit) | 2 | 2 | 2 | 2 |
| **Total** | **25** | **25** | **25** | **25** |
