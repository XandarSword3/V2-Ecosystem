# Iteration 24 Analysis  i18n: Chalets Modal + Bookings Hardcoded Strings

## Findings

### IMPROVE-24A: staff/chalets/page.tsx  statusConfig i18n refactor
- **Issue:** statusConfig defined outside component with hardcoded English labels ('Pending', 'Confirmed', 'Checked In', etc.)  cannot use translation hooks outside components
- **Fix:** Split into statusConfigBase (colors/icons, outside component) + statusConfig (with i18n labels via tst(), inside component). Same pattern as staff/bookings/page.tsx
- **Impact:** All 6 status labels now use i18n  supports en/de/fr/it locales

### IMPROVE-24B: staff/chalets/page.tsx  Booking detail modal i18n (15 strings)
- **Issue:** 15 hardcoded English strings in the booking detail modal: Status, Dates, X Nights, Customer Information, Name, Email, Phone, Guests, Billing, Base Amount, Add-ons, Total, Payment Status, Pending (default), Special Requests
- **Fix:** Added 15 new i18n keys to staff.chalets namespace in all 4 locale files (en/de/fr/it). Replaced all hardcoded strings with tc() calls. Used ICU MessageFormat for Nights: '{count} Nights' / '{count} Naechte' etc.
- **Impact:** Entire booking detail modal is now fully translatable

### IMPROVE-24C: staff/bookings/page.tsx  Hardcoded strings i18n
- **Issue:** 'Unknown Chalet' fallback and 'guests' label hardcoded in English in the booking card grid
- **Fix:** Replaced 'Unknown Chalet' with tch('unknownChalet') and 'guests' with tb('guests'). Added unknownChalet key to staff.chalets in all 4 locales.
- **Impact:** Bookings page card data is now fully translatable

## New i18n Keys Added (all 4 locales)
staff.chalets: modalStatus, modalDates, modalNights, customerInfo, customerName, customerEmail, customerPhone, billing, baseAmount, addOns, total, paymentStatus, paymentPending, specialRequests, unknownChalet

## Files Changed
1. app/staff/chalets/page.tsx  statusConfig refactor + 15 modal string replacements
2. app/staff/bookings/page.tsx  2 string replacements
3. messages/{en,de,fr,it}.json  15 new keys each (60 total)
