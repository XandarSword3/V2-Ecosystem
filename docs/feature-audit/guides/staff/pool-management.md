# Staff Guide: Pool Management

**Module:** STF-POOL | **Features:** 15 | **Last Updated:** 2026-02-08

---

## Overview

The Pool Management module equips pool-area staff with tools to monitor capacity, validate guest tickets (via QR scan or manual entry), track active swimming sessions, and handle walk-in ticket sales. The dashboard provides real-time visibility into active sessions, tickets sold, and capacity utilization. Staff can check visitors in and out, close the pool in emergencies, and review revenue and ticket-type breakdowns throughout the day.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Login URL** | `http://localhost:3000/staff/login` |
| **Credentials** | `staff@v2resort.com` / `staff123` |
| **Browser** | Chrome, Firefox, or Edge (latest) |
| **Hardware** | Tablet or desktop at pool entrance; QR scanner (USB or camera-based) |
| **Network** | Stable WiFi required at pool area for real-time capacity tracking |

---

## Features Covered

| ID | Feature Name | Type | Status |
|---|---|---|---|
| STF-POOL-001 | Dashboard (Active Sessions, Tickets Sold, Capacity) | Dashboard | ✅ Implemented |
| STF-POOL-002 | QR Ticket Scanning | Validation | ✅ Implemented |
| STF-POOL-003 | Manual Ticket Validation | Validation | ✅ Implemented |
| STF-POOL-004 | Active Visitors List | Display | ✅ Implemented |
| STF-POOL-005 | Check-out Visitor | Action | ✅ Implemented |
| STF-POOL-006 | Today's Sessions History | Display | ✅ Implemented |
| STF-POOL-007 | Walk-in Ticket Creation | Create | ✅ Implemented |
| STF-POOL-008 | Capacity Monitoring | Display | ✅ Implemented |
| STF-POOL-009 | Capacity Alerts | Notification | ✅ Implemented |
| STF-POOL-010 | Update Session Capacity | Action | ✅ Implemented |
| STF-POOL-011 | Revenue Stats | Analytics | ✅ Implemented |
| STF-POOL-012 | Ticket Type Breakdown | Analytics | ✅ Implemented |
| STF-POOL-013 | Emergency Pool Closure | Action | ✅ Implemented |
| STF-POOL-014 | Session Timer Display | Display | ✅ Implemented |
| STF-POOL-015 | Real-time Capacity Updates | WebSocket | ✅ Implemented |

---

## Daily Workflow

### Opening Shift

1. **Log in** at `/staff/login` with your staff credentials.
2. Navigate to **Pool** from the sidebar or go directly to `/staff/pool`.
3. Review the **Dashboard** stats: Active Sessions should be 0, Tickets Sold should be 0, Capacity should show full availability.
4. Verify the **QR scanner** is connected and functional—test by scanning a sample code.
5. Check the pool's maximum capacity setting. If an event or maintenance has reduced capacity, use **Update Session Capacity** to adjust the limit.
6. Confirm the WebSocket connection indicator shows green (real-time updates active).
7. Ensure the pool area is safe and ready before admitting guests.

### During Shift

1. **Admit guests with pre-purchased tickets**: When a guest presents a ticket (digital or printed), use QR Ticket Scanning to validate it. The scanner reads the QR code and the system confirms validity via `POST /pool/staff/validate`.
2. **Handle tickets without QR codes**: Use Manual Ticket Validation—enter the ticket reference number and click Validate.
3. **Sell walk-in tickets**: For guests without tickets, use Walk-in Ticket Creation. Select ticket type, collect payment, and the system generates a session entry.
4. **Monitor capacity**: Watch the capacity gauge on the dashboard. When capacity reaches 80%, a yellow warning appears. At 95%, a red alert triggers.
5. **Track active visitors**: The Active Visitors List shows everyone currently in the pool area with their entry time and session duration.
6. **Check out departing visitors**: When a guest leaves, find them in the Active Visitors List and click **Check Out** to end their session and free up capacity.
7. **Handle emergencies**: If a safety incident occurs, use **Emergency Pool Closure** to immediately close the pool and notify all relevant parties.

### Closing Shift

1. Ensure all visitors have been checked out—the Active Visitors List should be empty.
2. Review the day's revenue stats and ticket type breakdown in the analytics section.
3. Check Today's Sessions to verify all sessions are closed (no "active" sessions remaining).
4. Note any incidents or anomalies in the shift log.
5. Log out from the staff menu.

---

## Feature Details

### STF-POOL-001: Dashboard

