import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';

test.describe('Customer Global Settings [CUS-SET]', () => {
  test('CUS-SET-001: switch currency', async ({ page }) => {
    await page.goto(FRONTEND);
    const currencySelector = page.getByRole('combobox', { name: /currency/i })
      .or(page.locator('[class*="currency"] select, [class*="currency-select"]'))
      .or(page.getByLabel(/currency/i));
    await expect(currencySelector.first()).toBeVisible();
    await currencySelector.first().click();
    const options = page.getByRole('option').or(page.locator('[class*="currency"] option, [class*="dropdown-item"]'));
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
  });

  test('CUS-SET-002: switch language', async ({ page }) => {
    await page.goto(FRONTEND);
    const langSelector = page.getByRole('combobox', { name: /language|lang/i })
      .or(page.locator('[class*="language"] select, [class*="lang-select"]'))
      .or(page.getByLabel(/language/i));
    await expect(langSelector.first()).toBeVisible();
    await langSelector.first().click();
    const options = page.getByRole('option').or(page.locator('[class*="language"] option, [class*="dropdown-item"]'));
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
  });

  test('CUS-SET-004: toggle theme dark/light', async ({ page }) => {
    await page.goto(FRONTEND);
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i })
      .or(page.getByRole('switch', { name: /theme|dark|light/i }))
      .or(page.locator('[class*="theme-toggle"], [class*="dark-mode"]'));
    await expect(themeToggle.first()).toBeVisible();

    const htmlBefore = await page.locator('html').getAttribute('class') ?? '';
    await themeToggle.first().click();
    await page.waitForTimeout(500);
    const htmlAfter = await page.locator('html').getAttribute('class') ?? '';

    // Theme class should have changed (e.g., adding or removing 'dark')
    expect(htmlAfter).not.toBe(htmlBefore);
  });
});
