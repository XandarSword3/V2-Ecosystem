# Phase 2 — Implementation Plan
## Staged Implementation with Continuous Testing

**Status:** Approved | **Approach:** Incremental delivery with per-stage verification

---

## Testing Strategy Overview

### Device Testing Matrix (Per Stage)
| Stage | Desktop Chrome | Desktop Safari | iPhone Safari | Android Chrome | Tablet |
|-------|---------------|----------------|---------------|----------------|--------|
| 1-3 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4-6 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7-9 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 10-12 | ✓ | ✓ | ✓ | ✓ | ✓ |

### Performance Targets
- **60fps** on all animations
- **First Paint** < 100ms for loading screen Stage 1
- **Total Loading Sequence** < 1400ms (matches plan spec)
- **Lighthouse Performance** > 90

### Test Checklist Per Stage
- [ ] Visual matches spec
- [ ] No console errors
- [ ] 60fps on Chrome DevTools Performance panel
- [ ] Reduced motion fallback works (test in macOS Settings → Accessibility)
- [ ] Mobile touch targets unaffected
- [ ] No layout shift (CLS = 0)

---

## Stage 1: Loading Screen — Foundation Shell
**Goal:** Component exists, mounts, unmounts without errors

### 1.1 Create File Structure
```
components/effects/
├── LoadingScreen.tsx           # Main component
├── loading-screen/
│   ├── OrbitalRings.tsx        # Stage 2: Ring system
│   ├── AuroraField.tsx         # Stage 3: Gradient orbs
│   ├── TypographyReveal.tsx    # Stage 4: Character animation
│   ├── ParticleConstellation.tsx # Stage 5: Ambient particles
│   └── index.ts                # Barrel export
```

### 1.2 Implement Shell Component
**File:** `components/effects/LoadingScreen.tsx`

**Acceptance Criteria:**
- Component accepts `isReady: boolean` and `resortName?: string` props
- Renders full-screen fixed overlay when `!isReady`
- Unmounts cleanly when `isReady` becomes true
- No animations yet — just structural layout
- Uses `var(--color-background)` for background
- Has `data-testid="loading-screen"` for testing

**Test:**
```bash
# Build passes
npm run build:frontend

# No console errors
# Component visible in React DevTools
```

### 1.3 Add to Layout
**File:** `app/layout.tsx`

**Changes:**
- Import `LoadingScreen`
- Pass `isReady` state (start with `const [isReady, setIsReady] = useState(false)`)
- Add 2-second timeout to simulate loading for testing

**Acceptance Criteria:**
- Loading screen appears on app load
- After 2 seconds, screen disappears
- Main content visible
- No flash of unstyled content

**Test:**
- Desktop: Visual check
- Mobile: Visual check
- Reduced motion: No difference (no animations yet)

---

## Stage 2: Loading Screen — Stage 1 & 2 (Void + Geometric Birth)
**Goal:** Void and orbital rings animate correctly

### 2.1 Implement Void Stage (0ms–200ms)
**Acceptance Criteria:**
- Screen is pure `var(--color-background)` for first 200ms
- Subtle noise texture overlay at 3% opacity (CSS or SVG)
- No content visible
- Uses CSS `@media (prefers-reduced-motion)` — if reduced motion, skip to rings immediately

**Test:**
- Frame-by-frame in DevTools: first 200ms shows only background
- Noise texture barely visible (3% is subtle)

### 2.2 Implement Orbital Rings
**File:** `components/effects/loading-screen/OrbitalRings.tsx`

**Specifications from plan:**
- 3 rings: 200px, 300px, 400px diameter
- 12–16 segmented arcs per ring (SVG paths)
- Scale from 0 → 1 with stagger: 0ms, 100ms, 200ms
- Easing: `[0.22, 1, 0.36, 1]`
- Duration: 600ms each
- Colors: `var(--color-primary)` at 60%, 40%, 20% opacity
- Rotation: continuous, alternating directions, 30s/45s/60s periods

**Acceptance Criteria:**
- Rings appear after 200ms (Void stage)
- Scale animation smooth, no jank
- Continuous rotation runs at 60fps
- Reduced motion: rings appear instantly, no rotation

**Test:**
```bash
# Chrome DevTools Performance
# Record 3 seconds
# Verify: No red bars (jank), 60fps line stable
```

---

## Stage 3: Loading Screen — Stage 3 (Aurora Field)
**Goal:** Aurora gradients drift and breathe

### 3.1 Implement Aurora Field
**File:** `components/effects/loading-screen/AuroraField.tsx`

**Specifications:**
- 3 radial gradients: 800px–1200px diameter
- Colors: `var(--color-primary)` 20% → `var(--color-secondary)` 15% → transparent
- Drift in circular paths: 20px radius, 30s duration
- Each gradient offset by 120° in orbit timing
- Appears at 400ms (overlaps with rings)

**Acceptance Criteria:**
- Gradients visible behind rings
- Motion is subtle, not distracting
- 60fps on mobile
- Reduced motion: static gradients, no drift

