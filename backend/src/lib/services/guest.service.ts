import { randomUUID } from 'crypto';
import type { Container, GuestProfile, GuestStatus } from '../container/types';
import type { InMemoryGuestRepository } from '../repositories/guest.repository.memory';

export class GuestServiceError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

function validateUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}
function validatePhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+?[1-9]\d{7,14}$/.test(normalized);
}

const VALID_STATUSES: GuestStatus[] = ['active', 'inactive', 'vip', 'banned'];

export function createGuestService(container: Container) {
  const repo = container.guestRepository as import('../repositories/guest.repository.memory').InMemoryGuestRepository;

  return {
    async createGuest(input: { firstName: string; lastName: string; email: string; phone: string; userId?: string; preferences?: Record<string, unknown>; tags?: string[]; dateOfBirth?: string; nationality?: string; idType?: string; idNumber?: string; notes?: string }) {
      if (input.firstName.length < 2) throw new GuestServiceError('INVALID_FIRST NAME', 'First name too short');
      if (input.lastName.length < 2) throw new GuestServiceError('INVALID_LAST NAME', 'Last name too short');
      if (!validateEmail(input.email)) throw new GuestServiceError('INVALID_EMAIL', 'Invalid email');
      const phone = normalizePhone(input.phone);
      if (!validatePhone(input.phone)) throw new GuestServiceError('INVALID_PHONE', 'Invalid phone');
      if (input.userId && !validateUUID(input.userId)) throw new GuestServiceError('INVALID_USER_ID', 'Invalid user ID');
      if (input.dateOfBirth && new Date(input.dateOfBirth) > new Date()) throw new GuestServiceError('INVALID_DATE_OF_BIRTH', 'Future DOB');
      const existing = await repo.findByEmail(input.email.toLowerCase());
      if (existing) throw new GuestServiceError('EMAIL_EXISTS', 'Email already exists');
      const existingPhone = await repo.findByPhone(phone);
      if (existingPhone) throw new GuestServiceError('PHONE_EXISTS', 'Phone already exists');
      const now = new Date().toISOString();
      const guest: GuestProfile = {
        id: randomUUID(),
        userId: input.userId ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone,
        dateOfBirth: input.dateOfBirth ?? null,
        nationality: input.nationality ?? null,
        idType: input.idType ?? null,
        idNumber: input.idNumber ?? null,
        status: 'active',
        preferences: input.preferences ?? {},
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        totalStays: 0, totalSpent: 0, lastVisit: null,
        createdAt: now, updatedAt: null,
      };
      return repo.save(guest);
    },

    async getGuest(id: string) {
      if (!validateUUID(id)) throw new GuestServiceError('INVALID_GUEST_ID', 'Invalid ID format');
      return repo.findById(id);
    },

    async getGuestByEmail(email: string) {
      if (!validateEmail(email)) throw new GuestServiceError('INVALID_EMAIL', 'Invalid email');
      return repo.findByEmail(email.toLowerCase());
    },

    async getGuestByPhone(phone: string) {
      if (!validatePhone(phone)) throw new GuestServiceError('INVALID_PHONE', 'Invalid phone');
      return repo.findByPhone(normalizePhone(phone));
    },

    async getGuestByUserId(userId: string) {
      if (!validateUUID(userId)) throw new GuestServiceError('INVALID_USER_ID', 'Invalid user ID');
      return repo.findByUserId(userId);
    },

    async updateGuest(id: string, updates: Partial<Omit<GuestProfile, 'id' | 'createdAt'>>) {
      if (!validateUUID(id)) throw new GuestServiceError('INVALID_GUEST_ID', 'Invalid ID format');
      const guest = await repo.findById(id);
      if (!guest) throw new GuestServiceError('GUEST_NOT_FOUND', 'Guest not found');
      if (updates.email) {
        if (!validateEmail(updates.email)) throw new GuestServiceError('INVALID_EMAIL', 'Invalid email');
        const existing = await repo.findByEmail(updates.email.toLowerCase());
        if (existing && existing.id !== id) throw new GuestServiceError('EMAIL_EXISTS', 'Email already in use');
        updates = { ...updates, email: updates.email.toLowerCase() };
      }
      return repo.save({ ...guest, ...updates, updatedAt: new Date().toISOString() });
    },

    async deleteGuest(id: string) {
      if (!validateUUID(id)) throw new GuestServiceError('INVALID_GUEST_ID', 'Invalid ID format');
      const guest = await repo.findById(id);
      if (!guest) throw new GuestServiceError('GUEST_NOT_FOUND', 'Guest not found');
      await repo.delete(id);
    },

    async setStatus(id: string, status: GuestStatus) {
      if (!VALID_STATUSES.includes(status)) throw new GuestServiceError('INVALID_STATUS', 'Invalid status');
      const guest = await repo.findById(id);
      if (!guest) throw new GuestServiceError('GUEST_NOT_FOUND', 'Guest not found');
      return repo.save({ ...guest, status, updatedAt: new Date().toISOString() });
    },

    async recordVisit(input: { guestId: string; amountSpent: number }) {
      if (input.amountSpent < 0) throw new GuestServiceError('INVALID_AMOUNT', 'Amount cannot be negative');
      const guest = await repo.findById(input.guestId);
      if (!guest) throw new GuestServiceError('GUEST_NOT_FOUND', 'Guest not found');
      return repo.save({ ...guest, totalStays: guest.totalStays + 1, totalSpent: guest.totalSpent + input.amountSpent, lastVisit: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },

    async addTags(id: string, tags: string[]) {
      if (!tags.length) throw new GuestServiceError('INVALID_TAGS', 'Tags cannot be empty');
      const guest = await repo.findById(id);
      if (!guest) throw new GuestServiceError('GUEST_NOT_FOUND', 'Guest not found');
      const merged = Array.from(new Set([...guest.tags, ...tags]));
      return repo.save({ ...guest, tags: merged, updatedAt: new Date().toISOString() });
    },

    async removeTags(id: string, tags: string[]) {
      if (!tags.length) throw new GuestServiceError('INVALID_TAGS', 'Tags cannot be empty');
      const guest = await repo.findById(id);
      if (!guest) throw new GuestServiceError('GUEST_NOT_FOUND', 'Guest not found');
      return repo.save({ ...guest, tags: guest.tags.filter(t => !tags.includes(t)), updatedAt: new Date().toISOString() });
    },

    async listGuests(filters?: { status?: GuestStatus; tags?: string[] }) {
      return repo.findAll(filters);
    },

    async searchGuests(query: string) {
      if (!query.trim()) return [];
      return repo.search(query);
    },

    async getVipGuests() {
      return repo.findAll({ status: 'vip' });
    },

    async getStats() {
      const all = await repo.findAll();
      const byStatus = all.reduce((acc, g) => { acc[g.status] = (acc[g.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      return {
        totalGuests: all.length,
        activeGuests: byStatus['active'] ?? 0,
        vipGuests: byStatus['vip'] ?? 0,
        inactiveGuests: byStatus['inactive'] ?? 0,
        bannedGuests: byStatus['banned'] ?? 0,
        totalRevenue: all.reduce((s, g) => s + g.totalSpent, 0),
      };
    },

    getStatuses() { return VALID_STATUSES as string[]; },

    async mergeProfiles(primaryId: string, secondaryId: string) {
      if (primaryId === secondaryId) throw new GuestServiceError('SAME_GUEST', 'Cannot merge guest with itself');
      const primary = await repo.findById(primaryId);
      if (!primary) throw new GuestServiceError('GUEST_NOT_FOUND', 'Primary guest not found');
      const secondary = await repo.findById(secondaryId);
      if (!secondary) throw new GuestServiceError('GUEST_NOT_FOUND', 'Secondary guest not found');
      const merged: GuestProfile = {
        ...primary,
        totalStays: primary.totalStays + secondary.totalStays,
        totalSpent: primary.totalSpent + secondary.totalSpent,
        tags: Array.from(new Set([...primary.tags, ...secondary.tags])),
        updatedAt: new Date().toISOString(),
      };
      await repo.save(merged);
      await repo.delete(secondaryId);
      return merged;
    },
  };
}
