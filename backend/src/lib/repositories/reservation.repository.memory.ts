/**
 * In-Memory Reservation Repository
 * Test double for ReservationRepository using in-memory data structures.
 */

import type {
  ReservationRepository,
  Reservation,
  ReservationStatus,
  ReservationType,
} from '../container/types.js';

export class InMemoryReservationRepository implements ReservationRepository {
  private reservations = new Map<string, Reservation>();

  reset() {
    this.reservations.clear();
  }

  async getById(id: string): Promise<Reservation | null> {
    return this.reservations.get(id) ?? null;
  }

  async getByConfirmationCode(code: string): Promise<Reservation | null> {
    for (const r of this.reservations.values()) {
      if (r.confirmationCode === code) return r;
    }
    return null;
  }

  async getAll(): Promise<Reservation[]> {
    return [...this.reservations.values()];
  }

  async getByGuestId(guestId: string): Promise<Reservation[]> {
    return [...this.reservations.values()].filter(r => r.guestId === guestId);
  }

  async getByResourceId(resourceId: string): Promise<Reservation[]> {
    return [...this.reservations.values()].filter(r => r.resourceId === resourceId);
  }

  async getByStatus(status: ReservationStatus): Promise<Reservation[]> {
    return [...this.reservations.values()].filter(r => r.status === status);
  }

  async getByType(type: ReservationType): Promise<Reservation[]> {
    return [...this.reservations.values()].filter(r => r.type === type);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    return [...this.reservations.values()].filter(
      r => r.checkIn >= startDate && r.checkOut <= endDate
    );
  }

  async create(data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reservation> {
    const id = crypto.randomUUID();
    const reservation: Reservation = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.reservations.set(id, reservation);
    return reservation;
  }

  async update(id: string, data: Partial<Reservation>): Promise<Reservation> {
    const existing = this.reservations.get(id);
    if (!existing) throw new Error(`Reservation ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.reservations.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.reservations.delete(id);
  }

  async findConflicts(resourceId: string, checkIn: string, checkOut: string, excludeId?: string): Promise<Reservation[]> {
    return [...this.reservations.values()].filter(
      r =>
        r.resourceId === resourceId &&
        r.id !== excludeId &&
        r.checkIn < checkOut &&
        r.checkOut > checkIn &&
        r.status !== 'cancelled'
    );
  }
}