**Test:**
- iPhone Safari: Check for jank (iOS sometimes struggles with large blur/gradient compositing)
- Android Chrome: Verify no scroll jank

---

## Stage 4: Loading Screen — Stage 4 (Typography)
**Goal:** Interim message and resort name animate

### 4.1 Implement TypographyReveal
**File:** `components/effects/loading-screen/TypographyReveal.tsx`

**Specifications:**
- Interim: "Entering..." with stagger fade (30ms per char)
- Resort name: character cascade from below
  - Initial: `opacity: 0`, `y: 20`, `rotateX: -90deg`
  - Stagger: 40ms per character
  - Easing: `[0.215, 0.61, 0.355, 1]`
  - Duration: 500ms per character
- Swap interim → name when `resortName` prop available

**Acceptance Criteria:**
- Interim message appears at 800ms
- Resort name replaces interim smoothly (crossfade)
- Character animation per spec
- Reduced motion: simple fade, no per-character animation

**Test:**
- Test with `resortName` initially undefined, then defined after 1s
- Verify no layout shift during swap
- Character animation readable, not too fast

---

## Stage 5: Loading Screen — Stage 5 + Exit (Particles + Handoff)
**Goal:** Ambient particles and clean exit

### 5.1 Implement Particle Constellation
**File:** `components/effects/loading-screen/ParticleConstellation.tsx`

**Specifications:**
- 20–30 dots, 4px diameter
- `var(--color-accent)` at 50% opacity
- Gentle floating motion, unique sine wave per particle
- Appears at 1600ms
- CSS-based cursor interaction (custom properties, not JS tracking)

**Acceptance Criteria:**
- Particles subtle, don't compete with name
- 60fps with 30 particles
- Reduced motion: particles static or omitted

### 5.2 Implement Exit Sequence
**Specifications:**
- Hold: 300ms at `isReady`
- Converge: Rings scale to 150%, name splits (odd up, even down)
- Dissolve: 400ms fade to background
- Handoff: Unmount

**Acceptance Criteria:**
- Exit triggered exactly when `isReady` becomes true
- No premature unmounting
- Smooth handoff to main content
- Reduced motion: simple 300ms opacity fade

**Test:**
- Trigger `isReady` at different times (500ms, 1500ms, 3000ms)
- Verify exit always completes gracefully
- Check memory: no detached DOM nodes (React DevTools Profiler)

---

## Stage 6: Loading Screen — Integration & Real Data
**Goal:** Works with actual `useSiteSettings()`

### 6.1 Wire to Real Settings
**File:** `app/layout.tsx`

**Changes:**
- Remove test timeout
- Connect `useSiteSettings()` loading state to `isReady`
- Consider: modules loaded? theme applied? minimum display time?

