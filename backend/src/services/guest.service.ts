/**
 * Guest Service
 *
 * Pure business-logic service for guest profile management.
 * Uses dependency injection — pass `guestRepository` to swap in an
 * in-memory store for tests.
 */

import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GuestStatus = 'active' | 'inactive' | 'vip' | 'banned';

export interface GuestProfile {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  status: GuestStatus;
  preferences: Record<string, unknown>;
  notes: string | null;
  tags: string[];
  totalStays: number;
  totalSpent: number;
  lastVisit: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface GuestStats {
  totalGuests: number;
  activeGuests: number;
  vipGuests: number;
  inactiveGuests: number;
  bannedGuests: number;
  totalRevenue: number;
  averageSpend: number;
}

// ─── Repository interface ─────────────────────────────────────────────────────

export interface GuestRepository {
  findById(id: string): Promise<GuestProfile | null>;
  findByEmail(email: string): Promise<GuestProfile | null>;
  findByPhone(phone: string): Promise<GuestProfile | null>;
  findByUserId(userId: string): Promise<GuestProfile | null>;
  findAll(filters?: { status?: GuestStatus; tags?: string[] }): Promise<GuestProfile[]>;
  search(query: string): Promise<GuestProfile[]>;
  save(guest: GuestProfile): Promise<GuestProfile>;
  delete(id: string): Promise<void>;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class GuestServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'GuestServiceError';
  }
}

// ─── Container ────────────────────────────────────────────────────────────────

export interface GuestServiceContainer {
  guestRepository: GuestRepository;
  logger?: {
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
    error(msg: string, meta?: Record<string, unknown>): void;
    debug(msg: string, meta?: Record<string, unknown>): void;
  };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

function validateUuid(id: string, code: string): void {
  if (!UUID_RE.test(id)) throw new GuestServiceError(`Invalid UUID: ${id}`, code);
}

function validateEmail(email: string): void {
  if (!EMAIL_RE.test(email)) throw new GuestServiceError('Invalid email', 'INVALID_EMAIL');
}

function validatePhone(phone: string): void {
  if (!PHONE_RE.test(phone)) throw new GuestServiceError('Invalid phone number', 'INVALID_PHONE');
}

const VALID_STATUSES: GuestStatus[] = ['active', 'inactive', 'vip', 'banned'];

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGuestService(container: GuestServiceContainer) {
  const { guestRepository: repo } = container;

  async function getOrThrow(id: string): Promise<GuestProfile> {
    validateUuid(id, 'INVALID_GUEST_ID');
    const guest = await repo.findById(id);
    if (!guest) throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);
    return guest;
  }

  return {
    // ── Create ──────────────────────────────────────────────────────────────

    async createGuest(input: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      userId?: string;
      dateOfBirth?: string;
      nationality?: string;
      idType?: string;
      idNumber?: string;
      preferences?: Record<string, unknown>;
      notes?: string;
      tags?: string[];
    }): Promise<GuestProfile> {
      if (!input.firstName || input.firstName.trim().length < 2)
        throw new GuestServiceError('First name must be at least 2 characters', 'INVALID_FIRST NAME');
      if (!input.lastName || input.lastName.trim().length < 2)
        throw new GuestServiceError('Last name must be at least 2 characters', 'INVALID_LAST NAME');

      const email = input.email.toLowerCase().trim();
      validateEmail(email);
      const phone = normalizePhone(input.phone);
      validatePhone(phone);

      if (input.userId) validateUuid(input.userId, 'INVALID_USER_ID');

      if (input.dateOfBirth && new Date(input.dateOfBirth) >= new Date())
        throw new GuestServiceError('Date of birth cannot be in the future', 'INVALID_DATE_OF_BIRTH');

      if (await repo.findByEmail(email))
        throw new GuestServiceError('Email already exists', 'EMAIL_EXISTS', 409);
      if (await repo.findByPhone(phone))
        throw new GuestServiceError('Phone already exists', 'PHONE_EXISTS', 409);

      const now = new Date().toISOString();
      const guest: GuestProfile = {
        id: uuidv4(),
        userId: input.userId ?? null,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone,
        dateOfBirth: input.dateOfBirth ?? null,
        nationality: input.nationality ?? null,
        idType: input.idType ?? null,
        idNumber: input.idNumber ?? null,
        status: 'active',
        preferences: input.preferences ?? {},
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        totalStays: 0,
        totalSpent: 0,
        lastVisit: null,
        createdAt: now,
        updatedAt: null,
      };
      return repo.save(guest);
    },

    // ── Read ─────────────────────────────────────────────────────────────────

    async getGuest(id: string): Promise<GuestProfile | null> {
      validateUuid(id, 'INVALID_GUEST_ID');
      return repo.findById(id);
    },

    async getGuestByEmail(email: string): Promise<GuestProfile | null> {
      validateEmail(email);
      return repo.findByEmail(email.toLowerCase().trim());
    },

    async getGuestByPhone(phone: string): Promise<GuestProfile | null> {
      const normalized = normalizePhone(phone);
      validatePhone(normalized);
      return repo.findByPhone(normalized);
    },

    async getGuestByUserId(userId: string): Promise<GuestProfile | null> {
      validateUuid(userId, 'INVALID_USER_ID');
      return repo.findByUserId(userId);
    },

    async listGuests(filters?: { status?: GuestStatus; tags?: string[] }): Promise<GuestProfile[]> {
      return repo.findAll(filters);
    },

