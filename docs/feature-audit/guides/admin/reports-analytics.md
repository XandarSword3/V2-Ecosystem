# Admin Guide: Reports & Analytics

> Module: ADM-RPT | Features: 20 | Role: super_admin | Updated: 2026-02-08

## Overview

The Reports & Analytics system provides resort administrators with comprehensive business intelligence across all service modules. From real-time revenue dashboards to custom report builders, this module consolidates data from bookings, orders, payments, customers, reviews, and staff into actionable insights. All reports can be filtered by date range, module, and various dimensions, with export capabilities to CSV and PDF.

Data is aggregated from Supabase PostgreSQL using materialized views and pre-computed analytics tables, with Redis caching for frequently accessed dashboards. The reporting backend runs scheduled aggregation jobs via cron tasks on the Express.js server (localhost:3005).

## Prerequisites

- **Role**: `super_admin` or `admin` with `reports.view` permission
- **Login**: Navigate to `/admin/login` and authenticate (admin@v2resort.com / admin123)
- **Backend**: Express.js on `localhost:3005` with analytics cron jobs running
- **Database**: Supabase PostgreSQL with materialized views `mv_daily_revenue`, `mv_module_stats`, `mv_customer_analytics` refreshed
- **Redis**: Connected for dashboard caching (TTL varies by report type)
- **Stripe**: Connected for payment reconciliation data

## Features Covered

| ID | Feature Name | Type | Impact | Status |
|---|---|---|---|---|
| ADM-RPT-001 | Revenue Dashboard (Today) | Dashboard | High | ✅ Implemented |
| ADM-RPT-002 | Revenue Dashboard (Weekly) | Dashboard | High | ✅ Implemented |
| ADM-RPT-003 | Revenue Dashboard (Monthly) | Dashboard | High | ✅ Implemented |
| ADM-RPT-004 | Module Revenue Breakdown | Report | High | ✅ Implemented |
| ADM-RPT-005 | Payment Method Analysis | Report | Medium | ✅ Implemented |
| ADM-RPT-006 | Daily Trends Report | Report | Medium | ✅ Implemented |
| ADM-RPT-007 | Weekly Trends Report | Report | Medium | ✅ Implemented |
| ADM-RPT-008 | Monthly Trends Report | Report | Medium | ✅ Implemented |
| ADM-RPT-009 | Occupancy Reports | Report | High | ✅ Implemented |
| ADM-RPT-010 | Customer Analytics | Report | Medium | ✅ Implemented |
| ADM-RPT-011 | Staff Performance Report | Report | Medium | ✅ Implemented |
| ADM-RPT-012 | Custom Report Builder | Tool | High | ✅ Implemented |
| ADM-RPT-013 | Scheduled Reports | Config | Medium | ✅ Implemented |
| ADM-RPT-014 | CSV Export | Utility | Medium | ✅ Implemented |
| ADM-RPT-015 | PDF Export | Utility | Medium | ✅ Implemented |
| ADM-RPT-016 | Financial Reconciliation | Report | Critical | ✅ Implemented |
| ADM-RPT-017 | Coupon & Promotion Impact | Report | Medium | ✅ Implemented |
| ADM-RPT-018 | Review Analytics Summary | Report | Low | ✅ Implemented |
| ADM-RPT-019 | Real-Time Activity Monitor | Dashboard | Medium | ✅ Implemented |
| ADM-RPT-020 | Year-over-Year Comparison | Report | Medium | ✅ Implemented |

## Dashboard Overview

### Main Reports Dashboard

- **URL**: `http://localhost:3000/admin/reports`
- **Layout**: Summary cards at top, chart area in center, report shortcuts below
- **Top Summary Cards**:
  - **Today's Revenue**: Real-time total with comparison to yesterday (±%)
  - **This Week's Revenue**: Running total with comparison to last week
  - **This Month's Revenue**: Running total with comparison to last month
  - **Active Orders/Bookings**: Current in-progress orders and upcoming bookings
- **Quick Access Tiles**: Revenue, Modules, Customers, Staff, Occupancy, Reconciliation, Custom Builder
- **Global Filters** (persistent across all reports):
  - Date range picker (presets: Today, Yesterday, This Week, Last Week, This Month, Last Month, Last 90 Days, This Year, Custom)
  - Module filter (multi-select from active modules)
  - Currency selector (if multi-currency enabled)

### Analytics Dashboard

- **URL**: `http://localhost:3000/admin/analytics`
- **Focus**: Trends, patterns, and predictive insights
- **Widgets**: Trend charts, comparison tools, heatmaps, funnel visualizations

