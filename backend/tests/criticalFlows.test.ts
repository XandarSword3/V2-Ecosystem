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

// Skip integration tests unless explicitly enabled
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('Order Creation (Integration)', () => {
  it('should create a restaurant order successfully', async () => {
    const res = await request(app)
      .post('/api/restaurant/orders')
      .send({
        customerName: 'Test User',
        customerPhone: '+1234567890',
        orderType: 'dine_in',
        items: [
          { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 2 }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orderNumber');
  });
});

describeIntegration('Authentication (Integration)', () => {
  it('should login and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@v2resort.com', password: 'Admin123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
  });
});

describeIntegration('Double Booking Prevention (Integration)', () => {
  it('should prevent double booking for the same chalet and dates', async () => {
    const bookingPayload = {
      chaletId: '550e8400-e29b-41d4-a716-446655440001',
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
      .post('/api/chalets/bookings')
      .send(bookingPayload);
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    // Second booking for same dates should fail
    const res2 = await request(app)
      .post('/api/chalets/bookings')
      .send(bookingPayload);
    expect(res2.status).not.toBe(200);
    expect(res2.body.success).toBe(false);
  });
});

describeIntegration('Payment Processing (Integration)', () => {
  it('should process payment and not fail', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({
        referenceType: 'order',
        referenceId: '550e8400-e29b-41d4-a716-446655440002',
        amount: 100,
        currency: 'USD',
        method: 'card'
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });
});

// Real-time update tests would require socket.io client and server setup, typically in a separate test file.