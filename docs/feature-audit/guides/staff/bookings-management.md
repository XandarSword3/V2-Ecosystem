# Staff Guide: Bookings & Navigation

**Modules:** STF-NAV (9) + STF-DASH (6) + STF-BOOK (8) | **Features:** 23 | **Last Updated:** 2026-02-08

---

## Overview

This guide covers the foundational staff experience: the sidebar navigation system, the staff dashboard with real-time activity feeds, and the general bookings management interface. These three modules work together to provide staff with a unified workspace for navigating between resort modules, monitoring key operational metrics at a glance, and managing bookings of all types with robust filtering, searching, and export capabilities.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Login URL** | `http://localhost:3000/staff/login` |
| **Credentials** | `staff@v2resort.com` / `staff123` |
| **Browser** | Chrome, Firefox, or Edge (latest) |
| **Hardware** | Desktop or tablet; printer for booking documents |
| **Network** | Stable connection for real-time dashboard and WebSocket updates |

---

## Features Covered

### STF-NAV: Navigation (9 Features)

| ID | Feature Name | Type | Status |
|---|---|---|---|
| STF-NAV-001 | Sidebar Navigation | Navigation | ✅ Implemented |
| STF-NAV-002 | Dynamic Module Links | Navigation | ✅ Implemented |
| STF-NAV-003 | Notification Bell | Notification | ✅ Implemented |
| STF-NAV-004 | Mark Notification as Read | Action | ✅ Implemented |
| STF-NAV-005 | Mark All Notifications as Read | Action | ✅ Implemented |
| STF-NAV-006 | Currency Selector | Settings | ✅ Implemented |
| STF-NAV-007 | Theme Toggle (Light/Dark) | Settings | ✅ Implemented |
| STF-NAV-008 | Clock Display | Display | ✅ Implemented |
| STF-NAV-009 | Logout | Action | ✅ Implemented |

### STF-DASH: Dashboard (6 Features)

| ID | Feature Name | Type | Status |
|---|---|---|---|
| STF-DASH-001 | Pending Orders Stat | Dashboard | ✅ Implemented |
| STF-DASH-002 | Completed Today Stat | Dashboard | ✅ Implemented |
| STF-DASH-003 | Active Issues Stat | Dashboard | ✅ Implemented |
| STF-DASH-004 | Quick Actions | Navigation | ✅ Implemented |
| STF-DASH-005 | Activity Feed | Display | ✅ Implemented |
| STF-DASH-006 | Real-time WebSocket Updates | WebSocket | ✅ Implemented |

### STF-BOOK: Bookings (8 Features)

| ID | Feature Name | Type | Status |
|---|---|---|---|
| STF-BOOK-001 | View All Bookings | Display | ✅ Implemented |
| STF-BOOK-002 | Filter by Date | Filter | ✅ Implemented |
| STF-BOOK-003 | Filter by Type | Filter | ✅ Implemented |
| STF-BOOK-004 | Search Bookings | Search | ✅ Implemented |
| STF-BOOK-005 | View Booking Details | Detail View | ✅ Implemented |
| STF-BOOK-006 | Update Booking Status | Action | ✅ Implemented |
| STF-BOOK-007 | Add Notes to Booking | Data Entry | ✅ Implemented |
| STF-BOOK-008 | Print / Export Booking | Export | ✅ Implemented |

---

## Daily Workflow

### Opening Shift

1. **Log in** at `/staff/login` with your credentials. You are redirected to `/staff` (the dashboard).
2. **Check the Dashboard** stats at the top:
   - **Pending Orders**: Number of unprocessed orders across all modules (restaurant, snack bar, etc.).
   - **Completed Today**: Orders/tasks completed so far today.
   - **Active Issues**: Open maintenance requests, complaints, or escalations.
3. **Review the Activity Feed** for any events from the overnight period or early morning (e.g., new online bookings, cancellations).
4. **Check notifications**: Click the bell icon in the top-right. Review any unread notifications from the previous shift.
5. **Navigate** to your assigned module using the sidebar (Restaurant, Chalets, Pool, Snack Bar, or Bookings).

### During Shift

