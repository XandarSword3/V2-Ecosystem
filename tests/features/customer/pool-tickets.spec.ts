import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

const SESSION_CARD_SELECTOR = [
  '[data-testid*="session"]',
  '[class*="session-card"]',
  '[class*="pool-session"]',
  '[class*="ticket-card"]',
  '[class*="session"]',
  '[class*="slot"]',
  'article:has-text("Pool")',
  'article:has-text("Session")'
].join(', ');

const getSessionCards = (page: import('@playwright/test').Page) =>
  page.locator(SESSION_CARD_SELECTOR).filter({ hasText: /pool|session|swim|available|spots|am|pm/i });

const openFirstSession = async (page: import('@playwright/test').Page) => {
  const sessions = getSessionCards(page);
  await expect(sessions.first()).toBeVisible();
  await sessions.first().click();
};

test.describe('Customer Pool Tickets [CUS-POOL]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/pool`);
  });

  test('CUS-POOL-001: view available pool sessions', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1, name: /pool|swim|aqua/i }).first();
    await expect(heading).toBeVisible();
    const sessions = getSessionCards(page);
    const count = await sessions.count();
    expect(count).toBeGreaterThan(0);
  });

  test('CUS-POOL-003: check session availability', async ({ page }) => {
    const session = getSessionCards(page).first();
    await expect(session).toBeVisible();
    const availability = session.locator('[class*="avail"], [class*="spots"], [class*="capacity"], text=/available|spots|left|full/i');
    await expect(availability.first()).toBeVisible();
  });

  test('CUS-POOL-004: select ticket type', async ({ page }) => {
    await openFirstSession(page);

    const ticketType = page.getByRole('combobox', { name: /type|ticket/i })
      .or(page.getByLabel(/type|ticket|category/i))
      .or(page.locator('select[name*="type"], select[name*="ticket"]'))
      .or(page.locator('[class*="ticket-type"], [class*="type-select"]'));
    await expect(ticketType.first()).toBeVisible();
  });

  test('CUS-POOL-005: select guest count', async ({ page }) => {
    await openFirstSession(page);

    const guestCount = page.getByLabel(/guest|count|quantity|number/i)
      .or(page.getByRole('spinbutton'))
      .or(page.locator('input[name*="guest"], input[name*="quantity"]'))
      .or(page.locator('input[type="number"]'));
    await expect(guestCount.first()).toBeVisible();
  });

  test('CUS-POOL-006: purchase flow starts', async ({ page }) => {
    await openFirstSession(page);
    const buyBtn = page.getByRole('button', { name: /buy|book|purchase|add|get ticket/i });
    await expect(buyBtn.first()).toBeVisible();
  });

  test('CUS-POOL-009: ticket confirmation shows details', async ({ page }) => {
    await openFirstSession(page);
    const detailSection = page.locator('[class*="detail"], [class*="summary"], [class*="info"]');
    await expect(detailSection.first()).toBeVisible();
    const timeInfo = page.locator('text=/\\d{1,2}[:.:]\\d{2}/');
    await expect(timeInfo.first()).toBeVisible();
  });
});
