# V2 Resort — Test Triage Report

**Date:** 2026-02-08
**Files Audited:** 51
**Verdict:** 26 KEEP · 22 REWRITE · 3 DELETE

---

## Bad Pattern Catalogue

| Code | Pattern | Why It's Bad |
|------|---------|-------------|
| **BP-1** | `expect(true).toBe(true)` | Literal always-pass. Tests nothing. |
| **BP-2** | `expect(x \|\| true).toBeTruthy()` | Always true regardless of `x`. |
| **BP-3** | `expect(count >= 0).toBeTruthy()` | Any count ≥ 0. Never fails. |
| **BP-4** | `expect(page.locator('body')).toBeVisible()` | Body is always visible. |
| **BP-5** | `if (visible) { expect(...) }` no else-fail | Silently skips assertion. |
| **BP-6** | `if (response.ok()) { expect(...) }` no else-fail | Silently passes on failure. |
| **BP-7** | `expect(await page.title()).toBeTruthy()` | Any title is truthy. |
| **BP-8** | `expect(body).toBeTruthy()` on textContent | Page body is never falsy. |

---

## Verdicts

### DELETE (3 files)

| # | File | Reason |
|---|------|--------|
| 1 | tests/seed.spec.ts | Empty placeholder — `// generate code here` |
| 2 | v2-resort/tests/complete-flows.spec.ts | All selectors (`data-testid`) don't exist in app — aspirational tests for unbuilt features |
| 3 | v2-resort/tests/debug-login.spec.ts | Debug utility, not a real test |

### KEEP (26 files)

| # | File | Quality | Real Assertions | Features |
|---|------|---------|----------------|----------|
| 1 | admin-systematic.spec.ts | 9/10 | ~12 | Admin page headings, buttons |
| 2 | auth-apple.spec.ts | 9/10 | 4 | Apple SSO redirect params |
| 3 | customer-flows.spec.ts | 7/10 | ~25 | Customer ordering, API tests |
| 4 | iteration-1-test.spec.ts | 9/10 | ~8 | Restaurant price consistency |
| 5 | iteration-2-test.spec.ts | 9/10 | ~8 | Cart pluralization, pool i18n |
| 6 | iteration-3-test.spec.ts | 9/10 | ~5 | Missing i18n keys |
| 7 | iteration-4-test.spec.ts | 9/10 | ~5 | SVG errors, footer links |
| 8 | iteration-5-test.spec.ts | 9/10 | ~5 | Reviews API, login autocomplete |
| 9 | iteration-6-test.spec.ts | 9/10 | ~4 | Register autocomplete |
| 10 | iteration-7-test.spec.ts | 8/10 | ~4 | Footer hrefs, cart page |
| 11 | iteration-9-test.spec.ts | 10/10 | ~9 | Staff scanner i18n (best in suite) |
| 12 | iteration-10-test.spec.ts | 7/10 | ~3 | Loyalty crash guard |
| 13 | iteration-13-test.spec.ts | 9/10 | ~5 | Demo credentials, cookie banner |
| 14 | iteration-14-test.spec.ts | 8/10 | ~4 | Manager dashboard |
| 15 | iteration-15-test.spec.ts | 8/10 | ~4 | Gift card currency |
| 16 | iteration-16-test.spec.ts | 7/10 | ~4 | Snack bar, pool a11y |
| 17 | iteration-17-test.spec.ts | 8/10 | ~3 | Gift card purchase format |
| 18 | iteration-19.spec.ts | 8/10 | ~5 | Multi-day dashboard |
| 19 | iteration-20.spec.ts | 8/10 | ~4 | Staff POS, booking statuses |
| 20 | iteration-21.spec.ts | 7/10 | ~3 | Order modal, wishlist |
| 21 | iteration-22.spec.ts | 6/10 | ~2 | Stripe modal, mobile nav |
| 22 | iteration-23.spec.ts | 7/10 | ~2 | Bookings abort |
| 23 | iteration-24.spec.ts | 7/10 | ~2 | Chalets modal i18n |
| 24 | iteration-25.spec.ts | 9/10 | ~6 | Pool page comprehensive i18n |
| 25 | module-builder.spec.ts | 8/10 | ~8 | Module drag-drop, save |
| 26 | module-builder-comprehensive.spec.ts | 8/10 | ~50+ | All 8 component types, undo/redo |
| 27 | module-builder-extra.spec.ts | 8/10 | ~8 | Button, form components |
| 28 | system_flow.spec.ts | 7/10 | ~4 | Homepage, admin login |
| 29 | verification_inventory.spec.ts | 7/10 | ~2 | Add-to-cart, checkout |