## CRUD Operations

### Revenue Dashboard (ADM-RPT-001/002/003)

#### Today's Revenue (ADM-RPT-001)

1. Navigate to `/admin/reports` → revenue automatically loads for today
2. **Key Metrics**:
   - **Gross Revenue**: Total charges before discounts/refunds
   - **Net Revenue**: After discounts, refunds, and fees
   - **Total Orders**: Count of completed orders across all modules
   - **Average Order Value (AOV)**: Net revenue ÷ total orders
   - **Discounts Applied**: Total coupon/promotion discounts
   - **Refunds Processed**: Total refund amount
3. **Revenue Timeline Chart**: Hourly revenue bar chart for today (00:00 to now)
4. **Comparison**: vs yesterday, vs same day last week (percentage and absolute difference)
5. **API**: `GET /api/admin/reports/revenue?period=today`

#### Weekly Revenue (ADM-RPT-002)

- Same metrics as daily, aggregated for current Monday–Sunday period
- **Revenue Timeline**: Daily bar chart for the week
- **Day-by-Day Breakdown** table with per-day revenue, orders, AOV
- **Best/Worst Day** callouts
- **API**: `GET /api/admin/reports/revenue?period=week`

#### Monthly Revenue (ADM-RPT-003)

- Same metrics, aggregated for current calendar month
- **Revenue Timeline**: Daily line chart for the month
- **Week-by-Week Breakdown** table
- **Month-to-Date vs Target** (if revenue target configured)
- **API**: `GET /api/admin/reports/revenue?period=month`

### Module Revenue Breakdown (ADM-RPT-004)

1. Navigate to `/admin/reports/modules`
2. **View Components**:
   - **Pie Chart**: Revenue share per module (interactive, click to drill down)
   - **Bar Chart**: Revenue per module side-by-side
   - **Data Table**:

| Column | Description |
|---|---|
| Module Name | Service module name with icon |
| Revenue | Total net revenue for period |
| Orders/Bookings | Count of transactions |
| AOV | Average order/booking value |
| % of Total | Module's share of total resort revenue |
| Trend | Sparkline showing 30-day trend |
| YoY Change | Year-over-year percentage change |

3. Click any module row to drill into that module's detailed analytics
4. **API**: `GET /api/admin/reports/modules?from=2026-01-01&to=2026-01-31`

### Payment Method Analysis (ADM-RPT-005)

1. Navigate to `/admin/reports/payments`
2. **Breakdown By Payment Method**:

| Payment Method | Fields Shown |
|---|---|
| Credit Card (Stripe) | Revenue, transaction count, avg transaction, fee amount, fee % |
| Debit Card (Stripe) | Same as above |
| Cash | Revenue, transaction count (manual entry) |
| Room Charge | Revenue, linked to chalet/room bookings |
| Gift Card | Revenue, redemption count, remaining balance |
| Coupon Discount | Total discount amount, coupon count |

3. **Donut Chart**: Visual breakdown of payment methods by volume
4. **Failed Transactions** section: Count, reasons (declined, insufficient funds, expired), retry rate
5. **API**: `GET /api/admin/reports/payments?from=...&to=...`

### Daily / Weekly / Monthly Trends (ADM-RPT-006/007/008)

1. Navigate to `/admin/reports/trends`
2. **Time Granularity Toggle**: Daily, Weekly, Monthly
3. **Trend Lines** (overlaid on same chart):
   - Revenue trend (primary line)
   - Order volume trend (secondary line)
   - AOV trend (tertiary line)
4. **Comparison Options**:
   - Current period vs previous period (default)
   - Current period vs same period last year
   - Custom comparison between any two date ranges
5. **Statistical Annotations**: Trendline slope, moving average (7/30-day), standard deviation bands
6. **Anomaly Detection**: Automated callouts for days/weeks with >2 standard deviation variance
7. **API**: `GET /api/admin/reports/trends?granularity=daily&from=...&to=...&compare=previous`

### Occupancy Reports (ADM-RPT-009)

1. Navigate to `/admin/reports/occupancy`
2. **Metrics by Module Type**:

**For Chalets/Rooms:**

| Metric | Description |
|---|---|
| Occupancy Rate | Booked nights ÷ available nights × 100 |
| Average Daily Rate (ADR) | Room revenue ÷ rooms sold |
| RevPAR | Revenue per available room |
| Average Length of Stay | Mean booking duration |
| Booking Lead Time | Average days between booking and check-in |
| Cancellation Rate | Cancelled ÷ total bookings × 100 |

**For Booking-Type Modules (Spa, Kayak, etc.):**

