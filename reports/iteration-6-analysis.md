# Iteration 6 Analysis — Register Autocomplete, Cart Discount Logic, Cart Modifier Totals

## Scope
- Register page missing autocomplete attributes (6 inputs)
- Restaurant cart 100% discount logic bug
- Cart sidebar under-reporting totals by omitting modifier costs (2 cart pages)

---

## Bugs Found

### BUG-6A: Register Page Missing autoComplete Attributes (MEDIUM)
- **Location:** `frontend/src/app/register/page.tsx` — 6 inputs
- **Warning:** Browser DevTools showed `Input elements should have autocomplete attributes (suggested: "new-password")` (twice)
- **Root Cause:** None of the 6 register form inputs had `autoComplete` attribute.
- **Fix:** Added proper `autoComplete` values:
  - First Name → `given-name`
  - Last Name → `family-name`
  - Email → `email`
  - Phone → `tel`
  - Password → `new-password`
  - Confirm Password → `new-password`

### BUG-6B: Restaurant Cart 100% Discount Shows Full Price (MEDIUM)
- **Location:** `frontend/src/app/restaurant/cart/page.tsx` line 82
- **Problem:** `const total = finalTotal > 0 ? finalTotal : preDiscountTotal` — if a 100% discount sets `finalTotal` to 0, the condition `> 0` is false and it falls back to `preDiscountTotal` (the full price).
- **Root Cause:** `finalTotal` is initialized as `useState(0)` and the operator `> 0` can't distinguish "no discount applied yet" from "100% discount applied".
- **Fix:** Changed to `const total = appliedDiscounts.length > 0 ? finalTotal : preDiscountTotal` — checks whether discounts were actually applied rather than checking if finalTotal is positive.

### BUG-6C: Cart Sidebar Omits Modifier Costs (MEDIUM)
- **Location:** Restaurant cart line 753, [slug] cart lines 398 & 692
- **Problem:** Order summary sidebar shows `item.price * item.quantity` but the main cart view shows `(item.price + (item.modifierTotal || 0)) * item.quantity`. If a user adds extra toppings (+$2), the sidebar shows a lower total than the main view.
- **Fix:** Changed all 3 locations to include `(item.modifierTotal || 0)` in the calculation.

---

## Files Changed (3 files)
1. `frontend/src/app/register/page.tsx` — 6 autoComplete attributes added
2. `frontend/src/app/restaurant/cart/page.tsx` — 100% discount fix + sidebar modifier fix
3. `frontend/src/app/[slug]/cart/page.tsx` — Line-item + sidebar modifier cost fixes

## Verification
- Register page: 0 browser warnings (was 2x "new-password" suggestion)
- All 3 files: 0 TypeScript errors
- Discount logic: `appliedDiscounts.length > 0` correctly distinguishes "no discount" from "100% discount"
