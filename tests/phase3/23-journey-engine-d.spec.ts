/**
 * ENGINE D - ONGOING ENTITLEMENT JOURNEYS
 * =========================================
 * Real cross-actor E2E tests for loyalty and gift card systems.
 *
 * Journeys:
 *   J-D1: Loyalty enrollment -> earn points -> check balance -> redeem
 *   J-D2: Gift card purchase -> check balance -> partial redeem -> balance updated
 *   J-D3: Admin adjusts loyalty points -> customer sees change
 */

import { test, expect, Page } from '@playwright/test';
import {
  URLS, CREDS, fullSetup, getCsrfToken, screenshot,
} from './helpers';

const API = URLS.API;

async function apiCall(page: Page, method: string, path: string, opts?: {
  body?: any; token?: string; csrf?: string;
}) {
  const url = `${API}/api/v1${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.token) headers['Authorization'] = `Bearer ${opts.token}`;
  if (opts?.csrf)  headers['x-csrf-token'] = opts.csrf;
  const reqOpts: any = { headers };
  if (opts?.body) reqOpts.data = opts.body;

  switch (method.toUpperCase()) {
    case 'GET':    return page.request.get(url, reqOpts);
    case 'POST':   return page.request.post(url, reqOpts);
    case 'PUT':    return page.request.put(url, reqOpts);
    case 'PATCH':  return page.request.patch(url, reqOpts);
    case 'DELETE': return page.request.delete(url, reqOpts);
    default:       return page.request.get(url, reqOpts);
  }
}


test.describe('ENGINE D - Loyalty Program Journey', () => {

  // JOURNEY 1: Loyalty enrollment -> earn -> check -> redeem
  test('J-D1: Loyalty lifecycle - enroll, earn, redeem across actors', async ({ browser }) => {
    const customerCtx = await browser.newContext();
    const staffCtx    = await browser.newContext();
    const adminCtx    = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    const staffPage    = await staffCtx.newPage();
    const adminPage    = await adminCtx.newPage();

    try {
      const customerSetup = await fullSetup(customerPage, 'customer');
      // Use admin for staff operations (restaurant_staff lacks loyalty permissions)
      const staffSetup    = await fullSetup(staffPage, 'admin');
      const adminSetup    = await fullSetup(adminPage, 'admin');
      expect(customerSetup).toBeTruthy();
      expect(staffSetup).toBeTruthy();
      expect(adminSetup).toBeTruthy();

      const customerToken = customerSetup!.tokens.accessToken;
      const staffToken    = staffSetup!.tokens.accessToken;
      const adminToken    = adminSetup!.tokens.accessToken;
      const custCsrf      = await getCsrfToken(customerPage);
      const staffCsrf     = await getCsrfToken(staffPage);
      const adminCsrf     = await getCsrfToken(adminPage);

      // PHASE 1: Check loyalty settings (public)
      const settingsResp = await apiCall(customerPage, 'GET', '/loyalty/settings');
      expect(settingsResp.ok()).toBe(true);
      const settingsBody = await settingsResp.json();
      expect(settingsBody.success).toBe(true);

      // PHASE 2: Customer enrolls in loyalty program
      const enrollResp = await apiCall(customerPage, 'POST', '/loyalty/enroll', {
        token: customerToken, csrf: custCsrf,
      });
      const enrollBody = await enrollResp.json();
      // May already be enrolled from previous test runs
      const isEnrolled = enrollBody.success || (enrollBody.message && enrollBody.message.includes('already'));
      expect(isEnrolled, `Enrollment failed: ${JSON.stringify(enrollBody)}`).toBeTruthy();

      // PHASE 3: Check initial balance
      const meResp = await apiCall(customerPage, 'GET', '/loyalty/me', {
        token: customerToken,
      });
      expect(meResp.ok()).toBe(true);
      const meBody = await meResp.json();
      expect(meBody.success).toBe(true);
      const initialPoints = meBody.data?.available_points || meBody.data?.account?.available_points || 0;

      // PHASE 4: Staff awards points to customer (CROSS-ACTOR)
      const customerId = customerSetup!.user.id;
      const earnResp = await apiCall(staffPage, 'POST', '/loyalty/earn', {
        body: {
          userId: customerId,
          points: 500,
          description: 'E2E test points award',
          referenceType: 'manual',
        },
        token: staffToken, csrf: staffCsrf,
      });
      const earnBody = await earnResp.json();
      expect(earnBody.success, `Earn points failed: ${JSON.stringify(earnBody)}`).toBe(true);

      // PHASE 5: Customer sees updated balance (CROSS-ACTOR VERIFICATION)
      const me2Resp = await apiCall(customerPage, 'GET', '/loyalty/me', {
        token: customerToken,
      });
      const me2Body = await me2Resp.json();
      expect(me2Body.success).toBe(true);
      const updatedPoints = me2Body.data?.available_points || me2Body.data?.account?.available_points || 0;
      expect(updatedPoints).toBeGreaterThanOrEqual(initialPoints + 500);

      // PHASE 6: Customer views loyalty page (FRONTEND)
      await customerPage.goto('/account/loyalty', { waitUntil: 'domcontentloaded' });
      await customerPage.waitForTimeout(3000);
      await screenshot(customerPage, 'J-D1-01-customer-loyalty-page');

      // PHASE 7: Staff redeems points for customer
      const redeemAmount = 100;
      const redeemResp = await apiCall(staffPage, 'POST', '/loyalty/redeem', {
        body: {
          userId: customerId,
          points: redeemAmount,
          description: 'E2E test redemption',
          referenceType: 'order',
        },
        token: staffToken, csrf: staffCsrf,
      });
      const redeemBody = await redeemResp.json();
      expect(redeemBody.success, `Redeem failed: ${JSON.stringify(redeemBody)}`).toBe(true);

      // PHASE 8: Customer balance decreased (CROSS-ACTOR VERIFICATION)
      const me3Resp = await apiCall(customerPage, 'GET', '/loyalty/me', {
        token: customerToken,
      });
      const me3Body = await me3Resp.json();
      expect(me3Body.success).toBe(true);
      const afterRedeemPoints = me3Body.data?.available_points || me3Body.data?.account?.available_points || 0;
      expect(afterRedeemPoints).toBe(updatedPoints - redeemAmount);

      // PHASE 9: Customer sees transaction history
      const txResp = await apiCall(customerPage, 'GET', '/loyalty/me/transactions', {
        token: customerToken,
      });
      const txBody = await txResp.json();
      expect(txBody.success).toBe(true);
      const transactions = txBody.data?.transactions || txBody.data || [];
      expect(Array.isArray(transactions) ? transactions.length : 0).toBeGreaterThanOrEqual(2);

      // PHASE 10: Admin sees all loyalty accounts (CROSS-ACTOR)
      const adminAccountsResp = await apiCall(adminPage, 'GET', '/loyalty/accounts', {
        token: adminToken,
      });
      expect(adminAccountsResp.ok()).toBe(true);
      const adminAccountsBody = await adminAccountsResp.json();
      expect(adminAccountsBody.success).toBe(true);

      // Admin can see loyalty stats
      const statsResp = await apiCall(adminPage, 'GET', '/loyalty/stats', {
        token: adminToken,
      });
      if (statsResp.ok()) {
        const statsBody = await statsResp.json();
        expect(statsBody.success).toBe(true);
      }

    } finally {
      await customerCtx.close();
      await staffCtx.close();
      await adminCtx.close();
    }
  });


  // JOURNEY 2: Admin adjusts loyalty points -> customer sees change
  test('J-D2: Admin adjusts loyalty points, customer sees change', async ({ browser }) => {
    const customerCtx = await browser.newContext();
    const adminCtx    = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    const adminPage    = await adminCtx.newPage();

    try {
      const customerSetup = await fullSetup(customerPage, 'customer');
      const adminSetup    = await fullSetup(adminPage, 'admin');
      expect(customerSetup).toBeTruthy();
      expect(adminSetup).toBeTruthy();

      const customerToken = customerSetup!.tokens.accessToken;
      const adminToken    = adminSetup!.tokens.accessToken;
      const adminCsrf     = await getCsrfToken(adminPage);

      // Get current balance
      const beforeResp = await apiCall(customerPage, 'GET', '/loyalty/me', {
        token: customerToken,
      });
      const beforeBody = await beforeResp.json();
      const beforePoints = beforeBody.data?.available_points || beforeBody.data?.account?.available_points || 0;

      // Admin adjusts points
      const adjustResp = await apiCall(adminPage, 'POST', '/loyalty/adjust', {
        body: {
          userId: customerSetup!.user.id,
          points: 200,
          reason: 'E2E admin adjustment test',
        },
        token: adminToken, csrf: adminCsrf,
      });
      const adjustBody = await adjustResp.json();
      expect(adjustBody.success, `Adjust failed: ${JSON.stringify(adjustBody)}`).toBe(true);

      // Customer sees the adjustment
      const afterResp = await apiCall(customerPage, 'GET', '/loyalty/me', {
        token: customerToken,
      });
      const afterBody = await afterResp.json();
      const afterPoints = afterBody.data?.available_points || afterBody.data?.account?.available_points || 0;
      expect(afterPoints).toBe(beforePoints + 200);

      // Admin views loyalty admin page (FRONTEND)
      await adminPage.goto('/admin/loyalty', { waitUntil: 'domcontentloaded' });
      await adminPage.waitForTimeout(3000);
      await screenshot(adminPage, 'J-D2-01-admin-loyalty-page');

    } finally {
      await customerCtx.close();
      await adminCtx.close();
    }
  });
});


test.describe('ENGINE D - Gift Card Journey', () => {

  // JOURNEY 3: Gift card creation -> check balance -> redeem -> balance reduced
  test('J-D3: Gift card lifecycle - admin creates, customer checks, redeems', async ({ browser }) => {
    const adminCtx    = await browser.newContext();
    const customerCtx = await browser.newContext();
    const adminPage    = await adminCtx.newPage();
    const customerPage = await customerCtx.newPage();

    try {
      const adminSetup    = await fullSetup(adminPage, 'admin');
      const customerSetup = await fullSetup(customerPage, 'customer');
      expect(adminSetup).toBeTruthy();
      expect(customerSetup).toBeTruthy();

      const adminToken    = adminSetup!.tokens.accessToken;
      const customerToken = customerSetup!.tokens.accessToken;
      const adminCsrf     = await getCsrfToken(adminPage);
      const custCsrf      = await getCsrfToken(customerPage);

      // PHASE 1: Admin creates a gift card
      const createResp = await apiCall(adminPage, 'POST', '/giftcards', {
        body: {
          amount: 50.00,
          recipientEmail: CREDS.customer.email,
          recipientName: 'Test Customer',
          message: 'E2E test gift card',
        },
        token: adminToken, csrf: adminCsrf,
      });
      const createBody = await createResp.json();
      expect(createBody.success, `Gift card creation failed: ${JSON.stringify(createBody)}`).toBe(true);
      const giftCardId = createBody.data?.id || createBody.data?.giftCard?.id;
      const giftCardCode = createBody.data?.code || createBody.data?.giftCard?.code;
      expect(giftCardCode, 'No gift card code returned').toBeTruthy();

      // PHASE 2: Admin views gift cards page (FRONTEND)
      await adminPage.goto('/admin/giftcards', { waitUntil: 'domcontentloaded' });
      await adminPage.waitForTimeout(3000);
      await screenshot(adminPage, 'J-D3-01-admin-giftcards-page');

      // PHASE 3: Customer checks balance (PUBLIC, CROSS-ACTOR)
      const checkResp = await apiCall(customerPage, 'GET', `/giftcards/check/${giftCardCode}`);
      const checkBody = await checkResp.json();
      expect(checkBody.success, `Balance check failed: ${JSON.stringify(checkBody)}`).toBe(true);
      const initialBalance = checkBody.data?.balance ?? checkBody.data?.giftCard?.balance;
      expect(Number(initialBalance)).toBe(50.00);

      // PHASE 4: Customer redeems partial amount
      const redeemResp = await apiCall(customerPage, 'POST', '/giftcards/redeem', {
        body: {
          code: giftCardCode,
          amount: 20.00,
        },
        token: customerToken, csrf: custCsrf,
      });
      const redeemBody = await redeemResp.json();
      expect(redeemBody.success, `Redeem failed: ${JSON.stringify(redeemBody)}`).toBe(true);

      // PHASE 5: Balance decreased (CROSS-ACTOR VERIFICATION)
      const check2Resp = await apiCall(customerPage, 'GET', `/giftcards/check/${giftCardCode}`);
      const check2Body = await check2Resp.json();
      expect(check2Body.success).toBe(true);
      const remainingBalance = check2Body.data?.balance ?? check2Body.data?.giftCard?.balance;
      expect(Number(remainingBalance)).toBe(30.00);

      // PHASE 6: Redeem the rest
      const redeem2Resp = await apiCall(customerPage, 'POST', '/giftcards/redeem', {
        body: {
          code: giftCardCode,
          amount: 30.00,
        },
        token: customerToken, csrf: custCsrf,
      });
      const redeem2Body = await redeem2Resp.json();
      expect(redeem2Body.success, `Second redeem failed: ${JSON.stringify(redeem2Body)}`).toBe(true);

      // PHASE 7: Balance is now zero
      const check3Resp = await apiCall(customerPage, 'GET', `/giftcards/check/${giftCardCode}`);
      const check3Body = await check3Resp.json();
      expect(check3Body.success).toBe(true);
      const finalBalance = check3Body.data?.balance ?? check3Body.data?.giftCard?.balance;
      expect(Number(finalBalance)).toBe(0);

      // PHASE 8: Attempt to redeem on zero balance -> should fail
      const redeem3Resp = await apiCall(customerPage, 'POST', '/giftcards/redeem', {
        body: {
          code: giftCardCode,
          amount: 5.00,
        },
        token: customerToken, csrf: custCsrf,
      });
      const redeem3Body = await redeem3Resp.json();
      // Should fail - insufficient balance
      expect(redeem3Body.success).toBe(false);

      // PHASE 9: Admin views gift card stats (CROSS-ACTOR)
      const statsResp = await apiCall(adminPage, 'GET', '/giftcards/stats', {
        token: adminToken,
      });
      if (statsResp.ok()) {
        const statsBody = await statsResp.json();
        expect(statsBody.success).toBe(true);
      }

      // PHASE 10: Admin disables the gift card
      if (giftCardId) {
        const disableResp = await apiCall(adminPage, 'PUT', `/giftcards/${giftCardId}/disable`, {
          token: adminToken, csrf: adminCsrf,
        });
        if (disableResp.ok()) {
          const disableBody = await disableResp.json();
          expect(disableBody.success).toBe(true);
        }
      }

    } finally {
      await adminCtx.close();
      await customerCtx.close();
    }
  });


  // JOURNEY 4: Customer views their gift cards (FRONTEND + API)
  test('J-D4: Customer views gift cards in account', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();

    try {
      const setup = await fullSetup(page, 'customer');
      expect(setup).toBeTruthy();

      const token = setup!.tokens.accessToken;

      // Customer checks their gift cards via API
      const myCardsResp = await apiCall(page, 'GET', '/giftcards/my', { token });
      expect(myCardsResp.ok()).toBe(true);
      const myCardsBody = await myCardsResp.json();
      expect(myCardsBody.success).toBe(true);

      // Navigate to gift cards page in account (FRONTEND)
      await page.goto('/account/giftcards', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await screenshot(page, 'J-D4-01-customer-giftcards-account');

      // Check gift card templates are public
      const templatesResp = await apiCall(page, 'GET', '/giftcards/templates');
      expect(templatesResp.ok()).toBe(true);
      const templatesBody = await templatesResp.json();
      expect(templatesBody.success).toBe(true);

    } finally {
      await ctx.close();
    }
  });
});
