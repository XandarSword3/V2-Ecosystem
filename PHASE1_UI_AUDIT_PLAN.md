# Phase 1 — UI/UX Enhancement Plan
## White-Label Resort Management System

**Status:** Planning Complete | **Awaiting Approval Before Implementation**

---

## Executive Summary

This plan provides a detailed audit and enhancement roadmap for all customer-facing pages. Every recommendation respects the white-label nature of the system — all visual changes use existing CSS variable systems (`var(--color-*)`, `bg-cms-*`, `text-cms-*`) and avoid hardcoded brand colors, specific imagery, or opinionated typography.

---

## 1. Responsiveness Audit

### 1.1 app/page.tsx (Homepage)
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Hero text `text-5xl md:text-7xl lg:text-8xl` causes overflow | Text cuts off on small screens |
| 320px–430px | Bento grid `auto-rows-[280px]` with 4 columns creates tiny cards | Unusable service cards |
| 320px–430px | Weather widget in `absolute top-4 right-4` overlaps hero text | Visual collision |
| 768px | Services grid uses `lg:grid-cols-4` leaving only 1 col at tablet | Excessive whitespace |
| 320px–430px | Floating decorative orbs (300px) overflow viewport | Horizontal scroll |
| All | Scroll indicator `bottom-12` obscured by mobile browser chrome | Users miss scroll cue |

**Proposed Fixes:**
- Add `text-4xl sm:text-5xl md:text-7xl` breakpoint chain to hero
- Change bento grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` with `auto-rows-min`
- Relocate weather widget to below hero text on mobile (<640px)
- Reduce orb sizes on mobile: `w-32 h-32 sm:w-48 sm:h-48`
- Move scroll indicator to `bottom-20` with `safe-bottom` padding

### 1.2 app/[slug]/page.tsx (Dynamic Module Renderer)
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | 404/disabled module state uses `max-w-md` but no padding | Text touches edges |
| 320px–430px | `text-6xl` for 404 number overflows | Layout break |
| All | No loading skeleton — just spinning loader | Perceived performance poor |

**Proposed Fixes:**
- Add `px-4` to Container in error states
- Change to `text-5xl sm:text-6xl` for 404 number
- Replace loader with module-specific skeleton component

### 1.3 app/[slug]/reserve/page.tsx (Reservation Flow)
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Time slot grid `grid-cols-4 md:grid-cols-6` has 4 cols on mobile | Buttons too narrow |
| 320px–430px | Party size buttons `[1-8]` wrap awkwardly with `flex-wrap` | 2 rows of buttons |
| 320px–430px | Date navigation chevrons too small for touch | 44px minimum not met |
| 768px | `Container size="md"` doesn't use full tablet width | Wasted space |

**Proposed Fixes:**
- Change time grid to `grid-cols-3 sm:grid-cols-4 md:grid-cols-6`
- Use horizontal scroll container for party size on mobile
- Increase chevron hit area to `min-w-[44px] min-h-[44px]`
- Use `size="lg"` for tablet breakpoint

### 1.4 app/[slug]/cart/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Order type selector (dine_in/takeaway/delivery) horizontal scroll | Hidden options |
| 320px–430px | Cart item quantities side-by-side compress | Hard to tap |
| 320px–430px | Payment method cards stack without gap | No visual separation |
| All | No sticky summary on mobile | Users scroll constantly |

**Proposed Fixes:**
- Convert order type to vertical stack with radio buttons on mobile
- Use vertical quantity stepper on mobile (<480px)
- Add `gap-3` between payment cards, increase to `p-4`
- Make order summary sticky on mobile with `sticky top-[header-height]`

### 1.5 app/[slug]/confirmation/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | QR code `w-40 h-40` may overflow narrow screens | Horizontal scroll |
| 320px–430px | Grid `grid-cols-2` for details too cramped | Text truncation |
| 320px–430px | Action buttons stack without gap | Touch target collision |

**Proposed Fixes:**
- Make QR code responsive: `w-32 h-32 sm:w-40 sm:h-40`
- Change to single column on mobile: `grid-cols-1 sm:grid-cols-2`
- Add `gap-3` between stacked buttons

### 1.6 app/[slug]/waitlist/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Status card `max-w-md` with no margin | Edge-to-edge text |
| 320px–430px | Status grid `space-y-3` with long labels | Misalignment |
| 768px | Join form `max-w-md` centered wastes tablet space | Excessive whitespace |

**Proposed Fixes:**
- Add `mx-4` to status card container
- Use flexbox with `justify-between` instead of grid for status items
- Expand to `max-w-lg` on tablet, add decorative elements

### 1.7 app/[slug]/[unitId]/page.tsx (Dynamic Unit Detail)
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Image gallery no swipe support | Mobile UX poor |
| 320px–430px | Date inputs side-by-side compress | Hard to tap |
| 320px–430px | Add-ons grid `grid-cols-2` too narrow | Text truncation |
| 768px | Pricing summary doesn't stick | Constant scroll |

**Proposed Fixes:**
- Add touch swipe to image gallery with Framer Motion drag
- Stack date inputs vertically on mobile with `flex-col`
- Use single column for add-ons on mobile
- Make pricing summary sticky on tablet+

### 1.8 app/restaurant/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Menu grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` only 1 col on mobile | Excessive scrolling |
| 320px–430px | Category filter horizontal scroll | Hidden categories |
| 320px–430px | Floating cart bar obscures content | Content inaccessible |
| 768px | Dietary filters inline compress | Touch targets small |

**Proposed Fixes:**
- Consider 2-col grid on mobile with smaller cards
- Make category filter a horizontal scroll with snap points
- Add `pb-20` to main content to account for cart bar
- Use dropdown for dietary filters on tablet

