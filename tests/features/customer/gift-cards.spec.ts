import { test, expect } from '../../fixtures/auth.fixture';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Customer Gift Cards [CUS-GFT]', () => {
  test('CUS-GFT-001: browse gift card templates', async ({ page }) => {
    await page.goto(`${FRONTEND}/gift-cards`);
    const heading = page.getByRole('heading', { name: /gift.?card/i });
    await expect(heading).toBeVisible();
    const templates = page.locator('[class*="template"], [class*="card"], [class*="design"]');
    const count = await templates.count();
    expect(count).toBeGreaterThan(0);
  });

  test('CUS-GFT-002: select gift card amount', async ({ page }) => {
    await page.goto(`${FRONTEND}/gift-cards`);
    const amountOption = page.getByRole('button', { name: /\d+/ })
      .or(page.getByRole('radio', { name: /\d+/ }))
      .or(page.locator('[class*="amount"]'));
    await expect(amountOption.first()).toBeVisible();
    await amountOption.first().click();
  });

  test('CUS-GFT-003: enter recipient details', async ({ page }) => {
    await page.goto(`${FRONTEND}/gift-cards`);
    const template = page.locator('[class*="template"], [class*="card"], [class*="design"]').first();
    await template.click();
    const recipientName = page.getByLabel(/recipient.*name|to.*name|name/i)
      .or(page.getByPlaceholder(/recipient|name/i));
    await expect(recipientName.first()).toBeVisible();
    const recipientEmail = page.getByLabel(/recipient.*email|to.*email|email/i)
      .or(page.getByPlaceholder(/email/i));
    await expect(recipientEmail.first()).toBeVisible();
  });

  test('CUS-GFT-004: enter personal message', async ({ page }) => {
    await page.goto(`${FRONTEND}/gift-cards`);
    const template = page.locator('[class*="template"], [class*="card"], [class*="design"]').first();
    await template.click();
    const message = page.getByLabel(/message|note|greeting/i)
      .or(page.getByPlaceholder(/message|note/i))
      .or(page.locator('textarea'));
    await expect(message.first()).toBeVisible();
    await message.first().fill('Happy Birthday!');
    await expect(message.first()).toHaveValue('Happy Birthday!');
  });

  test('CUS-GFT-005: purchase flow button available', async ({ page }) => {
    await page.goto(`${FRONTEND}/gift-cards`);
    const purchaseBtn = page.getByRole('button', { name: /buy|purchase|add to cart|send/i });
    await expect(purchaseBtn.first()).toBeVisible();
  });

  test('CUS-GFT-006: view my gift cards (requires login)', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByLabel(/email/i).fill('customer@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 5000 }).catch(() => {});
    await page.goto(`${FRONTEND}/gift-cards/my`);
    const heading = page.getByRole('heading', { name: /my.*gift|gift.*card/i });
    await expect(heading).toBeVisible();
  });

  test('CUS-GFT-008: check gift card balance', async ({ page }) => {
    await page.goto(`${FRONTEND}/gift-cards`);
    const balanceLink = page.getByRole('link', { name: /balance|check/i })
      .or(page.getByRole('button', { name: /balance|check/i }));
    await expect(balanceLink.first()).toBeVisible();
    await balanceLink.first().click();
    const balanceInput = page.getByLabel(/code|number|card/i)
      .or(page.getByPlaceholder(/code|number/i));
    await expect(balanceInput.first()).toBeVisible();
  });
});
