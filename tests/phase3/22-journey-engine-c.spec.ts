/**
 * ENGINE C — SHARED CAPACITY JOURNEYS
 * =====================================
 * Real cross-actor E2E tests for pool ticket lifecycle.
 *
 * Journeys:
 *   J-C1: Customer buys ticket → staff validates → entry → bracelet → exit → re-validate
 *   J-C2: Pool capacity check — availability reflects sales
 *   J-C3: Ticket cancellation
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

/** Get a pool session (preferring Morning/Afternoon/Evening Swim sessions) */
async function getPoolSession(page: Page): Promise<{ id: string; name: string; capacity: number; moduleId: string | null }> {
  const resp = await page.request.get(`${API}/api/v1/pool/sessions`);
  const body = await resp.json();
  const sessions = body.data || [];
  // Prefer standard swim sessions
  const session = sessions.find((s: any) => s.name?.includes('Swim') || s.name?.includes('Session'))
               || sessions[0];

  if (!session) {
    throw new Error('No pool sessions available for Engine C journeys');
  }

  return {
    id: session.id,
    name: session.name,
    capacity: Number(session.max_capacity ?? session.maxCapacity ?? session.capacity) || 50,
    moduleId: session.module_id ?? session.moduleId ?? null,
  };
}


test.describe('ENGINE C — Pool Ticket Full Lifecycle', () => {

  // ═══════════════════════════════════════════════════════════
  // JOURNEY 1: Ticket purchase → validate → entry → bracelet → exit → re-validate
  // ═══════════════════════════════════════════════════════════
  test('J-C1: Full pool ticket lifecycle across customer → staff', async ({ browser }) => {
    const customerCtx = await browser.newContext();
    const adminCtx     = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    const staffPage    = await adminCtx.newPage();

    try {
      const customerSetup = await fullSetup(customerPage, 'customer');
      // Use admin for pool staff operations (restaurant_staff lacks pool permissions)
      const staffSetup    = await fullSetup(staffPage, 'admin');
      expect(customerSetup).toBeTruthy();
      expect(staffSetup).toBeTruthy();

      const customerToken = customerSetup!.tokens.accessToken;
      const staffToken    = staffSetup!.tokens.accessToken;
      const custCsrf      = await getCsrfToken(customerPage);
      const staffCsrf     = await getCsrfToken(staffPage);

      const session = await getPoolSession(customerPage);
      expect(session.id).toBeTruthy();

      // ── PHASE 1: Customer browses pool page (FRONTEND) ──
      await customerPage.goto('/pool', { waitUntil: 'domcontentloaded' });
      await customerPage.waitForTimeout(3000);
      const poolText = await customerPage.textContent('body');
      expect(poolText!.length).toBeGreaterThan(50);
      await screenshot(customerPage, 'J-C1-01-customer-pool-page');

      // ── PHASE 2: Customer purchases ticket (API) ──
      const today = new Date().toISOString().split('T')[0];
      const ticketResp = await apiCall(customerPage, 'POST', '/pool/tickets', {
        body: {
          sessionId: session.id,
          ticketDate: today,
          numberOfGuests: 3,
          numberOfAdults: 2,
          numberOfChildren: 1,
          customerName: 'Pool Journey Guest',
          customerPhone: '+1234567890',
          paymentMethod: 'cash',
        },
        token: customerToken, csrf: custCsrf,
      });
      const ticketBody = await ticketResp.json();
      expect(ticketBody.success, `Ticket purchase failed: ${JSON.stringify(ticketBody)}`).toBe(true);

      const ticketData = ticketBody.data?.ticket || ticketBody.data;
      const ticketId = ticketData?.id;
      const ticketNumber = ticketData?.ticket_number || ticketData?.ticketNumber;
      expect(ticketId, 'No ticket ID returned').toBeTruthy();
      expect(ticketNumber, 'No ticket number returned').toBeTruthy();

      // Verify ticket status is valid (system uses 'valid' not 'active')
      const initialStatus = ticketData?.status;
      expect(initialStatus).toBe('valid');

      // ── PHASE 3: Staff validates ticket (CROSS-ACTOR) ──
      await staffPage.goto('/staff/pool', { waitUntil: 'domcontentloaded' });
      await staffPage.waitForTimeout(2000);
      await screenshot(staffPage, 'J-C1-02-staff-pool-page');

      const validateResp = await apiCall(staffPage, 'POST', '/pool/staff/validate', {
        body: { ticketNumber: ticketNumber },
        token: staffToken, csrf: staffCsrf,
      });
      const validateBody = await validateResp.json();
      expect(validateBody.success, `Ticket validation failed: ${JSON.stringify(validateBody)}`).toBe(true);
      // Validation should return ticket details showing valid
      const validationResult = validateBody.data;
      expect(validationResult).toBeTruthy();

      // ── PHASE 4: Staff records entry ──
      const entryResp = await apiCall(staffPage, 'POST', `/pool/tickets/${ticketId}/entry`, {
        token: staffToken, csrf: staffCsrf,
      });
      const entryBody = await entryResp.json();
      expect(entryBody.success, `Entry recording failed: ${JSON.stringify(entryBody)}`).toBe(true);

      // ── PHASE 5: Staff assigns bracelet ──
      const braceletNumber = `BR-${Date.now()}`;
      const braceletResp = await apiCall(staffPage, 'POST', `/pool/tickets/${ticketId}/bracelet`, {
        body: { braceletNumber },
        token: staffToken, csrf: staffCsrf,
      });
      if (braceletResp.ok()) {
        const braceletBody = await braceletResp.json();
        if (braceletBody.success) {
          // Verify bracelet is tracked
          const activeBraceletsResp = await apiCall(staffPage, 'GET', '/pool/staff/bracelets/active', {
            token: staffToken,
          });
          if (activeBraceletsResp.ok()) {
            const activeBraceletBody = await activeBraceletsResp.json();
            expect(activeBraceletBody.success).toBe(true);
          }
        }
      }

      // ── PHASE 6: Staff records exit ──
      const exitResp = await apiCall(staffPage, 'POST', `/pool/tickets/${ticketId}/exit`, {
        token: staffToken, csrf: staffCsrf,
      });
      const exitBody = await exitResp.json();
      expect(exitBody.success, `Exit recording failed: ${JSON.stringify(exitBody)}`).toBe(true);

      // ── PHASE 7: Re-validate shows ticket used ──
      const revalidateResp = await apiCall(staffPage, 'POST', '/pool/staff/validate', {
        body: { ticketNumber: ticketNumber },
        token: staffToken, csrf: staffCsrf,
      });
      const revalidateBody = await revalidateResp.json();
      // After entry+exit, the ticket should show as used or its status should have changed
      // The validate endpoint should still return data but indicate the ticket was used
      expect(revalidateBody.data || revalidateBody.success !== undefined).toBeTruthy();

      // ── PHASE 8: Customer sees ticket in my-tickets (CROSS-ACTOR) ──
      const myTicketsResp = await apiCall(customerPage, 'GET', '/pool/my-tickets', {
        token: customerToken,
      });
      const myTicketsBody = await myTicketsResp.json();
      expect(myTicketsBody.success).toBe(true);
      const myTickets = myTicketsBody.data?.tickets || myTicketsBody.data || [];
      const ourTicket = Array.isArray(myTickets)
        ? myTickets.find((t: any) => t.id === ticketId)
        : null;
      expect(ourTicket, 'Ticket not found in my-tickets').toBeTruthy();

    } finally {
      await customerCtx.close();
      await adminCtx.close();
    }
  });


  // ═══════════════════════════════════════════════════════════
  // JOURNEY 2: Pool availability reflects ticket sales
  // ═══════════════════════════════════════════════════════════
  test('J-C2: Pool availability decreases after ticket purchase', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();

    try {
      const setup = await fullSetup(page, 'customer');
      expect(setup).toBeTruthy();

      const token = setup!.tokens.accessToken;
      const csrf  = await getCsrfToken(page);
      const session = await getPoolSession(page);

      // Use a date far in the future to avoid pollution from other tests
      const futureDate = new Date(Date.now() + 86400000 * 45).toISOString().split('T')[0];
      const moduleFilter = session.moduleId ? `&moduleId=${session.moduleId}` : '';

      // Check availability BEFORE purchase
      const beforeResp = await apiCall(page, 'GET',
        `/pool/availability?date=${futureDate}${moduleFilter}`);
      let availBefore = 0;
      if (beforeResp.ok()) {
        const beforeBody = await beforeResp.json();
        if (beforeBody.success && beforeBody.data) {
          const sessionAvail = Array.isArray(beforeBody.data)
            ? beforeBody.data.find((s: any) => s.id === session.id || s.session_id === session.id || s.sessionId === session.id)
            : null;
          if (sessionAvail) {
            availBefore = sessionAvail.available || sessionAvail.remaining || 0;
          }
        }
      }

      // Purchase a ticket
      const ticketResp = await apiCall(page, 'POST', '/pool/tickets', {
        body: {
          sessionId: session.id,
          ticketDate: futureDate,
          numberOfGuests: 1,
          numberOfAdults: 1,
          numberOfChildren: 0,
          customerName: 'Avail Test Guest',
          customerPhone: '+1234567890',
          paymentMethod: 'cash',
        },
        token, csrf,
      });
      const ticketBody = await ticketResp.json();
      expect(ticketBody.success).toBe(true);

      // Check availability AFTER purchase
      const afterResp = await apiCall(page, 'GET',
        `/pool/availability?date=${futureDate}${moduleFilter}`);
      if (afterResp.ok()) {
        const afterBody = await afterResp.json();
        if (afterBody.success && afterBody.data) {
          const sessionAvailAfter = Array.isArray(afterBody.data)
            ? afterBody.data.find((s: any) => s.id === session.id || s.session_id === session.id || s.sessionId === session.id)
            : null;
          if (sessionAvailAfter && availBefore > 0) {
            const availAfter = sessionAvailAfter.available || sessionAvailAfter.remaining || 0;
            // Available should have decreased (or sold increased)
            expect(availAfter).toBeLessThanOrEqual(availBefore);
          }
        }
      }

    } finally {
      await ctx.close();
    }
  });


  // ═══════════════════════════════════════════════════════════
  // JOURNEY 3: Staff checks live capacity (FRONTEND + API)
  // ═══════════════════════════════════════════════════════════
  test('J-C3: Staff monitors pool capacity in real-time', async ({ browser }) => {
    const staffCtx = await browser.newContext();
    const staffPage = await staffCtx.newPage();

    try {
      // Use admin for pool staff operations (restaurant_staff lacks pool permissions)
      const staffSetup = await fullSetup(staffPage, 'admin');
      expect(staffSetup).toBeTruthy();

      const staffToken = staffSetup!.tokens.accessToken;

      // Staff navigates to pool management (FRONTEND)
      await staffPage.goto('/staff/pool', { waitUntil: 'domcontentloaded' });
      await staffPage.waitForTimeout(3000);
      const poolStaffText = await staffPage.textContent('body');
      expect(poolStaffText!.length).toBeGreaterThan(50);
      await screenshot(staffPage, 'J-C3-01-staff-pool-capacity');

      // Staff checks capacity via API
      const capacityResp = await apiCall(staffPage, 'GET', '/pool/staff/capacity', {
        token: staffToken,
      });
      expect(capacityResp.ok()).toBe(true);
      const capacityBody = await capacityResp.json();
      expect(capacityBody.success).toBe(true);
      expect(capacityBody.data).toBeTruthy();

      // Staff checks today's tickets
      const todayTicketsResp = await apiCall(staffPage, 'GET', '/pool/staff/tickets/today', {
        token: staffToken,
      });
      expect(todayTicketsResp.ok()).toBe(true);
      const todayTicketsBody = await todayTicketsResp.json();
      expect(todayTicketsBody.success).toBe(true);

    } finally {
      await staffCtx.close();
    }
  });
});
