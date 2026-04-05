/**
 * In-Memory Amenity Repository
 * Test double for AmenityRepository using in-memory data structures.
 */

import type {
  AmenityRepository,
  Amenity,
  AmenitySchedule,
  AmenityReservation,
  AmenityCategory,
  AmenityStatus,
} from '../container/types.js';

export class InMemoryAmenityRepository implements AmenityRepository {
  private amenities = new Map<string, Amenity>();
  private schedules: AmenitySchedule[] = [];
  private reservations = new Map<string, AmenityReservation>();

  reset() {
    this.amenities.clear();
    this.schedules = [];
    this.reservations.clear();
  }

  // Amenity operations
  async getById(id: string): Promise<Amenity | null> {
    return this.amenities.get(id) ?? null;
  }

  async getAll(): Promise<Amenity[]> {
    return [...this.amenities.values()];
  }

  async getByCategory(category: AmenityCategory): Promise<Amenity[]> {
    return [...this.amenities.values()].filter(a => a.category === category);
  }

  async getByStatus(status: AmenityStatus): Promise<Amenity[]> {
    return [...this.amenities.values()].filter(a => a.status === status);
  }

  async getActive(): Promise<Amenity[]> {
    return [...this.amenities.values()].filter(a => a.isActive);
  }

  async create(data: Omit<Amenity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Amenity> {
    const id = crypto.randomUUID();
    const amenity: Amenity = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.amenities.set(id, amenity);
    return amenity;
  }

  async update(id: string, data: Partial<Amenity>): Promise<Amenity> {
    const existing = this.amenities.get(id);
    if (!existing) throw new Error(`Amenity ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.amenities.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.amenities.delete(id);
  }

  // Schedule operations
  async getSchedule(amenityId: string): Promise<AmenitySchedule[]> {
    return this.schedules.filter(s => s.amenityId === amenityId);
  }

  async setSchedule(amenityId: string, schedule: Omit<AmenitySchedule, 'id'>[]): Promise<AmenitySchedule[]> {
    // Remove old schedule
    this.schedules = this.schedules.filter(s => s.amenityId !== amenityId);
    // Add new schedule
    const newSchedules: AmenitySchedule[] = schedule.map(s => ({
      ...s,
      id: crypto.randomUUID(),
    }));
    this.schedules.push(...newSchedules);
    return newSchedules;
  }

  // Reservation operations
  async createReservation(data: Omit<AmenityReservation, 'id' | 'createdAt'>): Promise<AmenityReservation> {
    const id = crypto.randomUUID();
    const reservation: AmenityReservation = { ...data, id, createdAt: new Date().toISOString() };
    this.reservations.set(id, reservation);
    return reservation;
  }

  async getReservation(id: string): Promise<AmenityReservation | null> {
    return this.reservations.get(id) ?? null;
  }

  async getReservationsByAmenity(amenityId: string, date: string): Promise<AmenityReservation[]> {
    return [...this.reservations.values()].filter(
      r => r.amenityId === amenityId && r.date === date
    );
  }

  async getReservationsByGuest(guestId: string): Promise<AmenityReservation[]> {
    return [...this.reservations.values()].filter(r => r.guestId === guestId);
  }

  async updateReservation(id: string, data: Partial<AmenityReservation>): Promise<AmenityReservation> {
    const existing = this.reservations.get(id);
    if (!existing) throw new Error(`Reservation ${id} not found`);
    const updated = { ...existing, ...data };
    this.reservations.set(id, updated);
    return updated;
  }

  async cancelReservation(id: string): Promise<void> {
    const existing = this.reservations.get(id);
    if (existing) {
      this.reservations.set(id, { ...existing, status: 'cancelled' });
    }
  }
}