| Metric | Description |
|---|---|
| Slot Utilization Rate | Booked slots ÷ available slots × 100 |
| Peak Hours | Hours with highest utilization |
| No-Show Rate | No-shows ÷ total bookings × 100 |
| Average Party Size | Mean guests per booking |

3. **Heatmap View**: Occupancy by day-of-week × hour-of-day (color-coded green to red)
4. **Calendar View**: Monthly calendar with occupancy percentage per day (color gradient)
5. **API**: `GET /api/admin/reports/occupancy?module=chalets&from=...&to=...`

### Customer Analytics (ADM-RPT-010)

1. Navigate to `/admin/reports/customers`
2. **Segments**:
   - **New vs Returning**: Pie chart + trend
   - **Customer Lifetime Value (CLV)**: Distribution histogram
   - **Top Customers**: Table sorted by total spend (name, email, total orders, total revenue, avg order, first/last visit)
   - **Acquisition Channels**: Where customers come from (direct, social, referral, etc.)
   - **Retention Cohort Analysis**: Monthly cohort table showing return rates
   - **Geographic Distribution**: Map/table of customer locations
   - **Language Preferences**: Breakdown by locale (EN/AR/FR/DE/IT)
3. **API**: `GET /api/admin/reports/customers?from=...&to=...`

### Staff Performance Report (ADM-RPT-011)

1. Navigate to `/admin/reports/staff`
2. **Metrics Per Staff Member**:

| Metric | Description |
|---|---|
| Orders Processed | Number of orders handled |
| Revenue Generated | Total revenue from staff-handled transactions |
| Average Response Time | Mean time from order placement to acknowledgment |
| Customer Ratings | Average rating from orders handled by this staff |
| Attendance | Shift attendance record |
| Tasks Completed | Housekeeping/maintenance tasks completed |

3. **Staff Leaderboard**: Top performers by revenue and customer satisfaction
4. **Shift Analysis**: Performance breakdown by shift (morning/afternoon/evening)
5. **API**: `GET /api/admin/reports/staff?from=...&to=...`

### Custom Report Builder (ADM-RPT-012)

1. Navigate to `/admin/reports/builder`
2. **Step 1 — Select Data Source**:
   - Orders, Bookings, Customers, Payments, Reviews, Inventory, Staff
3. **Step 2 — Choose Dimensions** (rows):
   - Date (day/week/month/quarter/year), Module, Customer, Staff, Payment Method, Category, Item
4. **Step 3 — Choose Metrics** (columns):
   - Revenue, Order Count, AOV, Quantity Sold, Discount Amount, Refund Amount, Rating Average
5. **Step 4 — Apply Filters**:
   - Date range, module, status, payment method, customer segment
6. **Step 5 — Visualization**:
   - Table (default), Bar Chart, Line Chart, Pie Chart, Pivot Table
7. **Step 6 — Save & Schedule** (optional):
   - Name the report, save for future access
   - Schedule automated generation (daily/weekly/monthly)
   - Set email recipients for scheduled delivery
8. Click **Generate Report** → POST `/api/admin/reports/custom`
9. Report renders in the viewport with export options

### Scheduled Reports (ADM-RPT-013)

1. Navigate to `/admin/reports/scheduled`
2. **Manage Scheduled Reports**:

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | text | Yes | 3-100 chars |
| `report_type` | select | Yes | Any report type or saved custom report |
| `frequency` | select | Yes | `daily`, `weekly`, `monthly` |
| `day_of_week` | select | Conditional | Required if weekly (Mon-Sun) |
| `day_of_month` | select | Conditional | Required if monthly (1-28) |
| `time` | time | Yes | HH:MM in resort timezone |
| `recipients` | email list | Yes | 1-10 email addresses |
| `format` | select | Yes | `csv`, `pdf`, `both` |
| `is_active` | toggle | No | Enable/disable schedule |

3. **API**: POST `/api/admin/reports/scheduled`
4. Cron job runs on Express.js backend; generated reports sent via email

### CSV Export (ADM-RPT-014)

1. Available on every report page via **Export → CSV** button
2. Exports the currently displayed data with applied filters
3. **CSV Format**: UTF-8 with BOM (for Excel compatibility), comma-delimited
4. **Filename**: `{report-type}_{date-range}_{timestamp}.csv`
5. For large exports (>50,000 rows): background generation with email delivery
6. **API**: `GET /api/admin/reports/{type}/export?format=csv&from=...&to=...`

### PDF Export (ADM-RPT-015)

