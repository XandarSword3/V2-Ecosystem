# V2 Resort - Staff Training Guide

## Technical Operations Training Manual

**Version:** 1.0  
**For:** Hotel Staff & System Administrators

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Accessing the Admin Dashboard](#2-accessing-the-admin-dashboard)
3. [Managing Bookings](#3-managing-bookings)
4. [Managing Food Orders](#4-managing-food-orders)
5. [Pool Management](#5-pool-management)
6. [Guest Management](#6-guest-management)
7. [Reports & Analytics](#7-reports--analytics)
8. [Troubleshooting Common Issues](#8-troubleshooting-common-issues)
9. [Security Best Practices](#9-security-best-practices)

---

## 1. System Overview

### What is V2 Resort Platform?

V2 Resort is an integrated hotel management system that handles:
- **Room Bookings** - Guests can book rooms online
- **Food Orders** - Restaurant and room service ordering
- **Pool Access** - Pool ticket booking and capacity management
- **Guest Profiles** - Unified guest information

### System Architecture (Simplified)

```
┌─────────────────┐     ┌─────────────────┐
│   Guest App     │────▶│   Admin Panel   │
│  (Web/Mobile)   │     │   (Staff Use)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   Server    │
              │   (API)     │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Database   │
              │  (Supabase) │
              └─────────────┘
```

### Access Levels

| Role | Can Access |
|------|------------|
| **Super Admin** | Everything, including system settings |
| **Admin** | Bookings, orders, guests, reports |
| **Reception** | Bookings, check-in/out, guest profiles |
| **Kitchen** | Food orders, menu management |
| **Pool Staff** | Pool tickets, capacity management |

---

## 2. Accessing the Admin Dashboard

### Login Process

1. Navigate to: `https://admin.v2resort.com` (or your specific URL)
2. Enter your email address
3. Enter your password
4. Click "Sign In"

**⚠️ Important Security Notes:**
- Never share your login credentials
- Log out when leaving your workstation
- Report suspicious login attempts immediately

### First-Time Login

1. You will receive an email with a temporary password
2. After first login, you must change your password
3. Password requirements:
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 number
   - At least 1 special character (!@#$%^&*)

### Dashboard Overview

After login, you'll see:

```
┌────────────────────────────────────────────────┐
│ V2 Resort Admin                    [User Menu] │
├───────────┬────────────────────────────────────┤
│           │                                    │
│ Dashboard │   Today's Summary                  │
│ Bookings  │   ┌─────┐ ┌─────┐ ┌─────┐        │
│ Orders    │   │ 12  │ │ 8   │ │ 45  │        │
│ Pool      │   │Check│ │Check│ │Pool │        │
│ Guests    │   │ Ins │ │Outs │ │Tick │        │
│ Menu      │   └─────┘ └─────┘ └─────┘        │
│ Reports   │                                    │
│ Settings  │   Pending Actions                  │
│           │   - 3 bookings need confirmation   │
│           │   - 5 orders in preparation        │
│           │                                    │
└───────────┴────────────────────────────────────┘
```

---

## 3. Managing Bookings

### Viewing Today's Bookings

1. Click **Bookings** in the sidebar
2. Default view shows today's check-ins and check-outs

### Creating a New Booking (Walk-in Guest)

1. Click **Bookings** → **New Booking**
2. Fill in guest details:
   - Name (required)
   - Email (required for confirmation)
   - Phone number
3. Select room type and dates
4. Choose payment method:
   - Pay now (credit card)
   - Pay at checkout
   - Pay later (generates invoice)
5. Click **Create Booking**

### Modifying a Booking

1. Find the booking (search by guest name, confirmation number)
2. Click on the booking to open details
3. Click **Edit Booking**
4. Make changes:
   - Extend/shorten stay
   - Change room
   - Add special requests
5. Click **Save Changes**
6. Guest automatically receives update email

### Cancelling a Booking

1. Open the booking
2. Click **Cancel Booking**
3. Select reason:
   - Guest requested
   - No-show
   - Other (specify)
4. Choose refund option:
   - Full refund
   - Partial refund
   - No refund (per policy)
5. Click **Confirm Cancellation**

### Check-In Process

1. Go to **Bookings** → **Today's Arrivals**
2. Find the guest's booking
3. Click **Check In**
4. Verify guest identity (ID/passport)
5. Confirm room assignment
6. Collect any remaining payment
7. Provide room key/access card
8. Click **Complete Check-In**

### Check-Out Process

1. Go to **Bookings** → **Today's Departures**
2. Find the guest
3. Click **Check Out**
4. Review charges:
   - Room charges
   - Mini-bar
   - Restaurant charges
   - Other incidentals
5. Process final payment
6. Click **Complete Check-Out**
7. Ask for feedback (optional)

---

## 4. Managing Food Orders

### Kitchen Display System

The kitchen display shows:
- New orders (highlighted)
- In-progress orders
- Completed orders (last 2 hours)

### Order Workflow

```
NEW → IN PREPARATION → READY → DELIVERED
```

### Processing Orders

1. New order appears with audio alert 🔔
2. Review order details:
   - Items ordered
   - Special instructions
   - Table/Room number
3. Click **Start Preparing**
4. Prepare the food
5. Click **Ready for Pickup/Delivery**
6. Staff delivers the order
7. Click **Delivered**

### Handling Order Issues

**Item unavailable:**
1. Click on the order
2. Click **Contact Guest**
3. Call or message the guest
4. Offer alternatives
5. Modify order if needed

**Special dietary requests:**
- Allergies are highlighted in RED
- Never ignore allergy warnings
- When in doubt, contact the guest

### Managing the Menu

#### Updating Item Availability

1. Go to **Menu** → **Items**
2. Find the item
3. Toggle **Available** switch off
4. Item immediately hidden from guest menu

#### Updating Prices

1. Go to **Menu** → **Items**
2. Click on item
3. Edit price
4. Click **Save**
5. New price applies to future orders

#### Adding New Items

1. Go to **Menu** → **Add Item**
2. Fill in:
   - Name (English + Italian)
   - Description
   - Price
   - Category
   - Photo (recommended)
   - Allergens
   - Preparation time
3. Click **Save**

---

## 5. Pool Management

### Daily Operations

1. Go to **Pool** in sidebar
2. See current status:
   - Current occupancy: X / Y capacity
   - Today's bookings
   - Available time slots

### Scanning Pool Tickets

1. Open **Pool** → **Scan Tickets**
2. Guest shows QR code
3. Scan with device camera
4. System shows:
   - Valid ✅ or Invalid ❌
   - Guest name
   - Ticket type (single/day pass)
   - Time remaining

### Managing Capacity

When pool is at capacity:
1. System automatically blocks new bookings
2. Display shows "At Capacity" to guests
3. As guests leave, capacity updates

### Weather Closures

1. Go to **Pool** → **Settings**
2. Click **Close Pool**
3. Select reason (weather, maintenance, etc.)
4. System will:
   - Block new bookings
   - Notify guests with existing bookings
   - Offer refunds/reschedules

---

## 6. Guest Management

### Finding a Guest

1. Go to **Guests**
2. Use search box:
   - Search by name
   - Search by email
   - Search by phone
   - Search by booking confirmation

### Guest Profile

Each profile shows:
- Contact information
- Booking history
- Order history
- Preferences
- Notes

### Adding Notes to Profile

1. Open guest profile
2. Scroll to **Notes**
3. Click **Add Note**
4. Enter note (e.g., "VIP guest", "Allergic to nuts")
5. Save

**Note visibility:**
- Notes are visible to all staff
- Never add inappropriate or personal comments
- Keep notes professional and useful

### Handling Guest Complaints

1. Listen to the complaint fully
2. Apologize and empathize
3. Create a note in their profile
4. Escalate to manager if needed
5. Document resolution

---

## 7. Reports & Analytics

### Daily Reports

**Occupancy Report:**
1. Go to **Reports** → **Occupancy**
2. Shows rooms occupied vs. available
3. Export to PDF or Excel

**Revenue Report:**
1. Go to **Reports** → **Revenue**
2. Shows income by category:
   - Room revenue
   - Food & beverage
   - Pool tickets
3. Filter by date range

### End-of-Day Report

1. Go to **Reports** → **End of Day**
2. Select today's date
3. View summary:
   - Check-ins completed
   - Check-outs completed
   - Total revenue
   - Outstanding payments
4. Print or email report

### Exporting Data

1. Go to any report
2. Click **Export** button
3. Choose format:
   - PDF (for printing)
   - Excel (for analysis)
   - CSV (for accounting software)

---

## 8. Troubleshooting Common Issues

### "I can't log in"

**Try these steps:**
1. Check CAPS LOCK is off
2. Clear browser cache
3. Try "Forgot Password"
4. Contact IT support

### "Guest didn't receive confirmation email"

**Check:**
1. Verify email address spelling
2. Ask guest to check spam folder
3. Resend confirmation:
   - Open booking
   - Click **Resend Confirmation**

### "Payment declined"

**Options:**
1. Try payment again
2. Try different card
3. Use cash payment option
4. Contact manager for assistance

### "System is slow"

**Try:**
1. Refresh the page (F5)
2. Clear browser cache
3. Try different browser
4. Report to IT if persistent

### "Order not appearing in kitchen"

**Check:**
1. Refresh kitchen display
2. Check internet connection
3. Verify order status in admin
4. Manually inform kitchen

### "QR code won't scan"

**Try:**
1. Clean camera lens
2. Ensure good lighting
3. Ask guest to adjust brightness
4. Enter ticket code manually

---

## 9. Security Best Practices

### Password Security

✅ **DO:**
- Use unique password for work account
- Change password every 90 days
- Lock computer when away (Windows+L)

❌ **DON'T:**
- Write passwords on sticky notes
- Share passwords with colleagues
- Use same password as personal accounts

### Guest Data Protection

✅ **DO:**
- Only access guest data when needed
- Log out after viewing sensitive info
- Report suspicious requests

❌ **DON'T:**
- Share guest information with unauthorized people
- Take photos of guest documents
- Discuss guest details in public areas

### Physical Security

- Never leave terminals logged in
- Report tailgating (unauthorized access)
- Keep access cards secure

### Suspicious Activity

Report immediately if you notice:
- Unknown devices connected
- Unfamiliar accounts
- Unusual system behavior
- Requests for guest data via phone/email

**Report to:** IT Security / Manager

---

## Quick Reference Card

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Search |
| Ctrl+P | Print |
| Esc | Close popup |
| F5 | Refresh page |

### Important Phone Numbers

| Contact | Number |
|---------|--------|
| IT Support | ext. XXX |
| Manager on Duty | ext. XXX |
| Emergency | 112 |

### System URLs

| System | URL |
|--------|-----|
| Admin Dashboard | admin.v2resort.com |
| Guest Website | v2resort.com |
| Support Portal | support.v2resort.com |

---

## Training Certification

I confirm that I have completed the V2 Resort system training and understand:
- My responsibilities for data protection
- How to perform my daily tasks
- When and how to escalate issues
- Security best practices

**Name:** ________________________

**Position:** ________________________

**Date:** ________________________

**Signature:** ________________________

**Trainer:** ________________________

---

*For additional training or questions, contact your supervisor or the IT department.*
