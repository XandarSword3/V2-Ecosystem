# Iteration 2 Analysis — Pool Module, Pluralization UX, Menu Loading

## Scope
- Pool page: dead code, inverted capacity bar, hardcoded English strings
- Cross-module: i18n pluralization ("1 items" → "1 item")
- Cross-module: Menu/data queries blocked until modules context loads (blank pages)

---

## Bugs Found

### BUG-2A: Menu/Data Queries Blocked by Module Context (HIGH)
- **Location:** `restaurant/page.tsx`, `pool/page.tsx`, `chalets/page.tsx`
- **Problem:** All three pages had `enabled: !!<module>` on their primary `useQuery`. The module comes from `useSiteSettings()` which fetches modules asynchronously. Until the modules API resolves, the query never fires — the page shows "No items found" or "No sessions available" instead of a loading state.
- **Impact:** Users visiting any of these pages see empty content for 1-3 seconds on every page load. No loading indicator shown.
- **Fix:** Removed the `enabled` guard. The `queryKey` already includes the module ID, so React Query automatically refetches when the ID changes from `undefined` to the real value.

### BUG-2B: Duplicate isLoading Block in Pool Page (MEDIUM)
- **Location:** `pool/page.tsx` lines 146-163
- **Problem:** Two consecutive `if (isLoading)` blocks — the first returns a simple spinner, the second (an enhanced animated version) is dead code that can never execute.
- **Fix:** Removed the first plain block, kept the styled animated version.

### BUG-2C: Inverted Capacity Progress Bar (LOW)
- **Location:** `pool/page.tsx` line ~400
- **Problem:** Capacity bar width was `(remaining / maxCapacity) * 100%` — a full bar meant all spots available. Users expect a progress bar to fill UP as spots are taken.
- **Fix:** Changed to `((maxCapacity - remaining) / maxCapacity) * 100%`.

### BUG-2D: Hardcoded English in Pool Info Section (LOW)
- **Location:** `pool/page.tsx` lines ~672-675
- **Problem:** "What to Bring" and "Amenities" content was hardcoded English strings instead of using the existing i18n keys `poolInfo.whatToBringList` and `poolInfo.amenitiesList`.
- **Fix:** Replaced with `t('poolInfo.whatToBringList')` and `t('poolInfo.amenitiesList')`.

### BUG-2E: Duplicate Module-Level cardVariants (LOW)
- **Location:** `pool/page.tsx` line ~65
- **Problem:** `cardVariants` was declared at module scope AND inside the component — the module-level one was shadowed and never used.
- **Fix:** Removed the module-level duplicate.

---

## Improvements Found

### IMPROVE-2A: Pluralization for Cart Item Count (MEDIUM)
- **Location:** `messages/en.json`, `de.json`, `fr.json`, `it.json`; `restaurant/components/FloatingCartBar.tsx`; `snack-bar/page.tsx`
- **Problem:** `itemsInCart` key was `"{count} items in cart"` — always plural. `common.items` was just `"items"`. Shows "1 items in cart" / "1 items".
- **Fix:** Converted both keys to ICU MessageFormat: `"{count, plural, one {# item in cart} other {# items in cart}}"`. Updated all 4 language files. Updated snack bar to pass `{ count: cartCount }`.

---

## Files Changed (10 files)
1. `frontend/src/app/pool/page.tsx` — 5 fixes (dead code, capacity bar, i18n, duplicate var, module guard)
2. `frontend/src/app/restaurant/page.tsx` — Removed enabled guard
3. `frontend/src/app/chalets/page.tsx` — Removed enabled guard
4. `frontend/src/app/snack-bar/page.tsx` — Added count param for pluralization
5. `frontend/messages/en.json` — ICU plural for itemsInCart + common.items
6. `frontend/messages/de.json` — ICU plural for itemsInCart + common.items
7. `frontend/messages/fr.json` — ICU plural for itemsInCart + common.items
8. `frontend/messages/it.json` — ICU plural for itemsInCart + common.items

## Deferred / Noted for Next Iteration
- `restaurant.spicy` i18n key missing (console error)
- Pool page has no max guest validation against remaining capacity
