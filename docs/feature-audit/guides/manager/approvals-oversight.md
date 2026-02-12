# Manager Guide: Approvals & Oversight

**Module:** MGR-OVERSEE | **Features:** 27 | **Last Updated:** 2026-02-08

---

## Overview

The Approvals & Oversight module is the manager's operational control center for everything that requires authorization, review, or intervention beyond standard staff capabilities. It consolidates refund approvals, cancellation reviews, pricing overrides, complaint management, audit trails, staff performance, inventory oversight, maintenance approvals, guest feedback follow-up, and system health monitoring into a unified set of admin interfaces. This module ensures accountability, quality control, and operational continuity across the entire resort.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Login URL** | `http://localhost:3000/admin/login` |
| **Credentials** | `admin@v2resort.com` / `admin123` |
| **Browser** | Chrome, Firefox, or Edge (latest) |
| **Hardware** | Desktop recommended for complex approval workflows |
| **Network** | Stable connection required for real-time approval notifications |
| **Access Level** | Manager role (admin login) |
| **Key URLs** | `/admin/approvals`, `/admin/complaints`, `/admin/audit`, `/admin/maintenance` |

---

## Features Covered

| ID | Feature Name | Type | Status |
|---|---|---|---|
| MGR-OVERSEE-001 | Staff Schedule Viewer | Display | ✅ Implemented |
| MGR-OVERSEE-002 | Approve Refunds | Approval | ✅ Implemented |
| MGR-OVERSEE-003 | Reject Refunds | Approval | ✅ Implemented |
| MGR-OVERSEE-004 | Pending Cancellations Queue | Approval | ✅ Implemented |
| MGR-OVERSEE-005 | Pricing Override | Action | ✅ Implemented |
| MGR-OVERSEE-006 | Complaint Log | Display | ✅ Implemented |
| MGR-OVERSEE-007 | Assign Complaint | Action | ✅ Implemented |
| MGR-OVERSEE-008 | Close Complaint | Action | ✅ Implemented |
| MGR-OVERSEE-009 | Audit Trail | Display | ✅ Implemented |
| MGR-OVERSEE-010 | Staff Performance Report | Analytics | ✅ Implemented |
| MGR-OVERSEE-011 | Daily Targets | Configuration | ✅ Implemented |
| MGR-OVERSEE-012 | Inventory Alerts | Notification | ✅ Implemented |
| MGR-OVERSEE-013 | Inventory Approvals | Approval | ✅ Implemented |
| MGR-OVERSEE-014 | Maintenance Requests View | Display | ✅ Implemented |
| MGR-OVERSEE-015 | Maintenance Approvals | Approval | ✅ Implemented |
| MGR-OVERSEE-016 | Guest Feedback View | Display | ✅ Implemented |
| MGR-OVERSEE-017 | Guest Feedback Follow-up | Action | ✅ Implemented |
| MGR-OVERSEE-018 | Waitlist Status | Display | ✅ Implemented |
| MGR-OVERSEE-019 | Table Assignments | Action | ✅ Implemented |
| MGR-OVERSEE-020 | Emergency Notifications | Notification | ✅ Implemented |
| MGR-OVERSEE-021 | Capacity Override | Action | ✅ Implemented |
| MGR-OVERSEE-022 | Financial Summary | Analytics | ✅ Implemented |
| MGR-OVERSEE-023 | Discount Approvals | Approval | ✅ Implemented |
| MGR-OVERSEE-024 | Scheduled Reports | Configuration | ✅ Implemented |
| MGR-OVERSEE-025 | System Health Monitor | Display | ✅ Implemented |
| MGR-OVERSEE-026 | Custom Dashboard Layout | Configuration | ✅ Implemented |
| MGR-OVERSEE-027 | CSV Export | Export | ✅ Implemented |

---

## Daily Workflow

### Morning Review

1. **Log in** at `/admin/login` with your admin credentials.
2. Navigate to `/admin/approvals` to review the pending queue:
   - **Pending Refunds**: Review refund requests from staff. Approve or reject each with a reason.
   - **Pending Cancellations**: Bookings flagged for cancellation that exceed the auto-approve threshold. Review and decide.
   - **Discount Approvals**: Staff-requested discounts that exceed their authority level.
3. Check `/admin/maintenance` for **overnight maintenance requests**. Approve urgent ones first.
4. Review `/admin/complaints` for any **new guest complaints** logged since yesterday. Assign them to the relevant department head.
5. Glance at the **Staff Schedule** to verify today's staffing coverage across all modules.
6. Check **Inventory Alerts** — approve purchase requisitions for low-stock items.
7. Open **System Health** to verify all services (frontend, backend, database, WebSocket) are operational.

