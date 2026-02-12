# Manager Guide: Dashboard & Analytics

**Module:** MGR-DASH | **Features:** 15 | **Last Updated:** 2026-02-08

---

## Overview

The Manager Dashboard provides a comprehensive, real-time overview of resort operations through analytics widgets, charts, and performance metrics. Managers can track revenue across time periods, monitor occupancy rates, evaluate staff performance, compare module-level KPIs, review customer satisfaction scores, and export reports—all from a single consolidated view. The dashboard is the manager's command center for data-driven decision making.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Login URL** | `http://localhost:3000/admin/login` |
| **Credentials** | `admin@v2resort.com` / `admin123` |
| **Browser** | Chrome, Firefox, or Edge (latest) |
| **Hardware** | Desktop or large tablet for optimal chart visibility |
| **Network** | Stable connection for real-time data streaming |
| **Access Level** | Manager role (admin login grants management-level access) |

---

## Features Covered

| ID | Feature Name | Type | Status |
|---|---|---|---|
| MGR-DASH-001 | Revenue Overview (Today/Week/Month) | Analytics | ✅ Implemented |
| MGR-DASH-002 | Occupancy Rate | Metric | ✅ Implemented |
| MGR-DASH-003 | Staff Performance Metrics | Analytics | ✅ Implemented |
| MGR-DASH-004 | Module Comparison | Analytics | ✅ Implemented |
| MGR-DASH-005 | Real-time Order Feed | Live Display | ✅ Implemented |
| MGR-DASH-006 | Customer Satisfaction Score | Metric | ✅ Implemented |
| MGR-DASH-007 | Active Promotions | Display | ✅ Implemented |
| MGR-DASH-008 | Recent Reviews | Display | ✅ Implemented |
| MGR-DASH-009 | Quick Actions | Navigation | ✅ Implemented |
| MGR-DASH-010 | Date Range Picker | Filter | ✅ Implemented |
| MGR-DASH-011 | Export Dashboard as PDF | Export | ✅ Implemented |
| MGR-DASH-012 | Revenue Chart | Visualization | ✅ Implemented |
| MGR-DASH-013 | Booking Trends Chart | Visualization | ✅ Implemented |
| MGR-DASH-014 | Module Revenue Breakdown | Analytics | ✅ Implemented |
| MGR-DASH-015 | Real-time WebSocket Data Stream | WebSocket | ✅ Implemented |

---

## Daily Workflow

### Morning Review

1. **Log in** at `/admin/login` with your admin credentials.
2. You are redirected to the admin dashboard at `/admin`.
3. **Review the Revenue Overview** cards at the top:
   - **Today's Revenue**: Current day total. Compare with the same day last week (shown as a delta percentage).
   - **This Week**: Running weekly total vs. target.
   - **This Month**: Month-to-date performance.
4. **Check Occupancy Rate**: The occupancy gauge shows current chalet/room occupancy as a percentage. Green (>70%), yellow (50-70%), red (<50%) indicates performance level.
5. **Scan Recent Reviews**: Look for any negative reviews (1-2 stars) from the previous day. Click to read and determine if follow-up is needed.
6. **Review Active Promotions**: Ensure current promotions are running as expected—check start/end dates and redemption counts.

### Midday Check

1. **Monitor the Real-time Order Feed**: Watch live orders flowing across restaurant, snack bar, and other modules. This gives a pulse on current activity levels.
2. **Check Staff Performance**: Review orders processed, average handling time, and customer ratings per staff member. Identify anyone who may need support.
3. **Module Comparison**: Compare revenue and order volumes across Restaurant, Pool, Snack Bar, and Chalets to spot underperforming areas.
4. **Review the Revenue Chart**: The line/bar chart shows intra-day revenue. Look for dips that might indicate operational issues.

### End of Day

1. **Use the Date Range Picker** to set today's date and review the full day's metrics.
2. **Check Customer Satisfaction Score**: The aggregated CSAT score from guest feedback, reviews, and surveys. Target: ≥4.0/5.0.
3. **Review Booking Trends Chart**: Understand tomorrow's booking volume to plan staffing.
4. **Export the Dashboard as PDF**: Click Export to generate a daily report for senior management or records.
5. **Log out** or continue to Approvals & Oversight for pending items.

---

## Feature Details

### MGR-DASH-001: Revenue Overview

**Steps to use:**
1. At the top of the dashboard, three revenue cards display:
   - **Today**: Total revenue from all sources (room bookings, restaurant, pool, snack bar, events) for today.
   - **This Week**: Sunday-to-Saturday running total.
   - **This Month**: First-of-month to today's date.
2. Each card shows:
   - The absolute revenue figure in the selected currency.
   - A percentage change vs. the previous equivalent period (e.g., today vs. yesterday, this week vs. last week).
   - An up/down arrow with green (positive) or red (negative) coloring.
