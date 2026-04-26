import { test, expect } from './fixtures/auth.fixture';

test.describe('Iteration 4 — SVG Path Animation + Footer Links', () => {
  test('BUG-4A: No SVG path console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/restaurant');
    await page.waitForLoadState('networkidle');

    const svgErrors = consoleErrors.filter((e) =>
      e.includes('attribute d') || e.includes('Expected moveto path command')
    );
    expect(svgErrors).toHaveLength(0);
  });

  test('BUG-4A: No SVG path errors on pool page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/pool');
    await page.waitForLoadState('networkidle');

    const svgErrors = consoleErrors.filter((e) =>
      e.includes('attribute d') || e.includes('Expected moveto path command')
    );
    expect(svgErrors).toHaveLength(0);
  });

  test('BUG-4B: Footer tel link is not empty', async ({ page }) => {
    await page.goto('http://localhost:3000/restaurant');
    await page.waitForLoadState('networkidle');

    const telLink = page.locator('a[href^="tel:"]').first();
    const href = await telLink.getAttribute('href');
    expect(href).not.toBe('tel:');
    expect(href!.length).toBeGreaterThan(4); // "tel:" is 4 chars
  });

  test('BUG-4B: Footer mailto link is not empty', async ({ page }) => {
    await page.goto('http://localhost:3000/restaurant');
    await page.waitForLoadState('networkidle');

    const mailLink = page.locator('a[href^="mailto:"]').first();
    const href = await mailLink.getAttribute('href');
    expect(href).not.toBe('mailto:');
    expect(href!.length).toBeGreaterThan(7); // "mailto:" is 7 chars
  });
});
