/**
 * e2e/fixtures/auth.fixture.ts
 *
 * Browser-level login helpers for tests that need an authenticated UI session.
 * These drive the actual login page in Chromium — no API shortcuts.
 *
 * Credentials are imported from test-credentials.ts.
 * Never read from env vars here — the password is a known test constant.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  PLATFORM_ADMIN,
} from './test-credentials';

// ---------------------------------------------------------------------------
// Core login helper
// ---------------------------------------------------------------------------

export async function loginAs(
  page: Page,
  subdomain: string,
  email: string,
  password: string,
  waitForUrl: RegExp | string = /\/admin|\/staff|\//,
) {
  await page.goto(`http://${subdomain}.localhost:3000/login`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(waitForUrl, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/** Logs in as the seeded super_admin for a tenant. */
export async function loginAsAdmin(page: Page, subdomain = 'testcorp') {
  await loginAs(
    page,
    subdomain,
    TEST_ADMIN_EMAIL(subdomain),
    TEST_ADMIN_PASSWORD,
    /\/admin/,
  );
}

/** Logs in as a regular customer. Caller supplies credentials. */
export async function loginAsCustomer(
  page: Page,
  subdomain: string,
  email: string,
  password: string,
) {
  await loginAs(page, subdomain, email, password, /\//);
}

// ---------------------------------------------------------------------------
// 2FA helpers
// ---------------------------------------------------------------------------

/** Supply a 6-digit TOTP code on the 2FA step after initial credential submit. */
export async function submitTotpCode(page: Page, code: string) {
  await expect(
    page.locator('input[name="code"], input[placeholder*="code"]')
  ).toBeVisible({ timeout: 5_000 });
  await page.fill('input[name="code"], input[placeholder*="code"]', code);
  await page.click('button[type="submit"], button:has-text("Verify")');
}

/** Supply a 9-digit backup code on the 2FA step. */
export async function submitBackupCode(page: Page, rawCode: string) {
  await page.click('text=backup code, text=Use backup');
  const formatted = rawCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  await page.fill('input[name="backupCode"]', formatted);
  await page.click('button[type="submit"], button:has-text("Verify")');
}

// ---------------------------------------------------------------------------
// Platform-tier admin login
// ---------------------------------------------------------------------------

export async function loginToPlatformAdmin(page: Page) {
  await page.goto('http://platform.localhost:3000/login');
  await page.fill('#email', PLATFORM_ADMIN.email);
  await page.fill('#password', PLATFORM_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin|\/platform-admin/, { timeout: 15_000 });
}
