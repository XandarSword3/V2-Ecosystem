# Admin Guide: Reviews & Feedback Management

> Module: ADM-REV | Features: 10 | Role: super_admin | Updated: 2026-02-08

## Overview

The Reviews & Feedback system gives administrators full control over customer-submitted reviews across all resort service modules. Admins can view, filter, respond to, moderate, and analyze reviews from a centralized dashboard. Reviews are tied to completed bookings/orders and associated with specific modules (restaurant, spa, pool, chalets, etc.) created through the Module Builder.

All review data is stored in the Supabase PostgreSQL `reviews` table with relations to `users`, `bookings`, and `modules`. Real-time updates are pushed via Socket.IO when new reviews are submitted, so the admin dashboard reflects incoming reviews without page refresh.

## Prerequisites

- **Role**: `super_admin` or `admin` with `reviews.manage` permission
- **Login**: Navigate to `/admin/login` and authenticate (e.g., admin@v2resort.com / admin123)
- **Dependencies**: At least one service module must exist and have completed orders/bookings with review-eligible status
- **Backend**: Express.js on `localhost:3005` with Socket.IO connected for real-time review notifications
- **Redis**: Connected for review analytics caching (TTL 10 min)

## Features Covered

| ID | Feature Name | Type | Impact | Status |
|---|---|---|---|---|
| ADM-REV-001 | View All Reviews | Read | Medium | ✅ Implemented |
| ADM-REV-002 | Filter Reviews by Rating | Filter | Medium | ✅ Implemented |
| ADM-REV-003 | Filter Reviews by Module | Filter | Medium | ✅ Implemented |
| ADM-REV-004 | Filter Reviews by Date Range | Filter | Low | ✅ Implemented |
| ADM-REV-005 | Reply to Review | Action | High | ✅ Implemented |
| ADM-REV-006 | Flag Inappropriate Review | Moderation | High | ✅ Implemented |
| ADM-REV-007 | Hide/Unhide Review | Moderation | High | ✅ Implemented |
| ADM-REV-008 | Review Analytics Dashboard | Analytics | Medium | ✅ Implemented |
| ADM-REV-009 | Rating Trends Over Time | Analytics | Medium | ✅ Implemented |
| ADM-REV-010 | Export Reviews | Utility | Low | ✅ Implemented |

## Dashboard Overview

- **URL**: `http://localhost:3000/admin/reviews`
- **Key Metrics Displayed** (top summary cards):
  - **Total Reviews**: All-time review count
  - **Average Rating**: Global average across all modules (displayed as star rating + decimal)
  - **This Month**: Reviews submitted in the current month
  - **Pending Moderation**: Reviews flagged for admin review
  - **Response Rate**: Percentage of reviews with admin replies
- **Quick Actions**:
  - **Filter Bar**: Rating stars (1-5 clickable), Module dropdown, Date range picker, Status (All / Flagged / Hidden / Responded)
  - **Export** button → downloads filtered results as CSV
  - **Bulk Actions** dropdown → "Mark as Reviewed", "Hide Selected", "Flag Selected"
- **Real-Time Indicator**: Green pulse dot when Socket.IO is connected; new reviews slide in at the top of the list

### Review List Item Layout

Each review in the list displays:
- Customer name + avatar (linked to customer profile)
- Star rating (1-5 visual stars)
- Module name badge (e.g., "Restaurant", "Spa")
- Review text (truncated at 200 chars with "Read more" link)
- Submission date + booking reference
- Status badges: `Flagged` (red), `Hidden` (gray), `Responded` (green)
- Action buttons: Reply, Flag, Hide, View Detail

## CRUD Operations

### View All Reviews (ADM-REV-001)

1. Navigate to `/admin/reviews`
2. Reviews load in reverse chronological order (newest first)
3. Default pagination: 25 reviews per page, infinite scroll or page numbers
4. Click any review row to expand the full detail panel on the right

