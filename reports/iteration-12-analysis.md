# Iteration 12  Analysis Report

## Date: 2025-01-27

## Issues Identified

### BUG-12A: Password Reset Pages Bypass API Client (HIGH)
- **Files:** `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- **Problem:** Both pages used raw `fetch()` with a hardcoded `API_URL` constant pointing to `/api/auth/...` paths. However, the backend expects `/api/v1/auth/...`. The app already has a properly configured `authApi` client in `lib/api.ts` that handles the correct base URL, retries, CSRF tokens, and credentials.
- **Impact:** Password reset flow completely broken  requests go to wrong endpoints. Users cannot recover accounts.
- **Fix:** Replaced raw `fetch()` calls with `authApi.forgotPassword(email)` and `authApi.resetPassword(token, password)`. Removed `API_URL` constants.

### BUG-12B: WeatherWidget Shows Fake Data Without Indicator (MEDIUM)
- **File:** `components/WeatherWidget.tsx`
- **Problem:** When the weather API fails (which is the default state since no weather API is configured), the widget silently falls back to "24C, Partly Cloudy"  completely fabricated data with no visual indicator that it's demo/fake data.
- **Impact:** Users see convincing but false weather information. Erodes trust if noticed.
- **Fix:** Added `isDemo: true` flag and changed fallback description to "Demo data  weather service unavailable" in both error fallback blocks.

### BUG-12C: authApi.resetPassword Sends Wrong Field Name (HIGH)
- **File:** `lib/api.ts`
- **Problem:** The `resetPassword` method in `authApi` sent `{ token, password }` but the backend `auth.controller.ts` destructures `{ token, newPassword }`. The field name mismatch means the backend never receives the new password.
- **Impact:** Even if BUG-12A were fixed alone, password reset would still fail due to this field name mismatch.
- **Fix:** Changed parameter name from `password` to `newPassword` and updated the request body accordingly.

### FIX-12D: Review Modal Missing Accessibility Attributes (MEDIUM)
- **File:** `components/TestimonialsCarousel.tsx`
- **Problem:** The review submission modal lacked `role="dialog"`, `aria-modal="true"`, `aria-label`, and Escape key handler. Screen readers couldn't identify it as a dialog, and keyboard users couldn't dismiss it.
- **Impact:** Accessibility violation  WCAG 2.1 AA non-compliance for modal dialogs.
- **Fix:** Added all required aria attributes and onKeyDown Escape handler to backdrop, plus aria-label to close button.

## Risk Assessment
- BUG-12A + 12C: Critical path fix  password recovery is a core auth feature
- BUG-12B: Low risk cosmetic improvement
- FIX-12D: Standard a11y improvement, no behavioral change
