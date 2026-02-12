# Iteration 3 Analysis — Missing i18n Key + Order Page Full i18n

## Scope
- Missing `restaurant.spicy` i18n key causing console errors
- Order page (`/order?table=N`) had 24 hardcoded English strings despite importing `useTranslations`
- Added 12 new translation keys across 4 locales (en, de, fr, it)

---

## Bugs Found

### BUG-3A: Missing `restaurant.spicy` i18n Key (MEDIUM)
- **Location:** `MenuItemCard.tsx` line 135 calls `t('spicy')` but the key didn't exist in the `restaurant` namespace
- **Console Error:** `IntlError: MISSING_MESSAGE: Could not resolve 'restaurant.spicy'`
- **Fix:** Added `"spicy"` key to all 4 locale files (en: "Spicy", de: "Scharf", fr: "Épicé", it: "Piccante")

---

## Improvements Found

### IMPROVE-3A: Order Page Full Internationalization (HIGH)
- **Location:** `frontend/src/app/order/page.tsx`
- **Problem:** 24 hardcoded English strings despite the file importing `useTranslations('restaurant')` and `useTranslations('common')`. Included toast messages, error text, button labels, form labels, placeholders, header text, badge text ("Spicy", "Featured", "Vegetarian"), and cart drawer text.
- **Audit Results:**
  - **13 strings** had exact matching keys already in the restaurant/common namespaces → wrapped with `t()` / `tc()`
  - **6 strings** had partial matches (different wording) → reused existing where semantically appropriate
  - **5 strings** had no existing key → created new keys in `restaurant.order.*` sub-namespace
- **New Keys Added (12):**
  - `order.failedToLoadMenu`, `order.invalidTable`, `order.invalidTableScanAgain`
  - `order.scanQRToOrder`, `order.goToRestaurant`, `order.submittedSuccessfully`
  - `order.failedToSubmit`, `order.noItemsInCategory`, `order.addToOrder`
  - `order.submitting`, `order.submitOrder`, `order.headerTitle`
- All new keys translated to German, French, and Italian

---

## Files Changed (5 files)
1. `frontend/src/app/order/page.tsx` — 22 edits replacing hardcoded strings with `t()`/`tc()` calls
2. `frontend/messages/en.json` — Added `spicy` key + 12 new `order.*` keys
3. `frontend/messages/de.json` — Added `spicy` key + 12 new `order.*` keys (German)
4. `frontend/messages/fr.json` — Added `spicy` key + 12 new `order.*` keys (French)
5. `frontend/messages/it.json` — Added `spicy` key + 12 new `order.*` keys (Italian)

## Verification
- Order page at `/order?table=5`: header shows "Iron Paradise Gym Restaurant", "Table 5" — i18n working
- Restaurant page: No more `IntlError: MISSING_MESSAGE` console errors
- 0 TypeScript errors in `order/page.tsx`
