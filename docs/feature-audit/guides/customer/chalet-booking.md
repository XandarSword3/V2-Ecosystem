# Customer Guide: Chalet Booking

> **Module:** CUS-CHAL
> **Features:** 17 features
> **Last Updated:** 2026-02-08

---

## Overview

The chalet booking module lets you browse available chalets at the resort, view photo galleries and amenity details, check real-time availability, and book your stay with a fully integrated payment flow. After booking, you can view, modify, or cancel reservations directly from your profile. The system supports date-range selection, guest count configuration, optional add-ons, and transparent price breakdowns.

## Prerequisites

- Must be logged in to make a booking (browsing chalets is available without login)
- Valid payment method (Stripe card) required at checkout
- Dates must be selected within the resort's operating calendar

## Features Covered

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-CHAL-001 | Browse chalet listings | ✅ Implemented |
| CUS-CHAL-002 | Filter chalets | ✅ Implemented |
| CUS-CHAL-003 | Sort chalet results | ✅ Implemented |
| CUS-CHAL-004 | View chalet detail page | ✅ Implemented |
| CUS-CHAL-005 | View image gallery | ✅ Implemented |
| CUS-CHAL-006 | Check availability calendar | ✅ Implemented |
| CUS-CHAL-007 | Select check-in and check-out dates | ✅ Implemented |
| CUS-CHAL-008 | Select number of guests | ✅ Implemented |
| CUS-CHAL-009 | Select add-ons | ✅ Implemented |
| CUS-CHAL-010 | View price breakdown | ✅ Implemented |
| CUS-CHAL-011 | Enter special requests | ✅ Implemented |
| CUS-CHAL-012 | Pay for booking | ✅ Implemented |
| CUS-CHAL-013 | View booking confirmation | ✅ Implemented |
| CUS-CHAL-014 | Receive booking email | ✅ Implemented |
| CUS-CHAL-015 | View my bookings | ✅ Implemented |
| CUS-CHAL-016 | Cancel booking | ✅ Implemented |
| CUS-CHAL-017 | Modify booking | ✅ Implemented |

## How-To Guides

### 1. Browse and Filter Chalets

**What it does:** Displays all available chalets with filtering and sorting options so you can find the perfect accommodation for your stay.

**Steps:**
1. Navigate to `/chalets` from the main navigation bar or resort homepage.
2. The listings page displays chalet cards in a grid layout. Each card shows:
   - A hero image of the chalet
   - Chalet name and type (e.g., Standard, Deluxe, Premium, Family)
   - Nightly price (displayed in your selected currency)
   - Guest capacity (e.g., "Sleeps 4")
   - Star rating or guest review score
   - Key amenities as icons (Wi-Fi, pool, kitchen, etc.)
3. **Filter** chalets using the filter panel on the left (desktop) or the filter button (mobile):
   - **Price range**: Set minimum and maximum nightly rate using a slider.
   - **Guest capacity**: Select the number of guests (1–10+).
   - **Chalet type**: Check one or more types (Standard, Deluxe, Premium, Family, Suite).
   - **Amenities**: Filter by specific amenities (Wi-Fi, private pool, kitchen, BBQ, hot tub, pet-friendly).
   - **Availability**: Enter your desired dates to show only chalets available for that period.
4. **Sort** results using the sort dropdown:
   - Price: Low to High / High to Low
   - Rating: Highest First
   - Popularity
   - Newest

**What you'll see:** A responsive grid of chalet cards that updates in real time as you apply filters. A count shows "Showing X of Y chalets". If no chalets match your filters, a "No results" message appears with a suggestion to broaden your criteria.

**Tips:**
- On mobile, filters appear as a slide-out panel triggered by a filter icon button.
- Applied filters appear as removable badges above the results.
- Prices shown on listings are the base nightly rate before taxes and add-ons.

**API Reference:**
- `GET /chalets` — fetches chalet listings with optional query parameters for filters and sorting
- `GET /chalets?type=deluxe&minPrice=100&maxPrice=500&guests=4&sort=price_asc`

---

### 2. View Chalet Details and Image Gallery

**What it does:** Shows the full detail page for a specific chalet including a photo gallery, amenity list, description, policies, and location information.