**Acceptance Criteria:**
- Loading screen shows until settings + modules are fetched
- Minimum display time: 1200ms (don't flash away too fast)
- If cached settings available, skip interim, show name immediately

**Test:**
- Throttle network to "Slow 3G" in DevTools
- Verify loading screen stays until data ready
- Test with cached: should be brief but not jarring

---

## Stage 7: Module Transition — Foundation Shell
**Goal:** Component exists, detects route changes

### 7.1 Create File Structure
```
components/effects/
├── ModuleTransition.tsx        # Main component (replaces PageTransition)
├── module-transition/
│   ├── Curtain.tsx             # The full-screen overlay
│   ├── AtmosphereResolver.ts   # Route → atmosphere mapping
│   ├── signatures/
│   │   ├── SteamWisps.tsx      # Restaurant
│   │   ├── RippleEffect.tsx    # Pool
│   │   ├── ForestDrift.tsx     # Chalets
│   │   ├── PopFizz.tsx         # Snack Bar
│   │   ├── HorizonGlow.tsx     # Home
│   │   └── ConstellationConnect.tsx # Dynamic
│   └── index.ts
```

### 7.2 Implement Atmosphere Resolver
**File:** `components/effects/module-transition/AtmosphereResolver.ts`

**Acceptance Criteria:**
- Function takes route string, returns atmosphere object
- Route patterns match spec exactly:
  - `/` → 'core'
  - `/restaurant/*` → 'culinary'
  - `/pool/*` → 'aquatic'
  - `/chalets/*` → 'sanctuary'
  - `/snack-bar/*` → 'casual'
  - `/login`, `/register` → 'portal'
  - `/*` (catchall) → 'discovery'
- Colors use `color-mix()` with CSS variables
- Unit tests for all route patterns

**Test:**
```typescript
// Unit tests
expect(getAtmosphere('/restaurant')).toBe('culinary');
expect(getAtmosphere('/pool/booking')).toBe('aquatic');
expect(getAtmosphere('/unknown-slug')).toBe('discovery');
```

### 7.3 Implement Basic Curtain (No Animation)
**File:** `components/effects/module-transition/Curtain.tsx`

**Acceptance Criteria:**
- Full-screen fixed overlay
- Background: radial gradient with atmosphere colors
- No clip-path yet — just appears/disappears
- Mounts on route change, unmounts after delay

**Test:**
- Navigate between pages
- Curtain should flash on each navigation (basic test)

---

## Stage 8: Module Transition — Direction Detection
**Goal:** Detect forward/back/same navigation

### 8.1 Implement Direction Logic
**File:** `components/effects/ModuleTransition.tsx`

**Logic:**
- Store previous route in ref
- Compare current vs previous
- Forward: deeper path (more segments)
- Back: shallower path (fewer segments)
- Same: same segment count, different final segment

**Acceptance Criteria:**
- `/` → `/restaurant` = 'forward'
- `/restaurant` → `/` = 'back'
- `/restaurant` → `/pool` = 'same'
- `/restaurant` → `/restaurant/item-123` = 'same' (deepening)

**Test:**
- Console.log direction on each navigation
- Verify correct detection

---

## Stage 9: Module Transition — Clip-Path Animation
**Goal:** Curtain expands and contracts with clip-path

### 9.1 Implement Clip-Path Variants
**Specifications from plan:**
- Forward: `circle(0% at 100% 50%)` → `circle(150% at 100% 50%)`
- Back: `circle(0% at 0% 50%)` → `circle(150% at 0% 50%)`
- Same: `circle(0% at 50% 100%)` → `circle(150% at 50% 100%)`
- Easing enter: `[0.77, 0, 0.175, 1]` (400ms)
- Easing exit: `[0.22, 1, 0.36, 1]` (400ms, delay 200ms)

**Acceptance Criteria:**
- Clip-path animates smoothly
- No jank during expansion
- Exit follows reverse path
- Reduced motion: opacity only, no clip-path

**Test:**
- Chrome: 60fps verified in Performance panel
- Safari: Check clip-path support (should work, iOS 15+)
- Firefox: Verify

---

## Stage 10: Module Transition — Signature Effects (Batch 1)
**Goal:** Restaurant (Steam) + Pool (Ripple) implemented

### 10.1 Implement SteamWisps
**File:** `components/effects/module-transition/signatures/SteamWisps.tsx`

**Specifications:**
- SVG paths, vertical wisps
- `var(--color-accent)` at 20% opacity
- Slow upward drift, 10s loop
- 3–4 wisps

**Test:**
- Navigate to `/restaurant`
- Wisps visible during curtain
- 60fps

### 10.2 Implement RippleEffect
**File:** `components/effects/module-transition/signatures/RippleEffect.tsx`

**Specifications:**
- 3–4 concentric circles
- `var(--color-secondary)` stroke at 30%
- Scale 0 → 2, fade out
- Staggered 150ms

**Test:**
- Navigate to `/pool`
- Ripples expand from curtain origin
- 60fps

---

## Stage 11: Module Transition — Signature Effects (Batch 2)
**Goal:** Chalets (Forest) + Snack Bar (Pop) + Home (Horizon)

### 11.1 Implement Remaining Signatures
**Files:**
- `ForestDrift.tsx` — horizontal organic shapes
- `PopFizz.tsx` — random pop animations
- `HorizonGlow.tsx` — breathing horizontal band

**Test:**
- Each module shows correct signature
- Reduced motion: all signatures static or omitted

---

## Stage 12: Module Transition — Edge Cases & Polish
**Goal:** Production-ready

### 12.1 Handle Interrupted Transitions
**Acceptance Criteria:**
- Rapid clicking: current transition completes to P3, new starts from P3
- No visual chaos
- Queue: max 1 pending transition

### 12.2 Handle Slow Connections
**Acceptance Criteria:**
- Transition timing fixed to animation, not data
- Skeleton loaders visible in revealed page
- No waiting for data

### 12.3 Back Navigation Support
**Acceptance Criteria:**
- Browser back button detected
- Direction: 'back'
- Curtain flows opposite
- Spatial memory maintained

### 12.4 Replace PageTransition.tsx
**File:** `app/layout.tsx`

**Changes:**
- Remove old `PageTransition`
- Use new `ModuleTransition`
- Wrap page content

**Final Test:**
- Full navigation flow test
- All modules visited
- Back/forward browser buttons
- Reduced motion throughout
- Mobile performance check

---

## Stage 13–18: Remaining UI/UX Plan Items
Following the same staged approach for:
- Stage 13: Responsive fixes (batch 1: homepage, auth pages)
- Stage 14: Responsive fixes (batch 2: module pages)
- Stage 15: Skeleton loading components
- Stage 16: Button loading states + optimistic UI
- Stage 17: Form validation feedback
- Stage 18: Shared components (EmptyState, ErrorState, etc.)

Each stage includes:
1. Implementation
2. Build check
3. Device testing (desktop, mobile)
4. Reduced motion check
5. Performance verification

---

## Git Commit Strategy

**Per Stage:**
```bash
# After each stage completes testing
git add .
git commit -m "Stage X: Description

- What was implemented
- Test results: [devices tested]
- Performance: [fps/results]
- Known issues: [if any]"

# Push periodically
git push origin main
```

---

## Rollback Plan

If any stage causes issues:
```bash
# Revert single commit
git revert HEAD

# Or stash and continue from previous stage
git stash
git checkout HEAD~1
```

---

**Ready to begin Stage 1?**
