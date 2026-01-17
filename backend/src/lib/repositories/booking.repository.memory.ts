import { Booking, BookingStatus, BookingSource, BookingRepository } from '../container/types';

export class InMemoryBookingRepository implements BookingRepository {
  private bookings: Map<string, Booking> = new Map();

  async getById(id: string): Promise<Booking | null> {
    return this.bookings.get(id) || null;
  }

  async getByBookingNumber(number: string): Promise<Booking | null> {
    for (const booking of this.bookings.values()) {
      if (booking.bookingNumber === number) {
        return booking;
      }
    }
    return null;
  }

  async getAll(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  async getByGuestId(guestId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(b => b.guestId === guestId);
  }

  async getByStatus(status: BookingStatus): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(b => b.status === status);
  }

  async getBySource(source: BookingSource): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(b => b.source === source);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(b => {
      return b.arrivalDate >= startDate && b.arrivalDate <= endDate;
    });
  }

  async create(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<Booking> {
    const id = crypto.randomUUID();
    const booking: Booking = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: null
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async update(id: string, data: Partial<Booking>): Promise<Booking> {
    const existing = this.bookings.get(id);
    if (!existing) {
      throw new Error('Booking not found');
    }
    const updated: Booking = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    this.bookings.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.bookings.delete(id);
  }
}
