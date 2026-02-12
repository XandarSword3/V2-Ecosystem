# V2 Resort — Playwright Test Standards

**Version:** 1.0
**Applies to:** All files in `v2-resort/tests/`

---

## Golden Rules

1. **Every `expect()` must be able to fail.** If your assertion is always true, delete it.
2. **No silent skips.** If an element might not exist, assert it should exist — don't `if/else` around it.
3. **Test behavior, not existence.** Don't just check a page loads — check it shows the right content.
4. **One test = one scenario.** Name it for what breaks if it fails.
5. **No `console.log` in tests.** Use Playwright's trace/screenshot on failure instead.

---

## Banned Patterns

These patterns MUST NOT appear in any test file:

```typescript
// ❌ BANNED: Always-pass literals
expect(true).toBe(true);
expect(true).toBeTruthy();

// ❌ BANNED: OR-true bypass
expect(someVar || true).toBeTruthy();
expect(pageContent || true).toBeTruthy();

// ❌ BANNED: Vacuous numeric checks
expect(count >= 0).toBeTruthy();
expect(count).toBeGreaterThanOrEqual(0);

// ❌ BANNED: Trivially true element checks
expect(page.locator('body')).toBeVisible();
expect(await page.title()).toBeTruthy();
expect(await page.locator('body').textContent()).toBeTruthy();

// ❌ BANNED: Silent skip (no else-fail)
if (await element.isVisible()) {
  await element.click();
  // no assertion if NOT visible
}

// ❌ BANNED: Swallowed failures
try { await riskyAction(); } catch { /* ignore */ }
```

---

## Required Patterns

### Page Load Assertions
```typescript
// ✅ GOOD: Check specific content, not just that the page loaded
await page.goto('/restaurant');
await expect(page.getByRole('heading', { name: /menu/i })).toBeVisible();
```

### Element Assertions
```typescript
// ✅ GOOD: Specific text or attribute checks
await expect(page.getByText('Order Confirmed!')).toBeVisible();
await expect(input).toHaveAttribute('autocomplete', 'email');
await expect(price).toContainText('$9.00');
```

### Conditional Elements (When Element MAY or MAY NOT Exist)
```typescript
// ✅ GOOD: Use test.skip or expect with timeout
const addBtn = page.getByRole('button', { name: /add to cart/i });
await expect(addBtn).toBeVisible({ timeout: 5000 });
await addBtn.click();
// If it's conditionally expected, use test.skip():
// test.skip(!featureEnabled, 'Feature X not enabled');
```

### API Assertions
```typescript
// ✅ GOOD: Check specific status AND body
const response = await page.request.get(`${API}/restaurant/menu/items`);
expect(response.status()).toBe(200);
const data = await response.json();
expect(data.success).toBe(true);
expect(Array.isArray(data.data)).toBe(true);
expect(data.data.length).toBeGreaterThan(0); // NOT >= 0
```

### Form Interactions
```typescript
// ✅ GOOD: Fill, submit, verify outcome
await page.getByLabel('Email').fill('test@example.com');
await page.getByRole('button', { name: /submit/i }).click();
await expect(page.getByText(/success|confirmed/i)).toBeVisible();
```

### Navigation Assertions
```typescript
// ✅ GOOD: Check URL changed to expected destination
await page.getByRole('link', { name: /restaurant/i }).click();
await expect(page).toHaveURL(/\/restaurant/);
```

### Negative Assertions (Checking Absence)
```typescript
// ✅ GOOD: Verify missing i18n keys don't appear
const body = await page.locator('body').textContent();
expect(body).not.toContain('Unhandled Runtime Error');
expect(body).not.toContain('staffScanner.');  // no raw i18n keys
```

---

## Test File Structure

```typescript
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Feature Name [FEATURE-ID]', () => {
  test.beforeEach(async ({ page }) => {
    // Common setup (login, navigation)
  });

  test('should [specific behavior being tested]', async ({ page }) => {
    // Arrange
    await page.goto(`${BASE}/target-page`);
    
    // Act
    await page.getByRole('button', { name: /action/i }).click();
    
    // Assert
    await expect(page.getByText('Expected Result')).toBeVisible();
  });
});
```

---

## Test Categories

### Smoke Tests (`tests/smoke/`)
- Page loads with correct heading
- No console errors
- Key navigation works
- Auth redirect works

### Feature Tests (`tests/features/{role}/`)
- One spec per major feature area
- Tests specific user interactions
- Validates form submissions, display content, state changes

### Workflow Tests (`tests/workflows/`)
- Multi-step, potentially multi-role scenarios
- End-to-end business processes
- Cross-module interactions

---

## Naming Convention

```
tests/
├── smoke/
│   └── {module}-smoke.spec.ts           # e.g., restaurant-smoke.spec.ts
├── features/
│   ├── customer/
│   │   └── {module}-{feature}.spec.ts   # e.g., restaurant-ordering.spec.ts
│   ├── staff/
│   │   └── {module}-{feature}.spec.ts   # e.g., pool-operations.spec.ts
│   ├── admin/
│   │   └── {module}-{feature}.spec.ts   # e.g., user-management.spec.ts
│   └── cross-cutting/
│       └── {concern}.spec.ts            # e.g., i18n.spec.ts
└── workflows/
    └── {workflow-name}.spec.ts          # e.g., restaurant-order-lifecycle.spec.ts
```

---

## Environment

| Variable | Value |
|----------|-------|
| Frontend URL | `http://localhost:3000` |
| Backend API | `http://localhost:3005/api` |
| Admin Email | `admin@v2resort.com` |
| Admin Password | `admin123` |
| Staff Email | `staff@v2resort.com` |
| Staff Password | `staff123` |
| Customer Email | `customer@test.com` |
| Customer Password | `password123` |

---

## Review Checklist

Before committing any test file, verify:

- [ ] Every `expect()` can fail with realistic inputs
- [ ] No banned patterns present
- [ ] Test names describe what breaks when they fail
- [ ] No `console.log` statements
- [ ] Correct port (3000 for frontend, 3005 for API)
- [ ] Feature ID referenced in describe block
- [ ] Assertions check content, not just existence
