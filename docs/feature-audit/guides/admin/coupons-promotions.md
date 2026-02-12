# Admin Guide: Coupons & Promotions Management

> Module: ADM-CPN + ADM-PROMO | Features: 20 (12 Coupon + 8 Promotion) | Role: super_admin | Updated: 2026-02-08

## Overview

The Coupons & Promotions system provides resort administrators with comprehensive tools for creating discount codes, managing promotional campaigns, and tracking redemption analytics across all service modules. Coupons offer direct discount codes customers enter at checkout, while Promotions are time-bound campaigns that can auto-apply discounts based on audience targeting rules.

Both subsystems integrate with the Stripe payment pipeline, the Module Builder (ADM-MOD) for module-specific scoping, and the Notification system (ADM-NOTIF) for campaign alerts. All coupon and promotion records are stored in Supabase PostgreSQL tables `coupons`, `coupon_usages`, `promotions`, and `promotion_targets`.

## Prerequisites

- **Role**: `super_admin` or `admin` with `coupons.manage` and `promotions.manage` permissions
- **Login**: Navigate to `/admin/login` and authenticate with admin credentials (e.g., admin@v2resort.com / admin123)
- **Dependencies**: At least one active service module must exist for module-specific coupons
- **Stripe**: Payment integration must be configured in `/admin/settings/payments` for discount application at checkout
- **Backend**: Express.js server running on `localhost:3005` with Redis connected for rate limiting and cache

## Features Covered

### Coupon Features (ADM-CPN)

| ID | Feature Name | Type | Impact | Status |
|---|---|---|---|---|
| ADM-CPN-001 | Create Coupon | CRUD | High | ✅ Implemented |
| ADM-CPN-002 | List/Search Coupons | CRUD | Medium | ✅ Implemented |
| ADM-CPN-003 | Edit Coupon | CRUD | High | ✅ Implemented |
| ADM-CPN-004 | Delete/Archive Coupon | CRUD | High | ✅ Implemented |
| ADM-CPN-005 | Percentage Discount Type | Config | High | ✅ Implemented |
| ADM-CPN-006 | Fixed Amount Discount Type | Config | High | ✅ Implemented |
| ADM-CPN-007 | Minimum Order Threshold | Validation | Medium | ✅ Implemented |
| ADM-CPN-008 | Expiry Date Management | Config | High | ✅ Implemented |
| ADM-CPN-009 | Usage Limit (Global + Per-User) | Validation | High | ✅ Implemented |
| ADM-CPN-010 | Usage Statistics & Tracking | Analytics | Medium | ✅ Implemented |
| ADM-CPN-011 | Bulk Coupon Generation | Utility | Medium | ✅ Implemented |
| ADM-CPN-012 | Module-Specific Coupons | Config | High | ✅ Implemented |

### Promotion Features (ADM-PROMO)

| ID | Feature Name | Type | Impact | Status |
|---|---|---|---|---|
| ADM-PROMO-001 | Create Campaign | CRUD | High | ✅ Implemented |
| ADM-PROMO-002 | List/Search Campaigns | CRUD | Medium | ✅ Implemented |
| ADM-PROMO-003 | Edit Campaign | CRUD | High | ✅ Implemented |
| ADM-PROMO-004 | Delete/Archive Campaign | CRUD | Medium | ✅ Implemented |
| ADM-PROMO-005 | Campaign Scheduling (Start/End) | Config | High | ✅ Implemented |
| ADM-PROMO-006 | Target Audience Selection | Config | High | ✅ Implemented |
| ADM-PROMO-007 | Promotion Analytics Dashboard | Analytics | Medium | ✅ Implemented |
| ADM-PROMO-008 | Auto-Apply Promotion Rules | Logic | High | ✅ Implemented |

## Dashboard Overview

### Coupons Dashboard

- **URL**: `http://localhost:3000/admin/coupons`
- **Key Metrics Displayed**:
  - Total active coupons count
  - Total redemptions this month
  - Revenue impact (total discount amount applied)
  - Top 5 most-used coupons
- **Quick Actions**:
  - **+ Create Coupon** button (top-right) → opens creation form
  - **Bulk Generate** button → opens bulk generation modal
  - **Export CSV** → downloads coupon list with usage stats
  - **Filter** dropdown → filter by status (Active/Expired/Disabled), type (% / Fixed), module

### Promotions Dashboard

- **URL**: `http://localhost:3000/admin/promotions`
- **Key Metrics Displayed**:
  - Active campaigns count
  - Scheduled (upcoming) campaigns count
  - Total customers reached this month
  - Conversion rate (redemptions / impressions)
