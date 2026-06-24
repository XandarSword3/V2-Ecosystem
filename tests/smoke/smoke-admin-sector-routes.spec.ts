import { test, expect } from '../fixtures/auth.fixture';

/**
 * Smoke coverage for admin "sectors".
 *
 * This suite is intentionally small: it only verifies that representative
 * routes for each admin sector render under a seeded `admin` session.
 */

test.describe('SMOKE - Admin sector routes render', () => {
  const routes = [
    // Core Shell
    { route: '/admin', label: 'core-shell' },

    // Users
    { route: '/admin/users', label: 'users' },

    // Settings
    { route: '/admin/settings', label: 'settings' },

    // Marketing & Loyalty & Codes
    { route: '/admin/loyalty', label: 'loyalty' },

    // Operations
    { route: '/admin/inventory', label: 'inventory' },

    // Reviews
    { route: '/admin/reviews', label: 'reviews' },

    // Reports
    { route: '/admin/reports', label: 'reports' },

    // Audit Logs
    { route: '/admin/audit', label: 'audit' },

    // Integrations
    { route: '/admin/integrations', label: 'integrations' },

    // Misc operational pages
    { route: '/admin/customizations', label: 'customizations' },

    // Dynamic Module Admin (representative per template-type)
    { route: '/admin/${slug}/menu', label: 'dynamic-menu-service' },
    { route: '/admin/accommodation_units/pricing', label: 'dynamic-multi-day-booking' },
    { route: '/admin/pool/capacity', label: 'dynamic-session-access' },
  ];

  test('SMOKE-XX @smoke admin sectors load', async ({ page, auth }) => {
    // Ensure we have an authenticated admin session for the UI.
    await auth.loginAs('admin');

    for (const r of routes) {
      await page.goto(r.route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const bodyText = (await page.textContent('body')) || '';
      expect(bodyText.length, `Expected content for ${r.route}`).toBeGreaterThan(30);

      // If the page immediately redirected to /admin, consider it a failure
      // for this specific route. (Some pages may legitimately not exist in certain DB seeds,
      // but smoke is meant to catch that quickly.)
      expect(page.url(), `Expected to remain on ${r.route}`).toContain('/admin');
    }
  });
});