**Steps:**
1. From the listings page, click on any chalet card.
2. You're taken to the chalet detail page at `/chalets/[id]`.
3. The page displays:
   - **Image gallery**: A large hero image with thumbnail strip below. Click any thumbnail to view it full-size. Use arrow buttons or swipe to navigate through all photos.
   - **Chalet name and type** with the nightly rate prominently displayed.
   - **Description**: A detailed text description of the chalet, its features, and surroundings.
   - **Amenities list**: Full list with icons — beds, bathrooms, kitchen, Wi-Fi, parking, pool access, balcony, air conditioning, etc.
   - **House rules**: Check-in/check-out times, pet policies, noise policies, smoking policy.
   - **Location**: Map showing the chalet's position within the resort.
   - **Reviews**: Guest reviews and average rating (if available).
4. Click on any image to open a full-screen lightbox gallery with zoom capability.

**What you'll see:** A rich detail page with all the information needed to make a booking decision. The booking widget (date picker, guest selector) is typically positioned in a sticky sidebar on desktop or at the bottom on mobile.

**Tips:**
- The image gallery supports swipe gestures on touch devices.
- High-resolution images load progressively — a blurred placeholder appears first, then the full image.
- All text content appears in your selected language.

---

### 3. Check Availability and Select Dates

**What it does:** Displays an interactive calendar showing which dates the chalet is available, booked, or blocked, and lets you select your check-in and check-out dates.

**Steps:**
1. On the chalet detail page (`/chalets/[id]`), locate the **availability calendar** in the booking widget.
2. The calendar shows:
   - **Green/available dates**: Open for booking.
   - **Red/grey dates**: Already booked or blocked.
   - **Today's date**: Highlighted with a circle or border.
3. Click a **check-in date** — it highlights as the start of your stay.
4. Click a **check-out date** — the range between check-in and check-out highlights.
5. The minimum stay requirement (if any) is enforced — you cannot select fewer nights than the minimum.
6. The total number of nights and the calculated price appear below the calendar.

**What you'll see:** A two-month calendar view (current and next month) with color-coded date availability. Selected dates form a highlighted range. An error message appears if you try to select unavailable dates.

**Tips:**
- Navigate months using the left/right arrows on the calendar header.
- Weekend rates and holiday rates may differ — the price summary updates to reflect the actual per-night cost for your selected dates.
- If your desired dates are unavailable, try shifting by a day or two, or check other chalets.

**API Reference:**
- `GET /chalets/:id/availability?month=2026-02` — returns availability data for a given month

---

### 4. Configure Guests and Add-Ons

**What it does:** Set the number of guests for your stay and optionally add extras like breakfast packages, airport transfers, welcome baskets, or equipment rentals.

**Steps:**
1. In the booking widget, set the **number of guests** using the **−** / **+** buttons or a dropdown:
   - Adults (required, minimum 1)
   - Children (optional)
   - Infants (optional, typically no charge)
2. The system validates against the chalet's maximum capacity. If you exceed it, an error appears: "Maximum capacity is X guests."
3. Below the guest selector, an **Add-Ons** section lists optional extras:
   - Breakfast package (per person per night)
   - Welcome fruit basket
   - Late check-out
   - Airport transfer
   - BBQ equipment rental
   - Extra bed / cot for infant
4. Toggle or check each add-on you want. Prices are shown per unit or per stay.
5. The **price breakdown** updates in real time as you change guests and add-ons.

**What you'll see:** A clear guest count with capacity validation, a list of available add-ons with prices, and an updated total price.

**Tips:**
- Some add-ons may have limited availability — book early, especially for high-demand items like airport transfers.
- Child pricing may differ from adult pricing for add-ons like breakfast.
- Add-ons can sometimes be added after booking by modifying your reservation.

---

### 5. Review Price Breakdown and Book

**What it does:** Displays a transparent price breakdown of your entire stay including nightly rates, taxes, add-ons, and any discounts, then processes your payment and confirms the booking.

**Steps:**
1. After selecting dates, guests, and add-ons, click **Book Now** or **Proceed to Checkout**.
2. The booking summary page displays:
   - Chalet name and type
   - Check-in / check-out dates and number of nights
   - Nightly rate × number of nights
   - Add-on costs (itemized)
   - Subtotal
   - Taxes and fees
   - Discount (if a coupon or loyalty points are applied)
   - **Grand Total**
3. Enter any **special requests** in the text field (e.g., "early check-in if possible", "extra towels", "ground floor preferred").
4. Select your **payment method**:
   - Choose a saved card or enter new card details via the Stripe secure form.
