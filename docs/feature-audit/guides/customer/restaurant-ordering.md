# Customer Guide: Restaurant Ordering

> **Module:** CUS-REST
> **Features:** 31 features
> **Last Updated:** 2026-02-08

---

## Overview

The V2 Resort restaurant module lets you browse menus, customize orders, and pay — all from your browser or mobile device. Whether you're dining in, ordering takeaway, or requesting delivery to your chalet, the system handles the full flow from menu browsing through real-time order tracking. You can also reserve tables and join waitlists during peak hours.

## Prerequisites

- Must be logged in to place orders (browsing the menu is available without login)
- Valid payment method on file (Stripe card) or cash option selected at checkout
- Location services enabled if using delivery to auto-detect your chalet/room

## Features Covered

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-REST-001 | Browse menu categories | ✅ Implemented |
| CUS-REST-002 | View category items | ✅ Implemented |
| CUS-REST-003 | Search menu items | ✅ Implemented |
| CUS-REST-004 | View item detail | ✅ Implemented |
| CUS-REST-005 | View item images | ✅ Implemented |
| CUS-REST-006 | Filter by dietary requirements | ✅ Implemented |
| CUS-REST-007 | Add item to cart | ✅ Implemented |
| CUS-REST-008 | Select item size/variant | ✅ Implemented |
| CUS-REST-009 | Add item modifiers | ✅ Implemented |
| CUS-REST-010 | Add extra toppings | ✅ Implemented |
| CUS-REST-011 | Remove ingredients | ✅ Implemented |
| CUS-REST-012 | Set spice level | ✅ Implemented |
| CUS-REST-013 | Add special instructions per item | ✅ Implemented |
| CUS-REST-014 | View cart | ✅ Implemented |
| CUS-REST-015 | Update item quantity in cart | ✅ Implemented |
| CUS-REST-016 | Remove item from cart | ✅ Implemented |
| CUS-REST-017 | Apply coupon code | ✅ Implemented |
| CUS-REST-018 | Apply gift card | ✅ Implemented |
| CUS-REST-019 | Redeem loyalty points | ✅ Implemented |
| CUS-REST-020 | Select order type | ✅ Implemented |
| CUS-REST-021 | Enter table number | ✅ Implemented |
| CUS-REST-022 | Add order-level special instructions | ✅ Implemented |
| CUS-REST-023 | Pay with Stripe card | ✅ Implemented |
| CUS-REST-024 | Pay with cash | ✅ Implemented |
| CUS-REST-025 | Place order | ✅ Implemented |
| CUS-REST-026 | View order confirmation | ✅ Implemented |
| CUS-REST-027 | Real-time order tracking | ✅ Implemented |
| CUS-REST-028 | Make table reservation | ✅ Implemented |
| CUS-REST-029 | View my reservations | ✅ Implemented |
| CUS-REST-030 | Join waitlist | ✅ Implemented |
| CUS-REST-031 | View waitlist status | ✅ Implemented |

## How-To Guides

### 1. Browse the Menu

**What it does:** Displays all restaurant menu categories and lets you drill into individual items with photos, descriptions, prices, and dietary labels.

**Steps:**
1. Navigate to `/restaurant` from the main navigation bar or resort homepage.
2. The menu page loads with category tabs along the top (e.g., Starters, Mains, Desserts, Beverages).
3. Click on a category tab to view items within that category.
4. Each item card shows the name, a thumbnail image, a short description, the base price, and any dietary icons (🥬 vegetarian, 🌾 gluten-free, etc.).
5. Click on any item card to open its full detail view.

**What you'll see:** A grid or list of menu items organized by category. Items with images display a photo; items without show a placeholder. Prices display in your selected currency.

**Tips:**
- The category bar is horizontally scrollable on mobile — swipe left/right to see all categories.
- Items that are currently unavailable appear greyed out with an "Unavailable" badge.
- The menu respects your chosen language — all item names and descriptions appear in your selected locale (EN, AR, FR, DE, IT).

**API Reference:**
- `GET /restaurant/menu/categories` — fetches all active categories
- `GET /restaurant/menu/items?category={id}` — fetches items for a specific category

