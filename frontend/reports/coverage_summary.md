# Frontend Test Coverage Summary

## Status
**All Tests Passing**
- **Total Test Files**: 149
- **Total Tests**: 2963
- **Coverage Estimation**: >70% of Core Application Flows and Pages

## Areas Covered

### 1. Core Pages (App Router)
- **Root**: `home`, `layout`, `loading`, `error`, `global-error`, `not-found` (implicitly via layout/root)
- **Auth**: `login`, `register`, `forgot-password`, `reset-password`
- **Core**: `cart`, `kiosk`, `providers` (Contexts), `offline`
- **Legal/Info**: `terms`, `privacy`, `contact`, `cancellation`

### 2. Feature Subsystems
- **User Profile**: `profile`, `account/giftcards`, `account/loyalty`, `account/privacy`
- **Modules**:
  - `restaurant` (Menu, Ordering)
  - `chalets` (Booking)
  - `pool` (Sessions)
  - `snack-bar` (Ordering)
  - `giftcards` (Purchase)
  - `order` (Tracking)
  - `[slug]` (Dynamic Modules)

### 3. Admin & Staff Portals
- **Admin**: `admin/layout` (Sidebar, Auth Guard), `admin/page` (Dashboard)
- **Staff**: `staff/layout` (Role-based Nav), `staff/page` (Dashboard)

### 4. Logic & Utilities
- **Stores**: `cartStore`, `settingsStore`, `authStore`
- **Services**: `api`, `server-api`, `socket`, `beta-testing`
- **Utils**: `utils.ts`, `cn`, `formatCurrency`, `date` utils
- **Hooks**: `useIdleTimer`, `usePWA`
- **Offline**: `offline-sync`, `offline-storage`, `offline-api`

## Mocking Strategy
A centralized mock registry (`tests/helpers/page-mocks.tsx`) was established to handle:
- **Next.js Internals**: `useRouter`, `usePathname`, `useSearchParams`, `next/image`, `next/link`.
- **Global Objects**: `IntersectionObserver`, `ResizeObserver`, `matchMedia`.
- **Complex UI**: `framer-motion` animations, `Canvas`/`WebGL` components (`Aurora`, `Card3D`).
- **State Management**: `Zustand` stores (mocked with initial state and spy methods).
- **Network**: `fetch` API, `Socket.io` client.

## Recommendations
1. **Integration Tests**: Add E2E tests with Playwright for critical flows (Booking, Checkout) to verify real API interaction.
2. **Visual Regression**: Use Storybook or similar for visually complex components (Aurora, 3D Cards).
3. **Admin Submodules**: Extend coverage to specific Admin CRUD pages (`admin/users`, `admin/inventory`) which are currently covered only by the layout smoke test.