1. Available on every report page via **Export → PDF** button
2. Generates a formatted PDF with:
   - Resort logo and header
   - Report title and date range
   - Summary metrics
   - Charts rendered as images
   - Data tables
   - Footer with generation timestamp and page numbers
3. **Filename**: `{report-type}_{date-range}_{timestamp}.pdf`
4. **API**: `GET /api/admin/reports/{type}/export?format=pdf&from=...&to=...`

### Financial Reconciliation (ADM-RPT-016)

1. Navigate to `/admin/reports/reconciliation`
2. **Purpose**: Compare internal order records with Stripe payment records to identify discrepancies
3. **Report Sections**:

| Section | Description |
|---|---|
| **Matched Transactions** | Orders with matching Stripe PaymentIntents (status, amount, date) |
| **Unmatched Internal** | Orders recorded in DB but no corresponding Stripe transaction |
| **Unmatched Stripe** | Stripe charges not linked to any internal order |
| **Amount Discrepancies** | Matched transactions where amounts differ |
| **Refund Reconciliation** | Internal refund records vs Stripe refund records |
| **Fee Summary** | Stripe processing fees, platform fees breakdown |

4. **Actions**: Click any discrepancy row to investigate; manual match/resolve options available
5. **Date Range**: Select period for reconciliation (recommended: daily or weekly)
6. **API**: `GET /api/admin/reports/reconciliation?from=...&to=...`

### Real-Time Activity Monitor (ADM-RPT-019)

1. Navigate to `/admin/reports/live`
2. **Live Dashboard** (updates every 5 seconds via Socket.IO):
   - Active users on site (count + pages being viewed)
   - Orders in progress (placed but not completed)
   - Bookings being made right now
   - Revenue counter (today, animated ticker)
   - Active staff on shift
3. **Activity Feed**: Scrolling list of recent events (order placed, booking confirmed, payment received, review submitted)
4. **No API polling**: Uses Socket.IO subscription for real-time updates

### Year-over-Year Comparison (ADM-RPT-020)

1. Navigate to `/admin/reports/yoy`
2. Select two years to compare (default: current year vs previous year)
3. **Side-by-Side Charts**: Monthly revenue, order volume, AOV, customer count
4. **Growth Table**: Month-by-month growth rate for each metric
5. **Seasonal Pattern Analysis**: Identifies recurring seasonal peaks and troughs
6. **API**: `GET /api/admin/reports/yoy?year1=2025&year2=2026`

## Configuration Settings

| Setting | Default | Options | Impact |
|---|---|---|---|
| `reports.default_date_range` | `this_month` | today/this_week/this_month/last_30_days/this_year | Default filter on dashboard load |
| `reports.currency_display` | `EUR` | From configured currencies | Currency for revenue display |
| `reports.cache_ttl_dashboard` | `300` (5 min) | 60-3600 | Redis cache TTL for dashboard data |
| `reports.cache_ttl_reports` | `900` (15 min) | 60-7200 | Redis cache TTL for generated reports |
| `reports.max_export_rows` | `50000` | 1000-500000 | Max rows before async export |
| `reports.pdf_logo` | Resort logo | Image URL | Logo in PDF report headers |
| `reports.scheduled_timezone` | `Europe/Rome` | Any IANA timezone | Timezone for scheduled report delivery |
| `reports.revenue_target_monthly` | `0` (disabled) | 0-999999 | Monthly revenue target for progress display |
| `reports.reconciliation_auto_run` | `daily` | disabled/daily/weekly | Auto-run reconciliation check frequency |
| `reports.retention_days` | `1825` (5 years) | 365-3650 | How long detailed report data is retained |

## Reports & Analytics

This module is itself the reporting engine. Key data sources:

| Data Source | PostgreSQL Table/View | Refresh Frequency |
|---|---|---|
| Revenue data | `mv_daily_revenue` | Every 15 minutes |
| Module stats | `mv_module_stats` | Every 15 minutes |
| Customer analytics | `mv_customer_analytics` | Hourly |
| Staff performance | `mv_staff_performance` | Hourly |
| Occupancy data | `mv_occupancy_stats` | Every 30 minutes |
| Payment reconciliation | `stripe_payments` + `orders` join | On demand |
| Review analytics | `mv_review_stats` | Hourly |

Materialized views are refreshed by a cron job running on the Express.js backend. Manual refresh available at `/admin/reports/settings` → **Refresh Data** button.

## Integration Points

