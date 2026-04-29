/**
 * Admin DB effect verification (Phase 3)
 *
 * This is a minimal mutation -> verification -> cleanup flow.
 * We use an admin-created customization group and verify persistence by:
 *   POST /customizations/groups -> GET /customizations/groups -> DELETE -> GET
 */

import { test, expect } from '../fixtures/auth.fixture';
import { getAuthHeaders, URLS } from './helpers';

const API = URLS.API;

function extractData(body: any): any {
  // Common patterns in this repo:
  // - { success: true, data: ... }
  // - raw array/object (controllers often respond directly)
  return body?.data ?? body?.items ?? body;
}

test.describe('Admin DB Effects — Customizations Group Lifecycle', () => {
  test('create -> verify via GET -> delete -> verify via GET', async ({ page }) => {
    const headers = await getAuthHeaders(page, 'admin');

    const uniqueName = `E2E Test Group ${Date.now()}`;

    // 1) Baseline GET
    const listBeforeResp = await page.request.get(
      `${API}/api/v1/customizations/groups?includeOptions=true`,
      { headers: { Authorization: headers.Authorization } },
    );
    expect(listBeforeResp.status()).toBeLessThan(300);

    const listBeforeBody = await listBeforeResp.json();
    const groupsBefore = extractData(listBeforeBody) as any[];

    const baselineCount = Array.isArray(groupsBefore) ? groupsBefore.length : 0;

    // 2) Create (mutation)
    const createResp = await page.request.post(`${API}/api/v1/customizations/groups`, {
      headers,
      data: {
        name: uniqueName,
        selectionMode: 'single',
        applicableEntityTypes: ['menu_item'],
        // Optional-but-safe defaults; backend service also defaults some fields
        minSelections: 1,
        maxSelections: 1,
        isGlobal: false,
      },
    });

    expect(createResp.status()).toBeLessThan(300);
    const createBody = await createResp.json();
    const createdGroup = extractData(createBody);
    expect(createdGroup).toBeTruthy();
    expect(createdGroup.id).toBeTruthy();

    const groupId = createdGroup.id as string;

    // 3) Verify created group exists (GET)
    const listAfterCreateResp = await page.request.get(
      `${API}/api/v1/customizations/groups?includeOptions=true`,
      { headers: { Authorization: headers.Authorization } },
    );
    expect(listAfterCreateResp.status()).toBeLessThan(300);

    const listAfterCreateBody = await listAfterCreateResp.json();
    const groupsAfterCreate = extractData(listAfterCreateBody) as any[];

    const foundAfterCreate =
      Array.isArray(groupsAfterCreate) &&
      groupsAfterCreate.find((g: any) => g.id === groupId || g.name === uniqueName);
    expect(foundAfterCreate, 'Expected created group to appear in GET list').toBeTruthy();

    // Sanity: ensure the list got larger or at least isn't unchanged.
    if (typeof baselineCount === 'number') {
      expect(groupsAfterCreate.length).toBeGreaterThanOrEqual(baselineCount);
    }

    // 4) Delete (mutation)
    // This endpoint returns 204 with no body.
    const deleteResp = await page.request.delete(`${API}/api/v1/customizations/groups/${groupId}`, {
      headers,
    });
    expect(deleteResp.status()).toBeLessThan(300);

    // 5) Verify deletion (GET)
    const listAfterDeleteResp = await page.request.get(
      `${API}/api/v1/customizations/groups?includeOptions=true`,
      { headers: { Authorization: headers.Authorization } },
    );
    expect(listAfterDeleteResp.status()).toBeLessThan(300);

    const listAfterDeleteBody = await listAfterDeleteResp.json();
    const groupsAfterDelete = extractData(listAfterDeleteBody) as any[];

    const foundAfterDelete =
      Array.isArray(groupsAfterDelete) &&
      groupsAfterDelete.find((g: any) => g.id === groupId || g.name === uniqueName);

    expect(foundAfterDelete, 'Expected deleted group to not appear in GET list').toBeFalsy();
  });
});

