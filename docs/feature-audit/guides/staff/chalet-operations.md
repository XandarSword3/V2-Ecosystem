# Staff Guide: Chalet Operations

**Module:** STF-CHAL | **Features:** 17 | **Last Updated:** 2026-02-08

---

## Overview

The Chalet Operations module is the primary workspace for front-desk and chalet management staff. It provides a comprehensive dashboard showing today's check-ins, check-outs, and occupancy, along with tools to search, filter, and manage guest bookings throughout their stay lifecycle. Staff can perform check-ins and check-outs, create walk-in bookings, report maintenance issues, view booking timelines, and communicate directly with guests—all from a single interface.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Login URL** | `http://localhost:3000/staff/login` |
| **Credentials** | `staff@v2resort.com` / `staff123` |
| **Browser** | Chrome, Firefox, or Edge (latest) |
| **Hardware** | Desktop or tablet with keyboard; printer for check-in documents |
| **Network** | Stable connection for real-time booking updates |

---

## Features Covered

| ID | Feature Name | Type | Status |
|---|---|---|---|
| STF-CHAL-001 | Dashboard Stats (Check-ins/Check-outs/Occupied) | Dashboard | ✅ Implemented |
| STF-CHAL-002 | Search Bookings | Search | ✅ Implemented |
| STF-CHAL-003 | Filter Bookings (Today/All Toggle) | Filter | ✅ Implemented |
| STF-CHAL-004 | Check-in Guest | Action | ✅ Implemented |
| STF-CHAL-005 | Check-out Guest | Action | ✅ Implemented |
| STF-CHAL-006 | Confirm Booking | Action | ✅ Implemented |
| STF-CHAL-007 | Cancel Booking | Action | ✅ Implemented |
| STF-CHAL-008 | Booking Timeline View | Display | ✅ Implemented |
| STF-CHAL-009 | Guest Details Panel | Detail View | ✅ Implemented |
| STF-CHAL-010 | Contact Guest | Communication | ✅ Implemented |
| STF-CHAL-011 | Report Maintenance | Action | ✅ Implemented |
| STF-CHAL-012 | Walk-in Booking Creation | Create | ✅ Implemented |
| STF-CHAL-013 | Special Notes | Data Entry | ✅ Implemented |
| STF-CHAL-014 | Generate Report | Export | ✅ Implemented |
| STF-CHAL-015 | Housekeeping Status Display | Display | ✅ Implemented |
| STF-CHAL-016 | Booking Status Filters | Filter | ✅ Implemented |
| STF-CHAL-017 | Real-time Booking Updates | WebSocket | ✅ Implemented |

---

## Daily Workflow

### Opening Shift

1. **Log in** at `/staff/login` with your staff credentials.
2. Navigate to **Chalets** from the sidebar or go directly to `/staff/chalets`.
3. Review the **Dashboard Stats** at the top of the page:
   - **Check-ins Today**: Number of guests expected to arrive.
   - **Check-outs Today**: Number of guests expected to depart.
   - **Occupied**: Current number of occupied chalets out of total available.
4. Switch the booking list to **Today** view to see only today's arrivals and departures.
5. Cross-reference the check-in list with housekeeping status—ensure all arriving chalets show a green "Clean" badge.
6. Verify any **special notes** on today's bookings (VIP guests, accessibility needs, early check-in requests).

### During Shift

1. **Process arrivals**: When a guest arrives, find their booking via search or the Today list, open the guest details panel, verify ID, and click **Check In**.
2. **Handle walk-ins**: If a guest arrives without a reservation, use Walk-in Booking Creation to allocate an available chalet.
3. **Process departures**: When a guest is leaving, open their booking, verify the chalet condition, and click **Check Out**. This automatically triggers a housekeeping request.
4. **Manage booking changes**: Confirm pending bookings, cancel no-shows, and update special notes as needed.
5. **Report issues**: If a guest reports a maintenance problem (broken AC, plumbing, etc.), use the Report Maintenance feature to log it directly from the booking.
6. **Communicate with guests**: Use the Contact Guest feature to send messages about check-in readiness, amenity information, or schedule changes.
7. **Monitor real-time updates**: Watch for WebSocket-driven updates—new online bookings, cancellations, or housekeeping status changes appear automatically.

