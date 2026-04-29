import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

type Viewport = { name: string; width: number; height: number };

const viewports: Viewport[] = [
  { name: 'phone-375x812', width: 375, height: 812 },
  { name: 'phone-430x932', width: 430, height: 932 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
];

const routes = [
  '/',
  '/restaurant',
  '/pool',
  '/snack-bar',
  '/chalets',
  '/giftcards',
  '/login',
  '/register',
  '/contact',
  '/privacy',
  '/terms',
];

async function expectNoHorizontalScroll(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      doc: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth },
      body: { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth },
    };
  });

  // Allow a tiny tolerance for subpixel rounding.
  expect(sizes.doc.scrollWidth).toBeLessThanOrEqual(sizes.doc.clientWidth + 1);
  expect(sizes.body.scrollWidth).toBeLessThanOrEqual(sizes.body.clientWidth + 1);
}

test.describe('Smoke - customer responsive shell', () => {
  for (const viewport of viewports) {
    test(`SMOKE-CUSTOMER-RESP @smoke routes render without horizontal scroll (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of routes) {
        await test.step(`${viewport.name} ${route}`, async () => {
          await page.goto(`${FRONTEND_URL}${route}`, { waitUntil: 'domcontentloaded' });

          // Basic sanity: page should render some main content.
          await expect(page.locator('main')).toBeVisible();

          // Primary invariant for this plan: no mobile overflow.
          await expectNoHorizontalScroll(page);
        });
      }
    });
  }
});