**Steps to use:**
1. Navigate to `/staff/pool`. The dashboard loads automatically via `GET /pool/staff/sessions`.
2. Three stat cards display at the top:
   - **Active Sessions**: Number of guests currently in the pool area.
   - **Tickets Sold**: Total tickets sold/validated today.
   - **Capacity**: Current occupancy vs. maximum (e.g., "18 / 50") with a progress bar.
3. Stats update in real-time via WebSocket. Manual refresh is available via the reload icon.

### STF-POOL-002: QR Ticket Scanning

**Steps to use:**
1. Click the **Scan Ticket** button on the dashboard, or the QR icon in the toolbar.
2. The camera viewfinder activates (or use the connected USB scanner).
3. Point the scanner at the guest's QR code (on their phone screen or printed ticket).
4. The system sends the scanned code to `POST /pool/staff/validate`.
5. **Valid ticket**: A green confirmation appears with ticket details (guest name, ticket type, session duration). The guest is automatically added to Active Visitors.
6. **Invalid ticket**: A red error appears with the reason (expired, already used, invalid code). Do not admit the guest—direct them to reception.
7. **Already scanned**: If the ticket was already used today, a warning appears. Verify with the guest.

### STF-POOL-003: Manual Ticket Validation

**Steps to use:**
1. Click **Manual Entry** next to the Scan Ticket button.
2. Enter the ticket reference number (printed on the ticket, e.g., "POOL-2026-00142").
3. Click **Validate**. The system checks the ticket via `POST /pool/staff/validate` with the reference.
4. Same success/failure responses as QR scanning.
5. Use this when QR codes are damaged, unreadable, or the scanner malfunctions.

### STF-POOL-004: Active Visitors List

**Steps to use:**
1. Below the dashboard stats, the **Active Visitors** table displays all guests currently in the pool area.
2. Columns: Guest Name, Ticket Type, Entry Time, Duration (live counter), Actions.
3. The list updates in real-time as guests are admitted or checked out.
4. Click a visitor row to see their full ticket details.
5. Use the search bar above the list to find a specific guest by name or ticket reference.

### STF-POOL-005: Check-out Visitor

**Steps to use:**
1. Find the visitor in the Active Visitors List.
2. Click the **Check Out** button in the Actions column for that visitor.
3. A confirmation dialog appears: "Check out [Guest Name]? Session duration: [X hours Y minutes]."
4. Click **Confirm**. The visitor is removed from the active list, capacity is freed, and the session is logged in Today's Sessions.
5. If a visitor leaves without checking out, you can still check them out later—find them in the active list and process normally.

### STF-POOL-006: Today's Sessions History

**Steps to use:**
1. Click the **Sessions** tab below the Active Visitors section.
2. A table shows all sessions from today, both active and completed.
3. Columns: Guest Name, Ticket Type, Entry Time, Exit Time (or "Active"), Duration, Status.
4. Completed sessions show the full duration. Active sessions show a running timer.
5. Use this to verify daily activity and cross-reference with ticket sales.

### STF-POOL-007: Walk-in Ticket Creation

**Steps to use:**
1. Click the **+ Walk-in** button on the dashboard.
2. A form opens with fields:
   - **Guest Name** (required).
   - **Ticket Type** (dropdown): Adult, Child, Family, VIP, Resort Guest.
   - **Payment Method**: Cash, Card, Room Charge.
   - **Quantity** (default: 1).
3. The price auto-calculates based on ticket type and quantity.
4. Click **Create Ticket**. The guest is added to the Active Visitors List immediately.
5. A receipt can be printed if the guest requests one.

### STF-POOL-008 & STF-POOL-009: Capacity Monitoring & Alerts

**Steps to use:**
1. The capacity gauge is displayed prominently on the dashboard as both a number (e.g., "34/50") and a visual progress bar.
2. **Color coding**:
   - 🟢 Green (0-79%): Normal capacity.
   - 🟡 Yellow (80-94%): Approaching capacity—consider slowing admissions.
   - 🔴 Red (95-100%): Near or at capacity—stop admitting guests until others leave.
3. When capacity hits 80%, an **alert banner** appears at the top of the screen: "Pool approaching capacity. Currently at [X]%."
4. At 100%, the Scan and Walk-in buttons become disabled (grayed out) with a message: "Pool at maximum capacity. Please wait for check-outs."
5. Alerts dismiss automatically when capacity drops below the threshold.

### STF-POOL-010: Update Session Capacity

