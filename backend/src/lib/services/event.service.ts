import { randomUUID } from 'crypto';
import type {
  Container, Venue, Event, VenueStatus, EventType, EventStatus,
} from '../container/types';
import type { InMemoryEventRepository } from '../repositories/event.repository.memory';

const VENUE_STATUSES: VenueStatus[] = ['available', 'booked', 'maintenance', 'closed'];
const EVENT_TYPES: EventType[] = ['wedding', 'conference', 'party', 'gala', 'meeting', 'concert', 'exhibition', 'corporate', 'social', 'other'];
const EVENT_STATUSES: EventStatus[] = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'postponed'];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

function isUUID(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

export class EventServiceError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export function createEventService(container: Container) {
  const repo = container.eventRepository as InMemoryEventRepository;

  async function getVenueOrThrow(id: string): Promise<Venue> {
    if (!isUUID(id)) throw new EventServiceError('INVALID_VENUE_ID', 'Invalid venue ID format');
    const v = await repo.findVenueById(id);
    if (!v) throw new EventServiceError('VENUE_NOT_FOUND', 'Venue not found');
    return v;
  }

  async function getEventOrThrow(id: string): Promise<Event> {
    if (!isUUID(id)) throw new EventServiceError('INVALID_EVENT_ID', 'Invalid event ID format');
    const e = await repo.findEventById(id);
    if (!e) throw new EventServiceError('EVENT_NOT_FOUND', 'Event not found');
    return e;
  }

  return {
    // ─── Venues ───────────────────────────────────────────────────────────────
    async createVenue(input: {
      name: string; description: string; capacity: number; hourlyRate: number;
      location: string; currency?: string; amenities?: string[];
      indoorCapacity?: number; outdoorCapacity?: number; dailyRate?: number;
    }): Promise<Venue> {
      if (!input.name || input.name.trim().length < 2) throw new EventServiceError('INVALID_VENUE_NAME', 'Venue name must be at least 2 characters');
      if (!input.description?.trim()) throw new EventServiceError('INVALID_DESCRIPTION', 'Description is required');
      if (!input.capacity || input.capacity <= 0) throw new EventServiceError('INVALID_CAPACITY', 'Capacity must be positive');
      if (input.hourlyRate < 0) throw new EventServiceError('INVALID_HOURLY_RATE', 'Hourly rate cannot be negative');
      if (input.currency && !VALID_CURRENCIES.includes(input.currency)) throw new EventServiceError('INVALID_CURRENCY', `Unsupported currency: ${input.currency}`);

      const venue: Venue = {
        id: randomUUID(),
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
        images: [],
        location: input.location,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return repo.saveVenue(venue);
    },

    async getVenue(id: string): Promise<Venue | null> {
      if (!isUUID(id)) throw new EventServiceError('INVALID_VENUE_ID', 'Invalid venue ID format');
      return repo.findVenueById(id);
    },

    async updateVenue(id: string, updates: Partial<{ name: string; capacity: number; amenities: string[]; hourlyRate: number }>): Promise<Venue> {
      const v = await getVenueOrThrow(id);
      return repo.saveVenue({ ...v, ...updates, updatedAt: new Date().toISOString() });
    },

    async deleteVenue(id: string): Promise<void> {
      await getVenueOrThrow(id);
      await repo.deleteVenue(id);
    },

    async setVenueStatus(id: string, status: string): Promise<Venue> {
      const v = await getVenueOrThrow(id);
      if (!VENUE_STATUSES.includes(status as VenueStatus)) throw new EventServiceError('INVALID_VENUE_STATUS', `Invalid status: ${status}`);
      return repo.saveVenue({ ...v, status: status as VenueStatus, updatedAt: new Date().toISOString() });
    },

    async listVenues(filters?: { minCapacity?: number; maxCapacity?: number; amenities?: string[] }): Promise<Venue[]> {
      let all = await repo.findAllVenues();
      if (filters?.minCapacity) all = all.filter(v => v.capacity >= filters.minCapacity!);
      if (filters?.maxCapacity) all = all.filter(v => v.capacity <= filters.maxCapacity!);
      if (filters?.amenities?.length) all = all.filter(v => filters.amenities!.every(a => v.amenities.includes(a)));
      return all;
    },

    async checkVenueAvailability(venueId: string, startTime: string, endTime: string): Promise<boolean> {
      const v = await getVenueOrThrow(venueId);
      if (v.status !== 'available') return false;
      // Check overlapping events
      const events = await repo.findEventsByVenue(venueId);
      const active = events.filter(e => e.status !== 'cancelled' && e.status !== 'completed');
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      return !active.some(e => {
        const es = new Date(e.startTime).getTime();
        const ee = new Date(e.endTime).getTime();
        return start < ee && end > es;
      });
    },

    // ─── Events ───────────────────────────────────────────────────────────────
    async createEvent(input: {
      name: string; description: string; eventType: string; venueId: string;
      organizerId: string; startTime: string; endTime: string;
      expectedGuests: number; budget?: number; requirements?: string[]; notes?: string;
    }): Promise<Event> {
      if (!input.name || input.name.trim().length < 2) throw new EventServiceError('INVALID_EVENT_NAME', 'Event name must be at least 2 characters');
      if (!EVENT_TYPES.includes(input.eventType as EventType)) throw new EventServiceError('INVALID_EVENT_TYPE', `Invalid event type: ${input.eventType}`);
      if (new Date(input.endTime) <= new Date(input.startTime)) throw new EventServiceError('INVALID_TIME_RANGE', 'End time must be after start time');
      const venue = await repo.findVenueById(input.venueId);
      if (!venue) throw new EventServiceError('VENUE_NOT_FOUND', 'Venue not found');
      if (input.expectedGuests > venue.capacity) throw new EventServiceError('EXCEEDS_CAPACITY', `Expected guests exceed venue capacity of ${venue.capacity}`);

      const event: Event = {
        id: randomUUID(),
        name: input.name.trim(),
        description: input.description,
        eventType: input.eventType as EventType,
        venueId: input.venueId,
        organizerId: input.organizerId,
        startTime: input.startTime,
        endTime: input.endTime,
        expectedGuests: input.expectedGuests,
        actualGuests: null,
        status: 'scheduled',
        budget: input.budget ?? null,
        actualCost: null,
        notes: input.notes ?? null,
        requirements: input.requirements ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return repo.saveEvent(event);
    },

    async getEvent(id: string): Promise<Event | null> {
      if (!isUUID(id)) throw new EventServiceError('INVALID_EVENT_ID', 'Invalid event ID format');
      return repo.findEventById(id);
    },

    async updateEvent(id: string, updates: Partial<{ name: string; expectedGuests: number; budget: number; notes: string }>): Promise<Event> {
      const e = await getEventOrThrow(id);
      return repo.saveEvent({ ...e, ...updates, updatedAt: new Date().toISOString() });
    },

    async cancelEvent(id: string, reason?: string): Promise<Event> {
      const e = await getEventOrThrow(id);
      if (e.status === 'cancelled') throw new EventServiceError('ALREADY_CANCELLED', 'Event is already cancelled');
      const notes = reason ? `${e.notes ? e.notes + '\n' : ''}Cancellation: ${reason}` : e.notes;
      return repo.saveEvent({ ...e, status: 'cancelled', notes, updatedAt: new Date().toISOString() });
    },

    async startEvent(id: string): Promise<Event> {
      const e = await getEventOrThrow(id);
      if (e.status === 'cancelled') throw new EventServiceError('INVALID_STATUS_TRANSITION', 'Cannot start a cancelled event');
      return repo.saveEvent({ ...e, status: 'in_progress', updatedAt: new Date().toISOString() });
    },

    async completeEvent(id: string, actualGuests?: number, actualCost?: number): Promise<Event> {
      const e = await getEventOrThrow(id);
      if (e.status !== 'in_progress') throw new EventServiceError('INVALID_STATUS_TRANSITION', 'Only in-progress events can be completed');
      return repo.saveEvent({
        ...e, status: 'completed',
        actualGuests: actualGuests ?? null,
        actualCost: actualCost ?? null,
        updatedAt: new Date().toISOString(),
      });
    },

    async listEvents(filters?: { eventType?: string; venueId?: string; status?: string }): Promise<Event[]> {
      let all = await repo.findAllEvents();
      if (filters?.eventType) all = all.filter(e => e.eventType === filters.eventType);
      if (filters?.venueId) all = all.filter(e => e.venueId === filters.venueId);
      if (filters?.status) all = all.filter(e => e.status === filters.status);
      return all;
    },

    async getStats() {
      const venues = await repo.findAllVenues();
      const events = await repo.findAllEvents();
      const byType = EVENT_TYPES.reduce((acc, t) => ({ ...acc, [t]: events.filter(e => e.eventType === t).length }), {} as Record<EventType, number>);
      const withBudget = events.filter(e => e.budget !== null);
      const avgEventBudget = withBudget.length ? withBudget.reduce((s, e) => s + e.budget!, 0) / withBudget.length : 0;
      return { totalVenues: venues.length, totalEvents: events.length, byType, avgEventBudget };
    },

    getEventTypes(): EventType[] { return [...EVENT_TYPES]; },
    getEventStatuses(): EventStatus[] { return [...EVENT_STATUSES]; },
    getVenueStatuses(): VenueStatus[] { return [...VENUE_STATUSES]; },
  };
}