### Closing Shift

1. Switch to **Today** view and verify all expected check-ins have arrived. Flag no-shows for the manager.
2. Confirm all departures have been processed and housekeeping has been notified.
3. Add any handover notes to relevant bookings using the Special Notes feature.
4. Generate the daily report via **Generate Report** for the shift manager.
5. Log out from the staff menu.

---

## Feature Details

### STF-CHAL-001: Dashboard Stats

**Steps to use:**
1. Navigate to `/staff/chalets`. The dashboard loads with three stat cards at the top.
2. **Check-ins Today** — Shows count of bookings with today's arrival date that haven't been checked in yet. Click the card to filter the list to pending check-ins.
3. **Check-outs Today** — Shows count of bookings with today's departure date that are still checked in. Click to filter to pending check-outs.
4. **Occupied** — Shows current occupancy as a fraction (e.g., "24/30") and a percentage. Color-coded: green (<70%), yellow (70-90%), red (>90%).
5. Stats refresh automatically via the API (`GET /chalets/staff/bookings`) and WebSocket updates.

### STF-CHAL-002: Search Bookings

**Steps to use:**
1. Locate the search bar at the top of the booking list.
2. Type any of the following to search: guest name, booking reference number, chalet number, email address, or phone number.
3. Results filter in real-time as you type (minimum 2 characters).
4. Search works across both "Today" and "All" views, respecting the current toggle setting.
5. Clear the search field to return to the full list.

### STF-CHAL-003: Filter Bookings (Today/All Toggle)

**Steps to use:**
1. Above the booking list, locate the **Today / All** toggle buttons.
2. **Today** (default): Shows only bookings with check-in or check-out dates matching today.
3. **All**: Shows all bookings regardless of date, sorted by check-in date descending.
4. The toggle state persists during your session but resets to "Today" on page reload.
5. Additional status filters (Confirmed, Checked-in, Checked-out, Cancelled) can be combined with the Today/All toggle.

### STF-CHAL-004: Check-in Guest

**Steps to use:**
1. Find the booking in the list (search or filter to "Today").
2. Click the booking row to expand the guest details panel.
3. Verify guest identity against booking information (name, ID document).
4. Confirm the chalet's housekeeping status shows **Clean** (green badge).
5. Click the **Check In** button. A confirmation dialog appears: "Check in [Guest Name] to Chalet [Number]?"
6. Click **Confirm**. The system sends `PATCH /chalets/staff/bookings/:id` with status "checked-in".
7. The booking card updates to show "Checked In" with the timestamp.
8. The dashboard stat for "Check-ins Today" decrements by one.

### STF-CHAL-005: Check-out Guest

**Steps to use:**
1. Find the guest's booking (search by name or filter to checked-in bookings).
2. Click to open the guest details panel.
3. Review any outstanding charges or notes.
4. Click the **Check Out** button. Confirmation dialog: "Check out [Guest Name] from Chalet [Number]?"
5. Click **Confirm**. The system sends the appropriate PATCH request.
6. The booking status updates to "Checked Out" and the housekeeping status for that chalet changes to "Needs Cleaning" automatically.
7. The occupancy count in the dashboard decreases.

### STF-CHAL-006: Confirm Booking

**Steps to use:**
1. Locate bookings with status **Pending** (shown with an orange badge).
2. Open the booking details panel by clicking the row.
3. Review the booking details: dates, chalet type, guest count, payment status.
4. Click **Confirm Booking**. The status changes to **Confirmed** (green badge).
5. An automated confirmation notification is sent to the guest (if notifications are enabled).

### STF-CHAL-007: Cancel Booking

**Steps to use:**
1. Open the booking you need to cancel.
2. Click the **Cancel Booking** button (red text).
3. A dialog appears requiring a **cancellation reason** (dropdown: Guest Request, No-Show, Payment Issue, Maintenance, Other).
4. Optionally add a free-text note.
5. Click **Confirm Cancellation**. The booking status changes to **Cancelled** (red badge).
6. The chalet becomes available for rebooking immediately.
7. Cancellations may require manager approval depending on the booking value—if so, the status changes to "Cancellation Pending" and appears in the manager's approval queue.