| System | Direction | Data | Trigger |
|---|---|---|---|
| Stripe | Inbound | Payment transactions, fees, refunds | Reconciliation report generation |
| Module Builder | Inbound | Module names, IDs for per-module filtering | Report generation |
| Booking System | Inbound | Booking records, occupancy data | Occupancy and revenue reports |
| Order System | Inbound | Order records, item-level data | Revenue and module reports |
| Customer Accounts | Inbound | Customer profiles, CLV data | Customer analytics |
| Staff System | Inbound | Staff records, shift data, task completions | Staff performance report |
| Coupons & Promotions | Inbound | Discount amounts, redemption counts | Coupon impact report |
| Reviews | Inbound | Ratings, review counts | Review analytics summary |
| Redis Cache | Bidirectional | Report data cache | Dashboard and report loads |
| Email System | Outbound | Scheduled report deliveries | Cron schedule trigger |
| Socket.IO | Inbound | Real-time activity events | Live activity monitor |
| Supabase Functions | Inbound | Materialized view refresh triggers | Cron schedule |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Dashboard shows stale data | Redis cache not expired or materialized views not refreshed | Click "Refresh Data" in report settings; or `redis-cli FLUSHDB` for full cache clear |
| Revenue numbers don't match Stripe dashboard | Timing differences or pending transactions | Run reconciliation report; check for unmatched transactions; allow 24h for Stripe settlement |
| CSV export empty | Filters too restrictive or date range has no data | Broaden date range; remove filters; verify data exists for the period |
| PDF export fails or times out | Complex report with many charts | Reduce date range; simplify report; increase backend `PDF_TIMEOUT_MS` env var |
| Scheduled report email not received | SMTP configuration issue or cron not running | Check email settings in `/admin/settings/email`; verify cron jobs are active (`pm2 status`) |
| Occupancy shows >100% | Overbooking allowed or data integrity issue | Check booking records for overlapping bookings; review module capacity settings |
| Custom report builder slow | Too many dimensions or large date range | Reduce granularity (use monthly instead of daily); narrow filters; limit dimensions to 3 |
| Year-over-year missing data | Previous year data not available or archived | Check data retention settings; older data may need to be restored from backup |
| Staff performance incomplete | Staff not linked to all transactions | Ensure staff assignments are recorded for all order/booking types |
| Real-time monitor not updating | Socket.IO disconnected | Check browser console for WebSocket errors; verify Socket.IO on port 3005 |

## Security & Permissions

| Action | Required Role | Additional Notes |
|---|---|---|
| View revenue dashboard | `admin`, `super_admin` | Core reporting access |
| View module breakdown | `admin`, `super_admin` | — |
| View occupancy reports | `admin`, `super_admin` | — |
| View customer analytics | `super_admin` | Contains PII (names, emails, spend) |
| View staff performance | `super_admin` | Sensitive employee data |
| Financial reconciliation | `super_admin` | Financial data with Stripe details |
| Custom report builder | `super_admin` | Can access any data dimension |
| Configure scheduled reports | `super_admin` | — |
| Export CSV | `admin`, `super_admin` | `admin` limited to non-PII exports |
| Export PDF | `admin`, `super_admin` | Same restrictions as CSV |
| Manage report settings | `super_admin` | — |
| Live activity monitor | `admin`, `super_admin` | — |

All report access is logged in `audit_logs` with `action = report.viewed`, including which report type and filter parameters were used. Export actions are logged separately with `action = report.exported`.

## Related Modules

### Admin Guides
- [Module Builder](./module-builder.md) — Module data that feeds into per-module revenue reports
- [Coupons & Promotions](./coupons-promotions.md) — Discount impact tracked in revenue reports
- [Reviews & Feedback](./reviews-feedback.md) — Review analytics summarized in reports
- [Settings & Configuration](./settings-configuration.md) — Report settings, email config, timezone

### Customer Guides
- [Order History](../customer/orders.md) — Customer-facing view of their orders (data source for admin reports)
- [Booking History](../customer/bookings.md) — Customer-facing bookings (data source for occupancy reports)

## Feature Coverage Summary

| Category | Total Features | Implemented | Tested | Documented |
|---|---|---|---|---|
| Revenue Dashboards | 3 | 3 | 3 | 3 |
| Breakdown Reports | 2 | 2 | 2 | 2 |
| Trend Reports | 3 | 3 | 3 | 3 |
| Domain Reports | 3 | 3 | 3 | 3 |
| Custom & Scheduled | 2 | 2 | 2 | 2 |
| Export | 2 | 2 | 2 | 2 |
| Financial | 1 | 1 | 1 | 1 |
| Additional Reports | 4 | 4 | 4 | 4 |
| **Total** | **20** | **20** | **20** | **20** |
