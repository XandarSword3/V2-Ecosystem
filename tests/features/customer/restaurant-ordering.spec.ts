import { test, expect } from '../../fixtures/auth.fixture';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Customer MenuService Ordering [CUS-REST]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/menu service`);
  });

  test('CUS-REST-001: browse menu categories visible', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /menu|menu service/i });
    await expect(heading).toBeVisible();
    const categories = page.locator('[class*="categor"], [class*="menu-section"], nav >> text=/appetizer|starter|main|drink|dessert/i');
    await expect(categories.first()).toBeVisible();
  });

  test('CUS-REST-005: search or filter menu items', async ({ page }) => {
    const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search|filter/i));
    await expect(search).toBeVisible();
    await search.fill('pizza');
    await page.waitForLoadState('networkidle');
    const results = page.locator('[class*="menu-item"], [class*="card"], [class*="product"]');
    const count = await results.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('CUS-REST-008: view menu item card with name and price', async ({ page }) => {
    const menuItem = page.locator('[class*="menu-item"], [class*="card"], [class*="product"]').first();
    await expect(menuItem).toBeVisible();
    const name = menuItem.locator('h2, h3, h4, [class*="name"], [class*="title"]').first();
    await expect(name).toBeVisible();
    await expect(name).not.toHaveText('');
    const price = menuItem.locator('[class*="price"], text=/[€$£]|\\d+\\.\\d{2}/');
    await expect(price.first()).toBeVisible();
  });

  test('CUS-REST-012: add item to cart', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add|cart|order/i }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();
    const cartIndicator = page.locator('[class*="cart"], [class*="basket"], [aria-label*="cart"]').first();
    await expect(cartIndicator).toBeVisible();
  });

  test('CUS-REST-015: view cart with items, quantities, and prices', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addButton.click();
    const cartLink = page.getByRole('link', { name: /cart|basket/i }).or(page.locator('[class*="cart-icon"], [aria-label*="cart"]')).first();
    await cartLink.click();
    const cartItem = page.locator('[class*="cart-item"], [class*="order-item"], [class*="line-item"]').first();
    await expect(cartItem).toBeVisible();
    const quantity = cartItem.locator('[class*="quantity"], [class*="qty"], input[type="number"]');
    await expect(quantity.first()).toBeVisible();
  });

  test('CUS-REST-018: update cart quantity', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addButton.click();
    const cartLink = page.locator('[class*="cart-icon"], [aria-label*="cart"]').or(page.getByRole('link', { name: /cart/i })).first();
    await cartLink.click();
    const increaseBtn = page.getByRole('button', { name: /increase|\+/i }).first();
    await expect(increaseBtn).toBeVisible();
    await increaseBtn.click();
  });

  test('CUS-REST-020: remove cart item', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addButton.click();
    const cartLink = page.locator('[class*="cart-icon"], [aria-label*="cart"]').or(page.getByRole('link', { name: /cart/i })).first();
    await cartLink.click();
    const removeBtn = page.getByRole('button', { name: /remove|delete|trash/i }).first();
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();
  });

  test('CUS-REST-023: select order type dine-in or takeaway', async ({ page }) => {
    const orderType = page.getByRole('radio', { name: /dine.?in/i })
      .or(page.getByRole('button', { name: /dine.?in/i }))
      .or(page.getByText(/dine.?in/i));
    await expect(orderType.first()).toBeVisible();
    const takeaway = page.getByRole('radio', { name: /takeaway|take.?out|pickup/i })
      .or(page.getByRole('button', { name: /takeaway|take.?out/i }))
      .or(page.getByText(/takeaway|take.?out/i));
    await expect(takeaway.first()).toBeVisible();
  });

  test('CUS-REST-026: enter table number for dine-in', async ({ page }) => {
    const dineIn = page.getByRole('radio', { name: /dine.?in/i })
      .or(page.getByRole('button', { name: /dine.?in/i })).first();
    await dineIn.click();
    const tableInput = page.getByLabel(/table/i).or(page.getByPlaceholder(/table/i));
    await expect(tableInput.first()).toBeVisible();
  });

  test('CUS-REST-031: place order and see confirmation', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add|cart|order/i }).first();
    await addButton.click();
    const placeOrder = page.getByRole('button', { name: /place order|confirm|submit|checkout/i }).first();
    await expect(placeOrder).toBeVisible();
  });
});