1. **Use the sidebar** to switch between modules as needed. The active module is highlighted.
2. **Monitor notifications**: The bell icon shows a red badge with the unread count. Click to view and manage notifications.
3. **Check the dashboard periodically** for updated stats—especially if managing multiple areas.
4. **Manage bookings** at `/staff/bookings`:
   - Search for specific bookings by guest name, reference, or date.
   - Update booking statuses as guests check in, check out, or modify plans.
   - Add notes for the next shift or for reference.
5. **Respond to quick actions**: The dashboard Quick Actions panel provides one-click access to common tasks (New Booking, Check In, Report Issue).

### Closing Shift

1. Return to the **Dashboard** (`/staff`) and review the day's summary stats.
2. Check for any **unresolved issues** (Active Issues stat should ideally be 0 or have only items for the next shift).
3. **Mark all notifications as read** to clear the queue for the incoming shift.
4. Add any handover notes to relevant bookings.
5. **Log out** using the Logout button in the sidebar footer.

---

## Feature Details

### Navigation (STF-NAV)

#### STF-NAV-001 & STF-NAV-002: Sidebar Navigation & Dynamic Module Links

**Steps to use:**
1. The sidebar is displayed on the left side of every staff page.
2. **Module links** are listed vertically:
   - 🏠 **Dashboard** — `/staff`
   - 📋 **Bookings** — `/staff/bookings`
   - 🏠 **Chalets** — `/staff/chalets`
   - 🍽️ **Restaurant** — `/staff/restaurant`
   - 🏊 **Pool** — `/staff/pool`
   - 🍔 **Snack Bar** — `/staff/snack-bar`
3. The currently active module is highlighted with a colored background and bold text.
4. Module links are **dynamic**—they appear based on staff permissions. If you don't see a module, your account doesn't have access to it. Contact your manager.
5. On tablets, the sidebar collapses to an icon-only view. Tap the hamburger icon (☰) to expand.

#### STF-NAV-003, STF-NAV-004 & STF-NAV-005: Notification Bell & Management

**Steps to use:**
1. The **notification bell** icon is in the top-right toolbar, visible on all staff pages.
2. A **red badge** with a number indicates unread notifications (e.g., "5").
3. **Click the bell** to open the notification dropdown panel.
4. Notifications list shows:
   - Notification text (e.g., "New booking #2145 received," "Maintenance request assigned to you").
   - Timestamp (relative: "5 min ago," "1 hour ago").
   - Read/unread indicator (unread notifications have a blue dot).
5. **Mark individual as read**: Click a notification to mark it as read. The blue dot disappears.
6. **Mark all as read**: Click the **"Mark All Read"** link at the top of the dropdown. All blue dots clear and the badge count resets to 0.
7. Clicking a notification with a link (e.g., a booking notification) navigates you to the relevant page.

#### STF-NAV-006: Currency Selector

**Steps to use:**
1. In the top toolbar, locate the currency indicator (e.g., "EUR" or "€").
2. Click to open the currency dropdown.
3. Select the desired display currency for prices throughout the interface (e.g., EUR, USD, GBP).
4. All monetary values in the interface convert to the selected currency.
5. This is a display setting only—it doesn't change actual transaction currencies.

#### STF-NAV-007: Theme Toggle

**Steps to use:**
1. In the top toolbar, find the theme toggle icon (sun/moon icon).
2. Click to switch between **Light Mode** and **Dark Mode**.
3. The preference is saved in your browser and persists across sessions.
4. Dark mode is recommended for kitchen display screens to reduce eye strain.

#### STF-NAV-008: Clock Display

**Steps to use:**
1. The current time is displayed in the top toolbar, updating every second.
2. Time is shown in the resort's configured timezone.
3. The format (12h/24h) follows the system locale settings.

#### STF-NAV-009: Logout

**Steps to use:**
1. Click **Logout** at the bottom of the sidebar.
2. A confirmation dialog appears: "Are you sure you want to log out?"
3. Click **Confirm**. You are redirected to `/staff/login`.
4. Your session is invalidated—the auth token is cleared from the browser.
5. Always log out when leaving the terminal unattended.

---

### Dashboard (STF-DASH)

#### STF-DASH-001, STF-DASH-002 & STF-DASH-003: Dashboard Stats