### Midday Oversight

1. Review **Staff Performance** metrics to monitor productivity and identify anyone who may need assistance or a break.
2. Check **Daily Targets** progress — are modules on track for revenue and order targets?
3. Monitor the **Waitlist Status** for the restaurant and reassign tables if needed via **Table Assignments**.
4. Respond to any **Emergency Notifications** immediately (pool closures, safety incidents, system outages).
5. Follow up on morning complaints — check if assigned staff have begun addressing them.

### End of Day

1. Review the **Financial Summary** for the day. Compare actual vs. target across all revenue streams.
2. Close any resolved **Complaints** that staff have handled.
3. Check the **Audit Trail** for any unusual activity (manual overrides, deleted records, after-hours access).
4. Run or verify **Scheduled Reports** for the day (daily summary email, revenue report, occupancy report).
5. **Export CSV** of any data needed for weekly management meetings.
6. Optionally customize your **Dashboard Layout** to surface the widgets most relevant to tomorrow's priorities.
7. Log out.

---

## Feature Details

### MGR-OVERSEE-001: Staff Schedule Viewer

**Steps to use:**
1. Navigate to the Staff Schedule section in the admin panel.
2. A weekly calendar grid displays staff assignments across all modules.
3. Rows represent staff members; columns represent days. Each cell shows the assigned module and shift time.
4. Filter by module (Restaurant, Pool, Chalets, etc.) to see staffing for a specific area.
5. Click a cell to see shift details: start/end time, break schedule, and notes.
6. Use this to verify adequate coverage and identify gaps before they become problems.
7. Schedule changes must be made through the HR/scheduling system—this view is read-only for quick reference.

### MGR-OVERSEE-002 & MGR-OVERSEE-003: Approve / Reject Refunds

**Steps to use:**
1. Navigate to `/admin/approvals`. The **Refunds** tab shows pending refund requests.
2. Each request displays: booking reference, guest name, refund amount, reason, requesting staff member, and timestamp.
3. Click a request to see the full booking history, payment records, and refund justification.
4. **To approve**: Click **Approve Refund**. Enter an optional note (e.g., "Approved per cancellation policy §3.2"). Click **Confirm**. The refund is processed and the guest is notified.
5. **To reject**: Click **Reject Refund**. Enter a mandatory rejection reason (e.g., "Outside refund window," "Non-refundable booking"). Click **Confirm**. The requesting staff member is notified.
6. Approved refunds appear in the Financial Summary as deductions.
7. Both actions are logged in the Audit Trail.

### MGR-OVERSEE-004: Pending Cancellations Queue

**Steps to use:**
1. Under the **Cancellations** tab in `/admin/approvals`, view bookings where staff or guests have requested cancellation but the value exceeds the auto-approve threshold.
2. Each entry shows: booking reference, guest name, booking value, cancellation reason, penalty amount (if applicable), and requesting party.
3. Review the booking details and cancellation policy compliance.
4. Click **Approve Cancellation** to cancel the booking and process any applicable refund.
5. Click **Deny Cancellation** to keep the booking active and notify the guest/staff.
6. For partial cancellations (e.g., reducing a multi-night stay), use the Pricing Override feature to adjust the booking value.

### MGR-OVERSEE-005: Pricing Override

**Steps to use:**
1. Navigate to the booking or order that requires a price adjustment.
2. Click **Override Price** (available only to managers).
3. Enter the new price and select the reason: Complaint Resolution, Loyalty Discount, Error Correction, Promotional Rate, Manager Discretion.
4. The system shows the original price, new price, and the difference.
5. Click **Apply Override**. The price updates across all related records (invoice, booking details, revenue reports).
6. All overrides are logged in the Audit Trail with the manager's name, timestamp, reason, and amount.

### MGR-OVERSEE-006, MGR-OVERSEE-007 & MGR-OVERSEE-008: Complaint Management

**Steps to use:**
1. Navigate to `/admin/complaints`. The complaint log shows all guest complaints.
2. **Complaint Log (006)**: A table listing all complaints with columns: ID, Guest Name, Category (Service, Cleanliness, Food, Noise, Billing, Other), Priority (Low/Medium/High/Critical), Status (Open/Assigned/In Progress/Resolved/Closed), Date.
3. **Assign Complaint (007)**: Click an unassigned (Open status) complaint. Click **Assign**. Select the staff member or department head from the dropdown. Add instructions if needed. Click **Confirm**. The assigned person receives a notification.
4. **Close Complaint (008)**: Once a complaint has been resolved and the guest is satisfied, click the complaint, review the resolution notes from the assigned staff, and click **Close Complaint**. Enter a closing summary (e.g., "Guest received complimentary dinner; issue resolved"). The complaint status changes to Closed.
5. Overdue complaints (open >24 hours without assignment, or assigned >48 hours without progress) are highlighted in red.

