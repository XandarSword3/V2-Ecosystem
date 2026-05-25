import { v4 as uuidv4 } from 'uuid';

export type AmenityCategory = 'pool' | 'spa' | 'fitness' | 'dining' | 'entertainment' | 'sports' | 'recreation' | 'business' | 'kids' | 'other';
export type AmenityStatus = 'available' | 'maintenance' | 'closed' | 'reserved';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Amenity {
  id: string; name: string; description: string; category: AmenityCategory;
  location: string; capacity?: number; openingTime: string; closingTime: string;
  requiresReservation: boolean; pricePerHour: number; isComplimentary: boolean;
  images: string[]; rules: string[]; ageRestriction?: number;
  status: AmenityStatus; isActive: boolean;
  createdAt: string; updatedAt: string | null;
}

export interface AmenitySchedule {
  id: string; amenityId: string; dayOfWeek: number;
  openingTime: string; closingTime: string; isClosed: boolean;
}

export interface AmenityReservation {
  id: string; amenityId: string; guestId: string; guestName: string;
  date: string; startTime: string; endTime: string; partySize: number;
  notes?: string; status: ReservationStatus;
  createdAt: string;
}

export interface AmenityRepository {
  findById(id: string): Promise<Amenity | null>;
  findAll(): Promise<Amenity[]>;
  save(amenity: Amenity): Promise<Amenity>;
  delete(id: string): Promise<void>;
  saveSchedule(schedule: AmenitySchedule[]): Promise<AmenitySchedule[]>;
  findSchedule(amenityId: string): Promise<AmenitySchedule[]>;
  saveReservation(r: AmenityReservation): Promise<AmenityReservation>;
  findReservation(id: string): Promise<AmenityReservation | null>;
  findReservations(amenityId: string, date?: string): Promise<AmenityReservation[]>;
}