---

### 2. Search and Filter Menu Items

**What it does:** Lets you quickly find items by name or keyword, and filter the entire menu by dietary requirements such as vegetarian, vegan, gluten-free, halal, or allergen-free.

**Steps:**
1. On the `/restaurant` page, locate the search bar at the top of the menu section.
2. Type a keyword (e.g., "chicken", "pasta", "salad") — results filter in real time as you type.
3. To apply dietary filters, click the **Filter** icon (funnel) next to the search bar.
4. A dropdown or panel appears with checkboxes: Vegetarian, Vegan, Gluten-Free, Halal, Nut-Free, Dairy-Free.
5. Check one or more filters. The menu updates instantly to show only matching items.
6. Active filters appear as badges below the search bar. Click the **×** on any badge to remove that filter.

**What you'll see:** Only items matching your search term and/or dietary selections appear. A "No results" message displays if nothing matches.

**Tips:**
- Combine search with filters — e.g., search "pasta" + filter "Gluten-Free" to find gluten-free pasta dishes.
- Dietary labels come from the kitchen's item configuration, so they are accurate and up-to-date.
- Clear all filters by clicking **Reset Filters**.

---

### 3. Add Items to Cart with Customizations

**What it does:** Adds a menu item to your cart while allowing you to select size/variant, modifiers, extra toppings, removed ingredients, spice level, and per-item special instructions.

**Steps:**
1. From the menu, click on an item card to open the item detail view.
2. **Select size/variant** (if available): Choose from options like Small, Medium, Large or other variants. The price updates based on your selection.
3. **Add modifiers**: Toggle optional modifiers such as "Extra Cheese", "Add Bacon", "Substitute Rice for Fries". Each modifier shows its additional cost (or "Free" if included).
4. **Extra toppings**: In the toppings section, check the toppings you want added. Prices are shown per topping.
5. **Remove ingredients**: Expand the "Remove Ingredients" section and uncheck any default ingredients you want excluded (e.g., onions, tomatoes).
6. **Set spice level**: Use the spice level selector — typically Mild, Medium, Hot, Extra Hot — displayed as a slider or button group.
7. **Special instructions**: Type any additional notes in the "Special Instructions" text box (e.g., "allergic to shellfish", "well done please").
8. **Set quantity**: Use the **−** / **+** buttons to set how many of this item you want.
9. Click **Add to Cart**.

**What you'll see:** A confirmation toast notification appears: "Item added to cart". The cart icon in the navigation bar updates its badge count.

**Tips:**
- You can add the same item multiple times with different customizations — each configuration becomes a separate cart line.
- Required modifiers (e.g., "Choose your side") must be selected before the Add to Cart button becomes active.
- The total item price recalculates live as you add/remove modifiers and toppings.

---

### 4. Manage Your Cart

**What it does:** View all items in your cart, adjust quantities, remove items, and see the running subtotal before proceeding to checkout.

**Steps:**
1. Click the **cart icon** in the navigation bar, or navigate to `/restaurant/cart`.
2. The cart page displays each item with:
   - Item name and selected customizations
   - Unit price and line total
   - Quantity selector (**−** / **+** buttons)
3. To **update quantity**: Click **+** or **−** next to any item. The line total and cart subtotal update instantly.
4. To **remove an item**: Click the **trash/delete** icon on the item row. A brief confirmation may appear.
5. The cart footer shows: Subtotal, any applied discounts, tax, and estimated total.

**What you'll see:** A clean list of your selected items with full customization details. An empty cart shows a friendly "Your cart is empty" message with a link back to the menu.

**Tips:**
- Cart contents persist across page navigation within the same session.
- The cart supports items from the restaurant module; snack bar items use a separate cart at `/snack-bar/cart`.

---

### 5. Apply Discounts — Coupon, Gift Card, Loyalty Points

**What it does:** Reduces your order total by applying a valid coupon code, redeeming a gift card balance, or spending accumulated loyalty points.

