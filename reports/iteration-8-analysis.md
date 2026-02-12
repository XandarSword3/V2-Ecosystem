# Iteration 8 - Analysis

## Pages Tested
- `/chalets` - chalet cards, weekend rate display
- `/profile` - form inputs, icon button accessibility
- Kitchen display board component (`KitchenDisplayBoard.tsx`)

## Issues Found

### BUG-8A: Profile Page Missing Form Attributes + aria-label
- **Severity:** Medium (A11Y + autofill)
- **Location:** `frontend/src/app/profile/page.tsx`
- **Problem:** Three form inputs (full name, email, phone) missing `name` and `autoComplete` attributes. Icon-only camera button missing `aria-label`. Screen readers announce the button as unlabeled. Browsers cannot autofill fields without `name` attributes.
- **Fix:** Added `name` and `autoComplete` to all 3 inputs (name/name, email/email, phone/tel). Added `aria-label="Change profile photo"` to camera button.

### BUG-8B: KitchenDisplayBoard 3 Icon-only Buttons Missing aria-label
- **Severity:** Medium (A11Y)
- **Location:** `frontend/src/components/KitchenDisplayBoard.tsx`
- **Problem:** Three icon-only buttons (sound toggle, fullscreen, refresh) have no `aria-label`. Screen readers announce "button, button, button" with no indication of purpose.
- **Fix:** Added descriptive `aria-label` to all 3 buttons: "Mute sound"/"Enable sound" (dynamic), "Toggle fullscreen", "Refresh orders".

### IMPROVE-8A: Chalets (Fri-Sat) Hardcoded String
- **Severity:** Low (i18n)
- **Location:** `frontend/src/app/chalets/page.tsx` line 350
- **Problem:** Weekend rate notice showed `(Fri-Sat)` hardcoded in English after the per-night price.
- **Fix:** Added `weekendDays` i18n key to chalets namespace in all 4 locale files. Replaced hardcoded string with `t('weekendDays')`.

## Files Changed
| File | Change |
|------|--------|
| `frontend/src/app/profile/page.tsx` | aria-label + name/autoComplete on form inputs |
| `frontend/src/components/KitchenDisplayBoard.tsx` | 3 aria-labels on icon buttons |
| `frontend/src/app/chalets/page.tsx` | `(Fri-Sat)` to `t('weekendDays')` |
| `frontend/messages/{en,de,fr,it}.json` | +1 key each: weekendDays |
