import type { Amenity, AmenitySchedule, AmenityReservation } from '../container/types';

export class InMemoryAmenityRepository {
  private amenities: Map<string, Amenity> = new Map();
  private schedules: Map<string, AmenitySchedule[]> = new Map();
  private reservations: Map<string, AmenityReservation> = new Map();

  async findById(id: string): Promise<Amenity | null> { return this.amenities.get(id) ?? null; }
  async findAll(): Promise<Amenity[]> { return Array.from(this.amenities.values()); }
  async findByCategory(category: string): Promise<Amenity[]> { return Array.from(this.amenities.values()).filter(a => a.category === category); }
  async findActive(): Promise<Amenity[]> { return Array.from(this.amenities.values()).filter(a => a.isActive); }
  async save(amenity: Amenity): Promise<Amenity> { this.amenities.set(amenity.id, { ...amenity }); return amenity; }
  async delete(id: string): Promise<void> { this.amenities.delete(id); }

  async saveSchedules(amenityId: string, schedules: AmenitySchedule[]): Promise<AmenitySchedule[]> {
    this.schedules.set(amenityId, schedules.map(s => ({ ...s })));
    return schedules;
  }
  async findSchedules(amenityId: string): Promise<AmenitySchedule[]> { return this.schedules.get(amenityId) ?? []; }

  async saveReservation(r: AmenityReservation): Promise<AmenityReservation> { this.reservations.set(r.id, { ...r }); return r; }
  async findReservationById(id: string): Promise<AmenityReservation | null> { return this.reservations.get(id) ?? null; }
  async findReservations(amenityId: string, date?: string): Promise<AmenityReservation[]> {
    let res = Array.from(this.reservations.values()).filter(r => r.amenityId === amenityId);
    if (date) res = res.filter(r => r.date === date);
    return res;
  }
}
