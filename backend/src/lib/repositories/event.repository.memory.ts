import type { Venue, Event } from '../container/types';

export class InMemoryEventRepository {
  private venues: Map<string, Venue> = new Map();
  private events: Map<string, Event> = new Map();

  async saveVenue(v: Venue): Promise<Venue> { this.venues.set(v.id, { ...v }); return v; }
  async findVenueById(id: string): Promise<Venue | null> { return this.venues.get(id) ?? null; }
  async findAllVenues(): Promise<Venue[]> { return Array.from(this.venues.values()); }
  async deleteVenue(id: string): Promise<void> { this.venues.delete(id); }

  async saveEvent(e: Event): Promise<Event> { this.events.set(e.id, { ...e }); return e; }
  async findEventById(id: string): Promise<Event | null> { return this.events.get(id) ?? null; }
  async findAllEvents(): Promise<Event[]> { return Array.from(this.events.values()); }
  async findEventsByVenue(venueId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(e => e.venueId === venueId);
  }
}