### STF-CHAL-008: Booking Timeline View

**Steps to use:**
1. Click the **Timeline** tab above the booking list (next to the List tab).
2. The timeline displays chalet allocations as horizontal bars across a date axis.
3. Each bar is color-coded by status: blue (confirmed), green (checked-in), gray (checked-out), red (cancelled).
4. Hover over a bar to see a tooltip with guest name, dates, and status.
5. Click a bar to open the full booking details panel.
6. Use the date navigation arrows to scroll forward/backward by week.
7. This view is useful for spotting gaps in occupancy and identifying double-booking conflicts.

### STF-CHAL-009: Guest Details Panel

**Steps to use:**
1. Click any booking row in the list to open the guest details panel (slides in from the right).
2. The panel displays: guest name, contact details (email, phone), booking reference, chalet number, check-in/check-out dates, number of guests, payment status, special notes, and booking history.
3. From this panel you can: Check In, Check Out, Contact Guest, Report Maintenance, add Special Notes.
4. Click **Close** or press `Esc` to dismiss the panel.

### STF-CHAL-010: Contact Guest

**Steps to use:**
1. Open the guest details panel for the relevant booking.
2. Click **Contact Guest**. A communication dialog opens.
3. Choose the communication method: **Email** or **SMS** (if phone number is on file).
4. Select a template (e.g., "Check-in Ready," "Amenity Info," "Schedule Change") or write a custom message.
5. Preview the message, then click **Send**.
6. The message is logged in the booking's activity history for audit purposes.

### STF-CHAL-011: Report Maintenance

**Steps to use:**
1. Open the guest details panel for the booking associated with the chalet.
2. Click **Report Maintenance**.
3. Fill in the maintenance form:
   - **Category** (dropdown): Plumbing, Electrical, HVAC, Furniture, Cleaning, Other.
   - **Priority**: Low, Medium, High, Urgent.
   - **Description**: Free-text field describing the issue.
   - **Photo upload** (optional): Attach an image of the problem.
4. Click **Submit**. The maintenance request is created and routed to the maintenance team.
5. The chalet's status shows a maintenance indicator (wrench icon) until resolved.
6. High/Urgent priority requests also trigger a notification to the shift manager.

### STF-CHAL-012: Walk-in Booking Creation

**Steps to use:**
1. Click the **+ Walk-in** button at the top of the booking list.
2. A booking creation form opens. Fill in:
   - **Guest name**, **email**, **phone** (minimum: name required).
   - **Chalet type** preference (dropdown showing available types).
   - **Check-in date** (defaults to today) and **Check-out date**.
   - **Number of guests**.
   - **Payment method**: Cash, Card, or Invoice.
3. The system shows available chalets matching the criteria. Select one.
4. Click **Create Booking**. The booking is created with status "Checked In" (since the guest is physically present).
5. The new booking appears in the list and dashboard stats update accordingly.

### STF-CHAL-013: Special Notes

**Steps to use:**
1. Open the guest details panel for any booking.
2. Scroll to the **Notes** section.
3. Click **Add Note**. Enter the note text (e.g., "Guest requested extra towels," "VIP—resort owner's friend," "Late check-out approved until 2 PM").
4. Click **Save**. The note is timestamped with your staff name.
5. Notes are visible to all staff viewing this booking and persist across shifts.
6. Existing notes can be viewed but not edited or deleted by staff (manager permission required for deletion).

### STF-CHAL-014: Generate Report

**Steps to use:**
1. Click the **Generate Report** button in the toolbar above the booking list.
2. Select the report type:
   - **Daily Summary**: Today's check-ins, check-outs, occupancy, revenue.
   - **Occupancy Report**: Occupancy rates over a selected date range.
   - **Booking Report**: All bookings with details for a date range.
