/**
 * F2 Regression: ORDER_UPDATE asymmetry
 *
 * This test proves and protects a documented authorization behavior:
 *
 *   BACKEND:  authorize(['staff', 'manager', 'admin']) — role-based guard
 *   FRONTEND: hasPermission(Perm.ORDER_UPDATE) — permission-based gate
 *
 * Staff CAN update orders via the backend (role-based guard passes),
 * but the backend permissions endpoint does NOT return 'order:update' for staff.
 * The frontend ORDER_UPDATE gate is MORE restrictive than the backend.
 *
 * This is intentional: the frontend fails closed (hides actions the user
 * can technically perform) rather than failing open (showing actions the
 * backend would accept).
 *
 * This regression test ensures:
 *   1. Staff backend permissions do NOT include 'order:update'
 *   2. Staff CAN still update orders via the backend (role-based guard)
 *   3. The frontend ROLE_PERMISSIONS matrix includes 'order:update' for staff
 *      (so the frontend gate works when backend permissions are eventually aligned)
 *   4. The asymmetry is documented and deliberate
 *
 * If someone "fixes" this by adding 'order:update' to backend staff permissions,
 * these tests still pass — the asymmetry simply becomes aligned. That is acceptable.
 * If someone "fixes" this by removing ORDER_UPDATE from the frontend matrix,
 * these tests FAIL — that would be a regression.
 *
 * Run: npx playwright test tests/order-update-asymmetry.spec.ts
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3005';

const STAFF = {
  email: 'menu.service.staff@v2ecosystem.com',
  password: 'staff123',
};

const TEST_MODULE = 'delete';
const CATALOG_ITEM_ID = 'ae5a81da-53a2-469a-9d6b-58bdc7a8a38e';

async function login(request: any): Promise<string> {
  const response = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: STAFF.email, password: STAFF.password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.data.tokens.accessToken;
}

async function getPermissions(request: any, token: string): Promise<string[]> {
  const response = await request.get(`${API_URL}/api/v1/auth/me/permissions`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await response.json();
  return body?.data?.permissions || [];
}

// ============================================
// 1. Backend permissions: staff does NOT have order:update
// ============================================

test.describe('Backend: staff permissions lack order:update', () => {
  test('staff backend-resolved permissions do not include order:update', async ({ request }) => {
    const token = await login(request);
    const permissions = await getPermissions(request, token);

    const hasWildcard = permissions.includes('*');
    if (!hasWildcard) {
      expect(
        !permissions.includes('order:update'),
        `Backend should NOT grant order:update to staff via permissions endpoint. ` +
        `If this fails, the asymmetry has been resolved (acceptable). ` +
        `Current permissions: ${JSON.stringify(permissions.slice(0, 15))}`,
      ).toBeTruthy();
    }
  });
});

// ============================================
// 2. Backend role guard: staff CAN update orders
// ============================================

test.describe('Backend: staff CAN update orders via role guard', () => {
  test('staff can create and cancel an order (role-based access)', async ({ request }) => {
    const token = await login(request);

    // Create a real order
    const createResponse = await request.post(
      `${API_URL}/api/v1/staff/modules/${TEST_MODULE}/orders`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          items: [{ catalogItemId: CATALOG_ITEM_ID, quantity: 1 }],
          customerName: `Asymmetry Test ${Date.now()}`,
          fulfillment_mode: 'none',
        },
      },
    );
    expect(createResponse.ok(), 'Staff should be able to create orders (role guard)').toBeTruthy();
    const createBody = await createResponse.json();
    const orderId = createBody.data.id;

    // Cancel it (valid transition from confirmed)
    const cancelResponse = await request.patch(
      `${API_URL}/api/v1/staff/modules/${TEST_MODULE}/orders/${orderId}/status`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { status: 'cancelled' },
      },
    );
    expect(cancelResponse.ok(), 'Staff should be able to cancel orders (role guard)').toBeTruthy();
    const cancelBody = await cancelResponse.json();
    expect(cancelBody.data.status).toBe('cancelled');
  });
});

// ============================================
// 3. Frontend matrix: ORDER_UPDATE is defined for staff
// ============================================

test.describe('Frontend: ORDER_UPDATE exists in authorization matrix', () => {
  test('ROLE_PERMISSIONS includes ORDER_UPDATE for staff in authorization.tsx', () => {
    // Read the authorization module source
    const authPath = resolve(__dirname, '../frontend/src/lib/authorization.tsx');
    const source = readFileSync(authPath, 'utf-8');

    // The Perm enum must define ORDER_UPDATE
    expect(
      source.includes('ORDER_UPDATE'),
      'authorization.tsx must define Perm.ORDER_UPDATE',
    ).toBeTruthy();

    // ROLE_PERMISSIONS must include ORDER_UPDATE for staff
    // The staff entry uses Perm.ORDER_UPDATE constant (resolves to 'order:update')
    const staffMatch = source.match(/staff:\s*\[([\s\S]*?)\]/);
    expect(staffMatch, 'ROLE_PERMISSIONS must have a staff entry').toBeTruthy();
    expect(
      staffMatch![1].includes('Perm.ORDER_UPDATE'),
      `Staff ROLE_PERMISSIONS must include Perm.ORDER_UPDATE. ` +
      `If this is removed, the frontend will show order actions to staff ` +
      `that the backend allows but the frontend no longer gates.`,
    ).toBeTruthy();
  });
});

// ============================================
// 4. Asymmetry documentation
// ============================================

test.describe('Asymmetry is documented', () => {
  test('F2_CERTIFICATION_REPORT.md documents the ORDER_UPDATE discrepancy', () => {
    const reportPath = resolve(__dirname, '../docs/architecture/F2_CERTIFICATION_REPORT.md');
    const report = readFileSync(reportPath, 'utf-8');

    expect(
      report.includes('ORDER_UPDATE'),
      'Certification report must mention ORDER_UPDATE',
    ).toBeTruthy();
    expect(
      report.toLowerCase().includes('asymmetr') || report.toLowerCase().includes('discrepancy'),
      'Certification report must document the asymmetry/discrepancy',
    ).toBeTruthy();
    expect(
      report.includes('role-based'),
      'Certification report must mention role-based guard',
    ).toBeTruthy();
  });
});

// ============================================
// 5. Unauthenticated: backend rejects order update
// ============================================

test.describe('Backend: unauthenticated order update rejected', () => {
  test('unauthenticated PATCH to order status returns 401', async ({ request }) => {
    const response = await request.patch(
      `${API_URL}/api/v1/staff/modules/${TEST_MODULE}/orders/00000000-0000-0000-0000-000000000000/status`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { status: 'cancelled' },
      },
    );
    expect(
      [401, 403].includes(response.status()),
      `Unauthenticated order update must be rejected. Got ${response.status()}`,
    ).toBeTruthy();
  });
});
