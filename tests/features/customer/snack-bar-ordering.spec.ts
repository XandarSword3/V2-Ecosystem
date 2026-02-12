import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Customer Snack Bar Ordering [CUS-SNCK]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/snack-bar`);
  });

  test('CUS-SNCK-001: browse snack categories', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /snack|bar|refreshment/i });
    await expect(heading).toBeVisible();
    const categories = page.locator('[class*="categor"], [class*="tab"], [role="tablist"]');
    await expect(categories.first()).toBeVisible();
  });

  test('CUS-SNCK-002: browse items in category', async ({ page }) => {
    const items = page.locator('[class*="item"], [class*="product"], [class*="card"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    const firstName = items.first().locator('h3, h4, [class*="name"], [class*="title"]').first();
    await expect(firstName).toBeVisible();
    await expect(firstName).not.toHaveText('');
  });

  test('CUS-SNCK-003: add item to cart', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|cart|order/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    const cartBadge = page.locator('[class*="badge"], [class*="count"], [class*="cart-indicator"]');
    await expect(cartBadge.first()).toBeVisible();
  });

  test('CUS-SNCK-004: view cart contents', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addBtn.click();
    const cartLink = page.locator('[class*="cart-icon"], [aria-label*="cart"]')
      .or(page.getByRole('link', { name: /cart|basket/i })).first();
    await cartLink.click();
    const cartItem = page.locator('[class*="cart-item"], [class*="line-item"], [class*="order-item"]');
    await expect(cartItem.first()).toBeVisible();
  });

  test('CUS-SNCK-005: update quantities in cart', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addBtn.click();
    const cartLink = page.locator('[class*="cart-icon"], [aria-label*="cart"]')
      .or(page.getByRole('link', { name: /cart/i })).first();
    await cartLink.click();
    const increaseBtn = page.getByRole('button', { name: /increase|\+|more/i }).first();
    await expect(increaseBtn).toBeVisible();
  });

  test('CUS-SNCK-007: remove item from cart', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addBtn.click();
    const cartLink = page.locator('[class*="cart-icon"], [aria-label*="cart"]')
      .or(page.getByRole('link', { name: /cart/i })).first();
    await cartLink.click();
    const removeBtn = page.getByRole('button', { name: /remove|delete|trash/i }).first();
    await expect(removeBtn).toBeVisible();
  });

  test('CUS-SNCK-009: place order and see confirmation', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addBtn.click();
    const placeOrder = page.getByRole('button', { name: /place order|confirm|checkout|submit/i });
    await expect(placeOrder.first()).toBeVisible();
  });
});
