# V2 Resort - New Features User Manual

This manual covers the newly added features and explains how they work for **Customers**, **Staff**, and **Administrators**.

---

## Table of Contents

1. [Self-Service Kiosk System](#1-self-service-kiosk-system)
2. [Table Reservations](#2-table-reservations)
3. [Restaurant Waitlist](#3-restaurant-waitlist)
4. [Channel Manager (OTA Integration)](#4-channel-manager-ota-integration)
5. [Multi-Property Management](#5-multi-property-management)
6. [Tax Configuration](#6-tax-configuration)

---

## 1. Self-Service Kiosk System

### Overview
The Kiosk System allows guests to check in/out, make purchases, and access resort services through self-service touchscreen terminals placed around the property.

### For Customers (Guest-Facing Kiosk)

**URL:** `/kiosk`

**What You Can Do:**
- **Check-In:** Scan your booking QR code or enter your confirmation number to check into your chalet/room
- **Check-Out:** Complete your checkout process, review charges, and settle your bill
- **Browse Services:** View available resort services, pool sessions, restaurant menus
- **Make Purchases:** Buy pool tickets, gift cards, or book spa services
- **View Account:** Check your current stay details and charges

**How to Use:**
1. Approach any kiosk terminal in the lobby or common areas
2. The welcome screen displays available actions
3. For check-in: Tap "Check In" → Enter confirmation number or scan QR → Verify your identity → Receive your room key/access code
4. For purchases: Browse → Select items → Pay via card terminal → Receive confirmation

**Demo Mode:** When not in use, the kiosk displays promotional content and a welcome message.

---

### For Administrators (Kiosk Management)

**URL:** `/admin/kiosk`

**What You Can Do:**
- **View All Kiosks:** See all kiosk devices registered to your property
- **Monitor Status:** Real-time status of each kiosk (online/offline/maintenance)
- **Configure Kiosks:** Set up what services each kiosk can offer
- **Register New Kiosks:** Add new kiosk devices to the system
- **Troubleshoot:** View error logs and restart kiosks remotely

**Dashboard Features:**

| Column | Description |
|--------|-------------|
| Device Name | Friendly name (e.g., "Lobby Kiosk 1") |
| Location | Physical location in the property |
| Status | Online (green), Offline (red), Maintenance (yellow) |
| Last Seen | When the kiosk last communicated with the server |
| Actions | Edit, Restart, View Logs, Delete |

**Adding a New Kiosk:**
1. Click "Add Device" button
2. Enter device name and select location
3. Choose enabled features (check-in, payments, etc.)
4. Save → System generates a unique device token
5. Enter the token on the kiosk device to pair it

**Kiosk Configuration Options:**
- Enable/disable check-in functionality
- Enable/disable payment processing
- Set idle timeout duration
- Configure screensaver content
- Set operating hours

---

## 2. Table Reservations

### Overview
The reservation system allows guests to book tables at the resort restaurant in advance, and staff to manage seating arrangements.

### For Customers (Make a Reservation)

**URL:** `/restaurant/reserve`

**Booking Steps:**

1. **Select Date & Party Size**
   - Choose your preferred date from the calendar
   - Select number of guests (1-12+)
   - System shows available time slots

2. **Choose Time Slot**
   - Available slots shown in green
   - Unavailable slots shown in gray
   - Peak times may have limited availability

3. **Enter Your Details**
   - Name (required)
   - Email (required) - confirmation sent here
   - Phone (required) - for day-of contact
   - Special requests (optional) - allergies, celebrations, seating preferences

4. **Confirm Booking**
   - Review your reservation details
   - Click "Confirm Reservation"
   - Receive confirmation number and email

**Reservation Policies:**
- Reservations can be made up to 30 days in advance
- Cancel at least 24 hours before to avoid fees
- Tables held for 15 minutes past reservation time
- For parties over 8, call the restaurant directly

---

### For Staff/Administrators (Manage Reservations)

**URL:** `/admin/restaurant/reservations`

**Dashboard Overview:**
The admin view shows today's reservations by default with options to view other dates.

**Reservation List Columns:**

| Column | Description |
|--------|-------------|
| Time | Reservation time |
| Guest | Guest name and party size |
| Table | Assigned table (if any) |
| Status | Confirmed, Seated, Completed, No-Show, Cancelled |
| Contact | Phone number for quick contact |
| Actions | Seat, Edit, Cancel, Mark No-Show |

**Managing Reservations:**

**To Seat a Party:**
1. Find the reservation in the list
2. Click "Assign Table" 
3. Select an available table from the floor plan
4. Click "Seat" - status changes to "Seated"

**Reservation Statuses:**
- **Confirmed** - Booking is confirmed, guest not yet arrived
- **Seated** - Guest has arrived and is seated
- **Completed** - Guest has finished and table cleared
- **No-Show** - Guest didn't arrive within grace period
- **Cancelled** - Reservation was cancelled

**Floor Plan View:**
- Visual representation of table layout
- Color-coded by status:
  - Green = Available
  - Blue = Reserved (upcoming)
  - Orange = Occupied
  - Gray = Out of service
- Click any table to see its reservations or quick-seat a walk-in

**Creating Walk-In Reservation:**
1. Click "Add Reservation" 
2. Mark as "Walk-in" (skips confirmation email)
3. Assign table immediately if available

---

## 3. Restaurant Waitlist

### Overview
When tables aren't available, customers can join a waitlist and receive notifications when their table is ready.

### For Customers (Join the Waitlist)

**URL:** `/restaurant/waitlist`

**How to Join:**

1. **Enter Your Information**
   - Your name
   - Party size
   - Phone number (for SMS notification)
   - Optional notes (high chair needed, etc.)

2. **Submit & Wait**
   - You'll see your position in the queue
   - Estimated wait time displayed
   - You can leave the area - we'll text you!

3. **When Called**
   - Receive SMS: "Your table is ready! Please return within 5 minutes"
   - Return to host stand
   - If you don't return in 10 minutes, you may lose your spot

**Waitlist Display:**
- Shows your position: "You are #3 in line"
- Estimated wait: "Approximately 15-20 minutes"
- Option to remove yourself from waitlist

---

### For Staff (Manage Waitlist)

**URL:** `/admin/restaurant/waitlist`

**Waitlist Queue View:**

| Column | Description |
|--------|-------------|
| Position | Queue position (#1, #2, etc.) |
| Name | Customer name |
| Party | Number of guests |
| Wait Time | How long they've been waiting |
| Phone | Contact number |
| Notes | Special requests |
| Actions | Seat, Notify, Remove |

**Managing the Queue:**

**To Notify a Customer:**
1. When a table becomes available, click "Notify" 
2. System sends SMS to customer
3. Status changes to "Notified"
4. Timer starts for their return window

**To Seat a Customer:**
1. When customer arrives after notification
2. Click "Seat" 
3. Assign their table
4. They're removed from waitlist

**To Remove from Waitlist:**
1. If customer leaves or no-shows after notification
2. Click "Remove"
3. Select reason (left, no response, seated elsewhere)

**Waitlist Settings:**
- Set notification message template
- Configure return window (default: 10 minutes)
- Set maximum waitlist size
- Enable/disable SMS notifications

---

## 4. Channel Manager (OTA Integration)

### Overview
The Channel Manager connects your property to Online Travel Agencies (OTAs) like Booking.com, Expedia, and Airbnb. It synchronizes availability, rates, and reservations across all platforms.

### For Administrators Only

**URL:** `/admin/channels`

**This feature is admin-only** - customers and regular staff cannot access it.

**Dashboard Overview:**

**Connected Channels Section:**
Shows all your connected OTA platforms with:
- Channel name and logo
- Connection status (Active, Syncing, Error)
- Last sync time
- Room nights booked this month
- Revenue this month

**Available Actions:**

| Action | Description |
|--------|-------------|
| Sync Now | Force immediate synchronization |
| Edit | Modify channel settings |
| View Logs | See sync history and errors |
| Disconnect | Remove channel connection |

**Connecting a New Channel:**

1. Click "Connect Channel"
2. Select the OTA from the list
3. Enter your credentials for that OTA:
   - Property ID
   - API Key / Secret
   - Username (if required)
4. Test Connection
5. If successful, configure sync settings:
   - What room types to sync
   - Rate plans to share
   - Minimum stay requirements
6. Activate the channel

**Sync Settings:**
- **Auto-sync frequency:** How often to push updates (every 15 min, hourly, etc.)
- **Inventory buffer:** Hold back X rooms from OTAs (for direct bookings)
- **Rate adjustments:** Add/subtract percentage from base rates per channel
- **Booking notifications:** Get alerted when OTA bookings come in

**Sync Logs:**
View history of all synchronizations:
- Timestamp
- Direction (Push to OTA / Pull from OTA)
- Items synced (rates, availability, bookings)
- Status (Success, Partial, Failed)
- Error details (if any)

**Troubleshooting Common Issues:**

| Problem | Solution |
|---------|----------|
| "Connection Failed" | Check API credentials are correct |
| "Rate Mismatch" | Verify rate plans are properly mapped |
| "Availability Conflict" | Check for overbookings, adjust buffer |
| "Sync Timeout" | Try manual sync, check OTA status |

---

## 5. Multi-Property Management

### Overview
For resort chains or properties with multiple locations, the Multi-Property system allows administrators to manage all properties from a single dashboard.

### For Administrators Only

**URL:** `/admin/properties`

**This feature is admin-only** - requires super_admin or property_admin role.

**Property List View:**

| Column | Description |
|--------|-------------|
| Property Name | Name of the property |
| Location | City/Region |
| Status | Active, Inactive, Maintenance |
| Units | Number of rooms/chalets |
| Occupancy | Current occupancy percentage |
| Revenue | This month's revenue |

**Switching Properties:**
1. Click on any property row
2. Or use the property switcher dropdown (top navigation)
3. All data in the admin panel updates to show that property's information

**Property Settings:**
Each property can have its own:
- Branding (logo, colors)
- Contact information
- Operating hours
- Tax rates
- Payment methods
- Staff assignments

**Adding a New Property:**
1. Click "Add Property"
2. Enter property details:
   - Name
   - Address
   - Contact info
   - Timezone
3. Configure initial settings
4. Assign property administrators
5. Set up units/rooms
6. Activate property

**Cross-Property Features:**
- **Consolidated Reports:** View revenue across all properties
- **Staff Sharing:** Assign staff to multiple properties
- **Rate Parity:** Ensure consistent pricing across properties
- **Centralized Inventory:** Manage supplies across locations

**Property Hierarchy:**
```
Organization (Your Company)
├── Property 1 (Main Resort)
│   ├── Units/Chalets
│   ├── Restaurant
│   └── Pool
├── Property 2 (Beach Location)
│   ├── Units/Chalets
│   └── Restaurant
└── Property 3 (Mountain Lodge)
    └── Units/Chalets
```

---

## 6. Tax Configuration

### Overview
The Tax Configuration system allows administrators to set up and manage tax rates for different product categories and jurisdictions.

### For Administrators Only

**URL:** `/admin/settings/tax`

**This feature is admin-only** - requires super_admin role.

**Global Tax Settings:**

| Setting | Description |
|---------|-------------|
| Default Tax Rate | Applied when no specific rate is set (e.g., 10%) |
| Tax Included in Prices | Whether displayed prices include tax |
| Tax Name | What to call it on receipts (VAT, Sales Tax, GST) |

**Tax Categories:**
Set different rates for different product types:

| Category | Example Rate | Applies To |
|----------|--------------|------------|
| Accommodation | 10% | Chalet bookings, room rentals |
| Food & Beverage | 8% | Restaurant, snack bar |
| Services | 12% | Spa, activities |
| Retail | 10% | Gift shop items |
| Pool/Facilities | 5% | Pool tickets, facility access |

**Setting Up Tax Categories:**

1. Click "Add Category"
2. Enter:
   - Category name
   - Tax rate (percentage)
   - Description
3. Assign which product types use this category
4. Save

**Tax Calculation Example:**
```
Pool Ticket: $25.00
Tax Category: Pool/Facilities (5%)
Tax Amount: $1.25
Total: $26.25

-- OR if "Tax Included" is enabled --

Pool Ticket: $25.00 (tax included)
Pre-tax Amount: $23.81
Tax (5%): $1.19
Total: $25.00
```

**Receipts & Invoices:**
Tax configuration affects how taxes appear on:
- Customer receipts
- Daily reports
- Monthly tax filings
- Invoice exports

**Multi-Jurisdiction Support:**
If your properties span different tax jurisdictions:
1. Enable "Multi-jurisdiction mode"
2. Set up tax rules per location
3. System automatically applies correct rate based on property

---

## Quick Reference: Feature Access by Role

| Feature | Customer | Staff | Admin | Super Admin |
|---------|----------|-------|-------|-------------|
| Kiosk (use) | ✅ | ✅ | ✅ | ✅ |
| Kiosk (manage) | ❌ | ❌ | ✅ | ✅ |
| Make Reservation | ✅ | ✅ | ✅ | ✅ |
| Manage Reservations | ❌ | ✅ | ✅ | ✅ |
| Join Waitlist | ✅ | ✅ | ✅ | ✅ |
| Manage Waitlist | ❌ | ✅ | ✅ | ✅ |
| Channel Manager | ❌ | ❌ | ✅ | ✅ |
| Multi-Property | ❌ | ❌ | ⚠️ Limited | ✅ |
| Tax Configuration | ❌ | ❌ | ❌ | ✅ |

---

## URL Reference

### Customer-Facing Pages
| Page | URL |
|------|-----|
| Self-Service Kiosk | `/kiosk` |
| Make Reservation | `/restaurant/reserve` |
| Join Waitlist | `/restaurant/waitlist` |

### Admin Pages
| Page | URL |
|------|-----|
| Kiosk Management | `/admin/kiosk` |
| Reservation Management | `/admin/restaurant/reservations` |
| Waitlist Management | `/admin/restaurant/waitlist` |
| Channel Manager | `/admin/channels` |
| Property Management | `/admin/properties` |
| Tax Settings | `/admin/settings/tax` |

---

## Technical Notes

### API Endpoints

All API calls use the base URL: `http://localhost:3005/api/v1/`

| Feature | Endpoint | Methods |
|---------|----------|---------|
| Kiosk Devices | `/kiosk/devices` | GET, POST |
| Tables | `/restaurant/tables` | GET, POST, PATCH |
| Reservations | `/restaurant/reservations` | GET, POST, PATCH |
| Waitlist | `/restaurant/waitlist` | GET, POST, PATCH |
| Channels | `/channels` | GET, POST, PATCH, DELETE |
| Properties | `/multi-property/properties` | GET, POST, PATCH |
| Tax Settings | `/settings/tax` | GET, PUT |

### Authentication
- Customer pages: No authentication required
- Staff pages: Requires `staff` role or higher
- Admin pages: Requires `admin` or `super_admin` role
- Tax/Multi-property: Requires `super_admin` role

---

*Last Updated: February 2, 2026*