**API**: 
```
GET http://localhost:3005/api/admin/reviews?page=1&limit=25&sort=created_at&order=desc
Authorization: Bearer {jwt_token}
```

**Response fields per review**:
- `id` (UUID)
- `user_id`, `user_name`, `user_avatar`
- `module_id`, `module_name`, `module_slug`
- `booking_id` (nullable — some reviews are general)
- `rating` (1-5 integer)
- `title` (optional, max 100 chars)
- `body` (review text, max 2000 chars)
- `images` (array of uploaded image URLs, max 5)
- `status` (`active`, `flagged`, `hidden`)
- `admin_reply` (nullable text)
- `admin_reply_at` (nullable datetime)
- `created_at`, `updated_at`

### Filter Reviews by Rating (ADM-REV-002)

1. On the dashboard, click a star rating (1-5) in the filter bar or select from the dropdown
2. Multiple ratings can be selected (e.g., show 1-star and 2-star only)
3. List updates immediately via client-side filtering + API re-fetch

**API**: `GET /api/admin/reviews?rating=1,2&page=1&limit=25`

### Filter Reviews by Module (ADM-REV-003)

1. Click the **Module** dropdown in the filter bar
2. Select one or more modules (populated dynamically from active modules)
3. List filters to show only reviews for selected modules

**API**: `GET /api/admin/reviews?module=spa,restaurant&page=1&limit=25`

### Filter Reviews by Date Range (ADM-REV-004)

1. Click the **Date Range** picker
2. Select start date and end date from the calendar widget
3. Preset shortcuts available: "Today", "This Week", "This Month", "Last 30 Days", "Last 90 Days", "Custom"

**API**: `GET /api/admin/reviews?from=2026-01-01&to=2026-01-31&page=1&limit=25`

### Reply to Review (ADM-REV-005)

1. Click the **Reply** button on any review (or open detail view)
2. Reply form appears below the review:

| Field | Type | Required | Validation Rules |
|---|---|---|---|
| `reply_text` | textarea | Yes | 10-1000 chars, no HTML allowed |

3. Click **Submit Reply** → POST `/api/admin/reviews/{id}/reply`
4. Reply is visible to the customer on their review and on the public module page
5. Only one admin reply per review; editing replaces the existing reply
6. Customer receives a notification (email + in-app) that their review was responded to
7. Review status badge updates to `Responded` (green)

**API**:
```
POST http://localhost:3005/api/admin/reviews/{review_id}/reply
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "reply_text": "Thank you for your feedback! We're sorry about the wait time and have addressed this with our team."
}
```

### Flag Inappropriate Review (ADM-REV-006)

1. Click the **Flag** (🚩) button on a review
2. Select a flag reason from the modal:
   - `spam` — Promotional or spam content
   - `offensive` — Profanity, hate speech, or inappropriate content
   - `fake` — Suspected fake or incentivized review
   - `irrelevant` — Not related to the resort or module
   - `other` — Provide custom reason (text field, max 255 chars)
3. Click **Flag Review** → PUT `/api/admin/reviews/{id}/flag`
4. Review status changes to `flagged` and appears in the "Pending Moderation" queue
5. Flagged reviews are hidden from the public customer UI but remain visible in admin

**API**:
```
PUT http://localhost:3005/api/admin/reviews/{review_id}/flag
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "reason": "offensive",
  "notes": "Contains inappropriate language in the second paragraph"
}
```

### Hide / Unhide Review (ADM-REV-007)

1. Click the **Hide** (👁️‍🗨️) button on a review
2. Confirmation modal: "Hide this review? It will no longer appear on the public module page."
3. Click **Confirm** → PUT `/api/admin/reviews/{id}/visibility`
4. Review marked as `hidden`; removed from public pages but preserved in admin view with gray badge
5. To unhide: click **Unhide** on a hidden review → same endpoint with `visible: true`
6. Audit log records who hid/unhid the review and when

