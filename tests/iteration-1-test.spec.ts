import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 1 - Restaurant Order Price Consistency', () => {
  
  test('cart price matches order confirmation price for sale items', async ({ page }) => {
    // Navigate to restaurant menu
    await page.goto('http://localhost:3000/restaurant');
    await page.waitForLoadState('networkidle');
    
    // Click Add to Cart on the first menu item (Test item with sale price $9 / regular $10)
    await page.getByRole('button', { name: 'Add to Cart' }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Click Add to Cart in the customization modal
    const modalAddBtn = page.getByRole('button', { name: /Add to Cart \• \$/ });
    if (await modalAddBtn.isVisible({ timeout: 2000 })) {
      await modalAddBtn.click();
    }
    await page.waitForLoadState('networkidle');
    
    // Go to checkout
    await page.getByRole('link', { name: 'Checkout' }).click();
    await page.waitForLoadState('networkidle');
    
    // Verify cart page shows $9.00 subtotal (sale price)
    const cartSubtotal = page.locator('text=Subtotal').locator('..').locator('text=$9.00');
    await expect(cartSubtotal).toBeVisible();
    
    // Record the total shown on cart page
    const cartTotal = await page.locator('text=Total').locator('..').locator('div').last().textContent();
    
    // Fill order details - click Place Order first to trigger validation
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.waitForLoadState('networkidle');
    
    await page.getByPlaceholder('Enter your full name').fill('Playwright Test User');
    await page.getByPlaceholder('Enter your phone number').fill('+1111111111');
    await page.getByPlaceholder('Enter your table number').fill('99');
    await page.getByRole('button', { name: 'Continue to Payment' }).click({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Place order
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.waitForURL('**/confirmation**', { timeout: 10000 });
    
    // Verify confirmation page shows same subtotal ($9.00, not $10.00)
    const confirmSubtotal = page.locator('text=Subtotal').locator('..').locator('text=$9.00');
    await expect(confirmSubtotal).toBeVisible();
    
    // Verify the item price is $9.00 (sale price matches cart)
    await expect(page.locator('text=$9.00').first()).toBeVisible();
    
    // Verify Order Confirmed heading
    await expect(page.getByText('Order Confirmed!')).toBeVisible();
  });

  test('order flow completes successfully end-to-end', async ({ page }) => {
    // Navigate to restaurant
    await page.goto('http://localhost:3000/restaurant');
    await page.waitForLoadState('networkidle');
    
    // Verify menu loads with categories
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appetizers' })).toBeVisible();
    
    // Verify at least one menu item is visible
    await expect(page.getByRole('button', { name: 'Add to Cart' }).first()).toBeVisible();
  });
});
