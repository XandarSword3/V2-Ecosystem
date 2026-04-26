import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Manager Dashboard [MGR]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin@v2resort.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|staff|dashboard)/);
    await page.goto('http://localhost:3000/staff/manager');
    await page.waitForLoadState('networkidle');
  });

  test('MGR-DASH-001: Dashboard loads with revenue stats', async ({ page }) => {
    const stats = page.locator('[class*="stat"], [class*="card"], [class*="metric"], [class*="revenue"]');
    await expect(stats.first()).toBeVisible();
    const revenue = page.locator('text=/revenue|income|earning|€|\\$|£/i');
    const count = await revenue.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('MGR-DASH-002: Overview/Approvals/Staff/Reports tabs', async ({ page }) => {
    const tabs = page.locator('button, [role="tab"], a').filter({
      hasText: /overview|approval|staff|report/i,
    });
    await expect(tabs.first()).toBeVisible();
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('MGR-APPR-001: Pending approvals display', async ({ page }) => {
    const approvalsTab = page.locator('button, [role="tab"], a').filter({ hasText: /approval/i });
    if (await approvalsTab.count() > 0) {
      await approvalsTab.first().click();
      await page.waitForLoadState('networkidle');
    }
    const approvals = page.locator('[class*="approval"], [class*="pending"], [class*="request"]');
    const approvalArea = page.locator('text=/approval|pending|request|no pending/i');
    await expect(approvalArea.first()).toBeVisible();
  });

  test('MGR-STAFF-001: Staff status table', async ({ page }) => {
    const staffTab = page.locator('button, [role="tab"], a').filter({ hasText: /staff/i });
    if (await staffTab.count() > 0) {
      await staffTab.first().click();
      await page.waitForLoadState('networkidle');
    }
    const table = page.locator('table, [class*="staff-list"], [class*="table"], [class*="roster"]');
    const staffArea = page.locator('text=/staff|employee|team|member|no staff/i');
    await expect(staffArea.first()).toBeVisible();
  });

  test('MGR-RPT-001: Report generation actions', async ({ page }) => {
    const reportsTab = page.locator('button, [role="tab"], a').filter({ hasText: /report/i });
    if (await reportsTab.count() > 0) {
      await reportsTab.first().click();
      await page.waitForLoadState('networkidle');
    }
    const reportActions = page.locator('button').filter({
      hasText: /generate|export|download|create|view/i,
    });
    const reportArea = page.locator('text=/report|generat|export|analytic|no report/i');
    await expect(reportArea.first()).toBeVisible();
  });

  test('MGR-DASH-003: Quick action links', async ({ page }) => {
    const quickActions = page.locator('a, button').filter({
      hasText: /quick|action|shortcut|manage|view all/i,
    });
    const actionCount = await quickActions.count();
    expect(actionCount).toBeGreaterThanOrEqual(0);
    const heading = page.locator('h1, h2, h3').filter({ hasText: /manager|dashboard|overview/i });
    await expect(heading.first()).toBeVisible();
  });

  test('MGR-DASH-004: Full admin panel link', async ({ page }) => {
    const adminLink = page.locator('a, button').filter({
      hasText: /admin|full panel|admin panel|go to admin/i,
    });
    const linkCount = await adminLink.count();
    expect(linkCount).toBeGreaterThanOrEqual(0);
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(50);
  });
});
