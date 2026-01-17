import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReservationService, ReservationService } from '../../src/lib/services/reservation.service';
import { InMemoryReservationRepository } from '../../src/lib/repositories/reservation.repository.memory';
import { Container, Reservation, ReservationType, ReservationStatus } from '../../src/lib/container/types';

describe('ReservationService', () => {
  let service: ReservationService;
  let repository: InMemoryReservationRepository;
  let mockLogger: any;

  const createMockContainer = (): Container => {
    repository = new InMemoryReservationRepository();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    return {
      reservationRepository: repository,
      logger: mockLogger
    } as unknown as Container;
  };

  const validReservationInput = {
    type: 'room' as ReservationType,
    guestId: 'guest-123',
    guestName: 'John Doe',
    guestEmail: 'john@example.com',
    guestPhone: '+1234567890',
    resourceId: 'room-101',
    resourceName: 'Deluxe Suite 101',
    checkIn: '2026-02-01T14:00:00Z',
    checkOut: '2026-02-05T11:00:00Z',
    guestCount: 2,
    specialRequests: 'Late check-in',
    notes: 'VIP guest',
    totalAmount: 800,
    depositAmount: 200,
    bookedBy: 'staff-1'
  };

  beforeEach(() => {
    service = createReservationService(createMockContainer());
  });

  describe('createReservation', () => {
    it('should create a reservation with valid input', async () => {
      const reservation = await service.createReservation(validReservationInput);

      expect(reservation.id).toBeDefined();
      expect(reservation.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(reservation.type).toBe('room');
      expect(reservation.guestId).toBe('guest-123');
      expect(reservation.guestName).toBe('John Doe');
      expect(reservation.guestEmail).toBe('john@example.com');
      expect(reservation.resourceId).toBe('room-101');
      expect(reservation.status).toBe('pending');
      expect(reservation.confirmationCode).toHaveLength(8);
      expect(reservation.depositPaid).toBe(false);
      expect(reservation.createdAt).toBeDefined();
    });

    it('should generate unique confirmation codes', async () => {
      const res1 = await service.createReservation(validReservationInput);
      const res2 = await service.createReservation({
        ...validReservationInput,
        resourceId: 'room-102',
        checkIn: '2026-02-10T14:00:00Z',
        checkOut: '2026-02-12T11:00:00Z'
      });

      expect(res1.confirmationCode).not.toBe(res2.confirmationCode);
    });

    it('should reject invalid date range - check-out before check-in', async () => {
      await expect(service.createReservation({
        ...validReservationInput,
        checkIn: '2026-02-05T14:00:00Z',
        checkOut: '2026-02-01T11:00:00Z'
      })).rejects.toThrow('Invalid date range');
    });

    it('should reject invalid date range - same dates', async () => {
      await expect(service.createReservation({
        ...validReservationInput,
        checkIn: '2026-02-05T14:00:00Z',
        checkOut: '2026-02-05T14:00:00Z'
      })).rejects.toThrow('Invalid date range');
    });

    it('should reject guest count less than 1', async () => {
      await expect(service.createReservation({
        ...validReservationInput,
        guestCount: 0
      })).rejects.toThrow('Guest count must be at least 1');
    });

    it('should detect conflicts with existing reservations', async () => {
      await service.createReservation(validReservationInput);

      await expect(service.createReservation({
        ...validReservationInput,
        guestId: 'guest-456',
        checkIn: '2026-02-03T14:00:00Z',
        checkOut: '2026-02-06T11:00:00Z'
      })).rejects.toThrow('Resource is not available');
    });

    it('should allow reservations for different resources at same time', async () => {
      await service.createReservation(validReservationInput);

      const res2 = await service.createReservation({
        ...validReservationInput,
        resourceId: 'room-102',
        resourceName: 'Suite 102'
      });

      expect(res2.id).toBeDefined();
    });

    it('should set default deposit amount to 0 if not provided', async () => {
      const { depositAmount, ...inputWithoutDeposit } = validReservationInput;
      const reservation = await service.createReservation(inputWithoutDeposit);

      expect(reservation.depositAmount).toBe(0);
    });

    it('should log reservation creation', async () => {
      await service.createReservation(validReservationInput);

      expect(mockLogger.info).toHaveBeenCalledWith('Reservation created', expect.objectContaining({
        reservationId: expect.any(String),
        confirmationCode: expect.any(String),
        type: 'room'
      }));
    });
  });

  describe('getReservation', () => {
    it('should return reservation by id', async () => {
      const created = await service.createReservation(validReservationInput);
      const retrieved = await service.getReservation(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent reservation', async () => {
      const result = await service.getReservation('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getReservationByConfirmationCode', () => {
    it('should return reservation by confirmation code', async () => {
      const created = await service.createReservation(validReservationInput);
      const retrieved = await service.getReservationByConfirmationCode(created.confirmationCode);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for invalid confirmation code', async () => {
      const result = await service.getReservationByConfirmationCode('INVALID');
      expect(result).toBeNull();
    });
  });

  describe('getReservations', () => {
    it('should return all reservations', async () => {
      await service.createReservation(validReservationInput);
      await service.createReservation({
        ...validReservationInput,
        resourceId: 'room-102'
      });

      const reservations = await service.getReservations();
      expect(reservations).toHaveLength(2);
    });

    it('should return empty array when no reservations', async () => {
      const reservations = await service.getReservations();
      expect(reservations).toEqual([]);
    });
  });

  describe('getReservationsByGuest', () => {
    it('should return reservations for a guest', async () => {
      await service.createReservation(validReservationInput);
      await service.createReservation({
        ...validReservationInput,
        resourceId: 'room-102',
        checkIn: '2026-03-01T14:00:00Z',
        checkOut: '2026-03-05T11:00:00Z'
      });
      await service.createReservation({
        ...validReservationInput,
        guestId: 'other-guest',
        resourceId: 'room-103'
      });

      const reservations = await service.getReservationsByGuest('guest-123');
      expect(reservations).toHaveLength(2);
    });
  });

  describe('getReservationsByResource', () => {
    it('should return reservations for a resource', async () => {
      await service.createReservation(validReservationInput);
      await service.createReservation({
        ...validReservationInput,
        checkIn: '2026-03-01T14:00:00Z',
        checkOut: '2026-03-05T11:00:00Z'
      });

      const reservations = await service.getReservationsByResource('room-101');
      expect(reservations).toHaveLength(2);
    });
  });

  describe('getReservationsByStatus', () => {
    it('should return reservations by status', async () => {
      const res = await service.createReservation(validReservationInput);
      await service.confirmReservation(res.id);

      const pending = await service.getReservationsByStatus('pending');
      const confirmed = await service.getReservationsByStatus('confirmed');

      expect(pending).toHaveLength(0);
      expect(confirmed).toHaveLength(1);
    });
  });

  describe('getReservationsByType', () => {
    it('should return reservations by type', async () => {
      await service.createReservation(validReservationInput);
      await service.createReservation({
        ...validReservationInput,
        type: 'spa',
        resourceId: 'spa-1',
        checkIn: '2026-02-01T10:00:00Z',
        checkOut: '2026-02-01T12:00:00Z'
      });

      const roomReservations = await service.getReservationsByType('room');
      const spaReservations = await service.getReservationsByType('spa');

      expect(roomReservations).toHaveLength(1);
      expect(spaReservations).toHaveLength(1);
    });
  });

  describe('getReservationsForDateRange', () => {
    it('should return reservations within date range', async () => {
      await service.createReservation(validReservationInput);
      await service.createReservation({
        ...validReservationInput,
        resourceId: 'room-102',
        checkIn: '2026-03-01T14:00:00Z',
        checkOut: '2026-03-05T11:00:00Z'
      });

      const reservations = await service.getReservationsForDateRange('2026-01-01', '2026-02-28');
      expect(reservations).toHaveLength(1);
    });
  });

  describe('updateReservation', () => {
    it('should update reservation details', async () => {
      const created = await service.createReservation(validReservationInput);

      const updated = await service.updateReservation(created.id, {
        guestName: 'Jane Doe',
        guestCount: 3
      });

      expect(updated.guestName).toBe('Jane Doe');
      expect(updated.guestCount).toBe(3);
      expect(updated.updatedAt).not.toBeNull();
    });

    it('should reject update for non-existent reservation', async () => {
      await expect(service.updateReservation('non-existent', {
        guestName: 'Test'
      })).rejects.toThrow('Reservation not found');
    });

    it('should reject update for cancelled reservation', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.cancelReservation(created.id, 'Test', 'staff-1');

      await expect(service.updateReservation(created.id, {
        guestName: 'Test'
      })).rejects.toThrow('Cannot modify reservation in current status');
    });

    it('should validate new date range on update', async () => {
      const created = await service.createReservation(validReservationInput);

      await expect(service.updateReservation(created.id, {
        checkIn: '2026-02-10T14:00:00Z',
        checkOut: '2026-02-05T11:00:00Z'
      })).rejects.toThrow('Invalid date range');
    });

    it('should check conflicts when updating dates', async () => {
      const res1 = await service.createReservation(validReservationInput);
      const res2 = await service.createReservation({
        ...validReservationInput,
        checkIn: '2026-02-10T14:00:00Z',
        checkOut: '2026-02-15T11:00:00Z'
      });

      await expect(service.updateReservation(res2.id, {
        checkIn: '2026-02-03T14:00:00Z',
        checkOut: '2026-02-06T11:00:00Z'
      })).rejects.toThrow('Resource is not available');
    });

    it('should reject guest count less than 1 on update', async () => {
      const created = await service.createReservation(validReservationInput);

      await expect(service.updateReservation(created.id, {
        guestCount: 0
      })).rejects.toThrow('Guest count must be at least 1');
    });
  });

  describe('deleteReservation', () => {
    it('should delete reservation', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.deleteReservation(created.id);

      const retrieved = await service.getReservation(created.id);
      expect(retrieved).toBeNull();
    });

    it('should reject delete for non-existent reservation', async () => {
      await expect(service.deleteReservation('non-existent'))
        .rejects.toThrow('Reservation not found');
    });
  });

  describe('confirmReservation', () => {
    it('should confirm pending reservation', async () => {
      const created = await service.createReservation(validReservationInput);
      const confirmed = await service.confirmReservation(created.id);

      expect(confirmed.status).toBe('confirmed');
    });

    it('should reject confirming non-existent reservation', async () => {
      await expect(service.confirmReservation('non-existent'))
        .rejects.toThrow('Reservation not found');
    });

    it('should reject confirming already confirmed reservation', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.confirmReservation(created.id);

      await expect(service.confirmReservation(created.id))
        .rejects.toThrow('Can only confirm pending reservations');
    });
  });

  describe('checkIn', () => {
    it('should check in guest for confirmed reservation', async () => {
      const created = await service.createReservation({
        ...validReservationInput,
        checkIn: new Date(Date.now() - 86400000).toISOString() // yesterday
      });
      await service.confirmReservation(created.id);

      const checkedIn = await service.checkIn(created.id, 'staff-1');

      expect(checkedIn.status).toBe('checked_in');
      expect(checkedIn.checkedInAt).toBeDefined();
      expect(checkedIn.checkedInBy).toBe('staff-1');
    });

    it('should reject check in for non-existent reservation', async () => {
      await expect(service.checkIn('non-existent', 'staff-1'))
        .rejects.toThrow('Reservation not found');
    });

    it('should reject check in for pending reservation', async () => {
      const created = await service.createReservation(validReservationInput);

      await expect(service.checkIn(created.id, 'staff-1'))
        .rejects.toThrow('Cannot check in');
    });

    it('should reject early check in', async () => {
      const created = await service.createReservation({
        ...validReservationInput,
        checkIn: '2030-02-01T14:00:00Z', // future date
        checkOut: '2030-02-05T11:00:00Z'
      });
      await service.confirmReservation(created.id);

      await expect(service.checkIn(created.id, 'staff-1'))
        .rejects.toThrow('Cannot check in');
    });
  });

  describe('checkOut', () => {
    it('should check out checked-in guest', async () => {
      const created = await service.createReservation({
        ...validReservationInput,
        checkIn: new Date(Date.now() - 86400000).toISOString()
      });
      await service.confirmReservation(created.id);
      await service.checkIn(created.id, 'staff-1');

      const checkedOut = await service.checkOut(created.id, 'staff-2');

      expect(checkedOut.status).toBe('checked_out');
      expect(checkedOut.checkedOutAt).toBeDefined();
      expect(checkedOut.checkedOutBy).toBe('staff-2');
    });

    it('should reject check out for non-existent reservation', async () => {
      await expect(service.checkOut('non-existent', 'staff-1'))
        .rejects.toThrow('Reservation not found');
    });

    it('should reject check out for non-checked-in reservation', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.confirmReservation(created.id);

      await expect(service.checkOut(created.id, 'staff-1'))
        .rejects.toThrow('Cannot check out');
    });
  });

  describe('cancelReservation', () => {
    it('should cancel pending reservation', async () => {
      const created = await service.createReservation(validReservationInput);
      const cancelled = await service.cancelReservation(created.id, 'Guest request', 'staff-1');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellationReason).toBe('Guest request');
      expect(cancelled.cancelledAt).toBeDefined();
      expect(cancelled.cancelledBy).toBe('staff-1');
    });

    it('should cancel confirmed reservation', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.confirmReservation(created.id);

      const cancelled = await service.cancelReservation(created.id, 'Change of plans', 'staff-1');
      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject cancelling checked-in reservation', async () => {
      const created = await service.createReservation({
        ...validReservationInput,
        checkIn: new Date(Date.now() - 86400000).toISOString()
      });
      await service.confirmReservation(created.id);
      await service.checkIn(created.id, 'staff-1');

      await expect(service.cancelReservation(created.id, 'Test', 'staff-1'))
        .rejects.toThrow('Cannot cancel reservation in current status');
    });
  });

  describe('markNoShow', () => {
    it('should mark confirmed reservation as no-show', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.confirmReservation(created.id);

      const noShow = await service.markNoShow(created.id);
      expect(noShow.status).toBe('no_show');
    });

    it('should reject marking pending reservation as no-show', async () => {
      const created = await service.createReservation(validReservationInput);

      await expect(service.markNoShow(created.id))
        .rejects.toThrow('Can only mark confirmed reservations as no-show');
    });
  });

  describe('recordDeposit', () => {
    it('should record deposit payment', async () => {
      const created = await service.createReservation(validReservationInput);
      const updated = await service.recordDeposit(created.id);

      expect(updated.depositPaid).toBe(true);
    });

    it('should reject recording deposit twice', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.recordDeposit(created.id);

      await expect(service.recordDeposit(created.id))
        .rejects.toThrow('Deposit already paid');
    });

    it('should reject recording deposit when no deposit required', async () => {
      const created = await service.createReservation({
        ...validReservationInput,
        depositAmount: 0
      });

      await expect(service.recordDeposit(created.id))
        .rejects.toThrow('No deposit required');
    });
  });

  describe('refundDeposit', () => {
    it('should refund deposit', async () => {
      const created = await service.createReservation(validReservationInput);
      await service.recordDeposit(created.id);

      const updated = await service.refundDeposit(created.id);
      expect(updated.depositPaid).toBe(false);
    });

    it('should reject refund when no deposit paid', async () => {
      const created = await service.createReservation(validReservationInput);

      await expect(service.refundDeposit(created.id))
        .rejects.toThrow('No deposit to refund');
    });
  });

  describe('checkAvailability', () => {
    it('should return true when resource is available', async () => {
      const available = await service.checkAvailability(
        'room-101',
        '2026-02-01T14:00:00Z',
        '2026-02-05T11:00:00Z'
      );
      expect(available).toBe(true);
    });

    it('should return false when resource is booked', async () => {
      await service.createReservation(validReservationInput);

      const available = await service.checkAvailability(
        'room-101',
        '2026-02-03T14:00:00Z',
        '2026-02-06T11:00:00Z'
      );
      expect(available).toBe(false);
    });

    it('should return true for adjacent bookings', async () => {
      await service.createReservation(validReservationInput);

      const available = await service.checkAvailability(
        'room-101',
        '2026-02-05T14:00:00Z',
        '2026-02-10T11:00:00Z'
      );
      expect(available).toBe(true);
    });
  });

  describe('findConflicts', () => {
    it('should return conflicting reservations', async () => {
      const created = await service.createReservation(validReservationInput);

      const conflicts = await service.findConflicts(
        'room-101',
        '2026-02-03T14:00:00Z',
        '2026-02-06T11:00:00Z'
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].reservationId).toBe(created.id);
      expect(conflicts[0].guestName).toBe('John Doe');
    });

    it('should exclude specified reservation from conflicts', async () => {
      const created = await service.createReservation(validReservationInput);

      const conflicts = await service.findConflicts(
        'room-101',
        '2026-02-03T14:00:00Z',
        '2026-02-06T11:00:00Z',
        created.id
      );

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('getUpcomingReservations', () => {
    it('should return upcoming reservations for guest', async () => {
      await service.createReservation({
        ...validReservationInput,
        checkIn: new Date(Date.now() + 86400000 * 7).toISOString(),
        checkOut: new Date(Date.now() + 86400000 * 10).toISOString()
      });

      const upcoming = await service.getUpcomingReservations('guest-123');
      expect(upcoming.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPendingReservations', () => {
    it('should return all pending reservations', async () => {
      await service.createReservation(validReservationInput);
      await service.createReservation({
        ...validReservationInput,
        resourceId: 'room-102'
      });

      const pending = await service.getPendingReservations();
      expect(pending).toHaveLength(2);
    });
  });

  describe('utility methods', () => {
    describe('generateConfirmationCode', () => {
      it('should generate 8-character code', () => {
        const code = service.generateConfirmationCode();
        expect(code).toHaveLength(8);
      });

      it('should only contain valid characters', () => {
        const code = service.generateConfirmationCode();
        expect(code).toMatch(/^[A-Z0-9]+$/);
      });
    });

    describe('calculateDuration', () => {
      it('should calculate days between dates', () => {
        const duration = service.calculateDuration(
          '2026-02-01T14:00:00Z',
          '2026-02-05T11:00:00Z'
        );
        expect(duration).toBe(4);
      });

      it('should round up partial days', () => {
        const duration = service.calculateDuration(
          '2026-02-01T14:00:00Z',
          '2026-02-02T10:00:00Z'
        );
        expect(duration).toBe(1);
      });
    });

    describe('isValidDateRange', () => {
      it('should return true for valid range', () => {
        expect(service.isValidDateRange(
          '2026-02-01T14:00:00Z',
          '2026-02-05T11:00:00Z'
        )).toBe(true);
      });

      it('should return false for invalid range', () => {
        expect(service.isValidDateRange(
          '2026-02-05T14:00:00Z',
          '2026-02-01T11:00:00Z'
        )).toBe(false);
      });

      it('should return false for same dates', () => {
        expect(service.isValidDateRange(
          '2026-02-01T14:00:00Z',
          '2026-02-01T14:00:00Z'
        )).toBe(false);
      });

      it('should return false for invalid date strings', () => {
        expect(service.isValidDateRange('invalid', '2026-02-01')).toBe(false);
      });
    });

    describe('canCancel', () => {
      it('should return true for pending reservation', async () => {
        const res = await service.createReservation(validReservationInput);
        expect(service.canCancel(res)).toBe(true);
      });

      it('should return true for confirmed reservation', async () => {
        const res = await service.createReservation(validReservationInput);
        const confirmed = await service.confirmReservation(res.id);
        expect(service.canCancel(confirmed)).toBe(true);
      });

      it('should return false for checked-in reservation', async () => {
        const res = await service.createReservation({
          ...validReservationInput,
          checkIn: new Date(Date.now() - 86400000).toISOString()
        });
        await service.confirmReservation(res.id);
        const checkedIn = await service.checkIn(res.id, 'staff-1');
        expect(service.canCancel(checkedIn)).toBe(false);
      });
    });

    describe('canCheckIn', () => {
      it('should return false for pending reservation', async () => {
        const res = await service.createReservation(validReservationInput);
        expect(service.canCheckIn(res)).toBe(false);
      });
    });

    describe('canCheckOut', () => {
      it('should return false for confirmed reservation', async () => {
        const res = await service.createReservation(validReservationInput);
        const confirmed = await service.confirmReservation(res.id);
        expect(service.canCheckOut(confirmed)).toBe(false);
      });

      it('should return true for checked-in reservation', async () => {
        const res = await service.createReservation({
          ...validReservationInput,
          checkIn: new Date(Date.now() - 86400000).toISOString()
        });
        await service.confirmReservation(res.id);
        const checkedIn = await service.checkIn(res.id, 'staff-1');
        expect(service.canCheckOut(checkedIn)).toBe(true);
      });
    });

    describe('canModify', () => {
      it('should return true for pending reservation', async () => {
        const res = await service.createReservation(validReservationInput);
        expect(service.canModify(res)).toBe(true);
      });

      it('should return false for cancelled reservation', async () => {
        const res = await service.createReservation(validReservationInput);
        const cancelled = await service.cancelReservation(res.id, 'Test', 'staff-1');
        expect(service.canModify(cancelled)).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle different reservation types', async () => {
      const types: ReservationType[] = ['room', 'restaurant', 'spa', 'activity', 'event', 'pool', 'cabana'];

      for (const type of types) {
        const res = await service.createReservation({
          ...validReservationInput,
          type,
          resourceId: `${type}-1`,
          checkIn: `2026-03-0${types.indexOf(type) + 1}T14:00:00Z`,
          checkOut: `2026-03-0${types.indexOf(type) + 2}T11:00:00Z`
        });
        expect(res.type).toBe(type);
      }
    });

    it('should handle reservations with no optional fields', async () => {
      const res = await service.createReservation({
        type: 'room',
        guestId: 'guest-123',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        resourceId: 'room-101',
        resourceName: 'Suite 101',
        checkIn: '2026-04-01T14:00:00Z',
        checkOut: '2026-04-05T11:00:00Z',
        guestCount: 1,
        totalAmount: 500,
        bookedBy: 'staff-1'
      });

      expect(res.guestPhone).toBeUndefined();
      expect(res.specialRequests).toBeUndefined();
      expect(res.notes).toBeUndefined();
      expect(res.depositAmount).toBe(0);
    });
  });
});
