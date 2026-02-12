# Iteration 7 - Analysis

## Pages Tested
- `/snack-bar` - full menu loaded (14 items, 4 categories)
- `/` - homepage footer verification
- `/restaurant/cart` - payment toast strings

## Issues Found

### BUG-7A: Footer Social Media Links Render href=""
- **Severity:** Medium
- **Location:** `frontend/src/components/Footer.tsx`
- **Problem:** When CMS `settings.footer` exists, the spread `...settings.footer` copies over CMS-provided `socials` array. If the CMS socials have empty URL strings, they render as `<a href="">` - creating self-links that reload the current page. The `footerConfig` merge logic had fallbacks for `logo`, `description`, `columns`, and `copyright` but NOT for `socials`.
- **Root Cause:** The `footerConfig` ternary applied `...settings.footer` first, then selectively overrode specific fields. Since `socials` was never overridden, it passed through whatever the CMS provided - including socials with empty or missing URLs.
- **Fix:** Added `normalizeSocials()` helper that: (1) falls back to `defaultFooterConfig.socials` when CMS socials are empty/undefined, and (2) filters out any social entry whose URL is blank. Explicitly set `socials: normalizeSocials(settings.footer.socials)` in `footerConfig`.

### BUG-7B: [slug]/cart Fires Two Toast Notifications on Order Success
- **Severity:** Medium
- **Location:** `frontend/src/app/[slug]/cart/page.tsx` lines 123-125
- **Problem:** The `onSuccess` callback in `orderMutation` called `toast.success()` twice:
  1. `toast.success(t('orderPlaced'))` - correct, i18n
  2. `toast.success('Order confirmed...')` - duplicate, hardcoded English
- **Root Cause:** Likely copy-paste from an earlier implementation that was partially migrated to i18n.
- **Fix:** Removed the second duplicate `toast.success()` call. Single i18n toast remains.

### IMPROVE-7A: Restaurant Cart Payment Toasts Hardcoded in English
- **Severity:** Low (i18n gap)
- **Location:** `frontend/src/app/restaurant/cart/page.tsx` lines 113, 185, 191
- **Problem:** Three payment-related toast messages were hardcoded English strings.
- **Fix:** Added 3 new i18n keys (`completeCardPayment`, `paymentFailed`, `paymentCancelled`) to the restaurant namespace in all 4 locale files (en, de, fr, it). Replaced hardcoded strings with `t()` calls.

## Files Changed
| File | Change |
|------|--------|
| `frontend/src/components/Footer.tsx` | Added `normalizeSocials()` + explicit socials fallback in `footerConfig` |
| `frontend/src/app/[slug]/cart/page.tsx` | Removed duplicate `toast.success()` |
| `frontend/src/app/restaurant/cart/page.tsx` | 3 hardcoded toasts  `t()` calls |
| `frontend/messages/en.json` | +3 keys: completeCardPayment, paymentFailed, paymentCancelled |
| `frontend/messages/de.json` | +3 keys (German translations) |
| `frontend/messages/fr.json` | +3 keys (French translations) |
| `frontend/messages/it.json` | +3 keys (Italian translations) |
