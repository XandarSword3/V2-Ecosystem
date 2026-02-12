# Iteration 1 Analysis — Restaurant Menu Ordering Flow

## Date: 2026-02-08

## Area Examined
**Restaurant menu → cart → checkout → order confirmation flow**

### Files Inspected:
- `frontend/src/app/restaurant/page.tsx` — Menu page
- `frontend/src/app/restaurant/cart/page.tsx` — Cart/checkout page
- `frontend/src/app/restaurant/components/useMenuActions.ts` — Cart add logic
- `frontend/src/app/restaurant/components/types.ts` — MenuItem normalization
- `frontend/src/app/restaurant/components/RestaurantModals.tsx` — Modifier modals
- `frontend/src/app/restaurant/components/FloatingCartBar.tsx` — Floating cart
- `frontend/src/stores/cartStore.ts` — Zustand cart state
- `frontend/src/lib/api.ts` — API client
- `backend/src/modules/restaurant/services/order.service.ts` — Order creation service
- `backend/src/modules/restaurant/controllers/order.controller.ts` — Order controller
- `backend/src/modules/restaurant/controllers/tab.controller.ts` — Tab/bill controller
- `backend/src/lib/services/order.service.ts` — Legacy order service
- `backend/src/modules/restaurant/restaurant.routes.ts` — Restaurant routes

---

## BUGS FOUND

### Bug 1: Price Discrepancy Between Cart and Order (HIGH)
- **Severity:** HIGH — Customer sees one price but is charged a different (higher) amount
- **Root Cause:** Backend `order.service.ts` line 93 used `parseFloat(menuItem.price)` (regular price = $10.00) while frontend correctly used `item.discountPrice || item.price` (sale price = $9.00)
- **Impact:** Cart showed $10.89 total, confirmation page showed $12.10 — a $1.21 overcharge
- **Files affected:** `order.service.ts`, `tab.controller.ts`, `lib/services/order.service.ts`
- **Same bug present in:** 4 files with `parseFloat(menuItem.price)`

### Bug 2: Stripe Integration Error (MEDIUM)
- **Severity:** MEDIUM — Console error: "Please call Stripe() with your publishable key. You used an empty string"
- **Impact:** Card payments likely fail. Cash payments work fine.
- **Deferred:** No valid Stripe key in env — not fixable without credentials

### Bug 3: "1 items in cart" Grammar (LOW)
- **Severity:** LOW — FloatingCartBar uses i18n key `itemsInCart` with count param but translation doesn't pluralize properly
- **Deferred:** Translation file issue, lower priority

## IMPROVEMENTS IDENTIFIED

### Improvement 1: Empty Menu Categories (MEDIUM)
- 14 categories exist but only 1 item ("Test") — most categories show "No items found"
- This is test data issue, not a code bug

### Improvement 2: Menu Items Display Only Shows Sale/Regular Prices (LOW)
- The menu card shows both $9.00 and $10.00 (sale and regular), which is correct UX

---

## What Was Fixed This Iteration
- **Bug 1: Price discrepancy** — Fixed in 3 files to use `discount_price` when available

## What Was Deferred
- Bug 2 (Stripe key) — Needs valid API credentials
- Bug 3 (grammar) — Low priority i18n fix
- Improvement 1 — Test data issue