5. Review the **cancellation policy** displayed above the confirmation button.
6. Click **Confirm Booking**.
7. Stripe processes the payment. A loading state appears for 2-5 seconds.
8. On success, you're redirected to `/chalets/booking-confirmation`.

**What you'll see:** A booking confirmation page with:
- Booking reference number
- Check-in/check-out dates and times
- Guest count
- Total paid
- Special requests noted
- A "View My Bookings" button
- Confirmation email notification

**Tips:**
- Screenshot or save your booking reference number for quick access at check-in.
- A confirmation email is sent to your registered email address within minutes.
- If payment fails, you're returned to the checkout page to try again — your selections are preserved.

**API Reference:**
- `POST /chalets/bookings` — creates the booking with dates, guests, add-ons, special requests, and payment intent
- `GET /chalets/bookings/:id` — retrieves booking details

---

### 6. View, Modify, and Cancel Bookings

**What it does:** Access your booking history, make changes to an upcoming reservation (dates, guests, add-ons), or cancel a booking per the cancellation policy.

**Steps:**

#### View Bookings
1. Navigate to `/profile` or click **My Bookings** from the profile dropdown.
2. The bookings tab lists all your chalet reservations:
   - **Upcoming**: Active future bookings
   - **Past**: Completed stays
   - **Cancelled**: Cancelled bookings
3. Click any booking to see its full details.

#### Modify a Booking
1. Open an upcoming booking from your profile.
2. Click **Modify Booking**.
3. You can change:
   - Check-in / check-out dates (subject to availability)
   - Number of guests
   - Add-ons (add or remove)
   - Special requests
4. The updated price breakdown shows the difference — you may owe additional payment or receive a partial refund.
5. Click **Confirm Changes**.

#### Cancel a Booking
1. Open an upcoming booking from your profile.
2. Click **Cancel Booking**.
3. A confirmation dialog shows:
   - The cancellation policy (e.g., "Free cancellation up to 48 hours before check-in")
   - Any cancellation fee
   - The refund amount
4. Click **Confirm Cancellation**.
5. The refund is processed to your original payment method. Processing time depends on your bank (typically 5-10 business days).

**What you'll see:** A clear list of bookings organized by status. Modification and cancellation options are only available for upcoming bookings within the allowed policy window.

**Tips:**
- Modifications are subject to availability — if your new dates are booked, you'll need to choose different dates.
- Cancellation policies vary by chalet type and season — always check before cancelling.
- Past bookings cannot be modified or cancelled but remain in your history for reference.

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| No chalets available for my dates | Fully booked for the selected period | Try different dates, a different chalet type, or check back later for cancellations. |
| Calendar not loading | Network timeout or JavaScript error | Refresh the page. Ensure JavaScript is enabled. Clear browser cache if persists. |
| Payment failed during booking | Card declined, expired, or limit reached | Try a different card. Contact your bank if the issue persists. |
| Can't modify booking | Outside modification window or already checked in | Check the modification policy on your booking confirmation. Contact reception for assistance. |
| Wrong price displayed | Currency mismatch or cached rates | Verify your currency setting in the header. Refresh the page for latest rates. |
| Image gallery not loading | Slow connection or image CDN issue | Wait for images to load (progressive loading). Try refreshing. Check your internet speed. |
| Add-on not available | Sold out or seasonally unavailable | Choose an alternative add-on or contact reception to arrange extras after arrival. |
| Confirmation email not received | Email delay, spam filter, or wrong email on file | Check your spam/junk folder. Verify your email in Profile settings. Contact support if not received within 30 minutes. |

## Related Modules

- [Pool Tickets](pool-tickets.md) — Book pool access during your chalet stay
- [Restaurant Ordering](restaurant-ordering.md) — Order food delivery to your chalet
- [Gift Cards](gift-cards.md) — Redeem gift cards towards your chalet booking
- [Loyalty Program](loyalty-program.md) — Earn loyalty points on chalet bookings
- [Account & Profile](account-and-profile.md) — Manage bookings and payment methods from your profile

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 17 |
| Implemented | 17 |
| Documented in Guide | 17 |
| Coverage | 100% |
| Primary URL | `/chalets` |
| Detail URL | `/chalets/[id]` |
| Confirmation URL | `/chalets/booking-confirmation` |
| Management URL | `/profile` (Bookings tab) |