3. Click any card to drill down into a detailed revenue breakdown by source module.
4. Revenue data updates in real-time as orders are completed and payments processed.

### MGR-DASH-002: Occupancy Rate

**Steps to use:**
1. The **Occupancy Rate** widget shows a circular gauge with the current percentage.
2. Below the gauge: "X of Y chalets occupied" (e.g., "24 of 30").
3. The gauge is color-coded:
   - 🟢 **Green** (>70%): Healthy occupancy.
   - 🟡 **Yellow** (50-70%): Moderate—consider promotions.
   - 🔴 **Red** (<50%): Low—review pricing and marketing.
4. Click the widget to see occupancy trends over the past 30 days (line chart).
5. Occupancy factors in confirmed and checked-in bookings for the current date.

### MGR-DASH-003: Staff Performance Metrics

**Steps to use:**
1. The **Staff Performance** panel shows a table of active staff members.
2. Columns: Staff Name, Module, Orders Handled, Avg. Handling Time, Customer Rating, Status (Online/Offline).
3. Sort by any column to identify top and bottom performers.
4. Click a staff member's row to see their detailed activity log and shift history.
5. Use this data for performance reviews, training identification, and workload rebalancing.
6. Data reflects the current date by default; use the Date Range Picker to view historical performance.

### MGR-DASH-004: Module Comparison

**Steps to use:**
1. The **Module Comparison** widget shows a side-by-side comparison of all active resort modules.
2. Metrics per module: Revenue, Order Count, Average Order Value, Customer Rating.
3. Displayed as a horizontal bar chart or data table (toggle between views).
4. Use this to identify which modules drive the most revenue and which need attention.
5. Click a module name to navigate to that module's detailed analytics.

### MGR-DASH-005: Real-time Order Feed

**Steps to use:**
1. The **Live Order Feed** panel on the right side of the dashboard shows orders as they happen across all modules.
2. Each entry shows: timestamp, order number, module (Restaurant, Snack Bar, etc.), item count, total value, status.
3. New orders appear at the top with a brief animation.
4. The feed is powered by WebSocket and reflects activity within seconds.
5. Click an order to navigate to its detail view in the respective module.
6. Filter the feed by module using the dropdown at the top of the panel.

### MGR-DASH-006: Customer Satisfaction Score

**Steps to use:**
1. The **CSAT** widget displays an aggregated satisfaction score (1.0 - 5.0 scale).
2. The score is compiled from: guest reviews, post-stay surveys, and in-app feedback.
3. A star rating visual accompanies the numeric score.
4. Below the score: total number of feedback submissions and the trend (improving/declining).
5. Click the widget to see a breakdown by feedback source and a word cloud of common comments.
6. Target CSAT: ≥4.0. Scores below 3.5 require immediate investigation.

### MGR-DASH-007: Active Promotions

**Steps to use:**
1. The **Active Promotions** panel lists all currently running promotions and offers.
2. Each promotion shows: name, type (discount, bundle, loyalty reward), start/end date, redemption count, target vs. actual performance.
3. Active promotions have a green badge; upcoming ones show "Starts in X days."
4. Click a promotion to see its full configuration and redemption details.
5. If a promotion is underperforming, consider adjusting its visibility or extending the duration.

### MGR-DASH-008: Recent Reviews

**Steps to use:**
1. The **Recent Reviews** panel shows the latest 5-10 guest reviews.
2. Each review shows: guest name, star rating, review excerpt, date, and source (Google, TripAdvisor, In-App).
3. Reviews are sorted newest first.
4. Color-coded by rating: ⭐⭐⭐⭐⭐ Green, ⭐⭐⭐ Yellow, ⭐⭐/⭐ Red.
5. Click a review to read the full text and add a management response.
6. Negative reviews (1-2 stars) are highlighted with a red border for immediate attention.

### MGR-DASH-009: Quick Actions

**Steps to use:**
1. The **Quick Actions** bar provides shortcut buttons for common manager tasks:
   - **Approve Refunds** — Jump to the refund approval queue.
   - **Staff Schedule** — View and edit today's staff roster.
   - **Generate Report** — Open the report generation wizard.
   - **System Health** — View server and service health status.
   - **Send Announcement** — Broadcast a message to all active staff.
2. Quick Actions save navigation time by linking directly to high-frequency tasks.

### MGR-DASH-010: Date Range Picker

**Steps to use:**
1. Located at the top-right of the dashboard, the **Date Range Picker** controls the time period for all analytics widgets.
2. Click the date display to open the picker. Options:
   - **Presets**: Today, Yesterday, Last 7 Days, This Month, Last Month, This Quarter, This Year, Custom.
   - **Custom**: Select start and end dates from a calendar.
3. After selecting a range, all widgets, charts, and metrics reload to reflect the chosen period.
4. The selected range is shown as text next to the picker (e.g., "Feb 1 – Feb 8, 2026").
5. The default is "Today" on first load.

