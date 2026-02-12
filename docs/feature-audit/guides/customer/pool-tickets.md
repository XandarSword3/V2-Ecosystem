# Customer Guide: Pool Tickets

> **Module:** CUS-POOL
> **Features:** 9 features
> **Last Updated:** 2026-02-08

---

## Overview

The pool tickets module lets you view available pool sessions, choose ticket types, select the number of guests, and purchase tickets with a seamless checkout flow. After purchase you receive a QR code for entry and can manage your tickets — including cancellations — from your profile. Sessions have limited capacity, so availability updates in real time.

## Prerequisites

- Must be logged in to purchase tickets (viewing sessions is available without login)
- Valid payment method (Stripe card) required at checkout
- Pool tickets are date- and session-specific — select carefully before purchasing

## Features Covered

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-POOL-001 | View pool sessions | ✅ Implemented |
| CUS-POOL-002 | View session availability | ✅ Implemented |
| CUS-POOL-003 | Select ticket type | ✅ Implemented |
| CUS-POOL-004 | Select guest count | ✅ Implemented |
| CUS-POOL-005 | Purchase ticket | ✅ Implemented |
| CUS-POOL-006 | View QR code ticket | ✅ Implemented |
| CUS-POOL-007 | View purchase confirmation | ✅ Implemented |
| CUS-POOL-008 | View my tickets | ✅ Implemented |
| CUS-POOL-009 | Cancel ticket | ✅ Implemented |

## How-To Guides

### 1. View Pool Sessions and Availability

**What it does:** Displays the resort's pool schedule with session times, capacity, and real-time availability so you can pick the best time to swim.

**Steps:**
1. Navigate to `/pool` from the main navigation bar or resort homepage.
2. A **date picker** at the top defaults to today's date. Select a different date to view future sessions.
3. The page lists all pool sessions for the selected date, each showing:
   - Session name or label (e.g., "Morning Swim", "Afternoon Session", "Evening Splash")
   - Start time and end time (e.g., 09:00–12:00)
   - Pool zone (e.g., Main Pool, Kids Pool, Lap Pool)
   - Capacity: "X of Y spots available" with a visual capacity bar
   - Pricing per ticket type
4. Sessions at full capacity show a **Sold Out** badge and are not selectable.
5. Sessions in the past for today's date appear greyed out.

**What you'll see:** A chronological list of pool sessions with clear availability indicators. Each session card is clickable to proceed with ticket selection.

**Tips:**
- Availability updates in real time — if someone cancels, spots reappear.
- Popular sessions (afternoon, weekends) fill up quickly. Book early in the day for best selection.
- Some sessions may be flagged as "Supervised" (lifeguard on duty) or "Adults Only" based on the resort's schedule.

**API Reference:**
- `GET /pool/sessions?date=2026-02-08` — returns all sessions for a given date with availability counts

---

### 2. Select Ticket Type and Guest Count

**What it does:** Choose the type of pool ticket you need (adult, child, family, VIP) and specify how many guests are attending.

**Steps:**
1. Click on an available session from the session list.
2. A ticket selection panel opens showing available **ticket types**:
   - **Adult** — Standard entry for guests aged 13+. Price shown per person.
   - **Child** — Discounted entry for guests aged 3–12. Price shown per person.
   - **Family** — Bundle ticket (typically 2 adults + 2 children). Price shown per bundle.
   - **VIP** — Premium access with extras (e.g., reserved lounger, towel service, complimentary drinks). Price shown per person.
3. For each ticket type, use the **−** / **+** buttons to set the quantity.
4. The system validates against remaining session capacity. If you exceed available spots, an error message appears: "Only X spots remaining."
5. A running **total** appears at the bottom, updating as you adjust quantities.
6. Click **Continue to Checkout** when satisfied.

**What you'll see:** A clear ticket type selector with prices, quantity controls, and a real-time total. Family bundles show what's included (e.g., "Includes 2 adults + 2 children").

**Tips:**
- Children under 3 are typically free and don't require a ticket — check the resort's age policy displayed on the page.
- Family bundles are usually cheaper than buying individual adult + child tickets separately.
- VIP tickets may include perks like a private cabana, priority entry, or complimentary poolside refreshments.

---

### 3. Purchase Tickets

**What it does:** Completes the ticket purchase by processing payment through Stripe and generating your entry tickets.

**Steps:**
1. On the checkout page, review your ticket selection:
   - Session date and time
   - Ticket types and quantities
   - Price per ticket and subtotal
   - Taxes and fees
   - **Grand Total**
2. Select your **payment method**:
   - Choose a saved card or click **Add New Card** to enter card details via the Stripe secure form.
