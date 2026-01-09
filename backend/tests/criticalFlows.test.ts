import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('Order Creation', () => {
  it('should create a restaurant order successfully', async () => {
    const res = await request(app)
      .post('/api/restaurant/orders')
      .send({
        customerName: 'Test User',
        customerPhone: '1234567890',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'test-id', quantity: 2 }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orderNumber');
  });
});

describe('Authentication', () => {
  it('should login and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@v2resort.com', password: 'Admin123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
  });
});

describe('Double Booking Prevention', () => {
  it('should prevent double booking for the same chalet and dates', async () => {
    const bookingPayload = {
      chaletId: 'test-chalet-id',
      checkInDate: '2026-01-10',
      checkOutDate: '2026-01-12',
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      customerPhone: '1234567890',
      numberOfGuests: 2
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

describe('Payment Processing', () => {
  it('should process payment and not fail', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({
        referenceType: 'order',
        referenceId: 'test-order-id',
        amount: 100,
        currency: 'USD',
        method: 'card'
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });
});

// Real-time update tests would require socket.io client and server setup, typically in a separate test file.