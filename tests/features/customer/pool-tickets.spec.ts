import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Customer Pool Tickets [CUS-POOL]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/pool`);
  });

  test('CUS-POOL-001: view available pool sessions', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /pool|swim|aqua/i });
    await expect(heading).toBeVisible();
    const sessions = page.locator('[class*="session"], [class*="slot"], [class*="card"]');
    const count = await sessions.count();
    expect(count).toBeGreaterThan(0);
  });

  test('CUS-POOL-003: check session availability', async ({ page }) => {
    const session = page.locator('[class*="session"], [class*="slot"], [class*="card"]').first();
    await expect(session).toBeVisible();
    const availability = session.locator('[class*="avail"], [class*="spots"], [class*="capacity"], text=/available|spots|left|full/i');
    await expect(availability.first()).toBeVisible();
  });

  test('CUS-POOL-004: select ticket type', async ({ page }) => {
    const ticketType = page.getByRole('combobox', { name: /type|ticket/i })
      .or(page.getByLabel(/type|ticket|category/i))
      .or(page.locator('[class*="ticket-type"], [class*="type-select"]'));
    await expect(ticketType.first()).toBeVisible();
  });

  test('CUS-POOL-005: select guest count', async ({ page }) => {
    const guestCount = page.getByLabel(/guest|count|quantity|number/i)
      .or(page.getByRole('spinbutton'))
      .or(page.locator('input[type="number"]'));
    await expect(guestCount.first()).toBeVisible();
  });

  test('CUS-POOL-006: purchase flow starts', async ({ page }) => {
    const session = page.locator('[class*="session"], [class*="slot"], [class*="card"]').first();
    await session.click();
    const buyBtn = page.getByRole('button', { name: /buy|book|purchase|add|get ticket/i });
    await expect(buyBtn.first()).toBeVisible();
  });

  test('CUS-POOL-009: ticket confirmation shows details', async ({ page }) => {
    const session = page.locator('[class*="session"], [class*="slot"], [class*="card"]').first();
    await session.click();
    const detailSection = page.locator('[class*="detail"], [class*="summary"], [class*="info"]');
    await expect(detailSection.first()).toBeVisible();
    const timeInfo = page.locator('text=/\\d{1,2}[:.:]\\d{2}/');
    await expect(timeInfo.first()).toBeVisible();
  });
});