3. Click **Purchase Tickets**.
4. Stripe processes the payment (2-5 seconds).
5. On success, you're redirected to the confirmation page at `/pool/confirmation`.

**What you'll see:** A processing spinner during payment, then a confirmation page with your ticket details and QR code(s).

**Tips:**
- Each ticket in the order receives its own QR code — one per guest.
- Payment is charged immediately; tickets are non-transferable.
- If payment fails, try another card or check your card details.

**API Reference:**
- `POST /pool/tickets` — creates the ticket purchase with session ID, ticket types, quantities, and payment intent

---

### 4. View QR Code and Confirmation

**What it does:** After purchase, displays your ticket confirmation with QR codes that serve as your pool entry pass.

**Steps:**
1. After successful purchase, the confirmation page at `/pool/confirmation` displays:
   - **Order reference number**
   - Session details (date, time, pool zone)
   - Ticket type and quantity for each type purchased
   - Individual **QR codes** for each ticket
   - Total amount paid
2. Each QR code represents one entry pass. Present it at the pool entrance.
3. You can:
   - **Save/screenshot** the QR codes to your phone for quick access.
   - Access your tickets anytime from **Profile → My Tickets**.

**What you'll see:** A confirmation summary with large, scannable QR codes. Each QR code has the ticket holder's name (if applicable) and ticket type beneath it.

**Tips:**
- QR codes are scanned by pool staff or a kiosk at the pool gate.
- Each QR code is single-use per session — once scanned for entry, it cannot be reused.
- If you lose the QR code, log into your profile to retrieve it.
- A confirmation email with the QR codes as attachments is also sent to your registered email address.

---

### 5. View and Cancel Tickets from Profile

**What it does:** Access all your pool tickets from your profile, view details, and cancel eligible tickets for a refund.

**Steps:**

#### View My Tickets
1. Navigate to `/profile` and click the **My Tickets** or **Pool Tickets** tab.
2. You'll see a list of your tickets organized by:
   - **Upcoming**: Tickets for future sessions — shows date, time, ticket type, and QR code access.
   - **Past**: Used or expired tickets — for your records.
   - **Cancelled**: Tickets you've cancelled.
3. Click on any ticket to view full details and QR code.

#### Cancel a Ticket
1. Open an upcoming ticket from your profile.
2. Click **Cancel Ticket**.
3. A confirmation dialog appears showing:
   - The cancellation policy (e.g., "Full refund if cancelled 24+ hours before session")
   - Any cancellation fees
   - The refund amount
4. Click **Confirm Cancellation**.
5. The refund is processed to your original payment method. A cancellation confirmation displays on screen.

**What you'll see:** A clean list of tickets with status indicators. QR codes are accessible for upcoming tickets. Cancelled tickets show a "Cancelled" badge with refund status.

**Tips:**
- Cancellation deadlines vary — some sessions allow free cancellation up to 24 hours before, others may charge a fee.
- Refunds typically take 5-10 business days to process depending on your bank.
- You cannot cancel a ticket after the session has started.
- If the pool session is cancelled by the resort (e.g., weather), you'll receive an automatic full refund.

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Session shows "Sold Out" | All spots for that session are taken | Try a different session time or date. Check back later for cancellations. |
| QR code won't scan at entrance | Low screen brightness or damaged display | Increase screen brightness to maximum. Try showing the code from the confirmation email instead. |
| Payment failed | Card declined or insufficient funds | Try a different card. Check that your card details are correct. |
| Can't find my tickets | Not logged into the correct account | Verify you're logged in with the same account used for purchase. Check email for confirmation. |
| Refund not received after cancellation | Bank processing delay | Refunds take 5-10 business days. If not received after 10 days, contact resort support. |
| Wrong date selected | Accidentally purchased for wrong day | Cancel the ticket (if within cancellation window) and repurchase for the correct date. |
| Guest count exceeds capacity | Trying to book more tickets than session allows | Reduce your ticket count or split across multiple sessions. |

## Related Modules

- [Chalet Booking](chalet-booking.md) — Pool access may be included with certain chalet packages
- [Snack Bar](snack-bar.md) — Order poolside snacks and drinks
- [Loyalty Program](loyalty-program.md) — Earn points on pool ticket purchases
- [Account & Profile](account-and-profile.md) — Manage tickets and payment methods from your profile

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 9 |
| Implemented | 9 |
| Documented in Guide | 9 |
| Coverage | 100% |
| Primary URL | `/pool` |
| Confirmation URL | `/pool/confirmation` |
| Management URL | `/profile` (My Tickets tab) |
