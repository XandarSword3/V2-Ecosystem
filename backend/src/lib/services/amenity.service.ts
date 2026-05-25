import { randomUUID } from 'crypto';
import type { Container, Amenity, AmenityCategory, AmenityStatus, AmenitySchedule, AmenityReservation, AmenityReservationStatus } from '../container/types';
import type { InMemoryAmenityRepository } from '../repositories/amenity.repository.memory';

export interface AmenityService {
  createAmenity(input: any): Promise<Amenity>;
  getAmenity(id: string): Promise<Amenity | null>;
  getAmenities(): Promise<Amenity[]>;
  getAmenitiesByCategory(cat: AmenityCategory): Promise<Amenity[]>;
  getActiveAmenities(): Promise<Amenity[]>;
  updateAmenity(id: string, updates: Partial<Amenity>): Promise<Amenity>;
  deleteAmenity(id: string): Promise<void>;
  setStatus(id: string, status: AmenityStatus): Promise<Amenity>;
  openAmenity(id: string): Promise<Amenity>;
  closeAmenity(id: string): Promise<Amenity>;
  setMaintenance(id: string): Promise<Amenity>;
  activateAmenity(id: string): Promise<Amenity>;
  deactivateAmenity(id: string): Promise<Amenity>;
  setSchedule(id: string, schedules: Omit<AmenitySchedule, 'id'>[]): Promise<AmenitySchedule[]>;
  getSchedule(id: string): Promise<AmenitySchedule[]>;
  isOpenAt(id: string, dayOfWeek: number, time: string): Promise<boolean>;
  createReservation(input: any): Promise<AmenityReservation>;
  getReservation(id: string): Promise<AmenityReservation | null>;
  confirmReservation(id: string): Promise<AmenityReservation>;
  cancelReservation(id: string): Promise<AmenityReservation>;
  completeReservation(id: string): Promise<AmenityReservation>;
  markNoShow(id: string): Promise<AmenityReservation>;
  checkAvailability(amenityId: string, date: string, start: string, end: string): Promise<boolean>;
  getAvailableSlots(amenityId: string, date: string): Promise<{ startTime: string; endTime: string }[]>;
  isValidTimeRange(start: string, end: string): boolean;
  parseTime(t: string): { hours: number; minutes: number };
  formatTime(h: number, m: number): string;
  calculateDurationMinutes(start: string, end: string): number;
  calculateCost(amenity: Amenity, minutes: number): number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function createAmenityService(container: Container): AmenityService {
  const repo = container.amenityRepository as InMemoryAmenityRepository;

  async function getOrThrow(id: string): Promise<Amenity> {
    const a = await repo.findById(id);
    if (!a) throw new Error('Amenity not found');
    return a;
  }

  async function getResOrThrow(id: string): Promise<AmenityReservation> {
    const r = await repo.findReservationById(id);
    if (!r) throw new Error('Reservation not found');
    return r;
  }

  return {
    async createAmenity(input) {
      if (!input.name?.trim()) throw new Error('Amenity name is required');
      if (input.openingTime && input.closingTime && timeToMinutes(input.openingTime) >= timeToMinutes(input.closingTime)) throw new Error('Invalid time range');
      const now = new Date().toISOString();
      const amenity: Amenity = {
        id: randomUUID(),
        name: input.name.trim(),
        description: input.description ?? '',
        category: input.category,
        location: input.location ?? '',
        capacity: input.capacity ?? null,
        openingTime: input.openingTime,
        closingTime: input.closingTime,
        requiresReservation: input.requiresReservation ?? false,
        pricePerHour: input.pricePerHour ?? 0,
        isComplimentary: input.isComplimentary ?? true,
        isActive: true,
        status: 'available',
        images: input.images ?? [],
        rules: input.rules ?? [],
        ageRestriction: input.ageRestriction ?? null,
        createdAt: now, updatedAt: null,
      };
      await repo.save(amenity);
      container.logger?.info('Amenity created', { amenityId: amenity.id, name: amenity.name });
      return amenity;
    },
    async getAmenity(id) { return repo.findById(id); },
    async getAmenities() { return repo.findAll(); },
    async getAmenitiesByCategory(cat) { return repo.findByCategory(cat); },
    async getActiveAmenities() { return repo.findActive(); },

    async updateAmenity(id, updates) {
      const a = await getOrThrow(id);
      if (updates.name !== undefined && !updates.name.trim()) throw new Error('Amenity name cannot be empty');
      const openingTime = updates.openingTime ?? a.openingTime;
      const closingTime = updates.closingTime ?? a.closingTime;
      if (timeToMinutes(openingTime) >= timeToMinutes(closingTime)) throw new Error('Invalid time range');
      return repo.save({ ...a, ...updates, updatedAt: new Date().toISOString() });
    },

    async deleteAmenity(id) {
      await getOrThrow(id);
      await repo.delete(id);
    },

    async setStatus(id, status) {
      const a = await getOrThrow(id);
      return repo.save({ ...a, status, updatedAt: new Date().toISOString() });
    },
    async openAmenity(id) { const a = await getOrThrow(id); return repo.save({ ...a, status: 'available', updatedAt: new Date().toISOString() }); },
    async closeAmenity(id) { const a = await getOrThrow(id); return repo.save({ ...a, status: 'closed', updatedAt: new Date().toISOString() }); },
    async setMaintenance(id) { const a = await getOrThrow(id); return repo.save({ ...a, status: 'maintenance', updatedAt: new Date().toISOString() }); },
    async activateAmenity(id) { const a = await getOrThrow(id); return repo.save({ ...a, isActive: true, updatedAt: new Date().toISOString() }); },
    async deactivateAmenity(id) { const a = await getOrThrow(id); return repo.save({ ...a, isActive: false, updatedAt: new Date().toISOString() }); },

    async setSchedule(amenityId, schedules) {
      await getOrThrow(amenityId);
      for (const s of schedules) {
        if (s.dayOfWeek < 0 || s.dayOfWeek > 6) throw new Error('Invalid day of week');
        if (!s.isClosed && timeToMinutes(s.openingTime) >= timeToMinutes(s.closingTime)) throw new Error('Invalid time range');
      }
      const withIds = schedules.map(s => ({ ...s, id: randomUUID() }));
      return repo.saveSchedules(amenityId, withIds);
    },
    async getSchedule(amenityId) { return repo.findSchedules(amenityId); },

    async isOpenAt(amenityId, dayOfWeek, time) {
      const a = await repo.findById(amenityId);
      if (!a || !a.isActive || a.status === 'closed' || a.status === 'maintenance') return false;
      const schedules = await repo.findSchedules(amenityId);
      const daySchedule = schedules.find(s => s.dayOfWeek === dayOfWeek);
      if (daySchedule) {
        if (daySchedule.isClosed) return false;
        const t = timeToMinutes(time);
        return t >= timeToMinutes(daySchedule.openingTime) && t < timeToMinutes(daySchedule.closingTime);
      }
      const t = timeToMinutes(time);
      return t >= timeToMinutes(a.openingTime) && t < timeToMinutes(a.closingTime);
    },

    async createReservation(input) {
      const a = await repo.findById(input.amenityId);
      if (!a) throw new Error('Amenity not found');
      if (!a.isActive) throw new Error('Amenity is not active');
      if (a.status !== 'available') throw new Error('Amenity is not available');
      if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new Error('Invalid time range');
      if (input.partySize < 1) throw new Error('Party size must be at least 1');
      if (a.capacity && input.partySize > a.capacity) throw new Error('Party size exceeds amenity capacity');
      // conflict check
      const existing = await repo.findReservations(input.amenityId, input.date);
      const active = existing.filter(r => r.status !== 'cancelled');
      const start = timeToMinutes(input.startTime);
      const end = timeToMinutes(input.endTime);
      for (const r of active) {
        const rs = timeToMinutes(r.startTime);
        const re = timeToMinutes(r.endTime);
        if (start < re && end > rs) throw new Error('Time slot is not available');
      }
      const dur = timeToMinutes(input.endTime) - timeToMinutes(input.startTime);
      const cost = a.isComplimentary ? 0 : (a.pricePerHour * dur / 60);
      const reservation: AmenityReservation = {
        id: randomUUID(),
        amenityId: input.amenityId,
        guestId: input.guestId,
        guestName: input.guestName,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        partySize: input.partySize,
        status: 'pending',
        notes: input.notes ?? null,
        cost,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return repo.saveReservation(reservation);
    },

    async getReservation(id) { return repo.findReservationById(id); },

    async confirmReservation(id) {
      const r = await getResOrThrow(id);
      if (r.status !== 'pending') throw new Error('Can only confirm pending reservations');
      return repo.saveReservation({ ...r, status: 'confirmed', updatedAt: new Date().toISOString() });
    },
    async cancelReservation(id) {
      const r = await getResOrThrow(id);
      if (r.status === 'cancelled' || r.status === 'completed') throw new Error('Cannot cancel reservation in current status');
      return repo.saveReservation({ ...r, status: 'cancelled', updatedAt: new Date().toISOString() });
    },
    async completeReservation(id) {
      const r = await getResOrThrow(id);
      if (r.status !== 'confirmed') throw new Error('Can only complete confirmed reservations');
      return repo.saveReservation({ ...r, status: 'completed', updatedAt: new Date().toISOString() });
    },
    async markNoShow(id) {
      const r = await getResOrThrow(id);
      if (r.status !== 'confirmed') throw new Error('Can only mark confirmed reservations as no-show');
      return repo.saveReservation({ ...r, status: 'no_show', updatedAt: new Date().toISOString() });
    },

    async checkAvailability(amenityId, date, start, end) {
      const reservations = await repo.findReservations(amenityId, date);
      const active = reservations.filter(r => r.status !== 'cancelled');
      const s = timeToMinutes(start);
      const e = timeToMinutes(end);
      for (const r of active) {
        if (s < timeToMinutes(r.endTime) && e > timeToMinutes(r.startTime)) return false;
      }
      return true;
    },

    async getAvailableSlots(amenityId, date) {
      const a = await getOrThrow(amenityId);
      const reservations = await repo.findReservations(amenityId, date);
      const active = reservations.filter(r => r.status !== 'cancelled').sort((x, y) => timeToMinutes(x.startTime) - timeToMinutes(y.startTime));
      const slots: { startTime: string; endTime: string }[] = [];
      let current = a.openingTime;
      for (const r of active) {
        if (timeToMinutes(current) < timeToMinutes(r.startTime)) {
          slots.push({ startTime: current, endTime: r.startTime });
        }
        if (timeToMinutes(r.endTime) > timeToMinutes(current)) current = r.endTime;
      }
      if (timeToMinutes(current) < timeToMinutes(a.closingTime)) {
        slots.push({ startTime: current, endTime: a.closingTime });
      }
      return slots;
    },

    isValidTimeRange(start, end) { return timeToMinutes(start) < timeToMinutes(end); },
    parseTime(t) { const [h, m] = t.split(':').map(Number); return { hours: h, minutes: m }; },
    formatTime(h, m) { return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
    calculateDurationMinutes(start, end) { return timeToMinutes(end) - timeToMinutes(start); },
    calculateCost(amenity, minutes) {
      if (amenity.isComplimentary) return 0;
      return amenity.pricePerHour * minutes / 60;
    },
  };
}
