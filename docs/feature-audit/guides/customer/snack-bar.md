# Customer Guide: Snack Bar

> **Module:** CUS-SNCK
> **Features:** 9 features
> **Last Updated:** 2026-02-08

---

## Overview

The snack bar is the resort's quick-service food outlet, ideal for grabbing drinks, light bites, and poolside refreshments. The ordering experience follows a streamlined browse-cart-order flow — browse by category, add items to your cart, adjust quantities, and place your order in just a few taps. Orders can be picked up at the snack bar counter or delivered to designated resort areas.

## Prerequisites

- Must be logged in to place orders (browsing is available without login)
- Valid payment method (Stripe card) required at checkout

## Features Covered

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-SNCK-001 | Browse snack bar categories | ✅ Implemented |
| CUS-SNCK-002 | View category items | ✅ Implemented |
| CUS-SNCK-003 | View item detail | ✅ Implemented |
| CUS-SNCK-004 | Add item to cart | ✅ Implemented |
| CUS-SNCK-005 | View cart | ✅ Implemented |
| CUS-SNCK-006 | Update item quantity in cart | ✅ Implemented |
| CUS-SNCK-007 | Remove item from cart | ✅ Implemented |
| CUS-SNCK-008 | Place order | ✅ Implemented |
| CUS-SNCK-009 | View order confirmation | ✅ Implemented |

## How-To Guides

### 1. Browse Categories and Items

**What it does:** Displays the snack bar's menu organized into categories so you can quickly find what you're craving — from beverages and ice cream to sandwiches and chips.

**Steps:**
1. Navigate to `/snack-bar` from the main navigation bar or resort homepage.
2. The page shows **category tabs** across the top (e.g., Beverages, Snacks, Ice Cream, Sandwiches, Combos).
3. Click a category tab to see items within that category.
4. Each item card displays:
   - Item name
   - Thumbnail image
   - Price (in your selected currency)
   - Brief description
5. Click on an item card to view its **full detail** — larger image, full description, ingredients, and any available options (e.g., size, flavor).

**What you'll see:** A clean, mobile-friendly grid of snack items organized by category. Items that are currently sold out show an "Unavailable" badge.

**Tips:**
- The snack bar menu is typically shorter than the restaurant menu — perfect for quick decisions.
- Categories scroll horizontally on mobile — swipe to see all tabs.
- All content displays in your selected language setting.

**API Reference:**
- `GET /snack/categories` — returns all active snack bar categories
- `GET /snack/items?category={id}` — returns items for a specific category

---

### 2. Add Items to Cart

**What it does:** Adds a snack or drink to your cart with an optional quantity selector before moving to checkout.

**Steps:**
1. From the category view or item detail page, click the **Add to Cart** button on an item.
2. If the item has options (e.g., size: Small / Medium / Large), select your preference first.
3. Optionally adjust the **quantity** using the **−** / **+** buttons (defaults to 1).
4. Click **Add to Cart** to confirm.
5. A toast notification appears: "Added to cart." The cart icon badge in the navigation bar updates.

**What you'll see:** A brief confirmation animation or toast message. The item now appears in your snack bar cart.

**Tips:**
- You can add the same item multiple times — each variant (e.g., different size) appears as a separate cart line.
- Quick-add: Some items with no options can be added directly from the category grid without opening the detail page.
- The snack bar cart is **separate** from the restaurant cart — each outlet has its own checkout flow.

---

### 3. View and Manage Your Cart

**What it does:** See all items in your snack bar cart, update quantities, remove items, and review the total before placing your order.

**Steps:**
1. Click the **cart icon** in the navigation bar while on a snack bar page, or navigate directly to `/snack-bar/cart`.
2. The cart page displays:
   - Each item with its name, selected options (if any), unit price, and line total
   - **Quantity controls**: **−** / **+** buttons next to each item
   - **Remove** button (trash icon) to delete an item entirely
   - **Subtotal** at the bottom
3. To **update quantity**: Click **+** to add more or **−** to reduce. Minimum quantity is 1; to go below 1, use the remove button.
4. To **remove an item**: Click the trash icon. The item is removed and the subtotal recalculates.
5. When satisfied, click **Place Order** or **Proceed to Checkout**.

**What you'll see:** A clear itemized list of your selected snacks and drinks with running total. An empty cart shows a "Your cart is empty" message with a link back to the snack bar menu.

**Tips:**
- Review your cart before ordering — snack bar orders are typically prepared quickly and may not be modifiable once placed.
- The cart persists across page navigation within the session.

---

### 4. Place Order and View Confirmation

**What it does:** Finalizes your snack bar order, processes payment, and provides a confirmation with your order number for pickup or delivery.

**Steps:**
1. From the cart page (`/snack-bar/cart`), review your items and totals.
2. Click **Place Order**.
3. Select your **payment method**:
   - Choose a saved card or enter new card details via the Stripe secure form.
4. The order summary shows:
   - Items and quantities
   - Subtotal, taxes, and **total**
5. Click **Confirm Order**.
6. Stripe processes payment (2-5 seconds).
7. On success, you're redirected to `/snack-bar/confirmation`.
8. The confirmation page displays:
   - **Order number** (e.g., "SB-20260208-042")
   - List of items ordered
   - Total paid
   - **Estimated preparation time** (e.g., "Ready in ~5 minutes")
   - Pickup instructions (e.g., "Collect at Snack Bar Counter #2")

**What you'll see:** A confirmation screen with your order reference and estimated ready time. A progress indicator may update as the order is prepared.

**Tips:**
- Snack bar orders are usually ready within 5–15 minutes.
- Keep the confirmation page open or note your order number for pickup.
- If paying with cash is supported at your resort's snack bar, a "Cash" option will appear at checkout.
- You can track your order from **Profile → Order History** once it's placed.

**API Reference:**
- `POST /snack/orders` — creates the snack bar order with items, quantities, and payment intent

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Item shows "Unavailable" | Out of stock for the day | Choose an alternative item. Stock refreshes daily. |
| Cart is empty after navigating away | Session expired or cookies cleared | Re-add items to your cart. Ensure cookies are enabled in your browser. |
| Payment declined | Card issue | Try a different card or verify your card details. |
| Order confirmation not received | Email delay | The confirmation is shown on-screen. Check your email spam folder for the receipt. |
| Can't find snack bar in navigation | Module may be disabled for off-season | The snack bar may operate seasonally. Check with resort reception for operating hours. |
| Wrong item quantity ordered | Didn't review cart before checkout | Snack bar orders may not be cancellable once preparation starts. For future orders, review your cart carefully. |

## Related Modules

- [Restaurant Ordering](restaurant-ordering.md) — Full-service dining with more customization options
- [Pool Tickets](pool-tickets.md) — Combine pool access with snack bar orders for a full poolside experience
- [Loyalty Program](loyalty-program.md) — Earn loyalty points on snack bar purchases
- [Account & Profile](account-and-profile.md) — View past snack bar orders in your order history

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 9 |
| Implemented | 9 |
| Documented in Guide | 9 |
| Coverage | 100% |
| Primary URL | `/snack-bar` |
| Cart URL | `/snack-bar/cart` |
| Confirmation URL | `/snack-bar/confirmation` |