### 1.9 app/chalets/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Hero stats `flex-wrap justify-center` wraps to 3 rows | Excessive height |
| 320px–430px | Chalet cards `lg:grid-cols-2` single column but images `h-80` | Aspect ratio too tall |
| 320px–430px | Amenities `flex-wrap` can create 3+ rows | Card height inconsistent |
| 768px | Booking info grid `md:grid-cols-3` squeezes text | Readability poor |

**Proposed Fixes:**
- Reduce hero stats to single row on mobile with horizontal scroll
- Reduce image height to `h-56 sm:h-64 lg:h-80`
- Limit amenities to 3 with "+N more" pattern on mobile
- Use 2-col grid for booking info on tablet

### 1.10 app/pool/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Session cards `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` only 1 col | Excessive scrolling |
| 320px–430px | Guest counter side-by-side narrow | Hard to adjust |
| 320px–430px | Price display `text-3xl` overflows with currency symbol | Text wrap |
| 768px | Hero stats same issue as chalets | Layout break |

**Proposed Fixes:**
- Consider 2-col grid on mobile for sessions
- Stack guest counters vertically on mobile
- Use `text-2xl sm:text-3xl` for price
- Apply same hero stats fix as chalets

### 1.11 app/snack-bar/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Category tabs horizontal scroll with no indicator | Hidden categories |
| 320px–430px | Cart sidebar overlay doesn't cover full screen | Background visible |
| 320px–430px | Item cards have `h-48` image fixed | Aspect ratio issues |
| All | No pull-to-refresh | Mobile UX missing |

**Proposed Fixes:**
- Add fade indicator on right edge of tabs
- Make sidebar `inset-0` with `z-50` overlay
- Use `aspect-video` instead of fixed height
- Add pull-to-refresh with Framer Motion

### 1.12 app/profile/page.tsx
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Tabs `overflow-x-auto` with no scroll indicator | Hidden tabs |
| 320px–430px | Orders list table layout compresses | Text unreadable |
| 320px–430px | Form grid `grid-cols-2` too narrow | Input overflow |
| 768px | Avatar and form side-by-side compress | Touch targets small |

**Proposed Fixes:**
- Add scroll snap and indicator dots for tabs
- Convert orders to card list on mobile
- Use single column form on mobile
- Stack avatar above form on tablet

### 1.13 Auth Pages (login, register, forgot-password, reset-password)
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Card padding `p-8` excessive on small screens | Content cramped |
| 320px–430px | Logo "V2 Resort" hardcoded | White-label violation |
| 320px–430px | Input font size 16px causes zoom on iOS | UX issue |
| 768px | Centered card wastes tablet space | Could use side image |

**Proposed Fixes:**
- Reduce to `p-6 sm:p-8` on mobile
- Replace with dynamic logo from `useSiteSettings()`
- Use `text-base` (16px) minimum for inputs to prevent zoom
- Consider split layout on tablet with decorative pattern

### 1.14 Static Pages (giftcards, contact, privacy, terms)
**Current Issues:**
| Breakpoint | Problem | Impact |
|------------|---------|--------|
| 320px–430px | Contact form 2-col grid compresses | Input overflow |
| 320px–430px | Gift card templates horizontal scroll | Hidden options |
| 320px–430px | Legal pages `max-w-4xl` with no padding | Text touches edges |
| 768px | Gift card grid could be 2-col | Excessive scroll |

**Proposed Fixes:**
- Use single column form on mobile
- Add snap points and indicators to gift card scroll
- Add `px-4` to legal page containers
- Use 2-col grid for gift cards on tablet

---

## 2. Animation and Transition Plan

### 2.1 Page Transitions (Already Partially Implemented)
**Current State:** `PageTransition` wrapper exists in layout.tsx
**Issues:**
- No exit animations — pages snap away
- Direction not preserved (back navigation same as forward)
- Reduced motion not fully respected

**Proposed Enhancement:**
```typescript
// File: components/effects/PageTransition.tsx
// Use AnimatePresence with mode="popLayout"
// Track navigation direction in history state
// Apply slide-left for forward, slide-right for back
```
| Animation | Trigger | Duration | Easing |
|-----------|---------|----------|--------|
| Page enter | Route change | 400ms | `[0.25, 0.1, 0.25, 1]` |
| Page exit | Route change | 300ms | `[0.25, 0.1, 0.25, 1]` |
| Direction slide | Navigation | 400ms | `easeInOut` |

### 2.2 Loading Skeletons (New)
**Current State:** Spinners only (`Loader2`)
**Proposed Skeleton Components:**
| Page | Skeleton Pattern | Library |
|------|-----------------|---------|
| Restaurant menu | Shimmer cards in grid | Framer Motion + CSS |
| Chalets list | Image placeholder + text lines | Framer Motion |
| Pool sessions | Card pulses with shimmer | Framer Motion |
| Profile tabs | Content-aware shapes | Framer Motion |
| Cart | Item row placeholders | Framer Motion |

**Implementation:**
- Create `SkeletonCard`, `SkeletonText`, `SkeletonImage` primitives
- Use `animate-pulse` with `bg-cms-surface` colors
- Stagger with `delayChildren: 0.1`

### 2.3 Micro-interactions on Buttons/Cards
**Current State:** Some hover effects, inconsistent
**Proposed Uniform Micro-interactions:**
| Element | Trigger | Animation | Duration |
|---------|---------|-----------|----------|
| Primary buttons | Hover | Scale 1.02, shadow increase | 200ms |
| Primary buttons | Tap | Scale 0.98 | 100ms |
| Cards (all) | Hover | translateY(-4px), shadow-lg | 300ms |
| Cards | Tap | Scale 0.99 | 100ms |
| Add to cart | Click | Ripple + badge bounce | 400ms |
| Quantity +/- | Click | Scale bounce 1.2 → 1 | 200ms |
| Close/X buttons | Hover | Rotate 90deg | 200ms |