### MGR-OVERSEE-009: Audit Trail

**Steps to use:**
1. Navigate to `/admin/audit`. The audit trail shows a chronological log of all significant system actions.
2. Entries include: timestamp, user (staff or manager), action type (login, status change, override, deletion, export), target resource, old value, new value, IP address.
3. Filter by: date range, user, action type, or module.
4. Search for specific entries using the search bar (e.g., search by booking reference to see all actions on that booking).
5. The audit trail is append-only—entries cannot be modified or deleted.
6. Use this for: investigating disputes, compliance auditing, identifying unauthorized actions, and performance review evidence.
7. Export the audit trail to CSV for external analysis.

### MGR-OVERSEE-010: Staff Performance Report

**Steps to use:**
1. The Staff Performance section shows detailed metrics per staff member.
2. Metrics include: orders processed, average processing time, customer ratings received, shift hours, attendance, late arrivals, complaints received, compliments received.
3. Select a time period (today, this week, this month, custom range).
4. Sort by any metric to rank staff (e.g., sort by customer ratings to find top performers).
5. Click a staff member for their individual performance dashboard with trend charts.
6. Export the report as PDF or CSV for HR review.

### MGR-OVERSEE-011: Daily Targets

**Steps to use:**
1. Navigate to the Daily Targets configuration.
2. Set performance targets for each module: revenue target, order count target, customer satisfaction target.
3. Targets are displayed on the manager dashboard as progress bars (actual vs. target).
4. At end of day, the system generates a target achievement report automatically.
5. Edit targets by clicking the pencil icon next to each metric. Changes take effect the next day.
6. Historical target performance is stored and available for trend analysis.

### MGR-OVERSEE-012 & MGR-OVERSEE-013: Inventory Alerts & Approvals

**Steps to use:**
1. **Inventory Alerts (012)**: A notification badge on the admin nav shows the count of active inventory alerts. Click to view items that have fallen below their reorder threshold.
2. Each alert shows: item name, current stock, minimum threshold, location (kitchen, snack bar, pool bar), and suggested reorder quantity.
3. **Inventory Approvals (013)**: Staff can submit purchase requisitions for restock. These appear in the approvals queue.
4. Review the requisition: items, quantities, estimated cost, supplier, requesting staff member.
5. Click **Approve** to authorize the purchase. The procurement team is notified.
6. Click **Reject** with a reason if the request is unnecessary or the budget doesn't allow it.

### MGR-OVERSEE-014 & MGR-OVERSEE-015: Maintenance Requests & Approvals