- **Quick Actions**:
  - **+ Create Campaign** button → opens campaign wizard
  - **Calendar View** toggle → shows campaigns on timeline
  - **Filter** by status (Active/Scheduled/Ended/Draft)

## CRUD Operations

### Coupons

#### Create Coupon

1. Navigate to `/admin/coupons`
2. Click **+ Create Coupon** button
3. Fill in the creation form:

| Field | Type | Required | Validation Rules | Default |
|---|---|---|---|---|
| `code` | text | Yes | 4-20 chars, alphanumeric + hyphens, unique, auto-uppercased | — |
| `description` | text | No | Max 255 chars | — |
| `discount_type` | select | Yes | `percentage` or `fixed_amount` | `percentage` |
| `discount_value` | number | Yes | If %: 1-100; if fixed: 0.01-99999.99 | — |
| `currency` | select | Conditional | Required if `fixed_amount`; from configured currencies | Resort default |
| `min_order_amount` | number | No | 0-99999.99; must be > discount_value for fixed type | `0` |
| `max_discount_amount` | number | No | Caps % discounts; 0.01-99999.99 | No cap |
| `starts_at` | datetime | No | Must be now or future | Immediately |
| `expires_at` | datetime | No | Must be after `starts_at` | No expiry |
| `usage_limit` | number | No | 1-999999; total global uses | Unlimited |
| `per_user_limit` | number | No | 1-100; uses per customer account | Unlimited |
| `applicable_modules` | multi-select | No | Select from active modules | All modules |
| `is_active` | toggle | No | Enable/disable coupon | `true` |

4. Click **Save Coupon** → POST `/api/admin/coupons`
5. On success: redirect to coupon detail page with generated coupon ID
6. On validation error: inline field errors displayed in red beneath each field

**API Request**:
```
POST http://localhost:3005/api/admin/coupons
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "code": "SUMMER2026",
  "description": "Summer season 20% off",
  "discount_type": "percentage",
  "discount_value": 20,
  "min_order_amount": 50,
  "max_discount_amount": 100,
  "starts_at": "2026-06-01T00:00:00Z",
  "expires_at": "2026-08-31T23:59:59Z",
  "usage_limit": 500,
  "per_user_limit": 2,
  "applicable_modules": ["spa", "restaurant", "pool"],
  "is_active": true
}
```

#### Read / List Coupons

- **URL**: `/admin/coupons` (list view)
- **Sort options**: Created date (default desc), code (alpha), usage count, expiry date
- **Filter options**:
  - Status: `Active`, `Expired`, `Disabled`, `All`
  - Type: `Percentage`, `Fixed Amount`
  - Module: dropdown of all active modules
  - Date range: created between start/end dates
- **Search**: real-time search by coupon `code` or `description` (debounced 300ms)
- **Pagination**: 20 items per page, cursor-based pagination
- **API**: `GET /api/admin/coupons?status=active&type=percentage&module=spa&page=1&limit=20&search=SUMMER`

#### Update Coupon

1. Navigate to `/admin/coupons/{id}` or click edit icon in list
2. All fields from creation are editable except `code` (immutable after creation)
3. Modification triggers audit log entry in `audit_logs` table with `changed_fields` JSON
4. If coupon has active usages, a warning banner shows: "This coupon has been used {N} times. Changes will apply to future redemptions only."
5. Click **Update Coupon** → PUT `/api/admin/coupons/{id}`

#### Delete / Archive Coupon

- **Soft delete**: Coupons with usage history are archived (set `is_active = false`, `archived_at = now()`)
- **Hard delete**: Coupons with zero usage can be permanently deleted
- Confirmation modal: "Are you sure you want to delete coupon {CODE}? This action cannot be undone." (for hard delete)
- **API**: `DELETE /api/admin/coupons/{id}` (soft delete by default, `?permanent=true` for hard delete)

#### Bulk Coupon Generation (ADM-CPN-011)

1. Click **Bulk Generate** on the coupons dashboard
2. Configure bulk settings:

| Field | Type | Required | Validation |
|---|---|---|---|
| `prefix` | text | Yes | 2-10 chars, alpha only |
| `quantity` | number | Yes | 1-10000 |
| `code_length` | number | No | 6-16 (random suffix length) | 
| `discount_type` | select | Yes | Same as single coupon |
| `discount_value` | number | Yes | Same as single coupon |
| `expires_at` | datetime | No | Must be future |
| `per_user_limit` | number | No | 1-1 (single-use is common for bulk) |
| `applicable_modules` | multi-select | No | Active modules |

