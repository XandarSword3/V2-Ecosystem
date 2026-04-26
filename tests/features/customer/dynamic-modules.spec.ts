import { test, expect } from '../../fixtures/auth.fixture';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Customer Dynamic Modules [CUS-MOD]', () => {
  test('CUS-MOD-001: view dynamic module page', async ({ page }) => {
    await page.goto(`${FRONTEND}/modules`);
    const heading = page.getByRole('heading', { name: /module|service|activit/i });
    await expect(heading).toBeVisible();
    const moduleCards = page.locator('[class*="module"], [class*="service"], [class*="card"]');
    const count = await moduleCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('CUS-MOD-003: browse module items', async ({ page }) => {
    await page.goto(`${FRONTEND}/modules`);
    const moduleCard = page.locator('[class*="module"], [class*="service"], [class*="card"]').first();
    await moduleCard.click();
    const items = page.locator('[class*="item"], [class*="product"], [class*="option"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    const itemName = items.first().locator('h3, h4, [class*="name"], [class*="title"]').first();
    await expect(itemName).toBeVisible();
    await expect(itemName).not.toHaveText('');
    const itemPrice = items.first().locator('[class*="price"], text=/[€$£]|\\d+\\.\\d{2}/');
    await expect(itemPrice.first()).toBeVisible();
  });

  test('CUS-MOD-006: add module item to cart', async ({ page }) => {
    await page.goto(`${FRONTEND}/modules`);
    const moduleCard = page.locator('[class*="module"], [class*="service"], [class*="card"]').first();
    await moduleCard.click();
    const addBtn = page.getByRole('button', { name: /add|book|buy|cart/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    const feedback = page.locator('[class*="cart"], [class*="badge"], [class*="notification"], [class*="success"]')
      .or(page.getByText(/added|cart/i));
    await expect(feedback.first()).toBeVisible();
  });
});
