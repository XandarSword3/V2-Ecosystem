# 1. Bug Fix: Hydration Error

## Problem

When navigating to the admin page (`/admin`), the user encountered:
- **Error:** "Expected server HTML to contain a matching `<main>` in `<div>`"
- **Symptom:** Offline page displayed instead of admin panel
- **Impact:** Admin panel completely inaccessible

## Root Cause Analysis

Three interacting issues were identified:

### Issue 1: Service Worker Navigation Handler
**File:** `frontend/public/sw.js`  
**Problem:** The `navigationHandler` function served the cached `/offline` page for ANY failed navigation request, even when the server was simply slow or recompiling in development.

### Issue 2: Nested `<main>` Elements
**File:** `frontend/src/app/admin/layout.tsx`  
**Problem:** The admin layout wrapped its content in a `<main>` element, but the root layout (`app/layout.tsx`) already provides a `<main>` wrapper. This created invalid `<main><main>` nesting, causing React's server-side HTML to mismatch the client-side hydration, triggering the hydration error.

### Issue 3: CSP Headers Too Strict
**File:** `frontend/next.config.mjs`  
**Problem:** Content Security Policy headers were blocking inline scripts required by Next.js framework, and WebSocket connections needed for HMR in development.

## Fixes Applied

### Fix 1 — Service Worker (`sw.js`)
```diff
- // Serve offline page for any failed navigation
- const offlineResponse = await caches.match(OFFLINE_URL);
- if (offlineResponse) {
-   return offlineResponse;
- }
+ // Try cached version of the SAME page first
+ const cachedResponse = await caches.match(request);
+ if (cachedResponse) {
+   return cachedResponse;
+ }
+ // Only serve offline page when genuinely offline
+ if (!self.navigator?.onLine) {
+   const offlineResponse = await caches.match(OFFLINE_URL);
+   if (offlineResponse) {
+     return offlineResponse;
+   }
+ }
```

### Fix 2 — Admin Layout (`admin/layout.tsx`)
```diff
- <main className="...">
+ <div className="...">
    {/* Admin content */}
- </main>
+ </div>
```
Changed nested `<main>` to `<div>` at lines 475 and 577.

### Fix 3 — CSP Headers (`next.config.mjs`)
```diff
- script-src 'self'
+ script-src 'self' 'unsafe-inline' (+ 'unsafe-eval' in dev)
  
- connect-src 'self'
+ connect-src 'self' ws: http://localhost:3005
```

## Verification Checklist

- [x] Frontend server starts without errors (port 3000)
- [x] Backend server accessible (port 3005)
- [x] Homepage loads with correct title "Azure Bay Resort | Luxury Experience"
- [x] Admin page redirects to `/login?redirect=/admin` (not logged in)
- [x] No CSP errors in console
- [x] Login with admin@v2resort.com / admin123 succeeds
- [x] Admin dashboard renders fully with sidebar
- [x] No hydration error in console
- [x] Loading animation shows correctly (2500ms)
- [x] No "You're Offline" page appearing incorrectly
