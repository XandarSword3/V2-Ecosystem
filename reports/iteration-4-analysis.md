# Iteration 4 Analysis — SVG Path Errors + Footer Broken Links

## Scope
- Framer-motion SVG path animation causing console errors on every page (5 `<motion.path>` elements)
- Footer phone/email links broken (`tel:` and `mailto:` with empty values)
- LiveChatWidget had same broken link pattern

---

## Bugs Found

### BUG-4A: SVG Path Animation Errors on Every Page (MEDIUM)
- **Location:** `LoadingScreen.tsx` (4 paths) + `pool/page.tsx` (1 path)
- **Console Error:** `Error: <path> attribute d: Expected moveto path command ('M' or 'm'), "undefined"` — appeared on every single page load (6-10 errors per load)
- **Root Cause:** `<motion.path d="M0,80..." animate={{ d: [...] }}>` — framer-motion discards the static `d` prop in favor of creating a motion value for animation. Between the first render and first animation frame, the motion value is `undefined`, causing the browser to log an error.
- **Fix:** Changed all 5 instances from static `d` prop to `initial={{ d: "..." }}`, which keeps the value inside framer-motion's motion value system from the start.

### BUG-4B: Footer Phone/Email Links Broken (LOW)
- **Location:** `Footer.tsx` lines 270, 282; `LiveChatWidget.tsx` lines 206, 210
- **Problem:** `href={`tel:${settings.phone || ''}`}` — when settings haven't loaded, `settings.phone` is undefined, so href becomes `tel:` (empty protocol, broken link). But the display text uses `settings.phone || tFooter('phone')` which shows a phone number from translations.
- **Fix:** Made href use same fallback as display text: `tel:${settings.phone || tFooter('phone')}`.

---

## Files Changed (4 files)
1. `frontend/src/components/effects/LoadingScreen.tsx` — 4 `<motion.path>` fixes (static `d` → `initial={{ d: ... }}`)
2. `frontend/src/app/pool/page.tsx` — 1 `<motion.path>` fix
3. `frontend/src/components/Footer.tsx` — Phone/email href fallbacks
4. `frontend/src/components/LiveChatWidget.tsx` — Phone/email href fallbacks

## Verification
- **Console errors:** 0 errors on page load (was 6-10 per page)
- **Footer links:** `tel:+1 (555) GYM-LIFT` and `mailto:info@ironparadisegym.com` (was `tel:` and `mailto:` empty)
- **0 TypeScript errors** across all 4 files