    async searchGuests(query: string): Promise<GuestProfile[]> {
      if (!query || !query.trim()) return [];
      return repo.search(query.trim());
    },

    async getVipGuests(): Promise<GuestProfile[]> {
      return repo.findAll({ status: 'vip' });
    },

    // ── Update ────────────────────────────────────────────────────────────────

    async updateGuest(
      id: string,
      updates: Partial<Pick<GuestProfile, 'firstName' | 'lastName' | 'email' | 'phone' | 'dateOfBirth' | 'nationality' | 'idType' | 'idNumber' | 'preferences' | 'notes' | 'tags'>>,
    ): Promise<GuestProfile> {
      validateUuid(id, 'INVALID_GUEST_ID');
      const guest = await repo.findById(id);
      if (!guest) throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);

      if (updates.email) {
        const email = updates.email.toLowerCase().trim();
        validateEmail(email);
        const existing = await repo.findByEmail(email);
        if (existing && existing.id !== id) throw new GuestServiceError('Email already exists', 'EMAIL_EXISTS', 409);
        updates = { ...updates, email };
      }

      if (updates.phone) {
        const phone = normalizePhone(updates.phone);
        validatePhone(phone);
        const existing = await repo.findByPhone(phone);
        if (existing && existing.id !== id) throw new GuestServiceError('Phone already exists', 'PHONE_EXISTS', 409);
        updates = { ...updates, phone };
      }

      return repo.save({ ...guest, ...updates, updatedAt: new Date().toISOString() });
    },

    async setStatus(id: string, status: GuestStatus): Promise<GuestProfile> {
      if (!VALID_STATUSES.includes(status))
        throw new GuestServiceError(`Invalid status: ${status}`, 'INVALID_STATUS');
      const guest = await getOrThrow(id);
      return repo.save({ ...guest, status, updatedAt: new Date().toISOString() });
    },

    // ── Delete ────────────────────────────────────────────────────────────────

    async deleteGuest(id: string): Promise<void> {
      const guest = await getOrThrow(id);
      await repo.delete(guest.id);
    },

    // ── Visit tracking ────────────────────────────────────────────────────────

    async recordVisit(input: { guestId: string; amountSpent: number }): Promise<GuestProfile> {
      if (input.amountSpent < 0)
        throw new GuestServiceError('Amount spent cannot be negative', 'INVALID_AMOUNT');
      const guest = await getOrThrow(input.guestId);
      return repo.save({
        ...guest,
        totalStays: guest.totalStays + 1,
        totalSpent: Math.round((guest.totalSpent + input.amountSpent) * 100) / 100,
        lastVisit: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    // ── Tags ──────────────────────────────────────────────────────────────────

    async addTags(id: string, tags: string[]): Promise<GuestProfile> {
      if (!tags || tags.length === 0)
        throw new GuestServiceError('Tags array cannot be empty', 'INVALID_TAGS');
      const guest = await getOrThrow(id);
      const merged = [...new Set([...guest.tags, ...tags])];
      return repo.save({ ...guest, tags: merged, updatedAt: new Date().toISOString() });
    },

    async removeTags(id: string, tags: string[]): Promise<GuestProfile> {
      if (!tags || tags.length === 0)
        throw new GuestServiceError('Tags array cannot be empty', 'INVALID_TAGS');
      const guest = await getOrThrow(id);
      return repo.save({
        ...guest,
        tags: guest.tags.filter((t) => !tags.includes(t)),
        updatedAt: new Date().toISOString(),
      });
    },

    // ── Stats ─────────────────────────────────────────────────────────────────

    async getStats(): Promise<GuestStats> {
      const all = await repo.findAll();
      const totalGuests = all.length;
      const activeGuests = all.filter((g) => g.status === 'active').length;
      const vipGuests = all.filter((g) => g.status === 'vip').length;
      const inactiveGuests = all.filter((g) => g.status === 'inactive').length;
      const bannedGuests = all.filter((g) => g.status === 'banned').length;
      const totalRevenue = Math.round(all.reduce((s, g) => s + g.totalSpent, 0) * 100) / 100;
      const averageSpend = totalGuests > 0 ? Math.round((totalRevenue / totalGuests) * 100) / 100 : 0;
      return { totalGuests, activeGuests, vipGuests, inactiveGuests, bannedGuests, totalRevenue, averageSpend };
    },

    // ── Merge ─────────────────────────────────────────────────────────────────

    async mergeProfiles(primaryId: string, secondaryId: string): Promise<GuestProfile> {
      if (primaryId === secondaryId)
        throw new GuestServiceError('Cannot merge a guest with themselves', 'SAME_GUEST');
      const primary = await getOrThrow(primaryId);
      const secondary = await getOrThrow(secondaryId);

      const merged: GuestProfile = {
        ...primary,
        totalStays: primary.totalStays + secondary.totalStays,
        totalSpent: Math.round((primary.totalSpent + secondary.totalSpent) * 100) / 100,
        tags: [...new Set([...primary.tags, ...secondary.tags])],
        lastVisit:
          primary.lastVisit && secondary.lastVisit
            ? new Date(primary.lastVisit) > new Date(secondary.lastVisit)
              ? primary.lastVisit
              : secondary.lastVisit
            : primary.lastVisit ?? secondary.lastVisit,
        updatedAt: new Date().toISOString(),
      };

      await repo.save(merged);
      await repo.delete(secondary.id);
      return merged;
    },

    // ── Utility ───────────────────────────────────────────────────────────────

    getStatuses(): GuestStatus[] {
      return [...VALID_STATUSES];
    },
  };
}
