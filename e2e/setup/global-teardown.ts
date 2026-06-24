/**
 * e2e/setup/global-teardown.ts
 *
 * Runs once after ALL tests complete (pass or fail).
 * Currently a no-op — test tenants are intentionally left in place between runs
 * so global-setup can reset them rather than recreate them every time (faster).
 *
 * If a test creates data that must be cleaned up (e.g. a real Stripe checkout),
 * handle cleanup in that test's afterAll, not here.
 */

import { FullConfig } from '@playwright/test';

export default async function globalTeardown(_config: FullConfig) {
  // Nothing to tear down — test tenants persist between runs and are reset
  // by global-setup on next run. This keeps runs fast.
}
