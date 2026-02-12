# Iteration 10  Analysis

## Date
2026-02-08 13:18

## Files Examined
- `frontend/src/components/customer/LoyaltyDisplay.tsx`  Loyalty progress bar widget
- `frontend/src/components/payments/StripePayment.tsx`  Stripe payment integration
- `frontend/src/app/staff/customers/page.tsx`  Staff customer lookup page

## Issues Found & Fixed

### BUG-10A: LoyaltyDisplay Progress Bar Formula Uses Wrong Numerator (HIGH)
**Category:** BUG  Math / Data Display
**Severity:** HIGH

**Problem:** Line 67 computed `progressPercent` using `account.tier?.pointsMultiplier` (e.g. 1.5) as the numerator instead of actual earned points. Formula: `((pointsMultiplier * 100) / (pointsRequired - pointsNeeded + currentPoints)) * 100`. This produced wildly incorrect percentages (e.g., 150% for a 1.5x multiplier).

**Root Cause:** Copy-paste error or confusion between `pointsMultiplier` and a points ratio.

**Fix:** Replaced with correct formula: `(pointsRequired - pointsNeeded) / pointsRequired * 100`, clamped at 100%. This correctly shows how far the user has progressed toward the next tier.

### BUG-10B: StripePayment useEffect Infinite Loop via `onError` Dep (HIGH)
**Category:** BUG  Performance / Billing
**Severity:** HIGH (causes infinite Stripe API calls)

**Problem:** The `useEffect` that calls `createPaymentIntent` included `onError` in its dep array. Since `onError` is typically passed as an inline arrow from parent components (new reference each render), this triggered infinite re-runs  infinite payment intent creation calls to the Stripe backend.

**Root Cause:** Unstable function reference in useEffect dependency array.

**Fix:** Wrapped `onError` with `useCallback` (`stableOnError = useCallback(onError, [])`) and used that in both the effect body and dep array. This prevents re-runs unless amount/referenceType/referenceId actually change.

### BUG-10C: Staff Customers Page Uses Deprecated `onKeyPress` (MEDIUM)
**Category:** BUG  Compatibility
**Severity:** MEDIUM

**Problem:** Search input used `onKeyPress` which is deprecated in React and doesn't fire reliably in all browsers.

**Fix:** Renamed handler to `handleKeyDown` and changed event binding to `onKeyDown`.

## Verification
- 0 TypeScript errors across all 3 files
- Playwright: `/staff/customers` loads, Enter-to-search works with `onKeyDown`
- Playwright: `/account/loyalty` loads (no runtime crash on formula)
- Console: only HMR + backend 500s (pre-existing server issue)
