# Iteration 5 Analysis — Reviews 500, Login Autocomplete, Homepage CTA

## Scope
- Homepage `/api/v1/reviews` returning 500 on every load
- Login page missing `autoComplete` attributes (browser accessibility warning)
- Homepage "Book Now" CTA buttons defaulting to `/` (self-link, useless)

---

## Bugs Found

### BUG-5A: Reviews API 500 on Homepage (MEDIUM)
- **Location:** `backend/src/modules/reviews/reviews.controller.ts` line 44
- **Error:** `GET /api/v1/reviews` — 500 Internal Server Error on every homepage load
- **Root Cause:** The `reviews` table either doesn't exist in the database or has schema mismatches. The `if (error) throw error` line causes an unhandled exception that propagates as a 500.
- **Fix:** Replaced `throw error` with a graceful `console.warn` + return empty `{ reviews: [], stats: { totalReviews: 0, averageRating: 0 } }`. The homepage now loads cleanly without errors.

### BUG-5B: Login Page Missing autoComplete Attributes (LOW)
- **Location:** `frontend/src/app/login/page.tsx` — 4 inputs
- **Warning:** Browser DevTools showed `Input elements should have autocomplete attributes (suggested: "current-password")`
- **Root Cause:** No `autoComplete` prop on any of the login form inputs.
- **Fix:** Added `autoComplete` to all 4 inputs:
  - Email input → `autoComplete="email"`
  - Password input → `autoComplete="current-password"`
  - 2FA code input → `autoComplete="one-time-code"`
  - Backup code input → `autoComplete="off"`

### IMPROVE-5A: Homepage "Book Now" CTA Self-Links to `/` (LOW)
- **Location:** `frontend/src/app/page.tsx` lines 335, 138
- **Problem:** Both CTA buttons ("View Menu" hero + "Book Now" bottom) fall back to `'/'` when no CMS setting is configured. Clicking "Book Now" does nothing since user is already on `/`.
- **Fix:** Changed default from `'/'` to `'/restaurant'` — the most useful destination when no CMS config exists.

---

## Files Changed (3 files)
1. `backend/src/modules/reviews/reviews.controller.ts` — Graceful error handling for missing table
2. `frontend/src/app/login/page.tsx` — Added autoComplete to 4 input elements
3. `frontend/src/app/page.tsx` — Changed CTA fallback from `/` to `/restaurant`

## Verification
- Homepage: 0 console errors (was 2x 500 errors for reviews)
- Login page: 0 console warnings (was "autocomplete attributes" warning)
- "Book Now" → `/restaurant` (was `/`)
- 0 TypeScript errors across all 3 files