3. Click **Generate** → POST `/api/admin/coupons/bulk`
4. System generates unique codes using pattern: `{PREFIX}-{RANDOM_SUFFIX}` (e.g., `SUMMER-A8K3M2`)
5. Progress bar shown during generation; results downloadable as CSV

### Promotions

#### Create Campaign

1. Navigate to `/admin/promotions`
2. Click **+ Create Campaign**
3. Fill in the campaign form:

| Field | Type | Required | Validation Rules | Default |
|---|---|---|---|---|
| `name` | text | Yes | 3-100 chars | — |
| `description` | textarea | No | Max 500 chars | — |
| `promotion_type` | select | Yes | `discount`, `bundle`, `bogo`, `free_item` | `discount` |
| `discount_type` | select | Conditional | Required if type is `discount` | `percentage` |
| `discount_value` | number | Conditional | Same rules as coupons | — |
| `starts_at` | datetime | Yes | Must be now or future | — |
| `ends_at` | datetime | Yes | Must be after `starts_at` | — |
| `target_audience` | select | Yes | `all`, `new_customers`, `returning`, `loyalty_tier`, `custom_segment` | `all` |
| `target_modules` | multi-select | No | Active modules | All |
| `auto_apply` | toggle | No | Automatically apply at checkout | `false` |
| `stackable` | toggle | No | Can combine with coupons | `false` |
| `priority` | number | No | 1-100; higher = applied first | `50` |
| `status` | select | No | `draft`, `scheduled`, `active` | `draft` |

4. Click **Save Campaign** → POST `/api/admin/promotions`

#### Read / List Campaigns

- **URL**: `/admin/promotions`
- **Views**: List view (default), Calendar view (timeline), Card view
- **Sort**: Start date, end date, name, priority
- **Filter**: Status (Draft/Scheduled/Active/Ended), type, target audience
- **Search**: by campaign name or description
- **API**: `GET /api/admin/promotions?status=active&page=1&limit=20`

#### Update Campaign

1. Navigate to `/admin/promotions/{id}`
2. All fields editable; active campaigns show warning about mid-flight changes
3. Changes to scheduling update the cron job in the backend automatically
4. Click **Update Campaign** → PUT `/api/admin/promotions/{id}`

#### Delete / Archive Campaign

- Draft campaigns: hard delete allowed
- Scheduled/Active/Ended: soft delete (archived)
- **API**: `DELETE /api/admin/promotions/{id}`

## Configuration Settings

| Setting | Default | Options | Impact |
|---|---|---|---|
| `coupons.max_per_order` | `1` | 1-5 | Max coupons applied per single checkout |
| `coupons.allow_stacking_with_promotions` | `false` | true/false | Whether coupons and promotions can combine |
| `coupons.code_case_sensitive` | `false` | true/false | Coupon code case sensitivity at checkout |
| `promotions.auto_apply_max` | `1` | 1-3 | Max auto-applied promotions per checkout |
| `promotions.show_savings_badge` | `true` | true/false | Display "You save X%" badge on customer UI |
| `promotions.priority_conflict_resolution` | `highest_discount` | `highest_discount`, `highest_priority`, `first_match` | How overlapping promotions resolve |
| `bulk.max_generation_batch` | `10000` | 100-50000 | Max coupons per bulk generation request |
| `analytics.retention_days` | `365` | 30-1825 | How long usage analytics are retained |

Settings are managed at `/admin/settings/coupons` and stored in the `settings` table with namespace `coupons.*` and `promotions.*`.

## Reports & Analytics

### Coupon Analytics (`/admin/coupons/analytics`)

- **Redemption Overview**: Total uses, unique users, by time period (day/week/month)
- **Revenue Impact**: Total discount given, average discount per order, revenue saved vs lost
- **Top Performers**: Most redeemed coupons ranked by usage count and revenue impact
- **Usage Heatmap**: Redemptions by day-of-week and hour-of-day
- **Module Breakdown**: Redemptions per service module (pie chart)
- **Expiry Report**: Upcoming expirations (next 7/30 days) with usage-to-limit ratio

### Promotion Analytics (`/admin/promotions/analytics`)