**API**:
```
PUT http://localhost:3005/api/admin/reviews/{review_id}/visibility
Authorization: Bearer {jwt_token}
Content-Type: application/json

{ "visible": false }
```

### Review Analytics Dashboard (ADM-REV-008)

- **URL**: `/admin/reviews/analytics`
- **Widgets**:
  - **Average Rating Card**: Global average (e.g., 4.3/5.0) with trend arrow vs last month
  - **Rating Distribution**: Bar chart showing count per rating (1★ through 5★)
  - **Module Comparison**: Horizontal bar chart comparing average ratings across modules
  - **Response Rate**: Percentage of reviews with admin replies, with target line
  - **Review Volume**: Line chart of reviews submitted per day/week/month
  - **Sentiment Score**: AI-derived sentiment analysis (positive / neutral / negative percentages)

### Rating Trends Over Time (ADM-REV-009)

- Located within the analytics dashboard
- **Time Granularity**: Toggle between daily, weekly, monthly views
- **Module Filter**: View trends for all modules or a specific module
- **Chart Type**: Line chart with rating average over time; overlay for review volume
- **Insights**: Automatic callouts for significant drops (>0.5 star decline over 7 days)

### Export Reviews (ADM-REV-010)

1. Click **Export** button on the reviews dashboard
2. Configure export settings:

| Option | Values | Default |
|---|---|---|
| Format | CSV, PDF | CSV |
| Date Range | Custom or preset | All time |
| Module Filter | All or specific | All |
| Rating Filter | 1-5 or all | All |
| Include Admin Replies | Yes/No | Yes |
| Include Hidden Reviews | Yes/No | No |

3. Click **Download** → GET `/api/admin/reviews/export?format=csv&from=...&to=...`
4. File is generated server-side and downloaded via browser
5. For large exports (>10000 reviews), an email with download link is sent instead

## Configuration Settings

| Setting | Default | Options | Impact |
|---|---|---|---|
| `reviews.auto_publish` | `true` | true/false | Whether new reviews appear immediately or require moderation |
| `reviews.min_rating_for_auto_publish` | `1` | 1-5 | Reviews below this rating go to moderation queue |
| `reviews.allow_images` | `true` | true/false | Allow customers to upload images with reviews |
| `reviews.max_images` | `5` | 1-10 | Max image uploads per review |
| `reviews.min_body_length` | `20` | 10-500 | Minimum character count for review text |
| `reviews.max_body_length` | `2000` | 100-5000 | Maximum character count for review text |
| `reviews.edit_window_hours` | `48` | 1-168 | Hours after posting that customer can edit their review |
| `reviews.notify_admin_on_low_rating` | `true` | true/false | Send admin notification for reviews ≤ 2 stars |
| `reviews.profanity_filter` | `true` | true/false | Auto-flag reviews containing profanity |
| `reviews.require_booking` | `true` | true/false | Only allow reviews from verified bookings/orders |

Settings managed at `/admin/settings/reviews` and stored in the `settings` table with namespace `reviews.*`.

## Reports & Analytics

### Available Reports

1. **Review Summary Report** — Monthly overview: total reviews, avg rating, response rate, top-rated module, lowest-rated module
2. **Module Performance Report** — Per-module: review count, avg rating, rating distribution, common keywords
3. **Response Time Report** — Average time between review submission and admin reply
4. **Moderation Report** — Flagged/hidden review counts, flag reasons breakdown
5. **Customer Satisfaction Trend** — Rolling 30/60/90-day average rating with trendline

### Scheduled Reports

- Configure automated report delivery in `/admin/settings/notifications`
- Options: Weekly digest (Monday 9 AM), Monthly summary (1st of month)
- Delivery: Email to configured admin addresses

## Integration Points

