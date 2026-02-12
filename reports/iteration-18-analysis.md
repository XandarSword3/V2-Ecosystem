# Iteration 18  Analysis

## Issues Identified

### FIX-18A: Snack Bar Staff  Missing AbortController for fetchOrders
**Category:** FIX (Data Integrity)
**File:** `staff/snack/page.tsx`
**Severity:** MEDIUM

**Problem:** `fetchOrders` called via useEffect had no AbortController. Also has 30s polling interval. The `Button onClick={fetchOrders}` would pass the click event as the first argument after signature change.

**Root Cause:** Missing cleanup pattern for async data fetching in useEffect.

**Solution:**
- Added optional `signal?: AbortSignal` to fetchOrders
- Pass AbortController signal from initial useEffect call
- Cleanup aborts controller + clears interval
- Guard all setState with `signal?.aborted`
- Handle `CanceledError` in catch
- Wrapped button onClick: `onClick={() => fetchOrders()}`

### FIX-18B: WeatherWidget  Missing AbortController for Weather Fetch
**Category:** FIX (Data Integrity)
**File:** `components/WeatherWidget.tsx`
**Severity:** MEDIUM

**Problem:** useEffect fetches weather using bare `fetch()` with no AbortController. Also has 30min refresh interval. Navigating away mid-request could trigger setState on unmounted component.

**Root Cause:** Missing cleanup for async fetch in useEffect. Uses native `fetch` (not axios `api`), so AbortError handling differs.

**Solution:**
- Created AbortController in useEffect
- Pass `{ signal: controller.signal }` to `fetch()`
- Guard all setState calls with `controller.signal.aborted`
- Handle `AbortError` (native fetch error name, not `CanceledError`)
- Cleanup aborts controller + clears interval

### FIX-18C: Account Loyalty  Missing AbortController for 3 Parallel API Calls
**Category:** FIX (Data Integrity)
**File:** `account/loyalty/page.tsx`
**Severity:** MEDIUM

**Problem:** `loadData()` makes 3 parallel `api.get()` calls via `Promise.all` with no AbortController. Navigating away mid-request would trigger state updates.

**Root Cause:** Missing cleanup pattern. The 3 parallel calls (`/loyalty/me`, `/loyalty/me/transactions`, `/loyalty/tiers`) all need abort signal.

**Solution:**
- Inlined async fetch inside useEffect with AbortController
- Pass `{ signal: controller.signal }` to all 3 api.get() calls
- Guard setState with `controller.signal.aborted`
- Handle `CanceledError`
- Return `controller.abort()` on cleanup

## TypeScript Verification
- 0 errors in `staff/snack/page.tsx`
- 0 errors in `WeatherWidget.tsx`
- 0 errors in `account/loyalty/page.tsx`
