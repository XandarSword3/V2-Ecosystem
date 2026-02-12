import { test, expect } from '@playwright/test';

/**
 * Iteration 3 Tests — Missing i18n key fix + Order Page i18n
 *
 * Tests verify:
 * 1. Restaurant page has no MISSING_MESSAGE console errors for 'spicy'
 * 2. Order page displays translated text (not hardcoded English)
 * 3. Order page header uses resort name from settings
 */

const BASE_URL = 'http://localhost:3000';

test.describe('Iteration 3: Missing restaurant.spicy Key', () => {
  test('restaurant page should have no IntlError for spicy key', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('MISSING_MESSAGE')) {
        errors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/restaurant`);
    // Wait for menu to load
    await expect(page.locator('text=/Dishes|Categories/i').first()).toBeVisible({ timeout: 10000 });

    // No IntlError about 'spicy'
    const spicyErrors = errors.filter(e => e.includes('spicy'));
    expect(spicyErrors).toHaveLength(0);
  });
});

test.describe('Iteration 3: Order Page i18n', () => {
  test('order page header should use translated restaurant name', async ({ page }) => {
    await page.goto(`${BASE_URL}/order?table=5`);

    // Header should contain "Restaurant" (from i18n key, not hardcoded)
    const header = page.locator('h1');
    await expect(header).toContainText('Restaurant', { timeout: 10000 });
  });

  test('order page should show translated Table label', async ({ page }) => {
    await page.goto(`${BASE_URL}/order?table=5`);

    // Should show "Table 5" (using tc('table'))
    const tableText = page.locator('text=/Table 5/i');
    await expect(tableText).toBeVisible({ timeout: 10000 });
  });

  test('order page invalid table should show translated error', async ({ page }) => {
    // Navigate without table param
    await page.goto(`${BASE_URL}/order`);

    // Should show translated "Invalid Table" heading
    const invalidTable = page.locator('h1');
    await expect(invalidTable).toContainText(/Invalid Table|Ungültiger Tisch|Table Invalide|Tavolo Non Valido/i, { timeout: 10000 });
  });

  test('order page menu items should have translated badges', async ({ page }) => {
    await page.goto(`${BASE_URL}/order?table=5`);

    // Wait for categories to load
    await expect(page.locator('button').first()).toBeVisible({ timeout: 10000 });

    // "Add to Order" button text should be present (from i18n)
    const addButton = page.locator('text=/Add to Order|Zur Bestellung|Ajouter à la commande|Aggiungi/i');
    await expect(addButton.first()).toBeVisible({ timeout: 10000 });
  });
});
