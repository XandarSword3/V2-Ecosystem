import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

test('End-to-End Inventory & Ordering Check', async ({ page }) => {
  // 1. Navigate to Restaurant Page
  console.log(`Navigating to ${FRONTEND_URL}/restaurant...`);
  await page.goto(`${FRONTEND_URL}/restaurant`);
  
  // 2. Wait for Menu Items
  console.log('Waiting for menu items...');
  const menuItem = page.locator('.menu-item, [data-testid="menu-item"]').first();
  await menuItem.waitFor({ state: 'visible', timeout: 15000 });
  
  // 3. Add Item to Cart
  console.log('Adding item to cart...');
  // Try to find a specific item "Fattoush" or fallback to first
  const specificItem = page.locator('text=Fattoush').locator('..').locator('button:has-text("Add")');
  const genericButton = page.locator('button:has-text("Add")').first();
  
  if (await specificItem.isVisible()) {
      await specificItem.click();
      console.log('Added "Fattoush" to cart.');
  } else {
      await genericButton.click();
      console.log('Added first available item to cart.');
  }

  // 4. Verify Cart Update
  console.log('Checking cart...');
  const cartCount = page.locator('[data-testid="cart-count"], .cart-count, .badge').first();
  await expect(cartCount).toBeVisible();
  
  // 5. Open Cart
  console.log('Opening cart...');
  const cartBtn = page.locator('[data-testid="cart-button"], button:has-text("Cart"), [aria-label="Cart"]');
  await cartBtn.click();
  
  // 6. Proceed to Checkout
  console.log('Proceeding to checkout...');
  if (await page.locator('text=Checkout').isVisible()) {
     await page.locator('text=Checkout').click();
  }

  // 7. Wait and observe (for headed mode)
  console.log('Waiting 5 seconds for visual verification...');
  await page.waitForTimeout(5000);
});