| System | Direction | Data | Trigger |
|---|---|---|---|
| Socket.IO | Inbound | Real-time new review notification | Customer submits review |
| Module Builder | Inbound | Module names and slugs for filtering | Dashboard load |
| Booking System | Inbound | Booking verification for review eligibility | Customer attempts to post review |
| Notification System | Outbound | Low-rating alerts to admin, reply notifications to customers | Review posted (≤2★) / Admin replies |
| i18n System | Inbound | Localized UI labels (5 locales: EN/AR/FR/DE/IT) | Page render |
| Customer Profile | Inbound | Customer name, avatar, booking history | Review display |
| Redis Cache | Bidirectional | Analytics data cache (TTL 10 min) | Analytics dashboard load |
| Audit Log | Outbound | All moderation actions (flag, hide, reply) | Admin action performed |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| New reviews not appearing in real-time | Socket.IO connection dropped | Check browser console for WS errors; verify backend Socket.IO is running on port 3005 |
| "No reviews found" despite customer submissions | Filter applied or reviews in moderation queue | Clear all filters; check moderation queue for auto-flagged reviews |
| Admin reply not visible to customer | Reply saved but notification failed | Check `reply_text` in review record; verify notification service is running |
| Analytics showing 0 for current month | Redis cache stale or analytics cron not running | Clear cache: `redis-cli DEL reviews:analytics:*`; check cron job status |
| Export timing out | Large dataset with no date filter | Apply date range filter to reduce export size; use email delivery for >10000 reviews |
| Profanity filter flagging innocent reviews | Aggressive profanity word list | Adjust word list in `/admin/settings/reviews` profanity filter configuration |
| Customer cannot submit review | `require_booking` enabled and no completed booking found | Verify customer has a completed booking for the module; check booking status |
| Images not loading in review | Image upload service down or CDN issue | Check Supabase Storage bucket `review-images`; verify CDN configuration |
| Duplicate reviews from same customer | Missing unique constraint on (user_id, booking_id) | Database constraint should prevent; if bypass occurred, manually hide duplicate |

## Security & Permissions

| Action | Required Role | Additional Notes |
|---|---|---|
| View all reviews | `admin`, `super_admin` | Read-only access for base `admin` role |
| Filter and search reviews | `admin`, `super_admin` | — |
| Reply to review | `super_admin` | Or `admin` with `reviews.reply` permission |
| Flag review | `admin`, `super_admin` | All admin roles can flag |
| Hide/unhide review | `super_admin` | Or `admin` with `reviews.moderate` permission |
| View analytics | `admin`, `super_admin` | Read-only |
| Export reviews | `super_admin` | Export restricted to super_admin for data protection |
| Edit review settings | `super_admin` | — |
| Delete review permanently | `super_admin` | Soft delete only; hard delete via database admin |

All moderation actions are logged in `audit_logs` with fields: `actor_id`, `action` (e.g., `review.flagged`, `review.hidden`, `review.replied`), `entity_id`, `metadata` (JSON with reason/details), `ip_address`, `created_at`.

## Related Modules

### Admin Guides
- [Module Builder](./module-builder.md) — Modules that reviews are attached to
- [Reports & Analytics](./reports-analytics.md) — Reviews data feeds into consolidated reporting
- [Settings & Configuration](./settings-configuration.md) — Review settings and notification configuration

### Customer Guides
- [Submitting a Review](../customer/reviews.md) — Customer-facing review submission flow
- [Booking History](../customer/bookings.md) — Bookings that are eligible for reviews

## Feature Coverage Summary

| Category | Total Features | Implemented | Tested | Documented |
|---|---|---|---|---|
| View & Browse | 1 | 1 | 1 | 1 |
| Filtering | 3 | 3 | 3 | 3 |
| Moderation Actions | 3 | 3 | 3 | 3 |
| Analytics | 2 | 2 | 2 | 2 |
| Export | 1 | 1 | 1 | 1 |
| **Total** | **10** | **10** | **10** | **10** |
