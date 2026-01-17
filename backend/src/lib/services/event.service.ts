/**
 * Event Service
 *
 * Business logic for venue and event management with DI.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Container,
  EventRepository,
  Venue,
  Event,
  EventType,
  EventStatus,
  VenueStatus,
  VenueFilters,
  EventFilters,
  LoggerService,
} from '../container/types.js';

// ============================================
// TYPES
// ============================================

export interface CreateVenueInput {
  name: string;
  description: string;
  capacity: number;
  indoorCapacity?: number;
  outdoorCapacity?: number;
  amenities?: string[];
  hourlyRate: number;
  dailyRate?: number;
  currency?: string;
  location: string;
  images?: string[];
}

export interface UpdateVenueInput {
  name?: string;
  description?: string;
  capacity?: number;
  indoorCapacity?: number;
  outdoorCapacity?: number;
  amenities?: string[];
  hourlyRate?: number;
  dailyRate?: number;
  location?: string;
  images?: string[];
}

export interface CreateEventInput {
  name: string;
  description: string;
  eventType: EventType;
  venueId: string;
  organizerId: string;
  startTime: string;
  endTime: string;
  expectedGuests: number;
  budget?: number;
  notes?: string;
  requirements?: string[];
}

export interface UpdateEventInput {
  name?: string;
  description?: string;
  expectedGuests?: number;
  actualGuests?: number;
  budget?: number;
  actualCost?: number;
  notes?: string;
  requirements?: string[];
}

export interface EventStats {
  totalVenues: number;
  totalEvents: number;
  byType: Record<EventType, number>;
  byStatus: Record<EventStatus, number>;
  venuesByStatus: Record<VenueStatus, number>;
  totalCapacity: number;
  avgEventBudget: number;
}

export interface EventService {
  // Venue operations
  createVenue(input: CreateVenueInput): Promise<Venue>;
  getVenue(id: string): Promise<Venue | null>;
  updateVenue(id: string, input: UpdateVenueInput): Promise<Venue>;
  deleteVenue(id: string): Promise<void>;
  listVenues(filters?: VenueFilters): Promise<Venue[]>;
  setVenueStatus(id: string, status: VenueStatus): Promise<Venue>;
  checkVenueAvailability(venueId: string, startTime: string, endTime: string): Promise<boolean>;
  
  // Event operations
  createEvent(input: CreateEventInput): Promise<Event>;
  getEvent(id: string): Promise<Event | null>;
  updateEvent(id: string, input: UpdateEventInput): Promise<Event>;
  cancelEvent(id: string, reason?: string): Promise<Event>;
  startEvent(id: string): Promise<Event>;
  completeEvent(id: string, actualGuests?: number, actualCost?: number): Promise<Event>;
  listEvents(filters?: EventFilters): Promise<Event[]>;
  getUpcomingEvents(venueId?: string): Promise<Event[]>;
  
  // Utility
  getStats(): Promise<EventStats>;
  getEventTypes(): EventType[];
  getEventStatuses(): EventStatus[];
  getVenueStatuses(): VenueStatus[];
}

// ============================================
// ERROR CLASS
// ============================================

export class EventServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'EventServiceError';
  }
}

// ============================================
// CONSTANTS
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_TYPES: EventType[] = ['wedding', 'conference', 'party', 'meeting', 'gala', 'concert', 'other'];
const EVENT_STATUSES: EventStatus[] = ['draft', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const VENUE_STATUSES: VenueStatus[] = ['available', 'maintenance', 'reserved', 'closed'];
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR'];

// ============================================
// FACTORY
// ============================================

export function createEventService(container: Container): EventService {
  const repository: EventRepository = container.eventRepository;
  const logger: LoggerService = container.logger;

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  function validateUUID(id: string, field: string): void {
    if (!UUID_REGEX.test(id)) {
      throw new EventServiceError(`Invalid ${field} format`, `INVALID_${field.toUpperCase()}_ID`);
    }
  }

  function validateVenueName(name: string): void {
    if (!name || name.trim().length < 2) {
      throw new EventServiceError('Venue name must be at least 2 characters', 'INVALID_VENUE_NAME');
    }
  }

  function validateEventName(name: string): void {
    if (!name || name.trim().length < 2) {
      throw new EventServiceError('Event name must be at least 2 characters', 'INVALID_EVENT_NAME');
    }
  }

  function validateDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      throw new EventServiceError('Description is required', 'INVALID_DESCRIPTION');
    }
  }

  function validateCapacity(capacity: number): void {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new EventServiceError('Capacity must be a positive integer', 'INVALID_CAPACITY');
    }
  }

  function validateHourlyRate(rate: number): void {
    if (typeof rate !== 'number' || rate < 0) {
      throw new EventServiceError('Hourly rate must be non-negative', 'INVALID_HOURLY_RATE');
    }
  }

  function validateEventType(type: EventType): void {
    if (!EVENT_TYPES.includes(type)) {
      throw new EventServiceError(`Invalid event type: ${type}`, 'INVALID_EVENT_TYPE');
    }
  }

  function validateDateRange(startTime: string, endTime: string): void {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime())) {
      throw new EventServiceError('Invalid start time', 'INVALID_START_TIME');
    }
    
    if (isNaN(end.getTime())) {
      throw new EventServiceError('Invalid end time', 'INVALID_END_TIME');
    }
    
    if (end <= start) {
      throw new EventServiceError('End time must be after start time', 'INVALID_TIME_RANGE');
    }
  }

  function validateExpectedGuests(count: number): void {
    if (!Number.isInteger(count) || count < 1) {
      throw new EventServiceError('Expected guests must be a positive integer', 'INVALID_GUEST_COUNT');
    }
  }

  // ============================================
  // VENUE OPERATIONS
  // ============================================

  async function createVenue(input: CreateVenueInput): Promise<Venue> {
    validateVenueName(input.name);
    validateDescription(input.description);
    validateCapacity(input.capacity);
    validateHourlyRate(input.hourlyRate);

    if (input.currency && !SUPPORTED_CURRENCIES.includes(input.currency)) {
      throw new EventServiceError(`Unsupported currency: ${input.currency}`, 'INVALID_CURRENCY');
    }

    const venue = await repository.createVenue({
      name: input.name.trim(),
      description: input.description.trim(),
      capacity: input.capacity,
      indoorCapacity: input.indoorCapacity ?? input.capacity,
      outdoorCapacity: input.outdoorCapacity ?? 0,
      amenities: input.amenities ?? [],
      hourlyRate: input.hourlyRate,
      dailyRate: input.dailyRate ?? input.hourlyRate * 8,
      currency: input.currency ?? 'USD',
      status: 'available',
      images: input.images ?? [],
      location: input.location.trim(),
    });

    logger.info('Venue created', { venueId: venue.id, name: venue.name });
    return venue;
  }

  async function getVenue(id: string): Promise<Venue | null> {
    validateUUID(id, 'venue');
    return repository.getVenueById(id);
  }

  async function updateVenue(id: string, input: UpdateVenueInput): Promise<Venue> {
    validateUUID(id, 'venue');

    const venue = await repository.getVenueById(id);
    if (!venue) {
      throw new EventServiceError('Venue not found', 'VENUE_NOT_FOUND', 404);
    }

    if (input.name !== undefined) {
      validateVenueName(input.name);
    }

    if (input.capacity !== undefined) {
      validateCapacity(input.capacity);
    }

    if (input.hourlyRate !== undefined) {
      validateHourlyRate(input.hourlyRate);
    }

    const updated = await repository.updateVenue(id, {
      ...(input.name && { name: input.name.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.indoorCapacity !== undefined && { indoorCapacity: input.indoorCapacity }),
      ...(input.outdoorCapacity !== undefined && { outdoorCapacity: input.outdoorCapacity }),
      ...(input.amenities && { amenities: input.amenities }),
      ...(input.hourlyRate !== undefined && { hourlyRate: input.hourlyRate }),
      ...(input.dailyRate !== undefined && { dailyRate: input.dailyRate }),
      ...(input.location && { location: input.location.trim() }),
      ...(input.images && { images: input.images }),
    });

    logger.info('Venue updated', { venueId: id });
    return updated;
  }

  async function deleteVenue(id: string): Promise<void> {
    validateUUID(id, 'venue');

    const venue = await repository.getVenueById(id);
    if (!venue) {
      throw new EventServiceError('Venue not found', 'VENUE_NOT_FOUND', 404);
    }

    // Check for upcoming events
    const now = new Date().toISOString();
    const futureEvents = await repository.getEventsByVenue(id, now.split('T')[0], '2099-12-31');
    const activeEvents = futureEvents.filter(e => !['completed', 'cancelled'].includes(e.status));
    
    if (activeEvents.length > 0) {
      throw new EventServiceError(
        'Cannot delete venue with active events',
        'VENUE_HAS_ACTIVE_EVENTS'
      );
    }

    await repository.deleteVenue(id);
    logger.info('Venue deleted', { venueId: id });
  }

  async function listVenues(filters?: VenueFilters): Promise<Venue[]> {
    return repository.listVenues(filters);
  }

  async function setVenueStatus(id: string, status: VenueStatus): Promise<Venue> {
    validateUUID(id, 'venue');

    if (!VENUE_STATUSES.includes(status)) {
      throw new EventServiceError(`Invalid venue status: ${status}`, 'INVALID_VENUE_STATUS');
    }

    const venue = await repository.getVenueById(id);
    if (!venue) {
      throw new EventServiceError('Venue not found', 'VENUE_NOT_FOUND', 404);
    }

    const updated = await repository.updateVenue(id, { status });
    logger.info('Venue status updated', { venueId: id, status });
    return updated;
  }

  async function checkVenueAvailability(
    venueId: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    validateUUID(venueId, 'venue');
    validateDateRange(startTime, endTime);

    const venue = await repository.getVenueById(venueId);
    if (!venue) {
      throw new EventServiceError('Venue not found', 'VENUE_NOT_FOUND', 404);
    }

    if (venue.status !== 'available') {
      return false;
    }

    const startDate = startTime.split('T')[0];
    const endDate = endTime.split('T')[0];
    const existingEvents = await repository.getEventsByVenue(venueId, startDate, endDate);

    // Check for overlapping events
    const requestStart = new Date(startTime).getTime();
    const requestEnd = new Date(endTime).getTime();

    for (const event of existingEvents) {
      if (['cancelled', 'completed'].includes(event.status)) continue;

      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = new Date(event.endTime).getTime();

      // Check if times overlap
      if (requestStart < eventEnd && requestEnd > eventStart) {
        return false;
      }
    }

    return true;
  }

  // ============================================
  // EVENT OPERATIONS
  // ============================================

  async function createEvent(input: CreateEventInput): Promise<Event> {
    validateEventName(input.name);
    validateDescription(input.description);
    validateEventType(input.eventType);
    validateUUID(input.venueId, 'venue');
    validateUUID(input.organizerId, 'organizer');
    validateDateRange(input.startTime, input.endTime);
    validateExpectedGuests(input.expectedGuests);

    // Check venue exists
    const venue = await repository.getVenueById(input.venueId);
    if (!venue) {
      throw new EventServiceError('Venue not found', 'VENUE_NOT_FOUND', 404);
    }

    // Check capacity
    if (input.expectedGuests > venue.capacity) {
      throw new EventServiceError(
        `Expected guests (${input.expectedGuests}) exceeds venue capacity (${venue.capacity})`,
        'EXCEEDS_CAPACITY'
      );
    }

    // Check availability
    const isAvailable = await checkVenueAvailability(input.venueId, input.startTime, input.endTime);
    if (!isAvailable) {
      throw new EventServiceError('Venue is not available for the requested time', 'VENUE_UNAVAILABLE');
    }

    const event = await repository.createEvent({
      name: input.name.trim(),
      description: input.description.trim(),
      eventType: input.eventType,
      venueId: input.venueId,
      organizerId: input.organizerId,
      startTime: input.startTime,
      endTime: input.endTime,
      expectedGuests: input.expectedGuests,
      actualGuests: null,
      status: 'scheduled',
      budget: input.budget ?? null,
      actualCost: null,
      notes: input.notes?.trim() ?? null,
      requirements: input.requirements ?? [],
    });

    logger.info('Event created', { eventId: event.id, name: event.name, venueId: event.venueId });
    return event;
  }

  async function getEvent(id: string): Promise<Event | null> {
    validateUUID(id, 'event');
    return repository.getEventById(id);
  }

  async function updateEvent(id: string, input: UpdateEventInput): Promise<Event> {
    validateUUID(id, 'event');

    const event = await repository.getEventById(id);
    if (!event) {
      throw new EventServiceError('Event not found', 'EVENT_NOT_FOUND', 404);
    }

    if (['completed', 'cancelled'].includes(event.status)) {
      throw new EventServiceError('Cannot update completed or cancelled event', 'EVENT_FINALIZED');
    }

    if (input.name !== undefined) {
      validateEventName(input.name);
    }

    if (input.expectedGuests !== undefined) {
      validateExpectedGuests(input.expectedGuests);
      
      // Check venue capacity
      const venue = await repository.getVenueById(event.venueId);
      if (venue && input.expectedGuests > venue.capacity) {
        throw new EventServiceError(
          `Expected guests (${input.expectedGuests}) exceeds venue capacity (${venue.capacity})`,
          'EXCEEDS_CAPACITY'
        );
      }
    }

    const updated = await repository.updateEvent(id, {
      ...(input.name && { name: input.name.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.expectedGuests !== undefined && { expectedGuests: input.expectedGuests }),
      ...(input.actualGuests !== undefined && { actualGuests: input.actualGuests }),
      ...(input.budget !== undefined && { budget: input.budget }),
      ...(input.actualCost !== undefined && { actualCost: input.actualCost }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() ?? null }),
      ...(input.requirements && { requirements: input.requirements }),
    });

    logger.info('Event updated', { eventId: id });
    return updated;
  }

  async function cancelEvent(id: string, reason?: string): Promise<Event> {
    validateUUID(id, 'event');

    const event = await repository.getEventById(id);
    if (!event) {
      throw new EventServiceError('Event not found', 'EVENT_NOT_FOUND', 404);
    }

    if (event.status === 'cancelled') {
      throw new EventServiceError('Event is already cancelled', 'ALREADY_CANCELLED');
    }

    if (event.status === 'completed') {
      throw new EventServiceError('Cannot cancel completed event', 'EVENT_COMPLETED');
    }

    const notes = reason
      ? (event.notes ? `${event.notes}\n\nCancellation: ${reason}` : `Cancellation: ${reason}`)
      : event.notes;

    const updated = await repository.updateEvent(id, {
      status: 'cancelled',
      notes,
    });

    logger.info('Event cancelled', { eventId: id, reason });
    return updated;
  }

  async function startEvent(id: string): Promise<Event> {
    validateUUID(id, 'event');

    const event = await repository.getEventById(id);
    if (!event) {
      throw new EventServiceError('Event not found', 'EVENT_NOT_FOUND', 404);
    }

    if (!['scheduled', 'confirmed'].includes(event.status)) {
      throw new EventServiceError(
        `Cannot start event with status: ${event.status}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.updateEvent(id, {
      status: 'in_progress',
    });

    logger.info('Event started', { eventId: id });
    return updated;
  }

  async function completeEvent(
    id: string,
    actualGuests?: number,
    actualCost?: number
  ): Promise<Event> {
    validateUUID(id, 'event');

    const event = await repository.getEventById(id);
    if (!event) {
      throw new EventServiceError('Event not found', 'EVENT_NOT_FOUND', 404);
    }

    if (event.status !== 'in_progress') {
      throw new EventServiceError(
        'Only in-progress events can be completed',
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.updateEvent(id, {
      status: 'completed',
      actualGuests: actualGuests ?? event.actualGuests,
      actualCost: actualCost ?? event.actualCost,
    });

    logger.info('Event completed', { eventId: id, actualGuests, actualCost });
    return updated;
  }

  async function listEvents(filters?: EventFilters): Promise<Event[]> {
    return repository.listEvents(filters);
  }

  async function getUpcomingEvents(venueId?: string): Promise<Event[]> {
    const now = new Date().toISOString();
    const events = await repository.listEvents({
      venueId,
      dateRange: { start: now.split('T')[0], end: '2099-12-31' },
    });

    return events
      .filter(e => !['completed', 'cancelled'].includes(e.status))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  // ============================================
  // UTILITY
  // ============================================

  async function getStats(): Promise<EventStats> {
    const venues = await repository.listVenues();
    const events = await repository.listEvents();

    const byType: Record<EventType, number> = {
      wedding: 0,
      conference: 0,
      party: 0,
      meeting: 0,
      gala: 0,
      concert: 0,
      other: 0,
    };

    const byStatus: Record<EventStatus, number> = {
      draft: 0,
      scheduled: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    const venuesByStatus: Record<VenueStatus, number> = {
      available: 0,
      maintenance: 0,
      reserved: 0,
      closed: 0,
    };

    let totalBudget = 0;
    let budgetCount = 0;

    for (const event of events) {
      byType[event.eventType]++;
      byStatus[event.status]++;
      
      if (event.budget !== null) {
        totalBudget += event.budget;
        budgetCount++;
      }
    }

    for (const venue of venues) {
      venuesByStatus[venue.status]++;
    }

    return {
      totalVenues: venues.length,
      totalEvents: events.length,
      byType,
      byStatus,
      venuesByStatus,
      totalCapacity: venues.reduce((sum, v) => sum + v.capacity, 0),
      avgEventBudget: budgetCount > 0 ? totalBudget / budgetCount : 0,
    };
  }

  function getEventTypes(): EventType[] {
    return [...EVENT_TYPES];
  }

  function getEventStatuses(): EventStatus[] {
    return [...EVENT_STATUSES];
  }

  function getVenueStatuses(): VenueStatus[] {
    return [...VENUE_STATUSES];
  }

  return {
    createVenue,
    getVenue,
    updateVenue,
    deleteVenue,
    listVenues,
    setVenueStatus,
    checkVenueAvailability,
    createEvent,
    getEvent,
    updateEvent,
    cancelEvent,
    startEvent,
    completeEvent,
    listEvents,
    getUpcomingEvents,
    getStats,
    getEventTypes,
    getEventStatuses,
    getVenueStatuses,
  };
}
