# Iteration 17  Analysis

## Issues Identified

### FIX-17A: GiftCardPurchase Component  Hardcoded $ Currency Symbols
**Category:** FIX (i18n/Currency)
**File:** `components/customer/GiftCardPurchase.tsx`
**Severity:** MEDIUM

**Problem:** Three locations with hardcoded `$` symbols:
1. `toast.error('Minimum gift card amount is ')`  plain dollar sign
2. `<span>$</span>`  input prefix with literal `$`
3. `Minimum , Maximum ,000`  range text with hardcoded values

**Root Cause:** Same issue as the public giftcards page (fixed in Iter-15). This component is used at `/account/giftcards`.

**Solution:** 
- Added `currencySymbols` import from `@/stores/settingsStore`
- Toast: `formatCurrency(10)` instead of ``
- Input prefix: `currencySymbols.USD` instead of `$`
- Range text: `formatCurrency(10)` and `formatCurrency(1000)` instead of `` and `,000`

### FIX-17B: GiftCardPurchase Component  Missing AbortController
**Category:** FIX (Data Integrity)
**File:** `components/customer/GiftCardPurchase.tsx`
**Severity:** MEDIUM

**Problem:** The `useEffect` calling `loadTemplates()` had no cleanup. Navigating away mid-request would trigger setState on unmounted component.

**Root Cause:** Missing cleanup pattern for async data fetching.

**Solution:** Inlined async fetch with AbortController, signal passed to `api.get()`, guarded setState with `signal.aborted`, cleanup aborts on unmount.

### FIX-17C: Pool Staff  Missing AbortController for fetchTickets
**Category:** FIX (Data Integrity)
**File:** `staff/pool/page.tsx`
**Severity:** MEDIUM

**Problem:** `fetchTickets` called via `useEffect` had no AbortController. Also, the `Button onClick={fetchTickets}` passed the click event as the first argument (subtle runtime bug).

**Root Cause:** Missing cleanup pattern + function reference used directly as event handler with changed signature.

**Solution:**
- Added optional `signal?: AbortSignal` parameter to `fetchTickets`
- Pass AbortController signal from useEffect, with cleanup
- Guard all setState with `signal?.aborted` check
- Handle `CanceledError` in catch block 
- Wrapped button onClick: `onClick={() => fetchTickets()}` to prevent event being passed as signal

## TypeScript Verification
- 0 errors in `GiftCardPurchase.tsx`
- 0 errors in `staff/pool/page.tsx`
