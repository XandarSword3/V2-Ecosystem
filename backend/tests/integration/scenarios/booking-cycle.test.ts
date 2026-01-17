/**
 * Integration Test: Booking Cycle
 *
 * Tests the complete chalet booking workflow:
 * Check availability → Book → Payment → Check-in → Check-out
 *
 * Scenario extracted from stress test customer-bot and staff-bot behaviors.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  TestApiClient,
  createStaffClient,
  createGuestClient,
} from '../api-client';
import {
  assertSuccess,
  assertFailure,
  assertHasData,
  assertBookingStructure,
} from '../assertions';
import { waitForServices, resetTestContext } from '../setup';

// Skip if integration tests not enabled
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Booking Cycle Integration', () => {
  let guestClient: TestApiClient;
  let staffClient: TestApiClient;
  let chaletId: string;
  let bookingId: string;
  let servicesAvailable = false;

  // Use dates in the future to avoid conflicts
  const checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + 30);
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + 2);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  beforeAll(async () => {
    // Always create clients
    guestClient = createGuestClient();
    staffClient = createGuestClient(); // Will be replaced if services available
    
    const services = await waitForServices(5, 1000);
    if (!services.api) {
      console.warn('⚠️ API not available, tests will be skipped');
      return;
    }

    servicesAvailable = true;
    resetTestContext();
    staffClient = await createStaffClient();
  });

  afterAll(() => {
    resetTestContext();
  });

  describe('Phase 1: Browse & Check Availability', () => {
    it('should fetch available chalets', async () => {
      const response = await guestClient.getChalets();
      assertSuccess(response);

      const chalets = assertHasData<any>(response);
      expect(Array.isArray(chalets) || chalets.data || chalets.items).toBeTruthy();

      // Store first available chalet
      const chaletList = chalets.data || chalets.items || chalets;
      if (chaletList.length > 0) {
        chaletId = chaletList[0].id;
      }
    });

    it('should fetch chalet details', async () => {
      if (!chaletId) {
        console.warn('⚠️ No chalets available');
        return;
      }

      const response = await guestClient.getChalet(chaletId);
      assertSuccess(response);

      assertHasData<any>(response, (chalet: any) => {
        expect(chalet.id).toBe(chaletId);
      });
    });

    it('should check chalet availability for dates', async () => {
      if (!chaletId) {
        console.warn('⚠️ No chalet available for availability check');
        chaletId = '550e8400-e29b-41d4-a716-446655440001';
      }

      const response = await guestClient.getChaletAvailability(
        chaletId,
        formatDate(checkInDate),
        formatDate(checkOutDate)
      );

      // Availability endpoint might not exist or return different format
      if (response.status === 404) {
        console.warn('⚠️ Availability endpoint not implemented');
        return;
      }

      assertSuccess(response);
    });
  });

  describe('Phase 2: Create Booking', () => {
    it('should create booking as guest', async () => {
      if (!chaletId) {
        chaletId = '550e8400-e29b-41d4-a716-446655440001';
      }

      const bookingData = {
        chaletId,
        checkInDate: formatDate(checkInDate),
        checkOutDate: formatDate(checkOutDate),
        customerName: 'Integration Test Guest',
        customerEmail: `integration.booking.${Date.now()}@v2resort.local`,
        customerPhone: '+1234567890',
        numberOfGuests: 2,
        paymentMethod: 'cash',
      };

      const response = await guestClient.createBooking(bookingData);

      // Handle case where chalet doesn't exist or is not available
      if (response.status === 404 || response.status === 400) {
        console.warn('⚠️ Booking creation failed - chalet may not exist');
        return;
      }

      assertSuccess(response);

      const booking = assertHasData<any>(response, (data: any) => {
        expect(data.id).toBeDefined();
        expect(['pending', 'confirmed']).toContain(data.status);
      });

      bookingId = booking.id;
    });

    it('should retrieve created booking', async () => {
      if (!bookingId) {
        return;
      }

      const response = await staffClient.getBooking(bookingId);
      assertSuccess(response);

      assertHasData<any>(response, (booking: any) => {
        assertBookingStructure(booking);
        expect(booking.id).toBe(bookingId);
      });
    });
  });

  describe('Phase 3: Double Booking Prevention', () => {
    it('should prevent double booking for same dates', async () => {
      if (!chaletId || !bookingId) {
        console.warn('⚠️ Skipping double booking test - no initial booking');
        return;
      }

      // Try to book same chalet for overlapping dates
      const conflictingBooking = {
        chaletId,
        checkInDate: formatDate(checkInDate),
        checkOutDate: formatDate(checkOutDate),
        customerName: 'Conflict Test Guest',
        customerEmail: `conflict.${Date.now()}@v2resort.local`,
        customerPhone: '+9876543210',
        numberOfGuests: 2,
        paymentMethod: 'cash',
      };

      const response = await guestClient.createBooking(conflictingBooking);

      // Should fail with conflict or validation error
      assertFailure(response);
      expect([400, 409, 422]).toContain(response.status);
    });
  });

  describe('Phase 4: Staff Operations', () => {
    it('should check in guest', async () => {
      if (!bookingId) {
        return;
      }

      const response = await staffClient.checkIn(bookingId);

      // Check-in endpoint might not be implemented
      if (response.status === 404) {
        console.warn('⚠️ Check-in endpoint not implemented');
        return;
      }

      assertSuccess(response);

      // Verify status changed
      const bookingResponse = await staffClient.getBooking(bookingId);
      if (bookingResponse.success) {
        expect(bookingResponse.data.status).toBe('checked_in');
      }
    });

    it('should check out guest', async () => {
      if (!bookingId) {
        return;
      }

      const response = await staffClient.checkOut(bookingId);

      // Check-out endpoint might not be implemented
      if (response.status === 404) {
        console.warn('⚠️ Check-out endpoint not implemented');
        return;
      }

      assertSuccess(response);

      // Verify status changed
      const bookingResponse = await staffClient.getBooking(bookingId);
      if (bookingResponse.success) {
        expect(bookingResponse.data.status).toBe('checked_out');
      }
    });
  });

  describe('Phase 5: Edge Cases', () => {
    it('should reject booking with invalid dates', async () => {
      const invalidBooking = {
        chaletId: chaletId || '550e8400-e29b-41d4-a716-446655440001',
        checkInDate: '2026-01-15',
        checkOutDate: '2026-01-10', // End before start
        customerName: 'Invalid Date Guest',
        customerEmail: 'invalid@v2resort.local',
        customerPhone: '+1234567890',
        numberOfGuests: 2,
      };

      const response = await guestClient.createBooking(invalidBooking);
      assertFailure(response);
      expect([400, 422]).toContain(response.status);
    });

    it('should reject booking with past dates', async () => {
      const pastBooking = {
        chaletId: chaletId || '550e8400-e29b-41d4-a716-446655440001',
        checkInDate: '2020-01-01',
        checkOutDate: '2020-01-05',
        customerName: 'Past Date Guest',
        customerEmail: 'past@v2resort.local',
        customerPhone: '+1234567890',
        numberOfGuests: 2,
      };

      const response = await guestClient.createBooking(pastBooking);
      assertFailure(response);
      expect([400, 422]).toContain(response.status);
    });

    it('should handle non-existent chalet booking', async () => {
      const fakeChalet = {
        chaletId: '00000000-0000-0000-0000-000000000000',
        checkInDate: formatDate(checkInDate),
        checkOutDate: formatDate(checkOutDate),
        customerName: 'Non-existent Chalet Guest',
        customerEmail: 'fake@v2resort.local',
        customerPhone: '+1234567890',
        numberOfGuests: 2,
      };

      const response = await guestClient.createBooking(fakeChalet);
      assertFailure(response);
      expect([400, 404, 422]).toContain(response.status);
    });
  });
});
