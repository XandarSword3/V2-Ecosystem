import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAmenityService, AmenityService } from '../../src/lib/services/amenity.service';
import { InMemoryAmenityRepository } from '../../src/lib/repositories/amenity.repository.memory';
import { Container, Amenity, AmenityCategory, AmenityStatus } from '../../src/lib/container/types';

describe('AmenityService', () => {
  let service: AmenityService;
  let repository: InMemoryAmenityRepository;
  let mockLogger: any;

  const createMockContainer = (): Container => {
    repository = new InMemoryAmenityRepository();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    return {
      amenityRepository: repository,
      logger: mockLogger
    } as unknown as Container;
  };

  const validAmenityInput = {
    name: 'Main Pool',
    description: 'Olympic-sized swimming pool',
    category: 'pool' as AmenityCategory,
    location: 'Ground Floor',
    capacity: 50,
    openingTime: '06:00',
    closingTime: '22:00',
    requiresReservation: false,
    pricePerHour: 0,
    isComplimentary: true,
    images: ['pool1.jpg', 'pool2.jpg'],
    rules: ['No diving', 'Shower before entering'],
    ageRestriction: undefined
  };

  const validReservationInput = {
    amenityId: '',
    guestId: 'guest-123',
    guestName: 'John Doe',
    date: '2026-02-01',
    startTime: '10:00',
    endTime: '11:00',
    partySize: 2,
    notes: 'Birthday celebration'
  };

  beforeEach(() => {
    service = createAmenityService(createMockContainer());
  });

  describe('createAmenity', () => {
    it('should create an amenity with valid input', async () => {
      const amenity = await service.createAmenity(validAmenityInput);

      expect(amenity.id).toBeDefined();
      expect(amenity.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(amenity.name).toBe('Main Pool');
      expect(amenity.category).toBe('pool');
      expect(amenity.status).toBe('available');
      expect(amenity.isActive).toBe(true);
      expect(amenity.createdAt).toBeDefined();
    });

    it('should reject empty name', async () => {
      await expect(service.createAmenity({
        ...validAmenityInput,
        name: '  '
      })).rejects.toThrow('Amenity name is required');
    });

    it('should reject invalid time range', async () => {
      await expect(service.createAmenity({
        ...validAmenityInput,
        openingTime: '22:00',
        closingTime: '06:00'
      })).rejects.toThrow('Invalid time range');
    });

    it('should set default values for optional fields', async () => {
      const amenity = await service.createAmenity({
        name: 'Test Amenity',
        description: 'Test',
        category: 'pool',
        location: 'Test Location',
        openingTime: '08:00',
        closingTime: '20:00'
      });

      expect(amenity.requiresReservation).toBe(false);
      expect(amenity.isComplimentary).toBe(true);
      expect(amenity.images).toEqual([]);
      expect(amenity.rules).toEqual([]);
    });

    it('should log amenity creation', async () => {
      await service.createAmenity(validAmenityInput);

      expect(mockLogger.info).toHaveBeenCalledWith('Amenity created', expect.objectContaining({
        amenityId: expect.any(String),
        name: 'Main Pool'
      }));
    });
  });

  describe('getAmenity', () => {
    it('should return amenity by id', async () => {
      const created = await service.createAmenity(validAmenityInput);
      const retrieved = await service.getAmenity(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent amenity', async () => {
      const result = await service.getAmenity('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getAmenities', () => {
    it('should return all amenities', async () => {
      await service.createAmenity(validAmenityInput);
      await service.createAmenity({ ...validAmenityInput, name: 'Spa' });

      const amenities = await service.getAmenities();
      expect(amenities).toHaveLength(2);
    });
  });

  describe('getAmenitiesByCategory', () => {
    it('should return amenities by category', async () => {
      await service.createAmenity(validAmenityInput);
      await service.createAmenity({ ...validAmenityInput, name: 'Spa', category: 'spa' });

      const poolAmenities = await service.getAmenitiesByCategory('pool');
      const spaAmenities = await service.getAmenitiesByCategory('spa');

      expect(poolAmenities).toHaveLength(1);
      expect(spaAmenities).toHaveLength(1);
    });
  });

  describe('getActiveAmenities', () => {
    it('should return only active amenities', async () => {
      const active = await service.createAmenity(validAmenityInput);
      const inactive = await service.createAmenity({ ...validAmenityInput, name: 'Closed Pool' });
      await service.deactivateAmenity(inactive.id);

      const activeAmenities = await service.getActiveAmenities();
      expect(activeAmenities).toHaveLength(1);
      expect(activeAmenities[0].id).toBe(active.id);
    });
  });

  describe('updateAmenity', () => {
    it('should update amenity details', async () => {
      const created = await service.createAmenity(validAmenityInput);

      const updated = await service.updateAmenity(created.id, {
        name: 'Updated Pool',
        capacity: 75
      });

      expect(updated.name).toBe('Updated Pool');
      expect(updated.capacity).toBe(75);
      expect(updated.updatedAt).not.toBeNull();
    });

    it('should reject update for non-existent amenity', async () => {
      await expect(service.updateAmenity('non-existent', { name: 'Test' }))
        .rejects.toThrow('Amenity not found');
    });

    it('should reject empty name', async () => {
      const created = await service.createAmenity(validAmenityInput);

      await expect(service.updateAmenity(created.id, { name: '' }))
        .rejects.toThrow('Amenity name cannot be empty');
    });

    it('should validate time range when updating opening time', async () => {
      const created = await service.createAmenity(validAmenityInput);

      await expect(service.updateAmenity(created.id, { openingTime: '23:00' }))
        .rejects.toThrow('Invalid time range');
    });

    it('should validate time range when updating closing time', async () => {
      const created = await service.createAmenity(validAmenityInput);

      await expect(service.updateAmenity(created.id, { closingTime: '05:00' }))
        .rejects.toThrow('Invalid time range');
    });
  });

  describe('deleteAmenity', () => {
    it('should delete amenity', async () => {
      const created = await service.createAmenity(validAmenityInput);
      await service.deleteAmenity(created.id);

      const retrieved = await service.getAmenity(created.id);
      expect(retrieved).toBeNull();
    });

    it('should reject delete for non-existent amenity', async () => {
      await expect(service.deleteAmenity('non-existent'))
        .rejects.toThrow('Amenity not found');
    });
  });

  describe('status operations', () => {
    describe('setStatus', () => {
      it('should set amenity status', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const updated = await service.setStatus(amenity.id, 'maintenance');

        expect(updated.status).toBe('maintenance');
      });

      it('should reject for non-existent amenity', async () => {
        await expect(service.setStatus('non-existent', 'closed'))
          .rejects.toThrow('Amenity not found');
      });
    });

    describe('openAmenity', () => {
      it('should set status to available', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.closeAmenity(amenity.id);
        const opened = await service.openAmenity(amenity.id);

        expect(opened.status).toBe('available');
      });
    });

    describe('closeAmenity', () => {
      it('should set status to closed', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const closed = await service.closeAmenity(amenity.id);

        expect(closed.status).toBe('closed');
      });
    });

    describe('setMaintenance', () => {
      it('should set status to maintenance', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const maintained = await service.setMaintenance(amenity.id);

        expect(maintained.status).toBe('maintenance');
      });
    });

    describe('activateAmenity', () => {
      it('should activate amenity', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.deactivateAmenity(amenity.id);
        const activated = await service.activateAmenity(amenity.id);

        expect(activated.isActive).toBe(true);
      });
    });

    describe('deactivateAmenity', () => {
      it('should deactivate amenity', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const deactivated = await service.deactivateAmenity(amenity.id);

        expect(deactivated.isActive).toBe(false);
      });
    });
  });

  describe('schedule management', () => {
    describe('setSchedule', () => {
      it('should set schedule for amenity', async () => {
        const amenity = await service.createAmenity(validAmenityInput);

        const schedule = await service.setSchedule(amenity.id, [
          { amenityId: amenity.id, dayOfWeek: 0, openingTime: '08:00', closingTime: '18:00', isClosed: false },
          { amenityId: amenity.id, dayOfWeek: 1, openingTime: '06:00', closingTime: '22:00', isClosed: false }
        ]);

        expect(schedule).toHaveLength(2);
        expect(schedule[0].id).toBeDefined();
      });

      it('should reject invalid day of week', async () => {
        const amenity = await service.createAmenity(validAmenityInput);

        await expect(service.setSchedule(amenity.id, [
          { amenityId: amenity.id, dayOfWeek: 7, openingTime: '08:00', closingTime: '18:00', isClosed: false }
        ])).rejects.toThrow('Invalid day of week');
      });

      it('should reject invalid time range in schedule', async () => {
        const amenity = await service.createAmenity(validAmenityInput);

        await expect(service.setSchedule(amenity.id, [
          { amenityId: amenity.id, dayOfWeek: 0, openingTime: '18:00', closingTime: '08:00', isClosed: false }
        ])).rejects.toThrow('Invalid time range');
      });
    });

    describe('getSchedule', () => {
      it('should return schedule for amenity', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.setSchedule(amenity.id, [
          { amenityId: amenity.id, dayOfWeek: 0, openingTime: '08:00', closingTime: '18:00', isClosed: false }
        ]);

        const schedule = await service.getSchedule(amenity.id);
        expect(schedule).toHaveLength(1);
      });
    });

    describe('isOpenAt', () => {
      it('should return true when open during default hours', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const isOpen = await service.isOpenAt(amenity.id, 1, '12:00');

        expect(isOpen).toBe(true);
      });

      it('should return false when closed', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.closeAmenity(amenity.id);

        const isOpen = await service.isOpenAt(amenity.id, 1, '12:00');
        expect(isOpen).toBe(false);
      });

      it('should return false when inactive', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.deactivateAmenity(amenity.id);

        const isOpen = await service.isOpenAt(amenity.id, 1, '12:00');
        expect(isOpen).toBe(false);
      });

      it('should use schedule when available', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.setSchedule(amenity.id, [
          { amenityId: amenity.id, dayOfWeek: 1, openingTime: '10:00', closingTime: '14:00', isClosed: false }
        ]);

        expect(await service.isOpenAt(amenity.id, 1, '12:00')).toBe(true);
        expect(await service.isOpenAt(amenity.id, 1, '09:00')).toBe(false);
        expect(await service.isOpenAt(amenity.id, 1, '15:00')).toBe(false);
      });

      it('should respect closed days in schedule', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.setSchedule(amenity.id, [
          { amenityId: amenity.id, dayOfWeek: 0, openingTime: '08:00', closingTime: '18:00', isClosed: true }
        ]);

        expect(await service.isOpenAt(amenity.id, 0, '12:00')).toBe(false);
      });
    });
  });

  describe('reservation management', () => {
    describe('createReservation', () => {
      it('should create a reservation', async () => {
        const amenity = await service.createAmenity({ ...validAmenityInput, requiresReservation: true });
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });

        expect(reservation.id).toBeDefined();
        expect(reservation.status).toBe('pending');
        expect(reservation.guestName).toBe('John Doe');
      });

      it('should reject for non-existent amenity', async () => {
        await expect(service.createReservation({
          ...validReservationInput,
          amenityId: 'non-existent'
        })).rejects.toThrow('Amenity not found');
      });

      it('should reject for inactive amenity', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.deactivateAmenity(amenity.id);

        await expect(service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        })).rejects.toThrow('Amenity is not active');
      });

      it('should reject for unavailable amenity', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.closeAmenity(amenity.id);

        await expect(service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        })).rejects.toThrow('Amenity is not available');
      });

      it('should reject invalid time range', async () => {
        const amenity = await service.createAmenity(validAmenityInput);

        await expect(service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          startTime: '12:00',
          endTime: '10:00'
        })).rejects.toThrow('Invalid time range');
      });

      it('should reject party size less than 1', async () => {
        const amenity = await service.createAmenity(validAmenityInput);

        await expect(service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          partySize: 0
        })).rejects.toThrow('Party size must be at least 1');
      });

      it('should reject party size exceeding capacity', async () => {
        const amenity = await service.createAmenity({ ...validAmenityInput, capacity: 5 });

        await expect(service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          partySize: 10
        })).rejects.toThrow('Party size exceeds amenity capacity');
      });

      it('should reject conflicting time slot', async () => {
        const amenity = await service.createAmenity(validAmenityInput);

        await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          startTime: '10:00',
          endTime: '11:00'
        });

        await expect(service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          startTime: '10:30',
          endTime: '11:30'
        })).rejects.toThrow('Time slot is not available');
      });
    });

    describe('getReservation', () => {
      it('should return reservation by id', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const created = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });

        const retrieved = await service.getReservation(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
      });
    });

    describe('confirmReservation', () => {
      it('should confirm pending reservation', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });

        const confirmed = await service.confirmReservation(reservation.id);
        expect(confirmed.status).toBe('confirmed');
      });

      it('should reject confirming non-pending reservation', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });
        await service.confirmReservation(reservation.id);

        await expect(service.confirmReservation(reservation.id))
          .rejects.toThrow('Can only confirm pending reservations');
      });
    });

    describe('cancelReservation', () => {
      it('should cancel reservation', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });

        const cancelled = await service.cancelReservation(reservation.id);
        expect(cancelled.status).toBe('cancelled');
      });

      it('should reject cancelling already cancelled reservation', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });
        await service.cancelReservation(reservation.id);

        await expect(service.cancelReservation(reservation.id))
          .rejects.toThrow('Cannot cancel reservation in current status');
      });
    });

    describe('completeReservation', () => {
      it('should complete confirmed reservation', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });
        await service.confirmReservation(reservation.id);

        const completed = await service.completeReservation(reservation.id);
        expect(completed.status).toBe('completed');
      });

      it('should reject completing non-confirmed reservation', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });

        await expect(service.completeReservation(reservation.id))
          .rejects.toThrow('Can only complete confirmed reservations');
      });
    });

    describe('markNoShow', () => {
      it('should mark confirmed reservation as no-show', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });
        await service.confirmReservation(reservation.id);

        const noShow = await service.markNoShow(reservation.id);
        expect(noShow.status).toBe('no_show');
      });

      it('should reject marking non-confirmed reservation as no-show', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id
        });

        await expect(service.markNoShow(reservation.id))
          .rejects.toThrow('Can only mark confirmed reservations as no-show');
      });
    });
  });

  describe('availability', () => {
    describe('checkAvailability', () => {
      it('should return true when slot is available', async () => {
        const amenity = await service.createAmenity(validAmenityInput);

        const available = await service.checkAvailability(
          amenity.id,
          '2026-02-01',
          '10:00',
          '11:00'
        );

        expect(available).toBe(true);
      });

      it('should return false when slot overlaps', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          startTime: '10:00',
          endTime: '12:00'
        });

        const available = await service.checkAvailability(
          amenity.id,
          '2026-02-01',
          '11:00',
          '13:00'
        );

        expect(available).toBe(false);
      });

      it('should ignore cancelled reservations', async () => {
        const amenity = await service.createAmenity(validAmenityInput);
        const reservation = await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          startTime: '10:00',
          endTime: '12:00'
        });
        await service.cancelReservation(reservation.id);

        const available = await service.checkAvailability(
          amenity.id,
          '2026-02-01',
          '10:00',
          '12:00'
        );

        expect(available).toBe(true);
      });
    });

    describe('getAvailableSlots', () => {
      it('should return all slots when no reservations', async () => {
        const amenity = await service.createAmenity({
          ...validAmenityInput,
          openingTime: '08:00',
          closingTime: '18:00'
        });

        const slots = await service.getAvailableSlots(amenity.id, '2026-02-01');

        expect(slots).toHaveLength(1);
        expect(slots[0].startTime).toBe('08:00');
        expect(slots[0].endTime).toBe('18:00');
      });

      it('should return slots around reservations', async () => {
        const amenity = await service.createAmenity({
          ...validAmenityInput,
          openingTime: '08:00',
          closingTime: '18:00'
        });
        await service.createReservation({
          ...validReservationInput,
          amenityId: amenity.id,
          startTime: '10:00',
          endTime: '12:00'
        });

        const slots = await service.getAvailableSlots(amenity.id, '2026-02-01');

        expect(slots).toHaveLength(2);
        expect(slots[0]).toEqual({ startTime: '08:00', endTime: '10:00' });
        expect(slots[1]).toEqual({ startTime: '12:00', endTime: '18:00' });
      });
    });
  });

  describe('utility methods', () => {
    describe('isValidTimeRange', () => {
      it('should return true for valid range', () => {
        expect(service.isValidTimeRange('08:00', '12:00')).toBe(true);
      });

      it('should return false for invalid range', () => {
        expect(service.isValidTimeRange('12:00', '08:00')).toBe(false);
      });

      it('should return false for same times', () => {
        expect(service.isValidTimeRange('12:00', '12:00')).toBe(false);
      });
    });

    describe('parseTime', () => {
      it('should parse time correctly', () => {
        expect(service.parseTime('14:30')).toEqual({ hours: 14, minutes: 30 });
      });

      it('should handle leading zeros', () => {
        expect(service.parseTime('08:05')).toEqual({ hours: 8, minutes: 5 });
      });
    });

    describe('formatTime', () => {
      it('should format time correctly', () => {
        expect(service.formatTime(14, 30)).toBe('14:30');
      });

      it('should pad single digits', () => {
        expect(service.formatTime(8, 5)).toBe('08:05');
      });
    });

    describe('calculateDurationMinutes', () => {
      it('should calculate duration correctly', () => {
        expect(service.calculateDurationMinutes('10:00', '12:00')).toBe(120);
        expect(service.calculateDurationMinutes('10:00', '10:30')).toBe(30);
      });
    });

    describe('calculateCost', () => {
      it('should return 0 for complimentary amenity', async () => {
        const amenity = await service.createAmenity({
          ...validAmenityInput,
          isComplimentary: true
        });

        const cost = service.calculateCost(amenity, 120);
        expect(cost).toBe(0);
      });

      it('should calculate cost based on hourly rate', async () => {
        const amenity = await service.createAmenity({
          ...validAmenityInput,
          isComplimentary: false,
          pricePerHour: 50
        });

        const cost = service.calculateCost(amenity, 120);
        expect(cost).toBe(100); // 2 hours * $50
      });

      it('should calculate partial hours', async () => {
        const amenity = await service.createAmenity({
          ...validAmenityInput,
          isComplimentary: false,
          pricePerHour: 60
        });

        const cost = service.calculateCost(amenity, 90);
        expect(cost).toBe(90); // 1.5 hours * $60
      });
    });
  });

  describe('edge cases', () => {
    it('should handle all amenity categories', async () => {
      const categories: AmenityCategory[] = ['pool', 'spa', 'fitness', 'dining', 'entertainment', 'sports', 'recreation', 'business', 'kids', 'other'];

      for (const category of categories) {
        const amenity = await service.createAmenity({
          ...validAmenityInput,
          name: `${category} amenity`,
          category
        });
        expect(amenity.category).toBe(category);
      }
    });

    it('should handle all amenity statuses', async () => {
      const amenity = await service.createAmenity(validAmenityInput);
      const statuses: AmenityStatus[] = ['available', 'maintenance', 'closed', 'reserved'];

      for (const status of statuses) {
        const updated = await service.setStatus(amenity.id, status);
        expect(updated.status).toBe(status);
      }
    });
  });
});
