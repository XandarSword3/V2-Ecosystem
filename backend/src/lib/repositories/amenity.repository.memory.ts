import { 
  Amenity, 
  AmenityCategory, 
  AmenityStatus, 
  AmenitySchedule, 
  AmenityReservation,
  AmenityRepository 
} from '../container/types';

export class InMemoryAmenityRepository implements AmenityRepository {
  private amenities: Map<string, Amenity> = new Map();
  private schedules: Map<string, AmenitySchedule[]> = new Map();
  private reservations: Map<string, AmenityReservation> = new Map();

  async getById(id: string): Promise<Amenity | null> {
    return this.amenities.get(id) || null;
  }

  async getAll(): Promise<Amenity[]> {
    return Array.from(this.amenities.values());
  }

  async getByCategory(category: AmenityCategory): Promise<Amenity[]> {
    return Array.from(this.amenities.values()).filter(a => a.category === category);
  }

  async getByStatus(status: AmenityStatus): Promise<Amenity[]> {
    return Array.from(this.amenities.values()).filter(a => a.status === status);
  }

  async getActive(): Promise<Amenity[]> {
    return Array.from(this.amenities.values()).filter(a => a.isActive);
  }

  async create(data: Omit<Amenity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Amenity> {
    const id = crypto.randomUUID();
    const amenity: Amenity = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: null
    };
    this.amenities.set(id, amenity);
    return amenity;
  }

  async update(id: string, data: Partial<Amenity>): Promise<Amenity> {
    const existing = this.amenities.get(id);
    if (!existing) {
      throw new Error('Amenity not found');
    }
    const updated: Amenity = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    this.amenities.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.amenities.delete(id);
  }

  async getSchedule(amenityId: string): Promise<AmenitySchedule[]> {
    return this.schedules.get(amenityId) || [];
  }

  async setSchedule(amenityId: string, schedule: Omit<AmenitySchedule, 'id'>[]): Promise<AmenitySchedule[]> {
    const schedules: AmenitySchedule[] = schedule.map(s => ({
      ...s,
      id: crypto.randomUUID()
    }));
    this.schedules.set(amenityId, schedules);
    return schedules;
  }

  async createReservation(data: Omit<AmenityReservation, 'id' | 'createdAt'>): Promise<AmenityReservation> {
    const id = crypto.randomUUID();
    const reservation: AmenityReservation = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    this.reservations.set(id, reservation);
    return reservation;
  }

  async getReservation(id: string): Promise<AmenityReservation | null> {
    return this.reservations.get(id) || null;
  }

  async getReservationsByAmenity(amenityId: string, date: string): Promise<AmenityReservation[]> {
    return Array.from(this.reservations.values()).filter(r => 
      r.amenityId === amenityId && r.date === date
    );
  }

  async getReservationsByGuest(guestId: string): Promise<AmenityReservation[]> {
    return Array.from(this.reservations.values()).filter(r => r.guestId === guestId);
  }

  async updateReservation(id: string, data: Partial<AmenityReservation>): Promise<AmenityReservation> {
    const existing = this.reservations.get(id);
    if (!existing) {
      throw new Error('Reservation not found');
    }
    const updated: AmenityReservation = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt
    };
    this.reservations.set(id, updated);
    return updated;
  }

  async cancelReservation(id: string): Promise<void> {
    const reservation = this.reservations.get(id);
    if (reservation) {
      reservation.status = 'cancelled';
      this.reservations.set(id, reservation);
    }
  }
}
