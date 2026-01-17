# Testing Strategy

V2 Resort employs a multi-layer testing approach combining unit tests, integration tests, and stress testing bots.

## Testing Philosophy

| Layer | Purpose | Tools |
|-------|---------|-------|
| **Unit Tests** | Isolated component/function testing | Vitest, Jest |
| **E2E Tests** | User flow verification | Playwright |
| **Stress Tests** | Realistic load simulation | Custom Bots |

## Directory Structure

```
v2-resort/
├── backend/
│   └── tests/
│       ├── unit/           # Unit tests
│       ├── integration/    # API integration tests
│       └── e2e/            # End-to-end tests
├── frontend/
│   └── tests/
│       ├── components/     # Component tests
│       └── e2e/            # Playwright tests
├── tools/
│   └── stress-test/        # Stress testing bots
└── tests/                   # Root-level Playwright tests
    └── seed.spec.ts
```

## Running Tests

### Backend Tests

```bash
cd v2-resort/backend

# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Frontend Tests

```bash
cd v2-resort/frontend

# Component tests
npm test

# E2E with Playwright
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

### Stress Tests

```bash
cd v2-resort/tools/stress-test

# Run all bots
npx ts-node run.ts

# Admin tests only
npx ts-node run-admin-only.ts
```

## Unit Testing

### Backend Example

```typescript
// tests/unit/services/order.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from '@/services/order.service';

describe('OrderService', () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
  });

  it('should calculate order total correctly', () => {
    const items = [
      { price: 10, quantity: 2 },
      { price: 15, quantity: 1 }
    ];
    
    expect(orderService.calculateTotal(items)).toBe(35);
  });

  it('should apply discount for orders over $50', () => {
    const total = 60;
    const discounted = orderService.applyDiscount(total);
    
    expect(discounted).toBe(54); // 10% discount
  });
});
```

### Frontend Component Example

```typescript
// tests/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## E2E Testing (Playwright)

```typescript
// tests/e2e/order-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Order Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('customer can complete an order', async ({ page }) => {
    // Login
    await page.click('text=Login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Browse menu
    await page.click('text=Restaurant');
    await expect(page.locator('h1')).toContainText('Menu');
    
    // Add item
    await page.click('text=Add to Cart', { first: true });
    await expect(page.locator('.cart-count')).toContainText('1');
    
    // Checkout
    await page.click('text=View Cart');
    await page.click('text=Checkout');
    
    // Confirm order
    await expect(page.locator('.order-confirmation')).toBeVisible();
  });
});
```

## Stress Testing Bots

### Overview

Stress test bots simulate realistic user behavior:

- **Customer Bot**: Browses, orders, tracks delivery
- **Staff Bot**: Processes orders, manages bookings
- **Admin Bot**: Manages users, updates settings

### Sample Bot Code

```typescript
// tools/stress-test/bots/customer-bot.ts
export class CustomerBot {
  private api: ApiClient;
  
  async run() {
    // Register or login
    await this.authenticate();
    
    // Browse menu
    const menu = await this.api.get('/restaurant/menu');
    
    // Add random items to cart
    const items = this.selectRandomItems(menu.data, 3);
    
    // Create order
    const order = await this.api.post('/orders', { items });
    
    // Connect to socket and track order
    await this.trackOrder(order.id);
    
    // Leave review after completion
    await this.leaveReview(order.id);
  }
}
```

## Test Configuration

### Vitest Config (Backend)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
```

## Coverage Goals

| Module | Target | Current |
|--------|--------|---------|
| Core Services | 80% | ~45% |
| API Routes | 70% | ~40% |
| Components | 60% | ~30% |
| Utilities | 90% | ~65% |

## Best Practices

1. **Test Behavior, Not Implementation** - Focus on what, not how
2. **Isolate Dependencies** - Mock external services
3. **Fast Feedback** - Run unit tests before commit
4. **Realistic Data** - Use fixtures that mirror production
5. **Clean Up** - Reset state between tests

## CI Integration

Tests run automatically on push:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run E2E tests
        run: npm run test:e2e
```

---

For stress testing documentation, see [tools/stress-test/STRESS_TESTING.md](../../tools/stress-test/STRESS_TESTING.md).
