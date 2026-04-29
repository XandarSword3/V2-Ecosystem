# Customer-facing page inventory (Tier 1–3)

This inventory lists **customer-facing** Next.js routes under `frontend/src/app/*` and maps shared layout ownership. It **excludes** `/admin/*` and `/staff/*`.

## Shared layout ownership

- **Global app shell**: `frontend/src/app/layout.tsx`
  - Renders `Header` (`frontend/src/components/layout/Header.tsx`)
  - Wraps pages with `PageTransition` (`frontend/src/components/effects/PageTransition.tsx`)
  - Renders `Footer` (`frontend/src/components/Footer.tsx`)
- **SEO wrapper layouts (customer)**:
  - Dynamic module wrapper: `frontend/src/app/[slug]/layout.tsx`
  - Restaurant wrapper: `frontend/src/app/restaurant/layout.tsx`
  - Pool wrapper: `frontend/src/app/pool/layout.tsx`
  - Snack bar wrapper: `frontend/src/app/snack-bar/layout.tsx`

## Tier 1 (conversion path)

- **Home**
  - `/` → `frontend/src/app/page.tsx`

- **Dynamic module funnel**
  - `/:slug` → `frontend/src/app/[slug]/page.tsx`
  - `/:slug/reserve` → `frontend/src/app/[slug]/reserve/page.tsx`
  - `/:slug/cart` → `frontend/src/app/[slug]/cart/page.tsx`
  - `/:slug/confirmation` → `frontend/src/app/[slug]/confirmation/page.tsx`
  - (supporting) `/:slug/waitlist` → `frontend/src/app/[slug]/waitlist/page.tsx`
  - (supporting) `/:slug/:unitId` → `frontend/src/app/[slug]/[unitId]/page.tsx`

- **Restaurant funnel (module hub + reserve/cart/confirmation)**
  - `/restaurant` → `frontend/src/app/restaurant/page.tsx`
  - `/restaurant/reserve` → `frontend/src/app/restaurant/reserve/page.tsx`
  - `/restaurant/cart` → `frontend/src/app/restaurant/cart/page.tsx`
  - `/restaurant/confirmation` → `frontend/src/app/restaurant/confirmation/page.tsx`
  - (supporting) `/restaurant/waitlist` → `frontend/src/app/restaurant/waitlist/page.tsx`

- **Snack bar funnel (module hub + cart/confirmation)**
  - `/snack-bar` → `frontend/src/app/snack-bar/page.tsx`
  - `/snack-bar/cart` → `frontend/src/app/snack-bar/cart/page.tsx`
  - `/snack-bar/confirmation` → `frontend/src/app/snack-bar/confirmation/page.tsx`

- **Chalets funnel (hub + unit detail + confirmation)**
  - `/chalets` → `frontend/src/app/chalets/page.tsx`
  - `/chalets/:id` → `frontend/src/app/chalets/[id]/page.tsx`
  - `/chalets/booking-confirmation` → `frontend/src/app/chalets/booking-confirmation/page.tsx`

- **Pool funnel**
  - `/pool` → `frontend/src/app/pool/page.tsx`
  - `/pool/confirmation` → `frontend/src/app/pool/confirmation/page.tsx`
  - (supporting) `/pool/membership` → `frontend/src/app/pool/membership/page.tsx`
  - (supporting) `/pool/memberships` → `frontend/src/app/pool/memberships/page.tsx`

## Tier 2 (trust + retention)

- **Gift cards**
  - `/giftcards` → `frontend/src/app/giftcards/page.tsx`

- **Account / profile**
  - `/profile` → `frontend/src/app/profile/page.tsx`
  - `/account/privacy` → `frontend/src/app/account/privacy/page.tsx`
  - `/account/loyalty` → `frontend/src/app/account/loyalty/page.tsx`

- **Auth**
  - `/login` → `frontend/src/app/login/page.tsx`
  - `/register` → `frontend/src/app/register/page.tsx`
  - `/forgot-password` → `frontend/src/app/forgot-password/page.tsx`
  - `/reset-password` → `frontend/src/app/reset-password/page.tsx`

## Tier 3 (support/legal/secondary)

- **Support**
  - `/contact` → `frontend/src/app/contact/page.tsx`

- **Legal**
  - `/privacy` → `frontend/src/app/privacy/page.tsx`
  - `/terms` → `frontend/src/app/terms/page.tsx`

## Unclassified / potentially customer-visible

These are present under `frontend/src/app/*` but may be operational or property-scoped:

- `/order` → `frontend/src/app/order/page.tsx`
- `/kiosk` → `frontend/src/app/kiosk/page.tsx`
- `/:slug/admin/settings/branding` → `frontend/src/app/[slug]/admin/settings/branding/page.tsx`
- `/:slug/admin/settings/email` → `frontend/src/app/[slug]/admin/settings/email/page.tsx`