### 2.4 Scroll-Triggered Reveals
**Current State:** Some `whileInView` usage, inconsistent
**Proposed Enhancements:**
| Section | Animation | Threshold | Duration |
|---------|-----------|-----------|----------|
| Hero content | Stagger fade up | 0.2 | 600ms |
| Service cards | Stagger scale in | 0.1 | 400ms |
| Stats counters | Count up + fade | 0.3 | 800ms |
| Feature sections | Slide from side | 0.2 | 500ms |
| Footer | Fade in | 0.1 | 300ms |

### 2.5 Success/Error Feedback
**Current State:** `toast` from sonner, no inline animations
**Proposed Enhancements:**
| State | Animation | Duration |
|-------|-----------|----------|
| Form success | Green checkmark draw + confetti burst | 600ms |
| Form error | Shake + red flash | 400ms |
| Item added to cart | Cart icon bounce + number roll | 300ms |
| Booking confirmed | Checkmark circle expand | 500ms |

---

## 3. Visual Improvement Plan

### 3.1 Card Styling Standardization
**Current Issues:**
- Multiple card styles: `card`, `card-glass`, `SpotlightCard`, `FloatingCard`
- Inconsistent border-radius: `rounded-xl`, `rounded-2xl`, `rounded-3xl`
- Inconsistent shadows across modules

**Proposed Standard (White-Label Safe):**
```css
/* Base card — all cards extend this */
.card-base {
  @apply rounded-2xl;
  @apply bg-cms-surface;
  @apply border border-cms-border;
  @apply shadow-elevated;
  @apply transition-all duration-300;
}

/* Hover state */
.card-base:hover {
  @apply -translate-y-1;
  @apply shadow-elevated-lg;
}
```

**Files to Update:**
- `app/page.tsx`: Service cards → use `card-base`
- `app/chalets/page.tsx`: Chalet cards → use `card-base` with image overlay
- `app/pool/page.tsx`: Session cards → use `card-base`
- `app/restaurant/components/MenuItemCard.tsx`: Menu cards → use `card-base`

### 3.2 Spacing Standardization
**Current Issues:**
- Inconsistent section padding: `py-12`, `py-16`, `py-24`
- Inconsistent gap values: `gap-4`, `gap-6`, `gap-8` without system

**Proposed Spacing Scale (CSS Variables):**
```css
:root {
  --space-xs: 0.5rem;   /* 8px */
  --space-sm: 1rem;     /* 16px */
  --space-md: 1.5rem;   /* 24px */
  --space-lg: 2.5rem;   /* 40px */
  --space-xl: 4rem;     /* 64px */
  --space-section: var(--layout-section-y);
}
```

**Implementation:**
- Replace magic numbers with `space-y-[var(--space-md)]`
- Use consistent `gap-[var(--space-md)]` for grids

### 3.3 Visual Hierarchy Improvements
**Current Issues:**
- Heading sizes inconsistent across pages
- Some pages use `text-4xl` for H1, others `text-5xl`
- Secondary text colors not consistently using `text-cms-muted`

**Proposed Type Scale (Responsive):**
| Level | Mobile | Tablet | Desktop | Weight | Color |
|-------|--------|--------|---------|--------|-------|
| H1 | text-3xl | text-4xl | text-5xl | font-bold | text-cms-text |
| H2 | text-2xl | text-3xl | text-4xl | font-bold | text-cms-text |
| H3 | text-xl | text-2xl | text-3xl | font-semibold | text-cms-text |
| Body | text-base | text-base | text-base | font-normal | text-cms-muted |
| Small | text-sm | text-sm | text-sm | font-medium | text-cms-muted |

### 3.4 Hover States
**Current State:** Some elements have hover, many don't
**Proposed Uniform Hover System:**
| Element | Hover Effect | CSS |
|---------|--------------|-----|
| All cards | Lift + shadow | `hover:-translate-y-1 hover:shadow-lg` |
| All buttons | Brightness + slight scale | `hover:brightness-110 hover:scale-[1.02]` |
| Links | Underline slide | `hover:underline underline-offset-4` |
| Images | Slight zoom | `hover:scale-105` with overflow-hidden container |
| Nav items | Background pill | `hover:bg-cms-surface-secondary` |

### 3.5 Empty States
**Current Issues:**
- Empty states vary wildly across pages
- Some show text only, some show icon + text
- No consistent CTA in empty states

**Proposed Empty State Component:**
```typescript
// File: components/ui/EmptyState.tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}
```
**Files to Update:**
- `app/chalets/page.tsx`: "No chalets available"
- `app/restaurant/page.tsx`: "No items found"
- `app/profile/page.tsx`: Empty orders/bookings/tickets
- `app/[slug]/cart/page.tsx`: Empty cart

### 3.6 Error States
**Current Issues:**
- Error boundaries use generic Next.js error
- API errors show raw text or toast only
- No retry mechanisms

**Proposed Error State Component:**
```typescript
// File: components/ui/ErrorState.tsx
interface ErrorStateProps {
  title: string;
  description: string;
  retry?: () => void;
  homeLink?: boolean;
}
```
**Files to Update:**
- `app/error.tsx`: Global error boundary
- `app/[slug]/page.tsx`: Module not found
- All API error states in pages

---

## 4. Interactivity Improvements