### MGR-DASH-011: Export Dashboard as PDF

**Steps to use:**
1. Click the **Export PDF** button in the top toolbar.
2. A dialog appears with export options:
   - **Include Sections**: Checkboxes for each widget/section to include in the PDF.
   - **Date Range**: Confirms the currently selected date range.
   - **Notes**: Optional text to append to the report footer.
3. Click **Generate PDF**. The system compiles all selected widgets into a formatted PDF.
4. The PDF downloads automatically. It includes charts as images, tables as formatted data, and the V2 Resort branding.
5. Use this for daily/weekly reporting to ownership or for archival purposes.

### MGR-DASH-012: Revenue Chart

**Steps to use:**
1. The **Revenue Chart** is a time-series visualization showing revenue over the selected date range.
2. **For "Today"**: An hourly bar chart showing revenue per hour.
3. **For multi-day ranges**: A daily line chart with data points for each day.
4. Hover over data points to see exact figures.
5. Toggle between **Line**, **Bar**, and **Area** chart types using the icons above the chart.
6. Overlay comparison data (e.g., this week vs. last week) by clicking the **Compare** toggle.

### MGR-DASH-013: Booking Trends Chart

**Steps to use:**
1. The **Booking Trends Chart** shows booking volume over time.
2. Displays new bookings, cancellations, and net bookings as separate data series.
3. Use this to identify booking patterns (e.g., weekday vs. weekend, seasonal trends).
4. The chart respects the Date Range Picker selection.
5. Hover for details; click a data point to see the list of bookings for that day.

### MGR-DASH-014: Module Revenue Breakdown

**Steps to use:**
1. A **pie chart or donut chart** shows revenue contribution by module (Chalets, Restaurant, Pool, Snack Bar, Events, etc.).
2. Hover over a segment to see the exact amount and percentage.
3. Click a segment to drill into that module's revenue details.
4. The breakdown updates with the Date Range Picker.

### MGR-DASH-015: Real-time WebSocket Data Stream

All live widgets (order feed, stats, charts) are powered by WebSocket connections to the backend at `localhost:3005`. Data appears on the dashboard within 1-2 seconds of the underlying event.

---

## Real-time Updates (WebSocket)

| Event | Trigger | Effect on Dashboard |
|---|---|---|
| `order:completed` | Any order marked complete | Revenue cards update; order appears in live feed |
| `booking:new` | New booking created | Booking trends chart updates; occupancy recalculates |
| `booking:cancelled` | Booking cancelled | Net bookings adjust; occupancy recalculates |
| `review:new` | Guest posts a review | Recent Reviews panel updates; CSAT may change |
| `staff:status_changed` | Staff logs in/out | Staff Performance panel updates online status |
| `revenue:updated` | Payment processed | Revenue chart data point updates |
| `promotion:redeemed` | Guest uses a promotion | Active Promotions redemption count increments |

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Revenue shows $0 for today | No completed orders yet or API error | Check if orders exist; refresh page; verify backend is running |
| Charts not rendering | JavaScript error or browser incompatibility | Clear cache; try Chrome; disable browser extensions |
| Date Range Picker not responding | Calendar widget JavaScript conflict | Refresh page; try clicking the text label instead of the icon |
| PDF export is blank or incomplete | Large date range causing timeout | Use a shorter date range; try section-by-section export |
| Occupancy rate doesn't match front desk count | Bookings not updated (no-shows not processed) | Ask front desk to process no-shows; check booking statuses |
| Real-time feed is delayed or frozen | WebSocket disconnected | Check connection indicator; refresh page |
| Staff Performance shows offline for active staff | Staff on a different terminal or session expired | Ask staff to log in again; check their session |
| Module comparison data is missing a module | Module has no activity in selected date range | Extend the date range or check if the module is active |
| CSAT score seems unusually low/high | Small sample size skewing average | Check the number of submissions; look at raw reviews |

---

## Related Modules

- [Manager: Approvals & Oversight](approvals-oversight.md) — Actionable management tasks (refunds, complaints, etc.)
- [Staff: Bookings & Navigation](../staff/bookings-management.md) — Staff-level booking view that feeds dashboard data
- [Staff: Restaurant & Kitchen](../staff/restaurant-kitchen.md) — Restaurant module whose orders appear in the live feed
- [Staff: Pool Management](../staff/pool-management.md) — Pool revenue and sessions in analytics
- [Staff: Snack Bar Operations](../staff/snack-bar-operations.md) — Snack bar revenue in analytics

---

## Feature Coverage Summary

| Category | Count | Percentage |
|---|---|---|
| Implemented | 15 | 100% |
| Partially Implemented | 0 | 0% |
| Not Implemented | 0 | 0% |
| **Total** | **15** | **100%** |