**Steps to use:**
1. Click the **Settings** gear icon next to the capacity display.
2. Enter the new **maximum capacity** value.
3. Select the reason: Maintenance, Event, Weather, Safety, Other.
4. Add an optional note (e.g., "Slide section closed for repair—reduced to 35").
5. Click **Update**. The capacity gauge recalculates immediately.
6. Changes are logged in the audit trail and visible to managers.
7. Only reduce capacity when there is a legitimate operational reason.

### STF-POOL-011 & STF-POOL-012: Revenue Stats & Ticket Type Breakdown

**Revenue Stats:**
1. Located in the analytics panel (click **Analytics** tab or scroll to the bottom of the dashboard).
2. Shows today's total revenue from pool tickets, broken down by payment method.
3. Compares with yesterday and the weekly average.

**Ticket Type Breakdown:**
1. A pie or bar chart shows the distribution of tickets sold today by type (Adult, Child, Family, VIP, Resort Guest).
2. Hover over chart segments to see exact counts and percentages.
3. This data helps predict staffing and supply needs for future shifts.

### STF-POOL-013: Emergency Pool Closure

**Steps to use:**
1. Click the **Emergency Close** button (red, located in the toolbar).
2. A confirmation dialog with a large warning icon appears: "Are you sure you want to close the pool? All active sessions will be marked as ended."
3. Select the reason: Weather Emergency, Safety Incident, Maintenance Emergency, Water Quality, Other.
4. Add a description of the situation.
5. Click **Close Pool**. The following happens immediately:
   - All active sessions are ended automatically.
   - The capacity is set to 0.
   - Scan and Walk-in buttons are disabled.
   - A red banner displays: "POOL CLOSED — [Reason]."
   - A notification is sent to the duty manager and maintenance team.
6. To **reopen**: Only a manager can reopen the pool from the admin panel, or staff can click **Reopen Pool** if they have the appropriate permission.

---

## Real-time Updates (WebSocket)

| Event | Trigger | Effect on Dashboard |
|---|---|---|
| `pool:visitor_entered` | Guest validated at another terminal | Active count increases; visitor appears in list |
| `pool:visitor_exited` | Guest checked out at another terminal | Active count decreases; visitor removed from list |
| `pool:capacity_changed` | Staff updates max capacity | Capacity gauge recalculates |
| `pool:emergency_close` | Emergency closure triggered | Red banner appears; all features disabled |
| `pool:reopened` | Manager reopens pool | Banner removed; features re-enabled |

---

## Escalation Points

| Situation | Action | Escalate To |
|---|---|---|
| Guest presents invalid/expired ticket | Politely explain; direct to reception for repurchase | Reception / Front Desk |
| Ticket scanner not working | Switch to manual validation | IT Support |
| Pool at maximum capacity with guests waiting | Do not exceed limit; inform waiting guests of estimated wait | Duty Manager |
| Safety incident in pool area | Use Emergency Pool Closure; administer first aid if trained | Duty Manager + Emergency Services |
| Guest disputes payment for walk-in ticket | Do not refund at pool; direct to reception | Front Desk Manager |
| Water quality concern | Close pool if serious; report maintenance | Maintenance Lead + Manager |
| Capacity was changed by unknown person | Check audit trail; report discrepancy | Shift Manager |
| Guest refuses to leave at closing time | Politely remind; do not force | Duty Manager / Security |

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| QR scanner not detecting codes | Camera focus issue or low light | Clean camera lens; improve lighting; try manual entry |
| "Invalid ticket" on a valid ticket | Ticket already used or expired | Check expiry date; verify ticket hasn't been scanned already today |
| Active Visitors count doesn't match actual headcount | Guests left without checking out | Manually check out departed guests; reconcile at end of shift |
| Capacity gauge stuck at old number | WebSocket disconnection | Refresh page; check network connection |
| Walk-in button disabled | Pool at capacity or emergency closure active | Wait for capacity; check for closure banner |
| Revenue doesn't match cash collected | Walk-in payments not recorded properly | Verify each walk-in ticket was created with correct payment method |
| Emergency Close didn't send notification | Network issue during closure | Manually call the duty manager; follow up with IT |

---

## Related Modules

- [Chalet Operations](chalet-operations.md) — Pool tickets may be bundled with chalet bookings
- [Snack Bar Operations](snack-bar-operations.md) — Snack bar adjacent to pool area
- [Bookings & Navigation](bookings-management.md) — Staff navigation and dashboard
- [Manager: Dashboard & Analytics](../manager/manager-dashboard.md) — Pool revenue in overall analytics

---

## Feature Coverage Summary

| Category | Count | Percentage |
|---|---|---|
| Implemented | 15 | 100% |
| Partially Implemented | 0 | 0% |
| Not Implemented | 0 | 0% |
| **Total** | **15** | **100%** |