### 4.1 Optimistic UI Updates
**Current State:** Most operations wait for API response
**Proposed Optimistic Updates:**
| Operation | Current | Proposed |
|-----------|---------|----------|
| Add to cart | Wait for API | Update UI immediately, rollback on error |
| Update quantity | Wait for API | Update immediately, sync in background |
| Remove from cart | Wait for API | Fade out immediately, restore on error |
| Join waitlist | Wait for API | Show position immediately, adjust on confirm |

**Implementation:**
- Use React Query `optimisticData` pattern
- Add rollback on error
- Show subtle sync indicator

### 4.2 Button Loading States
**Current State:** Most buttons lack loading state
**Proposed Implementation:**
| Button Type | Loading State |
|-------------|---------------|
| Primary | Spinner replaces text, disabled |
| Secondary | Spinner + reduced opacity |
| Icon only | Spinner replaces icon |
| Ghost | Spinner + text fades |

**Files to Update:**
- All form submit buttons
- Cart quantity buttons
- Waitlist join button
- Gift card purchase buttons

### 4.3 Form Validation Feedback
**Current State:** Most forms show errors only on submit
**Proposed Real-time Validation:**
| Field | Validation | Feedback |
|-------|------------|----------|
| Email | Regex on blur | Inline error message |
| Phone | Format on blur | Auto-format + error |
| Required | On blur | Red border + message |
| Date range | Logic check | Inline error if invalid |

**Files to Update:**
- `app/[slug]/reserve/page.tsx`: Reservation form
- `app/[slug]/[unitId]/page.tsx`: Booking form
- `app/contact/page.tsx`: Contact form
- `app/giftcards/page.tsx`: Gift card form

### 4.4 Toast Positioning
**Current State:** `position={isRtl ? 'top-left' : 'top-right'}` in layout
**Issues:**
- Mobile: toasts can cover navigation
- No stacking animation
- Duration inconsistent

**Proposed Toast System:**
| Breakpoint | Position | Duration |
|------------|----------|----------|
| Mobile | Bottom center | 4s |
| Tablet+ | Top right (LTR) / Top left (RTL) | 5s |
| Error | Stays until dismissed | Infinite |
| Success | Auto-dismiss | 3s |

### 4.5 Skeleton vs Spinner Strategy
**Current State:** Spinners everywhere
**Proposed Strategy:**
| Load Time | Component |
|-----------|-----------|
| <300ms | Spinner (current) |
| 300ms–2s | Skeleton |
| >2s | Skeleton with progress hint |

**Implementation:**
- Create `SmartLoading` component that switches based on estimated load time
- Use React Query `isLoading` vs `isFetching` distinction

---

## 5. Shared Component Opportunities

### 5.1 Component Audit
**Current Duplicated Patterns:**

| Pattern | Current Locations | Proposed Component |
|---------|-------------------|-------------------|
| Hero section with gradient + stats | chalets, pool, home | `HeroSection` |
| Module card (image + content + CTA) | chalets, [slug]/[unitId] | `ModuleCard` |
| Booking form with date picker | [slug]/reserve, [slug]/[unitId] | `BookingForm` |
| Cart summary with pricing | [slug]/cart, restaurant/cart | `CartSummary` |
| Confirmation success screen | [slug]/confirmation, */confirmation | `ConfirmationView` |
| Empty state with icon + text | Multiple pages | `EmptyState` |
| Error state with retry | Multiple pages | `ErrorState` |
| Quantity stepper | Multiple cart pages | `QuantityStepper` |
| Price display with currency | All pages | `PriceDisplay` |
| Status badge | profile, confirmations | `StatusBadge` |

### 5.2 Proposed New Shared Components

#### 5.2.1 HeroSection
```typescript
// File: components/layout/HeroSection.tsx
interface HeroSectionProps {
  title: string;
  subtitle?: string;
  stats?: { label: string; value: number | string; suffix?: string }[];
  background: 'gradient' | 'image' | 'aurora';
  gradientColors?: [string, string, string?];
  imageUrl?: string;
  children?: React.ReactNode;
}
```
**Replaces:** Hero sections in `app/page.tsx`, `app/chalets/page.tsx`, `app/pool/page.tsx`

#### 5.2.2 ModuleCard
```typescript
// File: components/cards/ModuleCard.tsx
interface ModuleCardProps {
  imageUrl?: string;
  fallbackIcon: LucideIcon;
  title: string;
  description?: string;
  price?: { amount: number; unit: 'per_night' | 'per_session' | 'per_item' };
  badges?: string[];
  amenities?: string[];
  href: string;
  featured?: boolean;
}
```
**Replaces:** Chalet cards, unit cards, session cards

#### 5.2.3 BookingForm
```typescript
// File: components/forms/BookingForm.tsx
interface BookingFormProps {
  type: 'reservation' | 'multi_day' | 'session';
  onSubmit: (data: BookingData) => void;
  availableDates?: Date[];
  capacity?: number;
  pricing?: PricingInfo;
}
```
**Replaces:** Date/time selection forms in reserve, unit detail pages

#### 5.2.4 CartSummary
```typescript
// File: components/cart/CartSummary.tsx
interface CartSummaryProps {
  items: CartItem[];
  taxRate: number;
  serviceChargeRate?: number;
  deliveryFee?: number;
  discounts?: Discount[];
  onCheckout: () => void;
}
```
**Replaces:** Cart calculation logic duplicated across cart pages

#### 5.2.5 ConfirmationView
```typescript
// File: components/confirmation/ConfirmationView.tsx
interface ConfirmationViewProps {
  type: 'order' | 'booking' | 'ticket' | 'waitlist';
  data: ConfirmationData;
  qrCode?: string;
  actions: { label: string; href: string; variant: ButtonVariant }[];
}
```
**Replaces:** All confirmation page UIs

