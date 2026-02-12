import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';

test.describe('Customer Profile & Account [CUS-ACCT]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByLabel(/email/i).fill('customer@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForTimeout(2000);
  });

  test('CUS-ACCT-001: view profile page', async ({ page }) => {
    await page.goto(`${FRONTEND}/profile`);
    const heading = page.getByRole('heading', { name: /profile|account|my/i });
    await expect(heading).toBeVisible();
    const nameField = page.getByLabel(/name/i).or(page.locator('[class*="name"]'));
    await expect(nameField.first()).toBeVisible();
    const emailField = page.getByLabel(/email/i).or(page.locator('[class*="email"]'));
    await expect(emailField.first()).toBeVisible();
  });

  test('CUS-ACCT-003: edit profile information', async ({ page }) => {
    await page.goto(`${FRONTEND}/profile`);
    const editBtn = page.getByRole('button', { name: /edit|update|save/i })
      .or(page.getByRole('link', { name: /edit/i }));
    await expect(editBtn.first()).toBeVisible();
    await editBtn.first().click();
    const nameInput = page.getByLabel(/first.*name|name/i).first();
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill('Test Customer');
    const saveBtn = page.getByRole('button', { name: /save|update|confirm/i });
    await expect(saveBtn.first()).toBeVisible();
  });

  test('CUS-ACCT-005: view order history', async ({ page }) => {
    await page.goto(`${FRONTEND}/orders`);
    const heading = page.getByRole('heading', { name: /order|history|booking/i });
    await expect(heading).toBeVisible();
    const orderList = page.locator('[class*="order"], [class*="history"], table, [class*="list"]');
    await expect(orderList.first()).toBeVisible();
  });

  test('CUS-ACCT-009: view order detail', async ({ page }) => {
    await page.goto(`${FRONTEND}/orders`);
    const orderRow = page.locator('[class*="order-item"], [class*="order-row"], tr, [class*="card"]').first();
    await orderRow.click();
    const detail = page.locator('[class*="detail"], [class*="order-info"], [class*="summary"]');
    await expect(detail.first()).toBeVisible();
    const status = page.locator('[class*="status"], text=/pending|confirmed|completed|processing/i');
    await expect(status.first()).toBeVisible();
  });
});
