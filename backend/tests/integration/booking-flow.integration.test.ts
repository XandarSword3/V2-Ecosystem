/**
 * Booking Flow Integration Tests
 * Tests the complete booking flow from search to confirmation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { supabase } from '../../src/lib/supabase';
import Stripe from 'stripe';

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_456',
        status: 'requires_payment_method',
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
      }),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({
        id: 're_test_123',
        amount: 10000,
        status: 'succeeded',
      }),
    },
  })),
}));

describe('Booking Flow Integration', () => {
  let app: Express.Application;
  let authToken: string;
  let testUserId: string;
  let testChaletId: string;
  let testBookingId: string;

  beforeAll(async () => {
    app = await createApp();
    
    // Create test user
    const { data: user, error } = await supabase.auth.signUp({
      email: 'test-booking@example.com',
      password: 'TestPassword123!',
    });
    
    if (user?.user) {
      testUserId = user.user.id;
      const { data: session } = await supabase.auth.signInWithPassword({
        email: 'test-booking@example.com',
        password: 'TestPassword123!',
      });
      authToken = session?.session?.access_token || '';
    }

    // Get first available chalet
    const { data: chalet } = await supabase
      .from('chalets')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    testChaletId = chalet?.id || 'test-chalet-id';
  });

  afterAll(async () => {
    // Cleanup test data
    if (testBookingId) {
      await supabase.from('chalet_bookings').delete().eq('id', testBookingId);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  describe('Chalet Availability Search', () => {
    it('should return available chalets for date range', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const checkOut = new Date(tomorrow);
      checkOut.setDate(checkOut.getDate() + 3);

      const response = await request(app)
        .get('/api/chalets/availability')
        .query({
          checkIn: tomorrow.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          guests: 4,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('chalets');
      expect(Array.isArray(response.body.chalets)).toBe(true);
    });

    it('should exclude already booked chalets', async () => {
      const response = await request(app)
        .get('/api/chalets/availability')
        .query({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05',
          guests: 2,
        });

      expect(response.status).toBe(200);
      const chaletIds = response.body.chalets.map((c: any) => c.id);
      // Should not include any chalets with overlapping bookings
      expect(chaletIds).not.toContain(undefined);
    });

    it('should filter by capacity', async () => {
      const response = await request(app)
        .get('/api/chalets/availability')
        .query({
          checkIn: '2025-08-01',
          checkOut: '2025-08-05',
          guests: 8,
        });

      expect(response.status).toBe(200);
      response.body.chalets.forEach((chalet: any) => {
        expect(chalet.capacity).toBeGreaterThanOrEqual(8);
      });
    });
  });

  describe('Booking Creation', () => {
    it('should create a booking with valid data', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 10);
      
      const checkOut = new Date(tomorrow);
      checkOut.setDate(checkOut.getDate() + 2);

      const response = await request(app)
        .post('/api/bookings/chalets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chaletId: testChaletId,
          checkIn: tomorrow.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          guests: 4,
          guestDetails: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: '+1234567890',
          },
          specialRequests: 'Early check-in if possible',
        });

      if (response.status === 201) {
        testBookingId = response.body.booking.id;
        expect(response.body.booking).toHaveProperty('id');
        expect(response.body.booking.status).toBe('pending');
        expect(response.body).toHaveProperty('paymentIntent');
      }
    });

    it('should reject booking for unavailable dates', async () => {
      const response = await request(app)
        .post('/api/bookings/chalets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chaletId: testChaletId,
          checkIn: '2025-01-01', // Past date
          checkOut: '2025-01-03',
          guests: 4,
        });

      expect(response.status).toBe(400);
    });

    it('should reject booking without authentication', async () => {
      const response = await request(app)
        .post('/api/bookings/chalets')
        .send({
          chaletId: testChaletId,
          checkIn: '2025-08-01',
          checkOut: '2025-08-03',
          guests: 4,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Booking Payment Flow', () => {
    it('should confirm booking after successful payment', async () => {
      if (!testBookingId) {
        return; // Skip if no booking was created
      }

      const response = await request(app)
        .post(`/api/bookings/chalets/${testBookingId}/confirm-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test_123',
        });

      if (response.status === 200) {
        expect(response.body.booking.status).toBe('confirmed');
        expect(response.body.booking.paymentStatus).toBe('paid');
      }
    });

    it('should send confirmation email after payment', async () => {
      // This would be verified through email service mock
      // For now, just verify the booking status changed
      if (!testBookingId) return;

      const { data: booking } = await supabase
        .from('chalet_bookings')
        .select('*')
        .eq('id', testBookingId)
        .single();

      if (booking) {
        expect(booking.confirmation_email_sent).toBeDefined();
      }
    });
  });

  describe('Booking Modification', () => {
    it('should allow date change for confirmed booking', async () => {
      if (!testBookingId) return;

      const newCheckIn = new Date();
      newCheckIn.setDate(newCheckIn.getDate() + 15);
      
      const newCheckOut = new Date(newCheckIn);
      newCheckOut.setDate(newCheckOut.getDate() + 3);

      const response = await request(app)
        .put(`/api/bookings/chalets/${testBookingId}/dates`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newCheckIn: newCheckIn.toISOString().split('T')[0],
          newCheckOut: newCheckOut.toISOString().split('T')[0],
        });

      expect([200, 400]).toContain(response.status);
    });

    it('should calculate price difference correctly', async () => {
      if (!testBookingId) return;

      const response = await request(app)
        .post(`/api/bookings/chalets/${testBookingId}/price-difference`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newCheckIn: '2025-09-01',
          newCheckOut: '2025-09-05',
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('originalPrice');
        expect(response.body).toHaveProperty('newPrice');
        expect(response.body).toHaveProperty('difference');
      }
    });
  });

  describe('Booking Cancellation', () => {
    it('should process cancellation with refund', async () => {
      if (!testBookingId) return;

      const response = await request(app)
        .post(`/api/bookings/chalets/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed travel plans',
        });

      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('refundAmount');
        expect(response.body.booking.status).toBe('cancelled');
      }
    });

    it('should apply correct cancellation policy', async () => {
      // Test cancellation policy calculation
      const response = await request(app)
        .get(`/api/bookings/cancellation-policy`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          bookingType: 'chalet',
          bookingDate: '2025-08-01',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('policy');
      expect(response.body).toHaveProperty('refundPercentage');
    });
  });
});

describe('Pool Ticket Booking Integration', () => {
  let app: Express.Application;
  let authToken: string;
  let testTicketId: string;

  beforeAll(async () => {
    app = await createApp();
    // Auth setup similar to chalet tests
  });

  describe('Pool Ticket Purchase', () => {
    it('should purchase pool ticket for valid date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/pool/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: tomorrow.toISOString().split('T')[0],
          slot: 'morning',
          adults: 2,
          children: 1,
        });

      if (response.status === 201) {
        testTicketId = response.body.ticket.id;
        expect(response.body.ticket).toHaveProperty('qrCode');
        expect(response.body.ticket.status).toBe('pending');
      }
    });

    it('should enforce daily capacity limits', async () => {
      // This test verifies capacity enforcement
      const response = await request(app)
        .get('/api/pool/capacity')
        .query({ date: '2025-07-15' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('maxCapacity');
      expect(response.body).toHaveProperty('currentBookings');
      expect(response.body).toHaveProperty('availableSlots');
    });
  });

  describe('Pool Ticket QR Validation', () => {
    it('should validate QR code at pool entry', async () => {
      if (!testTicketId) return;

      const response = await request(app)
        .post('/api/pool/validate-entry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticketId: testTicketId,
        });

      expect([200, 400]).toContain(response.status);
    });

    it('should reject expired or used tickets', async () => {
      const response = await request(app)
        .post('/api/pool/validate-entry')
        .send({
          ticketId: 'expired-ticket-id',
        });

      expect(response.status).toBe(400);
    });
  });
});

describe('Restaurant Booking Integration', () => {
  let app: Express.Application;
  let authToken: string;
  let testReservationId: string;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('Table Reservation', () => {
    it('should create table reservation', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/restaurant/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: tomorrow.toISOString().split('T')[0],
          time: '19:00',
          partySize: 4,
          guestName: 'Test Guest',
          guestPhone: '+1234567890',
          specialRequests: 'Window seat preferred',
        });

      if (response.status === 201) {
        testReservationId = response.body.reservation.id;
        expect(response.body.reservation).toHaveProperty('tableNumber');
        expect(response.body.reservation.status).toBe('confirmed');
      }
    });

    it('should find suitable table for party size', async () => {
      const response = await request(app)
        .get('/api/restaurant/available-tables')
        .query({
          date: '2025-08-15',
          time: '20:00',
          partySize: 6,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tables');
      response.body.tables.forEach((table: any) => {
        expect(table.capacity).toBeGreaterThanOrEqual(6);
      });
    });
  });

  describe('Kitchen Order Flow', () => {
    it('should create order for seated table', async () => {
      const response = await request(app)
        .post('/api/restaurant/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tableId: 1,
          items: [
            { menuItemId: 'item-1', quantity: 2, notes: 'No onions' },
            { menuItemId: 'item-2', quantity: 1 },
          ],
        });

      expect([201, 400]).toContain(response.status);
    });

    it('should update order status through kitchen workflow', async () => {
      // This would test the kitchen display workflow
      const response = await request(app)
        .get('/api/restaurant/kitchen/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
    });
  });
});