**Steps:**
1. In the cart or checkout page, locate the **Discount** section.
2. **Coupon code**: Enter your coupon code in the "Coupon Code" field and click **Apply**. If valid, the discount amount or percentage appears and the total updates.
3. **Gift card**: Click **Apply Gift Card**, enter the gift card code. The system checks the remaining balance and applies up to the order total.
4. **Loyalty points**: If enrolled in the loyalty program, a "Use Loyalty Points" option appears. Toggle it on and select how many points to redeem. The equivalent monetary value is shown (e.g., "500 points = $5.00").
5. Applied discounts appear as line items in the order summary with a **Remove** option.

**What you'll see:** Discount line items in the price breakdown. If a coupon is invalid or expired, an error message displays: "Invalid coupon code" or "Coupon has expired".

**Tips:**
- Only one coupon code can be applied per order, but you can combine a coupon with a gift card and loyalty points.
- Gift cards may have a remaining balance after the order — the leftover stays on your card for future use.
- Loyalty points redemption is subject to minimum thresholds set by the resort.

---

### 6. Select Order Type and Enter Details

**What it does:** Choose how you want your food — dine-in, takeaway, or delivery — and provide the necessary details like table number or delivery location.

**Steps:**
1. During checkout (after the cart review), select your **Order Type**:
   - **Dine-in**: You're eating at the restaurant.
   - **Takeaway**: You'll pick up the order at the restaurant counter.
   - **Delivery**: The order will be delivered to your chalet or room.
2. **If Dine-in**: Enter your **table number** in the provided field. Table numbers are typically displayed on a placard at your table.
3. **If Delivery**: Confirm or enter your chalet/room number. If your profile has a room on file, it auto-fills.
4. **Special instructions** (all order types): Add any order-level notes in the "Order Notes" box (e.g., "Please deliver to the pool area", "Need extra napkins").

**What you'll see:** The selected order type is highlighted. Required fields (like table number for dine-in) are validated before you can proceed.

**Tips:**
- Table number validation checks against the restaurant's active table list — if you enter an invalid number, you'll be prompted to correct it.
- Delivery may have additional fees shown in the price breakdown.

---

### 7. Pay and Place Your Order

**What it does:** Completes the order by processing payment via Stripe (card) or marking it as cash payment at the counter.

**Steps:**
1. On the checkout page, select your **Payment Method**:
   - **Card (Stripe)**: Your saved cards appear. Select one or click **Add New Card** to enter card details via the secure Stripe payment form. The form collects card number, expiry, CVC, and billing ZIP.
   - **Cash**: Select "Pay with Cash". No card details required — you'll pay at the restaurant counter or upon delivery.
2. Review the **Order Summary**: items, customizations, discounts, tax, delivery fee (if applicable), and grand total.
3. Click **Place Order**.
4. If paying by card, Stripe processes the payment. A loading spinner appears for 2-5 seconds.
5. Upon success, you're redirected to the confirmation page at `/restaurant/confirmation`.

**What you'll see:** A success screen with your order number, estimated preparation time, and a summary of what you ordered.

**Tips:**
- If card payment fails, an error message appears (e.g., "Card declined", "Insufficient funds"). You can try another card or switch to cash.
- Stripe payments are PCI-compliant — V2 Resort never stores your raw card details.
- 3D Secure authentication may be triggered for some cards — follow the bank's verification prompt if it appears.

**API Reference:**
- `POST /restaurant/orders` — creates the order with items, customizations, order type, and payment intent

---

### 8. Track Your Order in Real Time

**What it does:** After placing an order, view its live status as it moves through preparation, cooking, and delivery/pickup.

**Steps:**
1. After placing an order, you're automatically taken to the confirmation page at `/restaurant/confirmation`.
2. The page displays a **status tracker** with stages:
   - **Order Received** → **Preparing** → **Cooking** → **Ready for Pickup** / **Out for Delivery** → **Completed**
3. Each stage highlights when active. Timestamps show when each stage was reached.
4. You can also access order tracking from **Profile → Order History** — click on any active order to see its status.
5. Real-time updates are pushed via WebSocket — no need to manually refresh.

**What you'll see:** A visual progress bar or stepper showing the current order stage. An estimated time to completion may update as the kitchen progresses.

