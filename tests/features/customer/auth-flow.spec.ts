import { test, expect } from '../../fixtures/auth.fixture';

const FRONTEND = 'http://localhost:3000';

test.describe('Customer Auth Flow [CUS-AUTH]', () => {
  test('CUS-AUTH-001: login with email and password', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill('customer@test.com');
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('password123');
    const loginBtn = page.getByRole('button', { name: /log.?in|sign.?in/i });
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
  });

  test('CUS-AUTH-003: show/hide password toggle', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    const passwordInput = page.getByLabel(/password/i).first();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // The login toggle is an icon-only button next to #password.
    const toggleBtn = page.locator('#password + button[type="button"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('CUS-AUTH-005: Google OAuth button present', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    const googleBtn = page.getByRole('button', { name: /google/i })
      .or(page.locator('[class*="google"], a[href*="google"]'));
    await expect(googleBtn.first()).toBeVisible();
  });

  test('CUS-AUTH-006: Facebook OAuth button present', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    const fbBtn = page.getByRole('button', { name: /facebook/i })
      .or(page.locator('[class*="facebook"], a[href*="facebook"]'));
    await expect(fbBtn.first()).toBeVisible();
  });

  test('CUS-AUTH-007: register account form validation', async ({ page }) => {
    await page.goto(`${FRONTEND}/register`);
    const submitBtn = page.getByRole('button', { name: /register|sign.?up|create/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    const error = page.locator('[class*="error"], [role="alert"], [class*="invalid"]');
    await expect(error.first()).toBeVisible();
  });

  test('CUS-AUTH-009: password strength meter on registration', async ({ page }) => {
    await page.goto(`${FRONTEND}/register`);
    const passwordInput = page.getByLabel(/password/i).first();
    await passwordInput.fill('weak');
    const strengthMeter = page.locator('[class*="strength"], [class*="meter"], [class*="password-indicator"]');
    await expect(strengthMeter.first()).toBeVisible();
  });

  test('CUS-AUTH-010: forgot password form', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    const forgotLink = page.getByRole('link', { name: /forgot|reset/i })
      .or(page.getByText(/forgot.*password/i));
    await expect(forgotLink.first()).toBeVisible();
    await forgotLink.first().click();
    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    await expect(emailInput.first()).toBeVisible();
    const resetBtn = page.getByRole('button', { name: /reset|send|submit/i });
    await expect(resetBtn).toBeVisible();
  });

  test('CUS-AUTH-012: session timeout redirects to login', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByLabel(/email/i).fill('customer@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForLoadState('networkidle');
    // Clear auth tokens to simulate session expiry
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${FRONTEND}/profile`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/login|auth|sign/i);
  });
});
