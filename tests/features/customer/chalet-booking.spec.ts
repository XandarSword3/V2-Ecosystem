import { test, expect } from '../../fixtures/auth.fixture';

const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:3005/api';

test.describe('Customer Chalet Booking [CUS-CHAL]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND}/chalets`);
  });

  test('CUS-CHAL-001: browse chalet listings', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /chalet|accommodation|cabin/i });
    await expect(heading).toBeVisible();
    const listings = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]');
    const count = await listings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('CUS-CHAL-003: filter by date range', async ({ page }) => {
    const checkIn = page.getByLabel(/check.?in|start|from/i).or(page.getByPlaceholder(/check.?in|arrival/i)).first();
    await expect(checkIn).toBeVisible();
    const checkOut = page.getByLabel(/check.?out|end|to/i).or(page.getByPlaceholder(/check.?out|departure/i)).first();
    await expect(checkOut).toBeVisible();
  });

  test('CUS-CHAL-005: view chalet detail page', async ({ page }) => {
    const chaletCard = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]').first();
    await chaletCard.click();
    const detailHeading = page.getByRole('heading').first();
    await expect(detailHeading).toBeVisible();
    await expect(detailHeading).not.toHaveText('');
    const description = page.locator('[class*="description"], [class*="detail"], p').first();
    await expect(description).toBeVisible();
  });

  test('CUS-CHAL-007: view image gallery', async ({ page }) => {
    const chaletCard = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]').first();
    await chaletCard.click();
    const images = page.locator('[class*="gallery"] img, [class*="carousel"] img, [class*="image"] img');
    await expect(images.first()).toBeVisible();
    const imgSrc = await images.first().getAttribute('src');
    expect(imgSrc).toBeTruthy();
  });

  test('CUS-CHAL-009: check availability calendar', async ({ page }) => {
    const chaletCard = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]').first();
    await chaletCard.click();
    const calendar = page.locator('[class*="calendar"], [class*="availability"], [class*="datepicker"]');
    await expect(calendar.first()).toBeVisible();
  });

  test('CUS-CHAL-011: select booking dates', async ({ page }) => {
    const chaletCard = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]').first();
    await chaletCard.click();
    const dateInput = page.getByLabel(/date|check.?in/i).or(page.getByPlaceholder(/date/i)).first();
    await expect(dateInput).toBeVisible();
    await dateInput.click();
  });

  test('CUS-CHAL-013: view price breakdown', async ({ page }) => {
    const chaletCard = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]').first();
    await chaletCard.click();
    const price = page.locator('[class*="price"], [class*="cost"], [class*="total"]');
    await expect(price.first()).toBeVisible();
    const priceText = await price.first().textContent();
    expect(priceText).toMatch(/\d/);
  });

  test('CUS-CHAL-015: enter special requests', async ({ page }) => {
    const chaletCard = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]').first();
    await chaletCard.click();
    const specialReq = page.getByLabel(/special|request|note/i)
      .or(page.getByPlaceholder(/special|request|note/i))
      .or(page.locator('textarea'));
    await expect(specialReq.first()).toBeVisible();
    await specialReq.first().fill('Early check-in please');
    await expect(specialReq.first()).toHaveValue('Early check-in please');
  });

  test('CUS-CHAL-017: complete booking button present', async ({ page }) => {
    const chaletCard = page.locator('[class*="chalet"], [class*="listing"], [class*="card"]').first();
    await chaletCard.click();
    const bookBtn = page.getByRole('button', { name: /book|reserve|confirm/i });
    await expect(bookBtn.first()).toBeVisible();
  });
});