**Tips:**
- If delivery is selected, you may see a "Driver on the way" status with an estimated arrival time.
- Completed orders move to your order history automatically.
- If there's an issue with your order, use the **Live Chat** widget to contact resort staff directly.

---

### 9. Make a Table Reservation

**What it does:** Reserve a table at the restaurant for a specific date, time, and party size.

**Steps:**
1. Navigate to `/restaurant/reserve` from the restaurant page or main navigation.
2. Select your preferred **date** using the calendar picker.
3. Select a **time slot** from the available options. Greyed-out slots are fully booked.
4. Enter the **number of guests**.
5. Optionally add **special requests** (e.g., "window seat", "high chair needed", "birthday celebration").
6. Click **Reserve Table**.
7. A confirmation screen displays your reservation details, including a confirmation number.

**What you'll see:** Available time slots for the selected date, capacity indicators, and a confirmation with a reference number you can use to manage the reservation later.

**Tips:**
- You can view and manage your reservations from **Profile → My Reservations** or at `/restaurant/reserve`.
- Cancellation policies may apply — check the confirmation for the cancellation deadline.
- Reservations for large parties (e.g., 8+) may require staff confirmation.

**API Reference:**
- `POST /restaurant/reservations` — creates a new table reservation
- `GET /restaurant/reservations/me` — retrieves your reservations

---

### 10. Join and View the Waitlist

**What it does:** When the restaurant is full and no reservation slots are available, you can join a waitlist and monitor your position in the queue.

**Steps:**
1. Navigate to `/restaurant/waitlist`.
2. If the restaurant is at capacity, the page shows a **Join Waitlist** form.
3. Enter the **number of guests** and optionally your **phone number** for SMS notification.
4. Click **Join Waitlist**.
5. Your position in the queue is displayed (e.g., "You are #3 in line").
6. The page auto-updates your position as parties are seated.
7. When your table is ready, you receive a notification (in-app and/or SMS if provided).

**What you'll see:** Your current position in the waitlist, estimated wait time, and the number of parties ahead of you.

**Tips:**
- You can leave the waitlist page — your position is saved. Return to `/restaurant/waitlist` anytime to check status.
- If you miss your notification, you may be moved to the back of the queue after a grace period.
- The waitlist is independent of reservations — if you have a reservation, you don't need to join the waitlist.

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Menu items not loading | API timeout or network issue | Refresh the page. Check your internet connection. If persistent, try clearing browser cache. |
| "Item unavailable" after adding to cart | Item sold out between browsing and checkout | Remove the item from your cart and choose an alternative. |
| Coupon code not working | Code expired, already used, or doesn't meet minimum order | Check the coupon terms. Ensure your order meets the minimum spend requirement. |
| Card payment declined | Insufficient funds, expired card, or bank block | Try a different card, check with your bank, or switch to cash payment. |
| Order stuck on "Preparing" for too long | Kitchen delay or status update lag | Wait 5 minutes, then refresh. If still stuck, contact staff via Live Chat. |
| Table number rejected | Entered a table number not in the system | Verify the number on your table placard. Ask staff if unsure. |
| Can't see dietary filters | Filters not configured for this restaurant location | Contact resort support. Not all locations may have dietary data entered. |
| Reservation date unavailable | Restaurant closed or fully booked | Try a different date/time or join the waitlist for same-day seating. |

## Related Modules

- [Snack Bar](snack-bar.md) — Quick-service food ordering with a similar cart and checkout flow
- [Gift Cards](gift-cards.md) — Purchase and redeem gift cards usable at the restaurant
- [Loyalty Program](loyalty-program.md) — Earn and redeem points on restaurant orders
- [Account & Profile](account-and-profile.md) — Manage saved payment methods and view order history
- [GDPR & Privacy](gdpr-privacy.md) — Manage data related to your ordering history

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 31 |
| Implemented | 31 |
| Documented in Guide | 31 |
| Coverage | 100% |
| Primary URL | `/restaurant` |
| Cart URL | `/restaurant/cart` |
| Confirmation URL | `/restaurant/confirmation` |
| Reservation URL | `/restaurant/reserve` |
| Waitlist URL | `/restaurant/waitlist` |
