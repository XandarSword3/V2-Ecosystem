/**
 * In-Memory Event Repository
 * Test double for EventRepository using in-memory data structures.
 */

import type {
  EventRepository,
  Venue,
  Event,
  EventFilters,
  VenueFilters,
} from '../container/types.js';

export class InMemoryEventRepository implements EventRepository {
  private venues = new Map<string, Venue>();
  private events = new Map<string, Event>();

  reset() {
    this.venues.clear();
    this.events.clear();
  }

  // Venue operations
  async createVenue(data: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>): Promise<Venue> {
    const id = crypto.randomUUID();
    const venue: Venue = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.venues.set(id, venue);
    return venue;
  }

  async updateVenue(id: string, data: Partial<Venue>): Promise<Venue> {
    const existing = this.venues.get(id);
    if (!existing) throw new Error(`Venue ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.venues.set(id, updated);
    return updated;
  }

  async deleteVenue(id: string): Promise<void> {
    this.venues.delete(id);
  }

  async getVenueById(id: string): Promise<Venue | null> {
    return this.venues.get(id) ?? null;
  }

  async listVenues(filters?: VenueFilters): Promise<Venue[]> {
    let result = [...this.venues.values()];
    if (filters?.status) result = result.filter(v => v.status === filters.status);
    if (filters?.minCapacity !== undefined) result = result.filter(v => v.capacity >= filters.minCapacity!);
    if (filters?.maxCapacity !== undefined) result = result.filter(v => v.capacity <= filters.maxCapacity!);
    if (filters?.amenities?.length) result = result.filter(v => filters.amenities!.every(a => v.amenities.includes(a)));
    return result;
  }

  // Event operations
  async createEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const id = crypto.randomUUID();
    const event: Event = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    const existing = this.events.get(id);
    if (!existing) throw new Error(`Event ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.events.set(id, updated);
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    this.events.delete(id);
  }

  async getEventById(id: string): Promise<Event | null> {
    return this.events.get(id) ?? null;
  }

  async listEvents(filters?: EventFilters): Promise<Event[]> {
    let result = [...this.events.values()];
    if (filters?.venueId) result = result.filter(e => e.venueId === filters.venueId);
    if (filters?.organizerId) result = result.filter(e => e.organizerId === filters.organizerId);
    if (filters?.eventType) result = result.filter(e => e.eventType === filters.eventType);
    if (filters?.status) result = result.filter(e => e.status === filters.status);
    if (filters?.dateRange) {
      result = result.filter(e => e.startTime >= filters.dateRange!.start && e.endTime <= filters.dateRange!.end);
    }
    return result;
  }

  async getEventsByVenue(venueId: string, startDate: string, endDate: string): Promise<Event[]> {
    return [...this.events.values()].filter(
      e => e.venueId === venueId && e.startTime >= startDate && e.endTime <= endDate
    );
  }
}