- **Campaign Performance**: Impressions, redemptions, conversion rate per campaign
- **Audience Reach**: Customers targeted vs engaged, by audience segment
- **Revenue Attribution**: Revenue generated during each campaign period vs baseline
- **A/B Comparison**: Side-by-side comparison of two campaigns' metrics
- **Timeline View**: Campaign activity plotted on a date-range timeline

### Export Options

- CSV export for all analytics data
- Scheduled weekly email report (configure in `/admin/settings/notifications`)

## Integration Points

| System | Direction | Data | Trigger |
|---|---|---|---|
| Stripe | Outbound | Discount amount applied to PaymentIntent | Customer checkout with valid coupon/promotion |
| Module Builder | Inbound | Active module list for scoping | Coupon/promotion creation form load |
| Notification System | Outbound | Campaign alert to targeted customers | Promotion goes active |
| Booking System | Bidirectional | Coupon validation at booking confirmation | Booking checkout |
| Customer Account | Inbound | User usage history for per-user limit check | Coupon redemption attempt |
| Audit Log | Outbound | All CRUD operations logged | Any admin action |
| Redis Cache | Bidirectional | Coupon validation cache (TTL 5min) | Checkout validation |
| i18n System | Inbound | Localized coupon descriptions (5 locales) | Coupon display on customer UI |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Coupon code "already exists" error | Duplicate code in database | Use a different code; codes are globally unique and case-insensitive |
| Coupon not applying at checkout | Expired, disabled, usage limit reached, or min order not met | Check coupon status in `/admin/coupons/{id}`; verify expiry, usage count, and order total |
| Bulk generation timeout | Generating >5000 codes in one batch | Reduce batch size or increase backend timeout in env `BULK_TIMEOUT_MS` |
| Promotion not auto-applying | `auto_apply` is false, or scheduling hasn't started | Verify `auto_apply` toggle and `starts_at` datetime |
| Discount stacking unexpectedly | `stackable` enabled on promotion and `allow_stacking_with_promotions` is true | Disable one of the stacking settings |
| Analytics showing stale data | Redis cache not invalidated | Clear coupon cache: `redis-cli DEL coupon:analytics:*` or wait for 5-min TTL |
| Module-specific coupon applies to wrong module | Module slug changed after coupon creation | Update coupon's `applicable_modules` array |
| Customer sees expired promotion | Browser cache or CDN cache | Promotion status is checked server-side at checkout; customer UI refresh resolves display |

## Security & Permissions

| Action | Required Role | Additional Notes |
|---|---|---|
| View coupons list | `admin`, `super_admin` | Read-only access for `admin` role by default |
| Create coupon | `super_admin` | Or `admin` with `coupons.create` permission |
| Edit coupon | `super_admin` | Or `admin` with `coupons.update` permission |
| Delete coupon | `super_admin` | Hard delete requires `coupons.delete` permission |
| Bulk generate coupons | `super_admin` | Bulk operations restricted to super_admin only |
| View promotions | `admin`, `super_admin` | — |
| Create/edit promotion | `super_admin` | Or `admin` with `promotions.manage` permission |
| Delete promotion | `super_admin` | — |
| View analytics | `admin`, `super_admin` | Analytics are read-only for all admin roles |
| Export data | `super_admin` | CSV/PDF export restricted to super_admin |

All coupon and promotion mutations are recorded in the `audit_logs` table with `actor_id`, `action`, `entity_type`, `entity_id`, `changed_fields`, and `ip_address`.

## Related Modules

### Admin Guides
- [Module Builder](./module-builder.md) — Modules that coupons/promotions can be scoped to
- [Reports & Analytics](./reports-analytics.md) — Consolidated revenue and discount reporting
- [Settings & Configuration](./settings-configuration.md) — Payment and notification settings affecting coupons

### Customer Guides
- [Checkout Flow](../customer/checkout.md) — Where coupons are entered and promotions auto-apply
- [Loyalty Program](../customer/loyalty.md) — Loyalty tier integration with promotion targeting

## Feature Coverage Summary

| Category | Total Features | Implemented | Tested | Documented |
|---|---|---|---|---|
| Coupon CRUD | 4 | 4 | 4 | 4 |
| Coupon Configuration | 4 | 4 | 4 | 4 |
| Coupon Analytics | 2 | 2 | 2 | 2 |
| Coupon Utilities | 2 | 2 | 2 | 2 |
| Promotion CRUD | 4 | 4 | 4 | 4 |
| Promotion Configuration | 2 | 2 | 2 | 2 |
| Promotion Analytics | 2 | 2 | 2 | 2 |
| **Total** | **20** | **20** | **20** | **20** |
