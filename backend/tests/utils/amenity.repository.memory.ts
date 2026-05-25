import type { Amenity, AmenityRepository, AmenitySchedule, AmenityReservation } from '../../src/services/amenity.service';

export class InMemoryAmenityRepository implements AmenityRepository {
  private amenities = new Map<string, Amenity>();
  private schedules: AmenitySchedule[] = [];
  private reservations = new Map<string, AmenityReservation>();

  async findById(id: string): Promise<Amenity | null> { return this.amenities.get(id) ?? null; }
  async findAll(): Promise<Amenity[]> { return [...this.amenities.values()]; }
  async save(amenity: Amenity): Promise<Amenity> { this.amenities.set(amenity.id, { ...amenity }); return amenity; }
  async delete(id: string): Promise<void> { this.amenities.delete(id); }

  async saveSchedule(schedule: AmenitySchedule[]): Promise<AmenitySchedule[]> {
    if (schedule.length > 0) {
      const amenityId = schedule[0].amenityId;
      this.schedules = this.schedules.filter(s => s.amenityId !== amenityId);
    }
    this.schedules.push(...schedule);
    return schedule;
  }

  async findSchedule(amenityId: string): Promise<AmenitySchedule[]> {
    return this.schedules.filter(s => s.amenityId === amenityId);
  }

  async saveReservation(r: AmenityReservation): Promise<AmenityReservation> {
    this.reservations.set(r.id, { ...r });
    return r;
  }

  async findReservation(id: string): Promise<AmenityReservation | null> {
    return this.reservations.get(id) ?? null;
  }

  async findReservations(amenityId: string, date?: string): Promise<AmenityReservation[]> {
    return [...this.reservations.values()].filter(r =>
      r.amenityId === amenityId && (date === undefined || r.date === date)
    );
  }
}
