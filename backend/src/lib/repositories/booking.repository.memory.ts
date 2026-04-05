/**
 * In-Memory Booking Repository
 * Test double for BookingRepository using in-memory data structures.
 */

import type {
  BookingRepository,
  Booking,
  BookingStatus,
  BookingSource,
} from '../container/types.js';

export class InMemoryBookingRepository implements BookingRepository {
  private bookings = new Map<string, Booking>();

  reset() {
    this.bookings.clear();
  }

  async getById(id: string): Promise<Booking | null> {
    return this.bookings.get(id) ?? null;
  }

  async getByBookingNumber(number: string): Promise<Booking | null> {
    for (const b of this.bookings.values()) {
      if (b.bookingNumber === number) return b;
    }
    return null;
  }

  async getAll(): Promise<Booking[]> {
    return [...this.bookings.values()];
  }

  async getByGuestId(guestId: string): Promise<Booking[]> {
    return [...this.bookings.values()].filter(b => b.guestId === guestId);
  }

  async getByStatus(status: BookingStatus): Promise<Booking[]> {
    return [...this.bookings.values()].filter(b => b.status === status);
  }

  async getBySource(source: BookingSource): Promise<Booking[]> {
    return [...this.bookings.values()].filter(b => b.source === source);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Booking[]> {
    return [...this.bookings.values()].filter(
      b => b.arrivalDate >= startDate && b.departureDate <= endDate
    );
  }

  async create(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<Booking> {
    const id = crypto.randomUUID();
    const booking: Booking = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.bookings.set(id, booking);
    return booking;
  }

  async update(id: string, data: Partial<Booking>): Promise<Booking> {
    const existing = this.bookings.get(id);
    if (!existing) throw new Error(`Booking ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.bookings.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.bookings.delete(id);
  }
}