### REWRITE (22 files)

| # | File | Quality | Bad Patterns | Priority | Notes |
|---|------|---------|-------------|----------|-------|
| 1 | workflows/customer-all-features.spec.ts | 3/10 | ~20+ (BP-1,2,3,5) | **P1** | 12 sections, all contaminated |
| 2 | workflows/admin-all-features.spec.ts | 4/10 | ~15+ (BP-1,2,3,5) | **P1** | 15 sections, great structure |
| 3 | cms-sync-hardened.spec.ts | 3/10 | ~10+ (BP-1,3,4) | **P1** | 7-8 literal `expect(true)` |
| 4 | admin-staff-visual.spec.ts | 4/10 | ~15 (BP-4,5,6) | **P1** | body-visible + conditional API |
| 5 | workflows/notification-workflow.spec.ts | 3/10 | ~10+ (BP-1,2) | **P1** | Every phase always-pass |
| 6 | workflows/staff-all-features.spec.ts | 4/10 | ~10+ (BP-1,3,5) | **P2** | 9 sections, good structure |
| 7 | workflows/restaurant-order-workflow.spec.ts | 4/10 | ~8 (BP-1,2,5) | **P2** | 4-phase multi-role workflow |
| 8 | workflows/pool-ticket-workflow.spec.ts | 4/10 | ~8 (BP-1,2,3) | **P2** | Good API phase at end |
| 9 | workflows/chalet-booking-workflow.spec.ts | 3/10 | ~10 (BP-1,2) | **P2** | Good design, bad assertions |
| 10 | complete-feature-coverage.spec.ts | 6/10 | ~3 (BP-3) | **P3** | Mostly decent |
| 11 | customization-system.spec.ts | 4/10 | ~2 | **P3** | Won't compile (bad import) |
| 12 | cms-settings-comprehensive.spec.ts | 5/10 | ~5 (BP-4,5) | **P3** | body-visible, conditional |
| 13 | stress-behavior.spec.ts | 3/10 | 0 | **P3** | Wrong port (3001→3005) |
| 14 | e2e/ui-coverage.spec.ts | 4/10 | ~5 (BP-5) | **P3** | No failure on missing elements |
| 15 | admin-notifications.spec.ts | 6/10 | ~2 (BP-3) | **P3** | Mostly OK |
| 16 | iteration-8-test.spec.ts | 4/10 | ~1 (BP-7) | **P4** | Title truthiness |
| 17 | iteration-11-test.spec.ts | 4/10 | ~1 (BP-8) | **P4** | Body truthiness |
| 18 | iteration-12-test.spec.ts | 5/10 | 0 | **P4** | Empty test bodies |
| 19 | iteration-18-test.spec.ts | 2/10 | ~2 (BP-4) | **P4** | Mostly body.toBeVisible() |

---

## Rewrite Priority

1. **P1 (Critical):** 5 files — workflows/ + visual + CMS. These cover the most features but have the worst assertion quality.
2. **P2 (High):** 4 files — remaining workflow files. Good test structure, save the flow, gut the fake assertions.
3. **P3 (Medium):** 9 files — various feature/stress tests needing targeted fixes.
4. **P4 (Low):** 3 files — iteration tests with minor issues.

---

## Best Practice Exemplars

These files demonstrate proper test writing and should serve as templates:

1. **iteration-9-test.spec.ts** — 10/10 — `expect(body).not.toContain('staffScanner.')`
2. **iteration-1-test.spec.ts** — 9/10 — `expect(price).toContainText('$9.00')`
3. **module-builder-comprehensive.spec.ts** — 8/10 — 50+ assertions, full component coverage
4. **auth-apple.spec.ts** — 9/10 — Specific URL param checks
5. **admin-systematic.spec.ts** — 9/10 — Heading/button existence assertions