#### 5.2.6 EmptyState
```typescript
// File: components/ui/EmptyState.tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
```
**Replaces:** All empty list states

#### 5.2.7 ErrorState
```typescript
// File: components/ui/ErrorState.tsx
interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error;
  retry?: () => void;
  homeLink?: boolean;
}
```
**Replaces:** All error displays

#### 5.2.8 QuantityStepper
```typescript
// File: components/ui/QuantityStepper.tsx
interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}
```
**Replaces:** All +/- quantity controls

#### 5.2.9 PriceDisplay
```typescript
// File: components/ui/PriceDisplay.tsx
interface PriceDisplayProps {
  amount: number;
  currency: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDecimals?: boolean;
  originalAmount?: number; // For strikethrough
}
```
**Replaces:** All price formatting

#### 5.2.10 StatusBadge
```typescript
// File: components/ui/StatusBadge.tsx
type StatusType = 'pending' | 'confirmed' | 'preparing' | 'ready' | 
                  'completed' | 'cancelled' | 'valid' | 'used' | 
                  'waiting' | 'notified' | 'seated';
interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}
```
**Replaces:** All status displays with consistent colors

---

## 6. Implementation Priority

### Phase 1A — Foundation (Week 1)
1. Create shared components (EmptyState, ErrorState, LoadingSkeletons)
2. Implement responsive breakpoints audit fixes
3. Standardize card styling

### Phase 1B — Interactivity (Week 2)
1. Add optimistic UI to cart operations
2. Implement button loading states
3. Add form validation feedback

### Phase 1C — Polish (Week 3)
1. Implement animation enhancements
2. Add micro-interactions
3. Visual hierarchy standardization

---

## 7. White-Label Compliance Checklist

- [ ] No hardcoded brand colors (use `var(--color-*)`)
- [ ] No hardcoded logo text (use `settings.resortName`)
- [ ] No hardcoded contact info (use `settings`)
- [ ] No hardcoded images (use CMS or placeholders)
- [ ] All gradients use theme variables
- [ ] All animations respect `prefers-reduced-motion`
- [ ] All text uses i18n translation keys

---

## 8. Files Affected Summary

### High Priority (Core Experience)
| File | Changes |
|------|---------|
| `app/layout.tsx` | Toast positioning, PageTransition enhancement |
| `app/page.tsx` | Responsive fixes, animation standardization |
| `app/[slug]/page.tsx` | Skeleton loading, responsive fixes |
| `app/[slug]/cart/page.tsx` | Optimistic UI, sticky summary |
| `app/[slug]/confirmation/page.tsx` | Shared ConfirmationView |
| `components/ui/Button.tsx` | Loading state enhancement |

### Medium Priority (Module Pages)
| File | Changes |
|------|---------|
| `app/restaurant/page.tsx` | Card standardization, filter UX |
| `app/chalets/page.tsx` | HeroSection shared component |
| `app/pool/page.tsx` | HeroSection shared component |
| `app/snack-bar/page.tsx` | Responsive category tabs |
| `app/profile/page.tsx` | Tab scroll indicators, card list |

### Lower Priority (Static/Auth)
| File | Changes |
|------|---------|
| `app/login/page.tsx` | Dynamic logo, responsive padding |
| `app/register/page.tsx` | Form validation, dynamic logo |
| `app/forgot-password/page.tsx` | Dynamic logo |
| `app/reset-password/page.tsx` | Dynamic logo |
| `app/giftcards/page.tsx` | Responsive grid, scroll indicators |
| `app/contact/page.tsx` | Form validation |
| `app/privacy/page.tsx` | Responsive padding |
| `app/terms/page.tsx` | Responsive padding |

---

## 9. Main Animations — Ambitious Motion Systems

### 9.1 Initial Loading Screen

**Component Location:** `components/effects/LoadingScreen.tsx`  
**Mount Point:** `app/layout.tsx` (wraps children, conditionally renders based on app ready state)  
**Dependencies:** None (purely visual, receives `isReady` and `resortName` as props)

#### 9.1.1 Concept Overview
A cinematic, full-screen loading experience that transforms the anxiety of waiting into anticipation of arrival. The sequence creates a sense of "entering a destination" — mirroring the resort/hospitality context where first impressions define the entire experience.

#### 9.1.2 Visual Architecture

**Stage 1 — Void (0ms–200ms)**
- Pure `var(--color-background)` fills screen
- Subtle noise texture overlay at 3% opacity (CSS `noise-filter` or SVG pattern)
- No content visible — creating moment of anticipation

**Stage 2 — Geometric Birth (200ms–800ms)**
- **Orbital Ring System:** Three concentric rings (200px, 300px, 400px diameter) materialize at screen center
- Each ring composed of 12–16 segmented arcs (SVG paths)
- **Animation:** Rings scale from 0 → 1 with staggered delays (0ms, 100ms, 200ms)
- **Easing:** `[0.22, 1, 0.36, 1]` (ease-out-expo)
- **Duration:** 600ms each
- **Color:** Ring strokes use `var(--color-primary)` at 60%, 40%, 20% opacity respectively
- **Motion:** Subtle continuous rotation begins (clockwise, counter-clockwise, clockwise) at different speeds (30s, 45s, 60s per revolution)

**Stage 3 — Aurora Field Emerges (400ms–1200ms)**
- **Background Layer:** Three massive radial gradients (800px–1200px diameter) positioned off-center
- Colors: `var(--color-primary)` at 20% opacity → `var(--color-secondary)` at 15% → transparent
- **Animation:** Gradients drift in circular paths using Framer Motion `animate` with infinite loop
- **Path:** Elliptical orbit around center, 20px radius, 30s duration
- Each gradient offset by 120° in their orbit timing
- Creates living, breathing atmosphere behind the rings