export function createAmenityService(container: { amenityRepository: AmenityRepository; logger?: any }) {
  const { amenityRepository: repo, logger } = container;
  const log = logger ?? { info: () => {}, warn: () => {}, error: () => {} };

  function parseTime(time: string) {
    const [h, m] = time.split(':').map(Number);
    return { hours: h, minutes: m };
  }
  function formatTime(hours: number, minutes: number) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  function timeToMinutes(t: string) { const { hours: h, minutes: m } = parseTime(t); return h * 60 + m; }
  function isValidTimeRange(open: string, close: string) { return timeToMinutes(open) < timeToMinutes(close); }
  function calculateDurationMinutes(start: string, end: string) { return timeToMinutes(end) - timeToMinutes(start); }

  async function getOrThrow(id: string): Promise<Amenity> {
    const a = await repo.findById(id);
    if (!a) throw new Error('Amenity not found');
    return a;
  }

  return {
    parseTime, formatTime, isValidTimeRange, calculateDurationMinutes,

    calculateCost(amenity: Amenity, durationMinutes: number): number {
      if (amenity.isComplimentary) return 0;
      return Math.round((amenity.pricePerHour * durationMinutes / 60) * 100) / 100;
    },

    async createAmenity(input: Partial<Amenity> & { name: string; category: AmenityCategory; location: string; openingTime: string; closingTime: string }): Promise<Amenity> {
      if (!input.name?.trim()) throw new Error('Amenity name is required');
      if (!isValidTimeRange(input.openingTime, input.closingTime)) throw new Error('Invalid time range');
      const now = new Date().toISOString();
      const amenity: Amenity = {
        id: uuidv4(), name: input.name.trim(), description: input.description ?? '',
        category: input.category, location: input.location,
        capacity: input.capacity, openingTime: input.openingTime, closingTime: input.closingTime,
        requiresReservation: input.requiresReservation ?? false,
        pricePerHour: input.pricePerHour ?? 0, isComplimentary: input.isComplimentary ?? true,
        images: input.images ?? [], rules: input.rules ?? [],
        ageRestriction: input.ageRestriction,
        status: 'available', isActive: true,
        createdAt: now, updatedAt: null,
      };
      const saved = await repo.save(amenity);
      log.info('Amenity created', { amenityId: saved.id, name: saved.name });
      return saved;
    },

    async getAmenity(id: string): Promise<Amenity | null> { return repo.findById(id); },

    async getAmenities(): Promise<Amenity[]> { return repo.findAll(); },

    async getAmenitiesByCategory(category: AmenityCategory): Promise<Amenity[]> {
      return (await repo.findAll()).filter(a => a.category === category);
    },

    async getActiveAmenities(): Promise<Amenity[]> {
      return (await repo.findAll()).filter(a => a.isActive);
    },

    async updateAmenity(id: string, updates: Partial<Pick<Amenity, 'name' | 'description' | 'capacity' | 'openingTime' | 'closingTime' | 'requiresReservation' | 'pricePerHour' | 'isComplimentary' | 'images' | 'rules'>>): Promise<Amenity> {
      const amenity = await getOrThrow(id);
      if (updates.name !== undefined && !updates.name.trim()) throw new Error('Amenity name cannot be empty');
      const open = updates.openingTime ?? amenity.openingTime;
      const close = updates.closingTime ?? amenity.closingTime;
      if (!isValidTimeRange(open, close)) throw new Error('Invalid time range');
      return repo.save({ ...amenity, ...updates, updatedAt: new Date().toISOString() });
    },

    async deleteAmenity(id: string): Promise<void> {
      await getOrThrow(id);
      await repo.delete(id);
    },

    async setStatus(id: string, status: AmenityStatus): Promise<Amenity> {
      const a = await getOrThrow(id);
      return repo.save({ ...a, status, updatedAt: new Date().toISOString() });
    },

    async openAmenity(id: string) { return this.setStatus(id, 'available'); },
    async closeAmenity(id: string) { return this.setStatus(id, 'closed'); },
    async setMaintenance(id: string) { return this.setStatus(id, 'maintenance'); },

    async activateAmenity(id: string): Promise<Amenity> {
      const a = await getOrThrow(id);
      return repo.save({ ...a, isActive: true, updatedAt: new Date().toISOString() });
    },

    async deactivateAmenity(id: string): Promise<Amenity> {
      const a = await getOrThrow(id);
      return repo.save({ ...a, isActive: false, updatedAt: new Date().toISOString() });
    },

    async setSchedule(amenityId: string, entries: Omit<AmenitySchedule, 'id'>[]): Promise<AmenitySchedule[]> {
      for (const e of entries) {
        if (e.dayOfWeek < 0 || e.dayOfWeek > 6) throw new Error('Invalid day of week');
        if (!e.isClosed && !isValidTimeRange(e.openingTime, e.closingTime)) throw new Error('Invalid time range');
      }
      const schedules: AmenitySchedule[] = entries.map(e => ({ ...e, id: uuidv4() }));
      return repo.saveSchedule(schedules);
    },

    async getSchedule(amenityId: string): Promise<AmenitySchedule[]> {
      return repo.findSchedule(amenityId);
    },

    async isOpenAt(amenityId: string, dayOfWeek: number, time: string): Promise<boolean> {
      const amenity = await repo.findById(amenityId);
      if (!amenity || !amenity.isActive || amenity.status === 'closed' || amenity.status === 'maintenance') return false;
      const schedule = await repo.findSchedule(amenityId);
      const entry = schedule.find(s => s.amenityId === amenityId && s.dayOfWeek === dayOfWeek);
      if (entry) {
        if (entry.isClosed) return false;
        const t = timeToMinutes(time);
        return t >= timeToMinutes(entry.openingTime) && t < timeToMinutes(entry.closingTime);
      }
      // Fall back to default hours
      const t = timeToMinutes(time);
      return t >= timeToMinutes(amenity.openingTime) && t < timeToMinutes(amenity.closingTime);
    },

    async createReservation(input: Omit<AmenityReservation, 'id' | 'status' | 'createdAt'>): Promise<AmenityReservation> {
      const amenity = await repo.findById(input.amenityId);
      if (!amenity) throw new Error('Amenity not found');
      if (!amenity.isActive) throw new Error('Amenity is not active');
      if (amenity.status !== 'available') throw new Error('Amenity is not available');
      if (!isValidTimeRange(input.startTime, input.endTime)) throw new Error('Invalid time range');
      if (!input.partySize || input.partySize < 1) throw new Error('Party size must be at least 1');
      if (amenity.capacity && input.partySize > amenity.capacity) throw new Error('Party size exceeds amenity capacity');

      // Check conflicts
      const existing = await repo.findReservations(input.amenityId, input.date);
      const start = timeToMinutes(input.startTime);
      const end = timeToMinutes(input.endTime);
      for (const r of existing) {
        if (r.status === 'cancelled') continue;
        const rs = timeToMinutes(r.startTime);
        const re = timeToMinutes(r.endTime);
        if (start < re && end > rs) throw new Error('Time slot is not available');
      }

      const reservation: AmenityReservation = {
        id: uuidv4(), ...input, status: 'pending', createdAt: new Date().toISOString(),
      };
      return repo.saveReservation(reservation);
    },

    async getReservation(id: string): Promise<AmenityReservation | null> { return repo.findReservation(id); },

    async confirmReservation(id: string): Promise<AmenityReservation> {
      const r = await repo.findReservation(id);
      if (!r) throw new Error('Reservation not found');
      if (r.status !== 'pending') throw new Error('Can only confirm pending reservations');
      return repo.saveReservation({ ...r, status: 'confirmed' });
    },

    async cancelReservation(id: string): Promise<AmenityReservation> {
      const r = await repo.findReservation(id);
      if (!r) throw new Error('Reservation not found');
      if (!['pending', 'confirmed'].includes(r.status)) throw new Error('Cannot cancel reservation in current status');
      return repo.saveReservation({ ...r, status: 'cancelled' });
    },

    async completeReservation(id: string): Promise<AmenityReservation> {
      const r = await repo.findReservation(id);
      if (!r) throw new Error('Reservation not found');
      if (r.status !== 'confirmed') throw new Error('Can only complete confirmed reservations');
      return repo.saveReservation({ ...r, status: 'completed' });
    },

    async markNoShow(id: string): Promise<AmenityReservation> {
      const r = await repo.findReservation(id);
      if (!r) throw new Error('Reservation not found');
      if (r.status !== 'confirmed') throw new Error('Can only mark confirmed reservations as no-show');
      return repo.saveReservation({ ...r, status: 'no_show' });
    },

    async checkAvailability(amenityId: string, date: string, startTime: string, endTime: string): Promise<boolean> {
      const reservations = await repo.findReservations(amenityId, date);
      const start = timeToMinutes(startTime);
      const end = timeToMinutes(endTime);
      for (const r of reservations) {
        if (r.status === 'cancelled') continue;
        if (start < timeToMinutes(r.endTime) && end > timeToMinutes(r.startTime)) return false;
      }
      return true;
    },

    async getAvailableSlots(amenityId: string, date: string): Promise<{ startTime: string; endTime: string }[]> {
      const amenity = await getOrThrow(amenityId);
      const reservations = (await repo.findReservations(amenityId, date))
        .filter(r => r.status !== 'cancelled')
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      const slots: { startTime: string; endTime: string }[] = [];
      let cursor = timeToMinutes(amenity.openingTime);
      const close = timeToMinutes(amenity.closingTime);

      for (const r of reservations) {
        const rs = timeToMinutes(r.startTime);
        if (cursor < rs) slots.push({ startTime: formatTime(Math.floor(cursor / 60), cursor % 60), endTime: formatTime(Math.floor(rs / 60), rs % 60) });
        cursor = Math.max(cursor, timeToMinutes(r.endTime));
      }
      if (cursor < close) slots.push({ startTime: formatTime(Math.floor(cursor / 60), cursor % 60), endTime: formatTime(Math.floor(close / 60), close % 60) });
      return slots;
    },
  };
}
