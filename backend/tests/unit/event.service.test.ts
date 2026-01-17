/**
 * Event Service Tests
 *
 * Unit tests for the Event/Venue Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createEventService, EventServiceError } from '../../src/lib/services/event.service';
import { InMemoryEventRepository } from '../../src/lib/repositories/event.repository.memory';
import type { Container, Venue, Event } from '../../src/lib/container/types';

// Test UUIDs
const VENUE_1 = '11111111-1111-1111-1111-111111111111';
const VENUE_2 = '22222222-2222-2222-2222-222222222222';
const ORGANIZER_1 = '33333333-3333-3333-3333-333333333333';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(eventRepository: InMemoryEventRepository): Container {
  return {
    eventRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

function createTestVenue(overrides: Partial<Venue> = {}): Venue {
  const now = new Date().toISOString();
  return {
    id: '99999999-9999-9999-9999-999999999999',
    name: 'Grand Ballroom',
    description: 'A beautiful ballroom for events',
    capacity: 500,
    indoorCapacity: 500,
    outdoorCapacity: 0,
    amenities: ['wifi', 'av_equipment', 'catering'],
    hourlyRate: 500,
    dailyRate: 3000,
    currency: 'USD',
    status: 'available',
    images: [],
    location: 'Main Building, Floor 1',
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

function createTestEvent(overrides: Partial<Event> = {}): Event {
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const dayAfter = new Date(Date.now() + 172800000).toISOString();
  
  return {
    id: '88888888-8888-8888-8888-888888888888',
    name: 'Test Event',
    description: 'A test event',
    eventType: 'conference',
    venueId: VENUE_1,
    organizerId: ORGANIZER_1,
    startTime: tomorrow,
    endTime: dayAfter,
    expectedGuests: 100,
    actualGuests: null,
    status: 'scheduled',
    budget: 10000,
    actualCost: null,
    notes: null,
    requirements: ['projector', 'microphones'],
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

describe('EventService', () => {
  let repository: InMemoryEventRepository;
  let container: Container;
  let service: ReturnType<typeof createEventService>;

  beforeEach(() => {
    repository = new InMemoryEventRepository();
    container = createMockContainer(repository);
    service = createEventService(container);
  });

  // ============================================
  // CREATE VENUE TESTS
  // ============================================
  describe('createVenue', () => {
    it('should create a venue', async () => {
      const venue = await service.createVenue({
        name: 'Grand Ballroom',
        description: 'A beautiful ballroom',
        capacity: 500,
        hourlyRate: 500,
        location: 'Main Building',
      });

      expect(venue).toBeDefined();
      expect(venue.name).toBe('Grand Ballroom');
      expect(venue.status).toBe('available');
    });

    it('should default indoor capacity to total capacity', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      expect(venue.indoorCapacity).toBe(200);
    });

    it('should calculate default daily rate', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      expect(venue.dailyRate).toBe(800); // hourlyRate * 8
    });

    it('should default to USD currency', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      expect(venue.currency).toBe('USD');
    });

    it('should accept custom currency', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        currency: 'EUR',
        location: 'Location',
      });

      expect(venue.currency).toBe('EUR');
    });

    it('should accept amenities', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        amenities: ['wifi', 'parking'],
        location: 'Location',
      });

      expect(venue.amenities).toContain('wifi');
      expect(venue.amenities).toContain('parking');
    });

    it('should reject short name', async () => {
      await expect(
        service.createVenue({
          name: 'V',
          description: 'Description',
          capacity: 200,
          hourlyRate: 100,
          location: 'Location',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_VENUE_NAME',
      });
    });

    it('should reject empty description', async () => {
      await expect(
        service.createVenue({
          name: 'Venue',
          description: '',
          capacity: 200,
          hourlyRate: 100,
          location: 'Location',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DESCRIPTION',
      });
    });

    it('should reject invalid capacity', async () => {
      await expect(
        service.createVenue({
          name: 'Venue',
          description: 'Description',
          capacity: 0,
          hourlyRate: 100,
          location: 'Location',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CAPACITY',
      });
    });

    it('should reject negative hourly rate', async () => {
      await expect(
        service.createVenue({
          name: 'Venue',
          description: 'Description',
          capacity: 200,
          hourlyRate: -50,
          location: 'Location',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_HOURLY_RATE',
      });
    });

    it('should reject unsupported currency', async () => {
      await expect(
        service.createVenue({
          name: 'Venue',
          description: 'Description',
          capacity: 200,
          hourlyRate: 100,
          currency: 'XYZ',
          location: 'Location',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CURRENCY',
      });
    });
  });

  // ============================================
  // GET VENUE TESTS
  // ============================================
  describe('getVenue', () => {
    it('should retrieve venue by ID', async () => {
      const created = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const found = await service.getVenue(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent venue', async () => {
      const found = await service.getVenue(VENUE_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getVenue(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_VENUE_ID',
      });
    });
  });

  // ============================================
  // UPDATE VENUE TESTS
  // ============================================
  describe('updateVenue', () => {
    let venueId: string;

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });
      venueId = venue.id;
    });

    it('should update venue name', async () => {
      const updated = await service.updateVenue(venueId, {
        name: 'Updated Venue',
      });

      expect(updated.name).toBe('Updated Venue');
    });

    it('should update capacity', async () => {
      const updated = await service.updateVenue(venueId, {
        capacity: 300,
      });

      expect(updated.capacity).toBe(300);
    });

    it('should update amenities', async () => {
      const updated = await service.updateVenue(venueId, {
        amenities: ['wifi', 'parking', 'catering'],
      });

      expect(updated.amenities).toHaveLength(3);
    });

    it('should reject non-existent venue', async () => {
      await expect(
        service.updateVenue(VENUE_2, { name: 'New Name' })
      ).rejects.toMatchObject({
        code: 'VENUE_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.updateVenue(INVALID_UUID, { name: 'New Name' })
      ).rejects.toMatchObject({
        code: 'INVALID_VENUE_ID',
      });
    });
  });

  // ============================================
  // DELETE VENUE TESTS
  // ============================================
  describe('deleteVenue', () => {
    it('should delete venue without events', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      await service.deleteVenue(venue.id);

      const found = await service.getVenue(venue.id);
      expect(found).toBeNull();
    });

    it('should reject non-existent venue', async () => {
      await expect(service.deleteVenue(VENUE_2)).rejects.toMatchObject({
        code: 'VENUE_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.deleteVenue(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_VENUE_ID',
      });
    });
  });

  // ============================================
  // SET VENUE STATUS TESTS
  // ============================================
  describe('setVenueStatus', () => {
    let venueId: string;

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });
      venueId = venue.id;
    });

    it('should set venue to maintenance', async () => {
      const updated = await service.setVenueStatus(venueId, 'maintenance');
      expect(updated.status).toBe('maintenance');
    });

    it('should set venue to closed', async () => {
      const updated = await service.setVenueStatus(venueId, 'closed');
      expect(updated.status).toBe('closed');
    });

    it('should reject invalid status', async () => {
      await expect(
        service.setVenueStatus(venueId, 'invalid' as any)
      ).rejects.toMatchObject({
        code: 'INVALID_VENUE_STATUS',
      });
    });

    it('should reject non-existent venue', async () => {
      await expect(
        service.setVenueStatus(VENUE_2, 'maintenance')
      ).rejects.toMatchObject({
        code: 'VENUE_NOT_FOUND',
      });
    });
  });

  // ============================================
  // LIST VENUES TESTS
  // ============================================
  describe('listVenues', () => {
    beforeEach(async () => {
      await service.createVenue({
        name: 'Small Room',
        description: 'Description',
        capacity: 50,
        hourlyRate: 100,
        amenities: ['wifi'],
        location: 'Location',
      });

      await service.createVenue({
        name: 'Large Hall',
        description: 'Description',
        capacity: 500,
        hourlyRate: 500,
        amenities: ['wifi', 'av_equipment'],
        location: 'Location',
      });
    });

    it('should return all venues', async () => {
      const venues = await service.listVenues();
      expect(venues.length).toBe(2);
    });

    it('should filter by min capacity', async () => {
      const venues = await service.listVenues({ minCapacity: 100 });
      expect(venues.length).toBe(1);
    });

    it('should filter by max capacity', async () => {
      const venues = await service.listVenues({ maxCapacity: 100 });
      expect(venues.length).toBe(1);
    });

    it('should filter by amenities', async () => {
      const venues = await service.listVenues({ amenities: ['av_equipment'] });
      expect(venues.length).toBe(1);
    });
  });

  // ============================================
  // CHECK VENUE AVAILABILITY TESTS
  // ============================================
  describe('checkVenueAvailability', () => {
    let venueId: string;
    const tomorrow = new Date(Date.now() + 86400000);
    const startTime = tomorrow.toISOString();
    const endTime = new Date(tomorrow.getTime() + 3600000 * 4).toISOString(); // 4 hours later

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });
      venueId = venue.id;
    });

    it('should return true for available slot', async () => {
      const available = await service.checkVenueAvailability(
        venueId,
        startTime,
        endTime
      );
      expect(available).toBe(true);
    });

    it('should return false for non-available venue', async () => {
      await service.setVenueStatus(venueId, 'maintenance');

      const available = await service.checkVenueAvailability(
        venueId,
        startTime,
        endTime
      );
      expect(available).toBe(false);
    });

    it('should reject non-existent venue', async () => {
      await expect(
        service.checkVenueAvailability(VENUE_2, startTime, endTime)
      ).rejects.toMatchObject({
        code: 'VENUE_NOT_FOUND',
      });
    });
  });

  // ============================================
  // CREATE EVENT TESTS
  // ============================================
  describe('createEvent', () => {
    let venueId: string;
    const tomorrow = new Date(Date.now() + 86400000);
    const startTime = tomorrow.toISOString();
    const endTime = new Date(tomorrow.getTime() + 3600000 * 4).toISOString();

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });
      venueId = venue.id;
    });

    it('should create an event', async () => {
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId,
        organizerId: ORGANIZER_1,
        startTime,
        endTime,
        expectedGuests: 100,
      });

      expect(event).toBeDefined();
      expect(event.name).toBe('Conference');
      expect(event.status).toBe('scheduled');
    });

    it('should accept budget', async () => {
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId,
        organizerId: ORGANIZER_1,
        startTime,
        endTime,
        expectedGuests: 100,
        budget: 50000,
      });

      expect(event.budget).toBe(50000);
    });

    it('should accept requirements', async () => {
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId,
        organizerId: ORGANIZER_1,
        startTime,
        endTime,
        expectedGuests: 100,
        requirements: ['projector', 'microphones'],
      });

      expect(event.requirements).toContain('projector');
    });

    it('should reject short name', async () => {
      await expect(
        service.createEvent({
          name: 'C',
          description: 'Description',
          eventType: 'conference',
          venueId,
          organizerId: ORGANIZER_1,
          startTime,
          endTime,
          expectedGuests: 100,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_EVENT_NAME',
      });
    });

    it('should reject invalid event type', async () => {
      await expect(
        service.createEvent({
          name: 'Conference',
          description: 'Description',
          eventType: 'invalid' as any,
          venueId,
          organizerId: ORGANIZER_1,
          startTime,
          endTime,
          expectedGuests: 100,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_EVENT_TYPE',
      });
    });

    it('should reject non-existent venue', async () => {
      await expect(
        service.createEvent({
          name: 'Conference',
          description: 'Description',
          eventType: 'conference',
          venueId: VENUE_2,
          organizerId: ORGANIZER_1,
          startTime,
          endTime,
          expectedGuests: 100,
        })
      ).rejects.toMatchObject({
        code: 'VENUE_NOT_FOUND',
      });
    });

    it('should reject guests exceeding capacity', async () => {
      await expect(
        service.createEvent({
          name: 'Conference',
          description: 'Description',
          eventType: 'conference',
          venueId,
          organizerId: ORGANIZER_1,
          startTime,
          endTime,
          expectedGuests: 500, // venue capacity is 200
        })
      ).rejects.toMatchObject({
        code: 'EXCEEDS_CAPACITY',
      });
    });

    it('should reject invalid time range', async () => {
      await expect(
        service.createEvent({
          name: 'Conference',
          description: 'Description',
          eventType: 'conference',
          venueId,
          organizerId: ORGANIZER_1,
          startTime: endTime, // swapped
          endTime: startTime,
          expectedGuests: 100,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_TIME_RANGE',
      });
    });
  });

  // ============================================
  // GET EVENT TESTS
  // ============================================
  describe('getEvent', () => {
    it('should retrieve event by ID', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const tomorrow = new Date(Date.now() + 86400000);
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId: venue.id,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000 * 4).toISOString(),
        expectedGuests: 100,
      });

      const found = await service.getEvent(event.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(event.id);
    });

    it('should return null for non-existent event', async () => {
      const found = await service.getEvent(VENUE_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getEvent(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_EVENT_ID',
      });
    });
  });

  // ============================================
  // UPDATE EVENT TESTS
  // ============================================
  describe('updateEvent', () => {
    let eventId: string;

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const tomorrow = new Date(Date.now() + 86400000);
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId: venue.id,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000 * 4).toISOString(),
        expectedGuests: 100,
      });
      eventId = event.id;
    });

    it('should update event name', async () => {
      const updated = await service.updateEvent(eventId, {
        name: 'Updated Conference',
      });

      expect(updated.name).toBe('Updated Conference');
    });

    it('should update expected guests', async () => {
      const updated = await service.updateEvent(eventId, {
        expectedGuests: 150,
      });

      expect(updated.expectedGuests).toBe(150);
    });

    it('should update budget', async () => {
      const updated = await service.updateEvent(eventId, {
        budget: 75000,
      });

      expect(updated.budget).toBe(75000);
    });

    it('should reject non-existent event', async () => {
      await expect(
        service.updateEvent(VENUE_2, { name: 'New Name' })
      ).rejects.toMatchObject({
        code: 'EVENT_NOT_FOUND',
      });
    });
  });

  // ============================================
  // CANCEL EVENT TESTS
  // ============================================
  describe('cancelEvent', () => {
    let eventId: string;

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const tomorrow = new Date(Date.now() + 86400000);
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId: venue.id,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000 * 4).toISOString(),
        expectedGuests: 100,
      });
      eventId = event.id;
    });

    it('should cancel event', async () => {
      const cancelled = await service.cancelEvent(eventId);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should add cancellation reason to notes', async () => {
      const cancelled = await service.cancelEvent(eventId, 'Organizer request');
      expect(cancelled.notes).toContain('Cancellation: Organizer request');
    });

    it('should reject already cancelled event', async () => {
      await service.cancelEvent(eventId);

      await expect(service.cancelEvent(eventId)).rejects.toMatchObject({
        code: 'ALREADY_CANCELLED',
      });
    });

    it('should reject non-existent event', async () => {
      await expect(service.cancelEvent(VENUE_2)).rejects.toMatchObject({
        code: 'EVENT_NOT_FOUND',
      });
    });
  });

  // ============================================
  // START EVENT TESTS
  // ============================================
  describe('startEvent', () => {
    let eventId: string;

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const tomorrow = new Date(Date.now() + 86400000);
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId: venue.id,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000 * 4).toISOString(),
        expectedGuests: 100,
      });
      eventId = event.id;
    });

    it('should start event', async () => {
      const started = await service.startEvent(eventId);
      expect(started.status).toBe('in_progress');
    });

    it('should reject non-existent event', async () => {
      await expect(service.startEvent(VENUE_2)).rejects.toMatchObject({
        code: 'EVENT_NOT_FOUND',
      });
    });
  });

  // ============================================
  // COMPLETE EVENT TESTS
  // ============================================
  describe('completeEvent', () => {
    let eventId: string;

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const tomorrow = new Date(Date.now() + 86400000);
      const event = await service.createEvent({
        name: 'Conference',
        description: 'Annual conference',
        eventType: 'conference',
        venueId: venue.id,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000 * 4).toISOString(),
        expectedGuests: 100,
        budget: 50000,
      });
      eventId = event.id;
      await service.startEvent(eventId);
    });

    it('should complete event', async () => {
      const completed = await service.completeEvent(eventId);
      expect(completed.status).toBe('completed');
    });

    it('should record actual guests', async () => {
      const completed = await service.completeEvent(eventId, 95);
      expect(completed.actualGuests).toBe(95);
    });

    it('should record actual cost', async () => {
      const completed = await service.completeEvent(eventId, undefined, 45000);
      expect(completed.actualCost).toBe(45000);
    });

    it('should reject non-started event', async () => {
      const venue = await service.createVenue({
        name: 'Venue 2',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const tomorrow = new Date(Date.now() + 86400000 * 2);
      const event = await service.createEvent({
        name: 'Another Event',
        description: 'Description',
        eventType: 'meeting',
        venueId: venue.id,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000).toISOString(),
        expectedGuests: 20,
      });

      await expect(service.completeEvent(event.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // LIST EVENTS TESTS
  // ============================================
  describe('listEvents', () => {
    let venueId: string;

    beforeEach(async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });
      venueId = venue.id;

      const tomorrow = new Date(Date.now() + 86400000);

      await service.createEvent({
        name: 'Conference',
        description: 'Conference',
        eventType: 'conference',
        venueId,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000 * 4).toISOString(),
        expectedGuests: 100,
      });

      await service.createEvent({
        name: 'Wedding',
        description: 'Wedding',
        eventType: 'wedding',
        venueId,
        organizerId: ORGANIZER_1,
        startTime: new Date(tomorrow.getTime() + 86400000).toISOString(),
        endTime: new Date(tomorrow.getTime() + 86400000 + 3600000 * 6).toISOString(),
        expectedGuests: 150,
      });
    });

    it('should return all events', async () => {
      const events = await service.listEvents();
      expect(events.length).toBe(2);
    });

    it('should filter by event type', async () => {
      const events = await service.listEvents({ eventType: 'wedding' });
      expect(events.length).toBe(1);
    });

    it('should filter by venue', async () => {
      const events = await service.listEvents({ venueId });
      expect(events.length).toBe(2);
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no data', async () => {
      const stats = await service.getStats();

      expect(stats.totalVenues).toBe(0);
      expect(stats.totalEvents).toBe(0);
    });

    it('should count venues and events', async () => {
      const venue = await service.createVenue({
        name: 'Venue',
        description: 'Description',
        capacity: 200,
        hourlyRate: 100,
        location: 'Location',
      });

      const tomorrow = new Date(Date.now() + 86400000);
      await service.createEvent({
        name: 'Conference',
        description: 'Conference',
        eventType: 'conference',
        venueId: venue.id,
        organizerId: ORGANIZER_1,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 3600000 * 4).toISOString(),
        expectedGuests: 100,
        budget: 50000,
      });

      const stats = await service.getStats();

      expect(stats.totalVenues).toBe(1);
      expect(stats.totalEvents).toBe(1);
      expect(stats.byType.conference).toBe(1);
      expect(stats.avgEventBudget).toBe(50000);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getEventTypes', () => {
    it('should return all event types', () => {
      const types = service.getEventTypes();

      expect(types).toContain('wedding');
      expect(types).toContain('conference');
      expect(types).toContain('party');
    });
  });

  describe('getEventStatuses', () => {
    it('should return all event statuses', () => {
      const statuses = service.getEventStatuses();

      expect(statuses).toContain('scheduled');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('completed');
    });
  });

  describe('getVenueStatuses', () => {
    it('should return all venue statuses', () => {
      const statuses = service.getVenueStatuses();

      expect(statuses).toContain('available');
      expect(statuses).toContain('maintenance');
      expect(statuses).toContain('closed');
    });
  });
});