**Stage 4 — Typography Reveal (800ms–1600ms)**
**Challenge:** `resortName` from `useSiteSettings()` may not be available immediately

**Interim State (800ms–1200ms while name loads):**
- Generic welcome message: "Welcome" or "Entering..."
- Text uses `var(--color-text-muted)`
- **Animation:** Letters fade in with stagger (30ms per character)
- Font: System font stack, `font-weight: 300`, `font-size: 1.5rem`

**Resort Name State (1200ms onward, or immediate if settings cached):**
- Resort name appears at center, replacing interim text
- **Animation:** Each character cascades in from below
  - Initial: `opacity: 0`, `y: 20`, `rotateX: -90deg`
  - Final: `opacity: 1`, `y: 0`, `rotateX: 0`
- **Stagger:** 40ms per character
- **Easing:** `[0.215, 0.61, 0.355, 1]` (ease-out-cubic)
- **Duration:** 500ms per character
- **Typography:** `font-size: 2.5rem`, `font-weight: 600`, `letter-spacing: 0.05em`
- **Color:** `var(--color-text)`

**Stage 5 — Ambient Flourish (1600ms–exit)**
- **Particle Constellation:** 20–30 small dots (4px diameter) fade in around periphery
- Particles use `var(--color-accent)` at 50% opacity
- **Animation:** Gentle floating motion, each particle on unique sine wave path
- **Interaction:** Particles subtly gravitate toward cursor (CSS `transform` on `:hover` via CSS custom properties, not JS tracking)
- **Duration:** Continuous while loading screen visible

#### 9.1.3 Exit Animation Sequence (App Ready)

**Trigger:** `isReady` prop transitions from `false` → `true`

**Phase 1 — Hold (0ms–300ms)**
- Loading screen holds steady, all animations continue
- Creates psychological "completion moment" — user feels the system has "arrived"

**Phase 2 — Converge (300ms–800ms)**
- **Rings:** Scale up to 150% while fading out
- **Aurora gradients:** Contract to center, intensify to 80% opacity briefly, then fade
- **Typography:** Resort name splits — odd characters rise, even characters fall
  - Odd: `y: -100vh`, `opacity: 0`
  - Even: `y: 100vh`, `opacity: 0`
- **Easing:** `[0.55, 0.055, 0.675, 0.19]` (ease-in-cubic) — accelerates away
- **Duration:** 500ms

**Phase 3 — Dissolve (800ms–1200ms)**
- Entire loading screen fades to `var(--color-background)`
- **Opacity:** 1 → 0
- **Duration:** 400ms
- **Easing:** `ease-out`

**Phase 4 — Handoff (1200ms)**
- Loading screen unmounts
- Main content already rendered beneath (via `position: fixed` z-index layering)
- Optional: Main content subtle entrance — scale from 0.98 → 1, opacity 0.9 → 1 (200ms)

#### 9.1.4 Technical Specification

```typescript
// File: components/effects/LoadingScreen.tsx

interface LoadingScreenProps {
  isReady: boolean;
  resortName?: string;
  interimMessage?: string; // Fallback while name loads
}

// Animation Variants (Framer Motion)
const ringVariants = {
  hidden: { scale: 0, opacity: 0, rotate: -180 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1 - i * 0.2, // 1, 0.8, 0.6
    rotate: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }),
  exit: (i: number) => ({
    scale: 1.5,
    opacity: 0,
    rotate: i % 2 === 0 ? 90 : -90,
    transition: { duration: 0.5, ease: [0.55, 0.055, 0.675, 0.19] }
  })
};

const auroraVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 0.2 - i * 0.05,
    transition: {
      delay: 0.4 + i * 0.1,
      duration: 0.8,
      ease: "easeOut"
    }
  }),
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.5 }
  }
};

const characterVariants = {
  hidden: { opacity: 0, y: 20, rotateX: -90 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      delay: 0.8 + i * 0.04,
      duration: 0.5,
      ease: [0.215, 0.61, 0.355, 1]
    }
  }),
  exit: (i: number) => ({
    opacity: 0,
    y: i % 2 === 0 ? -1000 : 1000,
    transition: { duration: 0.5, ease: [0.55, 0.055, 0.675, 0.19] }
  })
};
```

#### 9.1.5 Reduced Motion Fallback

```css
@media (prefers-reduced-motion: reduce) {
  .loading-screen {
    /* Skip all geometric animations */
    /* Show simple spinner only */
    /* Fade in/out only, no transforms */
  }
}
```

**Behavior:**
- Rings: Static, no rotation, no scale animation
- Aurora: Static gradients, no drift
- Typography: Simple fade in/out, no character animation
- Exit: Simple opacity fade (300ms)

---

### 9.2 Module Transition System

**Component Location:** `components/effects/ModuleTransition.tsx` (extends/replaces `PageTransition.tsx`)  
**Mount Point:** `app/layout.tsx` (wraps page content)  
**Dependencies:** Requires access to current route and previous route (passed as props from layout, no router logic changes)

#### 9.2.1 Concept Overview

**Core Philosophy:** Each module (restaurant, pool, chalets, snack-bar, etc.) exists as a distinct "atmosphere" — moving between them should feel like stepping through a doorway into a different environment. The transition becomes a narrative device that reinforces the modular nature of the resort experience.

**Visual Metaphor:** The "Curtain of Atmosphere" — a dimensional wipe that carries the essence of the departing module while revealing the essence of the arriving module.

#### 9.2.2 Route-to-Atmosphere Mapping (White-Label Safe)

