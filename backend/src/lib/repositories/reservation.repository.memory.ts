import { Reservation, ReservationType, ReservationStatus, ReservationRepository } from '../container/types';

export class InMemoryReservationRepository implements ReservationRepository {
  private reservations: Map<string, Reservation> = new Map();

  async getById(id: string): Promise<Reservation | null> {
    return this.reservations.get(id) || null;
  }

  async getByConfirmationCode(code: string): Promise<Reservation | null> {
    for (const reservation of this.reservations.values()) {
      if (reservation.confirmationCode === code) {
        return reservation;
      }
    }
    return null;
  }

  async getAll(): Promise<Reservation[]> {
    return Array.from(this.reservations.values());
  }

  async getByGuestId(guestId: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(r => r.guestId === guestId);
  }

  async getByResourceId(resourceId: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(r => r.resourceId === resourceId);
  }

  async getByStatus(status: ReservationStatus): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(r => r.status === status);
  }

  async getByType(type: ReservationType): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(r => r.type === type);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(r => {
      return r.checkIn >= startDate && r.checkIn <= endDate;
    });
  }

  async create(data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reservation> {
    const id = crypto.randomUUID();
    const reservation: Reservation = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: null
    };
    this.reservations.set(id, reservation);
    return reservation;
  }

  async update(id: string, data: Partial<Reservation>): Promise<Reservation> {
    const existing = this.reservations.get(id);
    if (!existing) {
      throw new Error('Reservation not found');
    }
    const updated: Reservation = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    this.reservations.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.reservations.delete(id);
  }

  async findConflicts(resourceId: string, checkIn: string, checkOut: string, excludeId?: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(r => {
      if (r.resourceId !== resourceId) return false;
      if (excludeId && r.id === excludeId) return false;
      if (r.status === 'cancelled' || r.status === 'checked_out') return false;
      
      // Check for overlap
      return r.checkIn < checkOut && r.checkOut > checkIn;
    });
  }
}
