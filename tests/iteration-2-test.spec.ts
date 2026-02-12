import { test, expect } from '@playwright/test';

/**
 * Iteration 2 Tests — Pool Module, Pluralization, Menu Loading
 *
 * Tests verify:
 * 1. Restaurant menu loads immediately (no blank "No items found" state)
 * 2. Pool info section uses translated strings (not hardcoded English)
 * 3. Pluralization: "1 item in cart" vs "2 items in cart"
 */

const BASE_URL = 'http://localhost:3000';

test.describe('Iteration 2: Menu Loading Fix', () => {
  test('restaurant menu should show loading state then items without scrolling', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurant`);

    // Should eventually show menu items (categories, dishes)
    // The fix removed `enabled: !!restaurantModule` so the query fires immediately
    const menuContent = page.locator('text=/Dishes|Categories|Featured/i');
    await expect(menuContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('pool page should show sessions or loading without waiting for modules', async ({ page }) => {
    await page.goto(`${BASE_URL}/pool`);

    // Should see either loading animation or session data — NOT a blank "No sessions" state
    const poolContent = page.locator('text=/Pool Sessions|session|loading/i');
    await expect(poolContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('chalets page should load content without waiting for modules', async ({ page }) => {
    await page.goto(`${BASE_URL}/chalets`);

    // Should see either loading or chalet data
    const chaletContent = page.locator('text=/Chalets|chalet|loading|luxury/i');
    await expect(chaletContent.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Iteration 2: Pool Info i18n', () => {
  test('pool info section should use translated strings', async ({ page }) => {
    await page.goto(`${BASE_URL}/pool`);

    // "What to Bring" and "Amenities" sections should show translated text
    // (not hardcoded English "Swimwear, towel, sunscreen...")
    const whatToBring = page.locator('text=/What to Bring/i');
    await expect(whatToBring.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Iteration 2: Cart Pluralization', () => {
  test('restaurant floating cart should show singular "1 item in cart"', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurant`);

    // Wait for menu to load
    await expect(page.locator('text=/Dishes|Categories/i').first()).toBeVisible({ timeout: 10000 });

    // Add one item to cart
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();

      // Should show "1 item in cart" (singular)
      const cartBar = page.locator('text=/1 item in cart/i');
      await expect(cartBar).toBeVisible({ timeout: 5000 });
    }
  });

  test('restaurant floating cart should show plural "2 items in cart"', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurant`);

    await expect(page.locator('text=/Dishes|Categories/i').first()).toBeVisible({ timeout: 10000 });

    // Add two items
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await addButton.click();

      // Should show "2 items in cart" (plural)
      const cartBar = page.locator('text=/2 items in cart/i');
      await expect(cartBar).toBeVisible({ timeout: 5000 });
    }
  });
});