Since the system cannot know module identities in advance, it derives "atmosphere signatures" from route patterns:

| Route Pattern | Atmosphere Signature | Primary Color | Secondary Color | Texture |
|-------------|---------------------|---------------|-----------------|---------|
| `/` (home) | "Resort Core" | `var(--color-primary)` | `var(--color-secondary)` | Subtle grain |
| `/restaurant/*` | "Culinary Warmth" | `var(--color-accent)` (warm shift) | `var(--color-primary)` | Soft noise |
| `/pool/*` | "Aquatic Refresh" | `var(--color-secondary)` | `var(--color-primary)` | Wave distortion |
| `/chalets/*` | "Sanctuary Calm" | `var(--color-primary)` (cool shift) | `var(--color-surface)` | Fabric texture |
| `/snack-bar/*` | "Casual Energy" | `var(--color-accent)` | `var(--color-secondary)` | Dot pattern |
| `/[slug]/*` (dynamic) | "Discovery" | Blend of primary + accent | `var(--color-secondary)` | Geometric |
| Auth pages | "Portal" | `var(--color-primary)` | `var(--color-text-muted)` | Minimal |

**Color Shifts:** Achieved via CSS `color-mix()` — no hardcoded values:
```css
.warm-shift {
  color: color-mix(in srgb, var(--color-accent) 70%, var(--color-primary) 30%);
}
.cool-shift {
  color: color-mix(in srgb, var(--color-primary) 80%, var(--color-secondary) 20%);
}
```

#### 9.2.3 Transition Architecture

**Phase Structure — All Transitions Follow This Pattern:**

**P1 — Anticipation (0ms–200ms)**
- Current page content subtly responds to navigation intent
- **Effect:** Content scales to 0.98, opacity reduces to 0.9
- **Purpose:** Signals "something is happening" before the transition dominates

**P2 — The Curtain Descends (200ms–600ms)**
- **Visual:** Full-screen overlay emerges from the "direction of travel"
- Direction logic:
  - Forward navigation (deeper into site): Curtain flows from right (LTR) / left (RTL)
  - Back navigation: Curtain flows from left (LTR) / right (RTL)
  - Same-level navigation: Curtain flows from bottom
- **Texture:** The overlay carries the "atmosphere signature" of the **departing** module
  - Gradient using departing module's colors
  - Subtle animated texture (CSS only, no JS animation loops)
- **Animation:** 
  - Curtain expands from origin point to fill screen
  - Origin: Center-right for forward, center-left for back, bottom-center for same-level
  - Uses `clip-path` or `scale` with `transform-origin`
  - **Duration:** 400ms
  - **Easing:** `[0.77, 0, 0.175, 1]` (ease-in-out-quart)

**P3 — The Atmosphere Shift (600ms–800ms)**
- Curtain briefly holds at full screen (100ms)
- Colors subtly shift from departing to arriving signature
- **Effect:** Color crossfade using CSS `transition` on background gradients
- **Duration:** 200ms

**P4 — The Reveal (800ms–1200ms)**
- Curtain retreats in opposite direction, revealing new page
- New page content already present underneath, static
- **Direction:** Reveal follows reverse path of descent
- **Animation:**
  - Curtain contracts toward destination edge
  - New page content scales from 0.98 → 1, opacity 0.9 → 1 (subtle entrance)
  - **Duration:** 400ms
  - **Easing:** `[0.22, 1, 0.36, 1]` (ease-out-expo)

**P5 — Stabilization (1200ms–1400ms)**
- Any remaining transition elements fade completely
- New page settles to full opacity and scale 1
- **Duration:** 200ms

**Total Transition Time:** 1400ms (feels substantial but not slow)

#### 9.2.4 Distinct Module Signature Effects

Each module type has a subtle "signature motion" within the curtain:

**Restaurant — "Steam Rise"**
- During P2–P3, subtle vertical wisps (SVG paths) rise through the curtain
- Wisps: `var(--color-accent)` at 20% opacity
- Motion: Slow upward drift (CSS animation, 10s loop)
- Reduced motion: Static wisps, no drift

**Pool — "Ripple Spread"**
- During P2, concentric circles expand from curtain origin point
- Circles: `var(--color-secondary)` stroke at 30% opacity
- Motion: Scale 0 → 2, fade out
- **Animation:** 3–4 ripples, staggered 150ms apart
- Reduced motion: Single static circle outline

**Chalets — "Forest Breeze"**
- During P2–P3, subtle horizontal drift of organic shapes
- Shapes: Abstract leaf/tree forms, `var(--color-primary)` at 15%
- Motion: Slow horizontal translation (CSS animation)
- Reduced motion: Static organic pattern

**Snack Bar — "Pop Fizz"**
- During P2, small circles "pop" into existence and fade
- 8–12 circles, random positions within curtain
- Motion: Scale 0 → 1 → 0, opacity 0 → 1 → 0
- **Duration:** 300ms each
- **Stagger:** Randomized 0–200ms
- Reduced motion: Single central circle, no pop animation

**Home/Resort Core — "Horizon Glow"**
- During P2, horizontal band of intensified color at center
- Band: `var(--color-primary)` at 40% opacity
- Motion: Subtle vertical breathe (scale Y 1 → 1.05 → 1)
- Reduced motion: Static horizontal band

**Dynamic Modules — "Constellation Connect"**
- During P2, random dots appear and connect with lines
- Dots: `var(--color-accent)` at 50%
- Lines: `var(--color-primary)` at 20%
- Motion: Lines draw between dots (SVG stroke-dashoffset)
- Reduced motion: Static constellation pattern

#### 9.2.5 Technical Specification

