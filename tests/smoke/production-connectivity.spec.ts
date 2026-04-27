import { test, expect } from '../fixtures/auth.fixture';

const FRONTEND_URL =
  process.env.PRODUCTION_FRONTEND_URL ||
  process.env.FRONTEND_URL ||
  'https://v2-ecosystem.vercel.app';

const API_URL =
  process.env.PRODUCTION_API_URL ||
  process.env.API_URL ||
  'https://v2-resort-backend.onrender.com';

const CRITICAL_ENDPOINTS = [
  '/api/settings',
  '/api/modules?activeOnly=true',
  '/api/v1/terminology?business_type=resort',
];

async function expectNoVisibleText(page: import('../fixtures/auth.fixture').Page, text: string): Promise<void> {
  const visibleCount = await page.locator(`text=${text}`).evaluateAll((nodes) => {
    return nodes.filter((node) => {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      return isDisplayed && element.offsetParent !== null;
    }).length;
  });

  expect(visibleCount, `Visible occurrences of "${text}"`).toBe(0);
}

test.describe('Smoke - Production Connectivity', () => {
  test('PROD-01 @production public pages render without fatal fallback card', async ({ page }) => {
    for (const path of ['/', '/restaurant']) {
      await page.goto(`${FRONTEND_URL}${path}`, { waitUntil: 'domcontentloaded' });

      // Give async API calls enough time to settle and surface fallback UI.
      // Avoid strict network-idle waiting on pages that keep long-polling connections.
      await page.waitForTimeout(3000);

      await expectNoVisibleText(page, 'An error occurred');
      await expectNoVisibleText(page, 'Please try again later');
    }
  });

  test('PROD-02 @production browser fetch can reach critical public APIs', async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    const results = await page.evaluate(
      async ({ apiUrl, endpoints }) => {
        const checks: Array<{ endpoint: string; ok: boolean; status: number; error: string | null }> = [];

        for (const endpoint of endpoints) {
          let lastResult: { endpoint: string; ok: boolean; status: number; error: string | null } | null = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 30000);
              const response = await fetch(`${apiUrl}${endpoint}`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                signal: controller.signal,
              });
              clearTimeout(timeout);

              lastResult = {
                endpoint,
                ok: response.ok,
                status: response.status,
                error: null,
              };
              if (response.ok) break;
            } catch (error) {
              lastResult = {
                endpoint,
                ok: false,
                status: 0,
                error: error instanceof Error ? error.message : String(error),
              };
            }

            if (attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 3000));
            }
          }
          checks.push(lastResult || { endpoint, ok: false, status: 0, error: 'Unknown fetch failure' });
        }

        return checks;
      },
      { apiUrl: API_URL, endpoints: CRITICAL_ENDPOINTS }
    );

    for (const result of results) {
      expect(result.error, `${result.endpoint} failed due to browser-side fetch/CORS`).toBeNull();
      expect(result.ok, `${result.endpoint} returned non-2xx status ${result.status}`).toBe(true);
    }
  });
});