**Steps to use:**
1. Navigate to `/staff`. Three stat cards display at the top:
   - **Pending Orders**: Count of all pending orders across restaurant, snack bar, and other ordering modules. Click the card to navigate to the module with the most pending orders.
   - **Completed Today**: Total orders/tasks completed across all modules today. Resets at midnight.
   - **Active Issues**: Open maintenance requests, unresolved complaints, and flagged items requiring attention. Click to view the issues list.
2. Each card shows the current count prominently and a small trend indicator (up/down arrow with percentage vs. yesterday).
3. Stats are fetched on page load and update in real-time via WebSocket.

#### STF-DASH-004: Quick Actions

**Steps to use:**
1. Below the stat cards, the **Quick Actions** panel provides shortcut buttons:
   - **New Booking** — Opens the walk-in booking form.
   - **Check In** — Opens the chalet check-in interface.
   - **Report Issue** — Opens the maintenance/issue reporting form.
   - **View Today's Schedule** — Shows the day's booking overview across modules.
2. Click any button to navigate directly to the relevant function without going through the sidebar.

#### STF-DASH-005: Activity Feed

**Steps to use:**
1. The **Activity Feed** occupies the main content area of the dashboard.
2. It displays a chronological list of recent events across all modules:
   - New bookings, check-ins, check-outs.
   - Order completions.
   - Maintenance requests and resolutions.
   - Staff actions (who did what and when).
3. Each feed item shows: event icon, description, timestamp, and the staff member involved (if applicable).
4. The feed auto-scrolls as new events arrive via WebSocket.
5. Click any feed item to navigate to the relevant detail page.

#### STF-DASH-006: Real-time WebSocket Updates

All dashboard stats and the activity feed update in real-time via Socket.IO (connected to the Express backend at `localhost:3005`). No manual refresh is needed. The connection status indicator in the toolbar shows the current state.

---

### Bookings (STF-BOOK)

#### STF-BOOK-001: View All Bookings

**Steps to use:**
1. Navigate to `/staff/bookings`. The booking list loads all bookings via the backend API.
2. Bookings are displayed in a table format:
   - Columns: Booking Ref, Guest Name, Type (Chalet / Pool / Restaurant / Event), Check-in Date, Check-out Date, Status, Actions.
3. Default sort is by check-in date (soonest first).
4. Click column headers to sort by that column.
5. Pagination controls at the bottom handle large datasets (20 bookings per page).

#### STF-BOOK-002 & STF-BOOK-003: Filter by Date & Type

**Steps to use:**
1. Above the booking table, locate the filter controls.
2. **Date filter**: Click the date picker to select a date range. Only bookings with check-in dates within the range appear.
   - Quick presets: Today, This Week, This Month, Custom Range.
3. **Type filter**: Dropdown to filter by booking type (All, Chalet, Pool, Restaurant, Event).
4. Filters can be combined: e.g., "Chalet bookings this week."
5. The active filters are shown as chips above the table. Click the "×" on a chip to remove that filter.

#### STF-BOOK-004: Search Bookings

**Steps to use:**
1. Use the search bar above the booking table.
2. Search by: guest name, booking reference, email, phone number, or chalet/room number.
3. Results update as you type (debounced, triggers after 300ms pause).
4. Search works in conjunction with active filters.
5. Press `Esc` or clear the field to remove the search.

#### STF-BOOK-005: View Booking Details

**Steps to use:**
1. Click any booking row in the table. A detail panel slides in from the right.
2. The panel shows:
   - Full guest information (name, email, phone, address).
   - Booking details (type, dates, unit/room, guests count).
   - Price breakdown and payment status.
   - Booking history/timeline (created, confirmed, checked-in, etc.).
   - Staff notes attached to the booking.
3. Action buttons at the bottom: Update Status, Add Note, Print, Export.
4. Close the panel with the "×" button or press `Esc`.

#### STF-BOOK-006: Update Booking Status

**Steps to use:**
1. Open the booking detail panel.
2. Click the **Update Status** button. A dropdown appears with valid status transitions:
   - Pending → Confirmed, Cancelled.
   - Confirmed → Checked-in, Cancelled.
   - Checked-in → Checked-out.
3. Select the new status. A confirmation dialog appears.
4. Click **Confirm**. The status updates in the list and the booking history timeline is appended.
5. Status changes trigger notifications to the guest (if configured) and appear in the dashboard activity feed.