```typescript
// File: components/effects/ModuleTransition.tsx

interface ModuleTransitionProps {
  children: React.ReactNode;
  currentRoute: string;
  previousRoute?: string;
  direction: 'forward' | 'back' | 'same';
}

// Atmosphere signature resolver
const getAtmosphere = (route: string): Atmosphere => {
  if (route.startsWith('/restaurant')) return 'culinary';
  if (route.startsWith('/pool')) return 'aquatic';
  if (route.startsWith('/chalets')) return 'sanctuary';
  if (route.startsWith('/snack-bar')) return 'casual';
  if (route === '/' || route === '') return 'core';
  if (route.startsWith('/login') || route.startsWith('/register')) return 'portal';
  return 'discovery'; // Dynamic [slug] routes
};

// Animation variants
const curtainVariants = {
  // Forward navigation - curtain from right
  forwardEnter: {
    clipPath: 'circle(0% at 100% 50%)',
    opacity: 1
  },
  forwardVisible: {
    clipPath: 'circle(150% at 100% 50%)',
    transition: { duration: 0.4, ease: [0.77, 0, 0.175, 1] }
  },
  forwardExit: {
    clipPath: 'circle(0% at 0% 50%)',
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }
  },
  
  // Back navigation - curtain from left
  backEnter: {
    clipPath: 'circle(0% at 0% 50%)',
    opacity: 1
  },
  backVisible: {
    clipPath: 'circle(150% at 0% 50%)',
    transition: { duration: 0.4, ease: [0.77, 0, 0.175, 1] }
  },
  backExit: {
    clipPath: 'circle(0% at 100% 50%)',
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }
  },
  
  // Same-level - curtain from bottom
  sameEnter: {
    clipPath: 'circle(0% at 50% 100%)',
    opacity: 1
  },
  sameVisible: {
    clipPath: 'circle(150% at 50% 100%)',
    transition: { duration: 0.4, ease: [0.77, 0, 0.175, 1] }
  },
  sameExit: {
    clipPath: 'circle(0% at 50% 0%)',
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }
  }
};

const contentVariants = {
  initial: { scale: 0.98, opacity: 0.9 },
  animate: { 
    scale: 1, 
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.4 }
  },
  exit: { 
    scale: 0.98, 
    opacity: 0.9,
    transition: { duration: 0.2 }
  }
};
```

#### 9.2.6 Curtain Component Structure

```tsx
// Pseudostructure for curtain overlay
<motion.div
  className="fixed inset-0 z-50 pointer-events-none"
  style={{
    background: `radial-gradient(circle at center, ${atmosphere.primary} 0%, ${atmosphere.secondary} 100%)`,
  }}
  variants={curtainVariants}
  initial={`${direction}Enter`}
  animate={`${direction}Visible`}
  exit={`${direction}Exit`}
>
  {/* Module signature effect layer */}
  <div className="absolute inset-0 overflow-hidden">
    {atmosphere.type === 'aquatic' && <RippleEffect />}
    {atmosphere.type === 'culinary' && <SteamWisps />}
    {atmosphere.type === 'sanctuary' && <ForestDrift />}
    {atmosphere.type === 'casual' && <PopFizz />}
    {atmosphere.type === 'core' && <HorizonGlow />}
    {atmosphere.type === 'discovery' && <ConstellationConnect />}
  </div>
</motion.div>
```

#### 9.2.7 Edge Case Handling

**Interrupted Transitions:**
- If user navigates again during transition (rapid clicking):
  - Current transition completes to "atmosphere shift" phase (P3)
  - New transition begins from P3 state (curtain already full screen)
  - Prevents visual chaos, maintains smooth experience

**Slow Connections:**
- Transition timing is fixed to animation, not data loading
- Content may still be loading when reveal completes
- Loading skeletons (from Section 2.2) appear within revealed page
- Transition doesn't wait for data — purely visual layer

**Back Navigation:**
- Detected via browser back button or in-app back links
- Direction prop set to 'back'
- Curtain flows opposite direction
- Creates spatial memory — users sense "returning"

**Same-Module Navigation:**
- `/restaurant` → `/restaurant/item-123`
- Direction: 'same' (deepening, not crossing)
- Shorter transition (1000ms total)
- Subtle vertical curtain from bottom
- Maintains sense of "descending deeper"

#### 9.2.8 Reduced Motion Fallback

```css
@media (prefers-reduced-motion: reduce) {
  .module-transition {
    /* Disable all curtain clip-path animations */
    /* Simple opacity crossfade: 200ms */
    /* No signature effects (steam, ripples, etc.) */
  }
}
```

**Behavior:**
- Curtain: Simple opacity fade in/out (200ms)
- No clip-path expansion
- No signature effects (steam, ripples, etc.)
- Content: Simple opacity transition
- Total time: 400ms

---

## 10. Implementation Priority for Animation Systems

### Critical Path (Phase 2A — Week 1)
1. Create `LoadingScreen.tsx` component shell
2. Implement basic variant structure (rings, aurora, typography)
3. Add to `app/layout.tsx` with `isReady` prop passthrough
4. Test reduced motion fallbacks

### Secondary (Phase 2B — Week 2)
1. Create `ModuleTransition.tsx` component
2. Implement curtain clip-path variants
3. Create atmosphere signature components (Ripple, Steam, etc.)
4. Replace existing `PageTransition.tsx`

### Polish (Phase 2C — Week 3)
1. Fine-tune timing based on real-device testing
2. Optimize CSS animations for 60fps
3. Cross-browser clip-path testing
4. Performance profiling (avoid layout thrashing)

---

**End of Phase 1 Plan — Including Main Animations**

*Ready for approval to proceed to Phase 2 — Implementation*
