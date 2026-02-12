import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';

test.describe('Customer GDPR & Privacy [CUS-GDPR]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByLabel(/email/i).fill('customer@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForTimeout(2000);
  });

  test('CUS-GDPR-001: view privacy dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND}/privacy`);
    const heading = page.getByRole('heading', { name: /privacy|data|gdpr/i });
    await expect(heading).toBeVisible();
  });

  test('CUS-GDPR-002: manage consent preferences', async ({ page }) => {
    await page.goto(`${FRONTEND}/privacy`);
    const consentSection = page.locator('[class*="consent"], [class*="preference"]')
      .or(page.getByText(/consent|marketing|analytics/i));
    await expect(consentSection.first()).toBeVisible();
    const toggle = page.getByRole('switch').or(page.getByRole('checkbox')).or(page.locator('[class*="toggle"]'));
    await expect(toggle.first()).toBeVisible();
  });

  test('CUS-GDPR-004: request data export', async ({ page }) => {
    await page.goto(`${FRONTEND}/privacy`);
    const exportBtn = page.getByRole('button', { name: /export|download|request.*data/i })
      .or(page.getByRole('link', { name: /export|download/i }));
    await expect(exportBtn.first()).toBeVisible();
    await exportBtn.first().click();
    const confirmation = page.getByText(/request.*sent|export.*requested|email|download/i)
      .or(page.locator('[class*="success"], [class*="confirm"], [role="alert"]'));
    await expect(confirmation.first()).toBeVisible({ timeout: 5000 });
  });

  test('CUS-GDPR-006: request account deletion', async ({ page }) => {
    await page.goto(`${FRONTEND}/privacy`);
    const deleteBtn = page.getByRole('button', { name: /delete.*account|remove.*account|close.*account/i });
    await expect(deleteBtn.first()).toBeVisible();
    await deleteBtn.first().click();
    const confirmDialog = page.getByRole('dialog')
      .or(page.locator('[class*="modal"], [class*="confirm"]'));
    await expect(confirmDialog.first()).toBeVisible();
    const warningText = confirmDialog.first().locator('text=/permanent|irreversible|cannot.*undo|sure/i');
    await expect(warningText.first()).toBeVisible();
  });
});