3. Choose the date range (for non-daily reports).
4. Click **Generate**. The report renders on-screen.
5. Click **Download PDF** or **Export CSV** to save the report locally.

### STF-CHAL-015: Housekeeping Status Display

**Steps to use:**
1. Each chalet in the booking list displays a housekeeping badge:
   - 🟢 **Clean**: Ready for guest.
   - 🟡 **In Progress**: Housekeeping is currently cleaning.
   - 🔴 **Needs Cleaning**: Guest has checked out, housekeeping not started.
   - 🔧 **Maintenance**: Active maintenance request.
2. The status updates in real-time via WebSocket when housekeeping staff update their progress.
3. Do not check in a guest to a chalet that doesn't show 🟢 Clean status.
4. If a chalet has been "In Progress" for an unusually long time, contact the housekeeping supervisor.

### STF-CHAL-016 & STF-CHAL-017: Status Filters & Real-time Updates

**Status Filters:** Use the filter chips (Confirmed, Checked-in, Checked-out, Cancelled) below the search bar to narrow the booking list. Multiple filters can be active simultaneously.

**Real-time Updates:** All booking changes (new bookings, status changes, cancellations) from other staff or online guests are pushed via WebSocket and reflected on the board instantly without page refresh. A subtle animation highlights updated bookings.

---

## Real-time Updates (WebSocket)

| Event | Trigger | Effect on Board |
|---|---|---|
| `booking:new` | Online reservation made | New booking appears in list |
| `booking:status_changed` | Check-in/check-out/confirmation by another staff | Booking status badge updates |
| `booking:cancelled` | Guest cancels online | Booking shows cancelled status |
| `housekeeping:status_changed` | Housekeeping updates chalet status | Housekeeping badge updates on affected chalet |
| `maintenance:created` | Maintenance request logged | Maintenance icon appears on chalet |
| `maintenance:resolved` | Maintenance completed | Maintenance icon removed, housekeeping status may update |

---

## Escalation Points

| Situation | Action | Escalate To |
|---|---|---|
| Guest disputes booking details | Verify in system, check payment records | Front Desk Manager |
| Chalet not clean at check-in time | Contact housekeeping; offer alternative chalet | Housekeeping Supervisor + Manager |
| Guest requests early check-in (before 2 PM) | Check availability and chalet readiness | Shift Manager for approval |
| Guest requests late check-out | Check next booking for that chalet | Shift Manager for approval |
| Payment issue at check-in | Verify payment status in booking details | Finance / Front Desk Manager |
| Maintenance emergency (flooding, power out) | Report as Urgent; relocate guest if needed | Maintenance Lead + Duty Manager |
| Guest wants to cancel but is within penalty period | Explain policy; do not cancel without approval | Manager (cancellation approval queue) |
| Overbooking situation | Check all available chalets across types | Duty Manager |

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Dashboard stats show 0 for everything | API call failed or no bookings for today | Refresh page; check network; verify bookings exist in "All" view |
| Check-in button is grayed out | Booking is not in "Confirmed" status | Confirm the booking first, then check in |
| Cannot find a booking | Search term too specific or booking under different name | Try searching by booking reference, email, or chalet number |
| Housekeeping status not updating | WebSocket disconnection | Refresh the page; check the connection indicator |
| Walk-in form shows no available chalets | All chalets occupied or blocked for maintenance | Check the timeline view for upcoming checkouts; escalate to manager |
| Report fails to generate | Date range too large or server timeout | Try a smaller date range; wait and retry |
| Guest details panel won't open | JavaScript error or slow connection | Clear browser cache; refresh page |

---

## Related Modules

- [Bookings & Navigation](bookings-management.md) — General booking management and staff dashboard
- [Pool Management](pool-management.md) — Guest amenity that may be bundled with chalet bookings
- [Manager: Approvals & Oversight](../manager/approvals-oversight.md) — Cancellation approvals, maintenance approvals

---

## Feature Coverage Summary

| Category | Count | Percentage |
|---|---|---|
| Implemented | 17 | 100% |
| Partially Implemented | 0 | 0% |
| Not Implemented | 0 | 0% |
| **Total** | **17** | **100%** |