**Steps to use:**
1. Navigate to `/admin/maintenance`. The maintenance dashboard shows all requests.
2. **Requests View (014)**: A table listing all maintenance requests with: ID, Location (Chalet #, Pool, Restaurant), Category, Priority, Status (Submitted/Approved/In Progress/Completed), Submitted By, Date.
3. Filter by priority, status, or location.
4. **Approvals (015)**: Requests with estimated costs above the auto-approve threshold require manager approval.
5. Click a pending request. Review the description, photos, estimated cost, and recommended vendor.
6. Click **Approve** to authorize the work. The maintenance team and external vendor (if applicable) are notified.
7. Click **Reject** or **Defer** if the work isn't urgent or budget constraints apply.
8. Track progress by monitoring status updates from the maintenance team.

### MGR-OVERSEE-016 & MGR-OVERSEE-017: Guest Feedback & Follow-up

**Steps to use:**
1. **Guest Feedback View (016)**: Navigate to the feedback section. A list shows all guest feedback entries from surveys, in-app feedback, and direct messages.
2. Each entry shows: guest name, rating (1-5), feedback text, date, channel (email survey, in-app, front desk), and follow-up status (None/Pending/Completed).
3. Click an entry to read the full feedback and see the guest's booking history.
4. **Follow-up (017)**: For feedback that warrants action, click **Follow Up**.
5. Choose the follow-up method: Email, Phone Call, In-Person (next visit), Complimentary Offer.
6. Write the follow-up message or note the action taken.
7. Click **Submit**. The follow-up is logged and the feedback status changes to "Follow-up Completed."
8. Negative feedback (1-2 stars) should be followed up within 24 hours.

### MGR-OVERSEE-018: Waitlist Status

**Steps to use:**
1. The Waitlist Status panel shows guests currently waiting for restaurant tables or other capacity-limited services.
2. Each entry: guest name, party size, wait time, requested area (indoor/outdoor/bar), status (waiting/called/no-show).
3. Monitor wait times to ensure they stay within acceptable ranges (< 20 minutes target).
4. If wait times are excessive, consider opening additional seating or offering alternatives.

### MGR-OVERSEE-019: Table Assignments

**Steps to use:**
1. Navigate to the Table Assignments view. A floor plan or grid shows all restaurant tables.
2. Each table shows: table number, capacity, current status (Available/Occupied/Reserved/Being Cleaned).
3. Drag a waitlisted guest onto an available table to assign seating.
4. Click a table to see details: current guests, order status, server assigned.
5. Reassign servers by dragging staff names between table groups.
6. Use this during peak hours to optimize seating flow and server workloads.

### MGR-OVERSEE-020: Emergency Notifications

**Steps to use:**
1. Emergency notifications appear as full-screen overlays or prominent banners, regardless of which page you're viewing.
2. Types: Pool Emergency Closure, Fire Alarm, Medical Emergency, Security Alert, System Outage.
3. Each notification shows: type, location, time, reporting staff member, and required actions.
4. **Acknowledge** the notification by clicking the button—this logs that you've seen it and are responding.
5. Coordinate response through the appropriate channels (call emergency services, evacuate area, deploy staff).
6. After resolution, the notification can be closed and the incident report is filed in the Audit Trail.

### MGR-OVERSEE-021: Capacity Override

**Steps to use:**
1. Navigate to the capacity settings for any module (Pool, Restaurant, Event Space).
2. Click **Override Capacity**.
3. Enter the new maximum capacity and the reason: Event, Maintenance, Safety, Weather, Regulation.
4. Set an optional expiration (e.g., "Override valid until 6 PM today").
5. Click **Apply**. All staff interfaces for that module immediately reflect the new capacity limit.
6. The override is logged in the Audit Trail.
7. To restore normal capacity, click **Remove Override** or wait for the expiration time.

### MGR-OVERSEE-022: Financial Summary

**Steps to use:**
1. The Financial Summary provides a comprehensive money view across all resort operations.
2. Sections: Total Revenue, Expenses (refunds, overrides, comps), Net Revenue, Payment Method Breakdown (Cash/Card/Room Charge/Online), Tax Collected.
3. Compare across periods: Today vs. Yesterday, This Week vs. Last Week, This Month vs. Last Month.
4. Drill down by module to see which areas contribute most to revenue.
5. Flag discrepancies between system totals and actual cash/card settlements for investigation.
6. Use the date range picker to analyze any historical period.

### MGR-OVERSEE-023: Discount Approvals

**Steps to use:**
1. In the `/admin/approvals` page, the **Discounts** tab shows pending discount requests.
2. Each request: booking/order reference, staff member, discount type (percentage/fixed/promotional code), discount amount, reason.
3. Staff can apply small discounts independently (e.g., <10%). Larger discounts require manager approval.
4. Review the justification and booking/order value. Verify the discount is appropriate.
5. Click **Approve** or **Reject** with a reason.
6. Approved discounts are applied immediately and reflected in the Financial Summary.

### MGR-OVERSEE-024: Scheduled Reports

**Steps to use:**
1. Navigate to the Scheduled Reports configuration.
2. View existing scheduled reports: report type, frequency (daily/weekly/monthly), recipients, delivery method (email/dashboard), time of delivery.
3. To create a new scheduled report:
   - Click **+ New Scheduled Report**.
   - Select report type: Daily Summary, Revenue Report, Occupancy Report, Staff Performance, Booking Trends, Financial Summary.
   - Set frequency and delivery time.
   - Add recipient email addresses.
   - Click **Save Schedule**.
4. Reports generate automatically and are delivered at the configured time.
5. Edit or delete existing schedules by clicking the edit/delete icons.

### MGR-OVERSEE-025: System Health Monitor

**Steps to use:**
1. Navigate to the System Health section.
2. Service status panels show:
   - **Frontend** (Next.js at localhost:3000): Status, response time, errors.
   - **Backend** (Express at localhost:3005): Status, API response time, active connections.
   - **Database** (Supabase PostgreSQL): Status, query performance, connection pool.
   - **WebSocket** (Socket.IO): Status, active connections, message throughput.
   - **File Storage**: Disk usage, upload/download rates.
3. Each service shows: 🟢 Healthy, 🟡 Degraded, 🔴 Down.
4. Click a service for detailed metrics: uptime history, error logs, and performance graphs.
5. If a service is degraded or down, coordinate with IT support for resolution.

### MGR-OVERSEE-026: Custom Dashboard Layout

**Steps to use:**
1. On the admin dashboard, click the **Customize** button (grid icon) in the toolbar.
2. The dashboard enters edit mode—widgets show drag handles and resize controls.
3. **Rearrange widgets**: Drag widgets to new positions on the grid.
4. **Resize widgets**: Pull the corner handle to make widgets larger or smaller.
5. **Hide widgets**: Click the "×" on a widget to remove it from your view.
6. **Add widgets**: Click **+ Add Widget** to see available widgets and add new ones.
7. Click **Save Layout** to persist your configuration. It's saved per-account and loads every time you log in.
8. Click **Reset to Default** to restore the original layout.

### MGR-OVERSEE-027: CSV Export

**Steps to use:**
1. On any data table in the admin panel (approvals, complaints, audit trail, bookings, etc.), locate the **Export CSV** button.
2. Click the button. The current view (including active filters) is exported as a CSV file.
3. The CSV includes all visible columns and respects the current sort order.
4. For large datasets, the export may take a few seconds—a progress indicator appears.
5. The file downloads automatically with a descriptive filename (e.g., "complaints-2026-02-08.csv").
6. Open in Excel, Google Sheets, or any spreadsheet application for further analysis.
7. Useful for: weekly management meetings, compliance reporting, data analysis, and archiving.

---

## Real-time Updates (WebSocket)

| Event | Trigger | Effect on Interface |
|---|---|---|
| `approval:new` | Staff submits refund/discount/cancellation request | Badge count updates on Approvals tab |
| `complaint:new` | Staff logs a new complaint | Complaint log refreshes; notification to manager |
| `maintenance:new` | Staff reports maintenance issue | Maintenance dashboard updates |
| `emergency:triggered` | Emergency event (pool closure, alarm) | Full-screen emergency notification overlay |
| `feedback:new` | Guest submits feedback | Feedback panel updates; CSAT may recalculate |
| `inventory:alert` | Stock falls below threshold | Inventory alert badge appears |
| `system:health_changed` | Service status changes | Health monitor widget updates color |

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Approvals queue shows 0 items but staff says they submitted | Request may be below auto-approve threshold | Check the auto-approve settings; request may have been auto-processed |
| Cannot approve a refund — button grayed out | Another manager is reviewing the same request | Wait and try again; or coordinate with the other manager |
| Audit Trail doesn't show a particular action | Action type may not be audited by default | Check audit configuration; some low-priority actions may be filtered |
| Complaint shows "Assigned" but assignee says they didn't get notification | Email or in-app notification delivery failure | Manually inform the staff member; check notification service health |
| Financial Summary doesn't match accounting records | Timing difference or unprocessed transactions | Ensure all orders are completed/closed before comparing; check for pending refunds |
| Emergency notification not received | Manager was logged out or WebSocket disconnected | Ensure 24/7 manager coverage; set up SMS fallback for emergencies |
| CSV export times out | Too much data in the current view | Apply filters to reduce the dataset before exporting |
| Custom dashboard layout not saving | Browser storage issue or session expired | Log out and back in; clear browser cache; try a different browser |
| Scheduled report not delivered | Email service down or incorrect recipient address | Check System Health for email service status; verify recipient addresses |
| Capacity override not taking effect | Override may have expired or been superseded | Check override expiration; verify it was saved successfully |
| Maintenance request marked complete but issue persists | Premature closure by maintenance team | Reopen the request; add a note about the ongoing issue |

---

## Related Modules

- [Manager: Dashboard & Analytics](manager-dashboard.md) — High-level analytics and revenue overview
- [Staff: Bookings & Navigation](../staff/bookings-management.md) — Staff bookings that may require manager approval
- [Staff: Chalet Operations](../staff/chalet-operations.md) — Chalet maintenance and cancellation requests originate here
- [Staff: Restaurant & Kitchen](../staff/restaurant-kitchen.md) — Complaint and feedback sources
- [Staff: Pool Management](../staff/pool-management.md) — Pool emergency closures and capacity overrides
- [Staff: Snack Bar Operations](../staff/snack-bar-operations.md) — Inventory alerts and stock management

---

## Feature Coverage Summary

| Category | Count | Percentage |
|---|---|---|
| Implemented | 27 | 100% |
| Partially Implemented | 0 | 0% |
| Not Implemented | 0 | 0% |
| **Total** | **27** | **100%** |
