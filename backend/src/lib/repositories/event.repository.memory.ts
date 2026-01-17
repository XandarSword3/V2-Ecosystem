/**
 * In-Memory Event Repository
 *
 * Test double for event/venue operations.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Venue, Event, EventFilters, VenueFilters, EventRepository } from '../container/types.js';

export class InMemoryEventRepository implements EventRepository {
  private venues: Map<string, Venue> = new Map();
  private events: Map<string, Event> = new Map();

  // ============================================
  // VENUE OPERATIONS
  // ============================================

  async createVenue(venue: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>): Promise<Venue> {
    const now = new Date().toISOString();
    const newVenue: Venue = {
      ...venue,
      id: uuidv4(),
      createdAt: now,
      updatedAt: null,
    };
    this.venues.set(newVenue.id, newVenue);
    return newVenue;
  }

  async updateVenue(id: string, data: Partial<Venue>): Promise<Venue> {
    const venue = this.venues.get(id);
    if (!venue) {
      throw new Error('Venue not found');
    }
    
    const updated: Venue = {
      ...venue,
      ...data,
      id: venue.id,
      createdAt: venue.createdAt,
      updatedAt: new Date().toISOString(),
    };
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
    let result = Array.from(this.venues.values());

    if (filters?.status) {
      result = result.filter(v => v.status === filters.status);
    }

    if (filters?.minCapacity !== undefined) {
      result = result.filter(v => v.capacity >= filters.minCapacity!);
    }

    if (filters?.maxCapacity !== undefined) {
      result = result.filter(v => v.capacity <= filters.maxCapacity!);
    }

    if (filters?.amenities && filters.amenities.length > 0) {
      result = result.filter(v =>
        filters.amenities!.every(amenity => v.amenities.includes(amenity))
      );
    }

    return result;
  }

  // ============================================
  // EVENT OPERATIONS
  // ============================================

  async createEvent(event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const now = new Date().toISOString();
    const newEvent: Event = {
      ...event,
      id: uuidv4(),
      createdAt: now,
      updatedAt: null,
    };
    this.events.set(newEvent.id, newEvent);
    return newEvent;
  }

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    const event = this.events.get(id);
    if (!event) {
      throw new Error('Event not found');
    }
    
    const updated: Event = {
      ...event,
      ...data,
      id: event.id,
      createdAt: event.createdAt,
      updatedAt: new Date().toISOString(),
    };
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
    let result = Array.from(this.events.values());

    if (filters?.venueId) {
      result = result.filter(e => e.venueId === filters.venueId);
    }

    if (filters?.organizerId) {
      result = result.filter(e => e.organizerId === filters.organizerId);
    }

    if (filters?.eventType) {
      result = result.filter(e => e.eventType === filters.eventType);
    }

    if (filters?.status) {
      result = result.filter(e => e.status === filters.status);
    }

    if (filters?.dateRange) {
      const { start, end } = filters.dateRange;
      result = result.filter(e => {
        const eventStart = e.startTime.split('T')[0];
        return eventStart >= start && eventStart <= end;
      });
    }

    return result;
  }

  async getEventsByVenue(venueId: string, startDate: string, endDate: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(e => {
      if (e.venueId !== venueId) return false;
      const eventStart = e.startTime.split('T')[0];
      const eventEnd = e.endTime.split('T')[0];
      return (eventStart >= startDate && eventStart <= endDate) ||
             (eventEnd >= startDate && eventEnd <= endDate) ||
             (eventStart <= startDate && eventEnd >= endDate);
    });
  }

  // ============================================
  // TEST HELPERS
  // ============================================

  addVenue(venue: Venue): void {
    this.venues.set(venue.id, venue);
  }

  addEvent(event: Event): void {
    this.events.set(event.id, event);
  }

  clear(): void {
    this.venues.clear();
    this.events.clear();
  }

  getAllVenues(): Venue[] {
    return Array.from(this.venues.values());
  }

  getAllEvents(): Event[] {
    return Array.from(this.events.values());
  }
}
