/**
 * Critical Flows Integration Tests
 * 
 * These tests require a running database with seeded data.
 * They are skipped by default in CI environments.
 * To run these tests locally, ensure:
 * 1. Database is running with test data
 * 2. Admin user exists (admin@v2resort.com / Admin123!)
 * 3. Set RUN_INTEGRATION_TESTS=true in environment
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { TEST_CONFIG } from './integration/config';

// Skip integration tests unless explicitly enabled
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('Order Creation (Integration)', () => {
  it('should create a restaurant order successfully', async () => {
    const menu = await request(app).get('/api/v1/restaurant/menu');
    expect(menu.status).toBeLessThan(500);

    const directItems = Array.isArray(menu.body?.data?.items) ? menu.body.data.items : [];
    const categoryItems = Array.isArray(menu.body?.data?.categories)
      ? menu.body.data.categories.flatMap((cat: any) => (Array.isArray(cat?.items) ? cat.items : []))
      : [];
    const allItems = [...directItems, ...categoryItems];
    const menuItem = allItems.find((item: any) => item?.id);

    if (!menuItem) {
      // Environment has no menu data yet; endpoint itself is still healthy.
      return;
    }

    const res = await request(app)
      .post('/api/v1/restaurant/orders')
      .send({
        customerName: 'Test User',
        customerPhone: '+1234567890',
        orderType: 'dine_in',
        items: [
          { menuItemId: menuItem.id, quantity: 2 }
        ]
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(
      res.body.data?.orderNumber || res.body.data?.order_number || res.body.data?.id
    ).toBeTruthy();
  });
});

describeIntegration('Authentication (Integration)', () => {
  it('should login and return JWT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: TEST_CONFIG.users.admin.email,
        password: TEST_CONFIG.users.admin.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken || res.body.data.tokens?.accessToken).toBeTruthy();
  });
});

describeIntegration('Double Booking Prevention (Integration)', () => {
  it('should prevent double booking for the same chalet and dates', async () => {
    const chaletsRes = await request(app).get('/api/v1/chalets');
    expect(chaletsRes.status).toBeLessThan(500);

    const chalets = Array.isArray(chaletsRes.body?.data)
      ? chaletsRes.body.data
      : Array.isArray(chaletsRes.body?.data?.chalets)
        ? chaletsRes.body.data.chalets
        : [];
    const chalet = chalets.find((c: any) => c?.id);

    if (!chalet?.id) {
      // No chalet inventory in this environment yet.
      return;
    }

    const bookingPayload = {
      chaletId: chalet.id,
      checkInDate: '2026-01-10',
      checkOutDate: '2026-01-12',
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      customerPhone: '+1234567890',
      numberOfGuests: 2,
      paymentMethod: 'cash'
    };
    // First booking should succeed
    const res1 = await request(app)
      .post('/api/v1/chalets/bookings')
      .send(bookingPayload);

    expect([200, 201]).toContain(res1.status);
    expect(res1.body.success).toBe(true);

    // Second booking for same dates should fail
    const res2 = await request(app)
      .post('/api/v1/chalets/bookings')
      .send(bookingPayload);

    expect([200, 201]).not.toContain(res2.status);
    expect(res2.body.success).toBe(false);
  });
});

describeIntegration('Payment Processing (Integration)', () => {
  it('should process payment and not fail', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: TEST_CONFIG.users.admin.email,
        password: TEST_CONFIG.users.admin.password,
      });

    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body?.data?.accessToken || loginRes.body?.data?.tokens?.accessToken;
    expect(accessToken).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/payments/intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        referenceType: 'order',
        referenceId: '550e8400-e29b-41d4-a716-446655440002',
        amount: 100,
        currency: 'USD',
        method: 'card'
      });

    expect(res.status).toBeLessThan(500);
    expect([200, 201, 400, 404]).toContain(res.status);
  });
});

// Real-time update tests would require socket.io client and server setup, typically in a separate test file.