#### STF-BOOK-007: Add Notes to Booking

**Steps to use:**
1. Open the booking detail panel.
2. Scroll to the **Notes** section.
3. Click **Add Note**. A text area expands.
4. Type your note (e.g., "Guest called to confirm late arrival at 10 PM," "Extra bed requested").
5. Click **Save Note**. The note is timestamped with your staff name and added to the notes list.
6. Notes are visible to all staff and persist permanently. They cannot be deleted by staff.

#### STF-BOOK-008: Print / Export Booking

**Steps to use:**
1. Open the booking detail panel.
2. **Print**: Click the **Print** button. The browser's print dialog opens with a formatted booking summary (optimized for A4 paper). Includes guest details, booking info, and QR code for check-in.
3. **Export**: Click the **Export** dropdown:
   - **Export as PDF**: Downloads a PDF of the booking details.
   - **Export as CSV**: Downloads booking data in CSV format (useful for batch processing).
4. For bulk export: Use the filter/search to narrow the booking list, then click **Export All** above the table to export all visible bookings as CSV.

---

## Real-time Updates (WebSocket)

| Event | Trigger | Effect on Interface |
|---|---|---|
| `dashboard:stats_updated` | Any order/booking status change | Stat cards update counts |
| `activity:new` | Any staff action or system event | New item appears in Activity Feed |
| `booking:new` | New booking created (online or walk-in) | Booking appears in list; notification bell badge increments |
| `booking:status_changed` | Booking status updated by any staff | Booking row updates in list; activity feed entry |
| `notification:new` | System generates a notification for this user | Bell badge increments; sound plays if enabled |

---

## Escalation Points

| Situation | Action | Escalate To |
|---|---|---|
| Cannot access a module in the sidebar | Permission issue | Manager (to update staff permissions) |
| Dashboard stats seem incorrect | Possible data sync issue | IT Support / Manager |
| Booking not found in search | May be under different name or cancelled | Check with front desk; search by reference number |
| Cannot update booking status | Booking locked by another user or status transition not allowed | Shift Manager |
| Guest disputes booking details | Verify in system; do not modify without authorization | Front Desk Manager |
| Export/print not working | Browser popup blocked or PDF generation error | Try different browser; check popup settings |
| WebSocket disconnected (red indicator) | Network issue | Check WiFi; refresh page; report to IT if persistent |
| Suspicious notification activity | Possible system error or unauthorized access | IT Security + Manager |

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Sidebar doesn't show all modules | Staff account has limited permissions | Contact manager to update your role permissions |
| Dashboard stats show 0 for everything | API not responding or no activity today | Refresh page; check if backend at localhost:3005 is running |
| Activity feed is empty | No actions recorded today or WebSocket disconnected | Verify connection indicator; check if other staff are active |
| Notification bell badge doesn't reset | Not all notifications marked as read | Click "Mark All Read" in the notification dropdown |
| Theme/currency changes don't persist | Browser in private/incognito mode | Use normal browsing mode for persistent settings |
| Search returns no results | Search term doesn't match any field | Try different search terms (reference, email, phone) |
| Booking filters not working together | Known filtering combination issue | Clear all filters, then apply one at a time |
| Print layout is broken | Browser print settings not optimized | Use Chrome for best print output; set paper size to A4 |
| CSV export is garbled | Character encoding issue | Open the CSV in a text editor and re-save as UTF-8 |

---

## Related Modules

- [Chalet Operations](chalet-operations.md) — Chalet-specific booking management
- [Restaurant & Kitchen Operations](restaurant-kitchen.md) — Restaurant orders (visible in dashboard stats)
- [Pool Management](pool-management.md) — Pool session management
- [Snack Bar Operations](snack-bar-operations.md) — Snack bar orders (visible in dashboard stats)
- [Manager: Dashboard & Analytics](../manager/manager-dashboard.md) — Aggregated analytics view

---

## Feature Coverage Summary

| Category | Count | Percentage |
|---|---|---|
| Implemented | 23 | 100% |
| Partially Implemented | 0 | 0% |
| Not Implemented | 0 | 0% |
| **Total** | **23** | **100%** |
