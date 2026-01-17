/**
 * Guest Profile Service
 *
 * Manages guest profiles, preferences, and visit history.
 * Follows DI pattern for testability.
 */

import type { Container, GuestProfile, GuestPreferences, GuestFilters, GuestStatus } from '../container/types.js';

// ============================================
// CONSTANTS
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

const GUEST_STATUSES: GuestStatus[] = ['active', 'inactive', 'vip', 'banned'];
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;

// ============================================
// TYPES
// ============================================

export interface CreateGuestInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userId?: string;
  dateOfBirth?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  preferences?: GuestPreferences;
  notes?: string;
  tags?: string[];
}

export interface UpdateGuestInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  preferences?: Partial<GuestPreferences>;
  notes?: string | null;
  tags?: string[];
}

export interface RecordVisitInput {
  guestId: string;
  amountSpent: number;
}

export interface GuestStats {
  totalGuests: number;
  activeGuests: number;
  vipGuests: number;
  inactiveGuests: number;
  bannedGuests: number;
  totalRevenue: number;
  avgSpentPerGuest: number;
  avgStaysPerGuest: number;
}

export interface GuestService {
  createGuest(input: CreateGuestInput): Promise<GuestProfile>;
  getGuest(id: string): Promise<GuestProfile | null>;
  getGuestByEmail(email: string): Promise<GuestProfile | null>;
  getGuestByPhone(phone: string): Promise<GuestProfile | null>;
  getGuestByUserId(userId: string): Promise<GuestProfile | null>;
  updateGuest(id: string, input: UpdateGuestInput): Promise<GuestProfile>;
  deleteGuest(id: string): Promise<void>;
  setStatus(id: string, status: GuestStatus): Promise<GuestProfile>;
  recordVisit(input: RecordVisitInput): Promise<GuestProfile>;
  addTags(id: string, tags: string[]): Promise<GuestProfile>;
  removeTags(id: string, tags: string[]): Promise<GuestProfile>;
  listGuests(filters?: GuestFilters): Promise<GuestProfile[]>;
  searchGuests(query: string): Promise<GuestProfile[]>;
  getVipGuests(): Promise<GuestProfile[]>;
  getStats(): Promise<GuestStats>;
  getStatuses(): GuestStatus[];
  mergeProfiles(primaryId: string, secondaryId: string): Promise<GuestProfile>;
}

// ============================================
// ERROR CLASS
// ============================================

export class GuestServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'GuestServiceError';
  }
}

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function validateName(name: string, field: string): void {
  if (!name || name.trim().length < MIN_NAME_LENGTH) {
    throw new GuestServiceError(
      `${field} must be at least ${MIN_NAME_LENGTH} characters`,
      `INVALID_${field.toUpperCase()}`
    );
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new GuestServiceError(
      `${field} cannot exceed ${MAX_NAME_LENGTH} characters`,
      `INVALID_${field.toUpperCase()}`
    );
  }
}

function validateEmail(email: string): void {
  if (!email || !isValidEmail(email)) {
    throw new GuestServiceError('Invalid email format', 'INVALID_EMAIL');
  }
}

function validatePhone(phone: string): void {
  if (!phone || !isValidPhone(phone)) {
    throw new GuestServiceError('Invalid phone format', 'INVALID_PHONE');
  }
}

function validateDateOfBirth(dob: string): void {
  const date = new Date(dob);
  if (isNaN(date.getTime())) {
    throw new GuestServiceError('Invalid date of birth format', 'INVALID_DATE_OF_BIRTH');
  }
  if (date > new Date()) {
    throw new GuestServiceError('Date of birth cannot be in the future', 'INVALID_DATE_OF_BIRTH');
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createGuestService(container: Container): GuestService {
  const { guestRepository, logger } = container;

  async function createGuest(input: CreateGuestInput): Promise<GuestProfile> {
    logger?.info?.('Creating guest profile', { email: input.email });

    // Validate required fields
    validateName(input.firstName, 'first name');
    validateName(input.lastName, 'last name');
    validateEmail(input.email);
    validatePhone(input.phone);

    if (input.userId && !isValidUUID(input.userId)) {
      throw new GuestServiceError('Invalid user ID', 'INVALID_USER_ID');
    }

    if (input.dateOfBirth) {
      validateDateOfBirth(input.dateOfBirth);
    }

    // Check for existing guest with same email
    const existingByEmail = await guestRepository.getByEmail(input.email);
    if (existingByEmail) {
      throw new GuestServiceError('Guest with this email already exists', 'EMAIL_EXISTS');
    }

    // Check for existing guest with same phone
    const existingByPhone = await guestRepository.getByPhone(input.phone);
    if (existingByPhone) {
      throw new GuestServiceError('Guest with this phone already exists', 'PHONE_EXISTS');
    }

    const guest = await guestRepository.create({
      userId: input.userId || null,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone.replace(/[\s\-\(\)]/g, ''),
      dateOfBirth: input.dateOfBirth || null,
      nationality: input.nationality?.trim() || null,
      idType: input.idType?.trim() || null,
      idNumber: input.idNumber?.trim() || null,
      status: 'active',
      preferences: input.preferences || {},
      notes: input.notes?.trim() || null,
      tags: input.tags || [],
      totalStays: 0,
      totalSpent: 0,
      lastVisit: null,
    });

    return guest;
  }

  async function getGuest(id: string): Promise<GuestProfile | null> {
    if (!isValidUUID(id)) {
      throw new GuestServiceError('Invalid guest ID', 'INVALID_GUEST_ID');
    }

    return guestRepository.getById(id);
  }

  async function getGuestByEmail(email: string): Promise<GuestProfile | null> {
    if (!isValidEmail(email)) {
      throw new GuestServiceError('Invalid email format', 'INVALID_EMAIL');
    }

    return guestRepository.getByEmail(email.toLowerCase().trim());
  }

  async function getGuestByPhone(phone: string): Promise<GuestProfile | null> {
    if (!isValidPhone(phone)) {
      throw new GuestServiceError('Invalid phone format', 'INVALID_PHONE');
    }

    return guestRepository.getByPhone(phone.replace(/[\s\-\(\)]/g, ''));
  }

  async function getGuestByUserId(userId: string): Promise<GuestProfile | null> {
    if (!isValidUUID(userId)) {
      throw new GuestServiceError('Invalid user ID', 'INVALID_USER_ID');
    }

    return guestRepository.getByUserId(userId);
  }

  async function updateGuest(id: string, input: UpdateGuestInput): Promise<GuestProfile> {
    if (!isValidUUID(id)) {
      throw new GuestServiceError('Invalid guest ID', 'INVALID_GUEST_ID');
    }

    const guest = await guestRepository.getById(id);
    if (!guest) {
      throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);
    }

    const updates: Partial<GuestProfile> = {};

    if (input.firstName !== undefined) {
      validateName(input.firstName, 'first name');
      updates.firstName = input.firstName.trim();
    }

    if (input.lastName !== undefined) {
      validateName(input.lastName, 'last name');
      updates.lastName = input.lastName.trim();
    }

    if (input.email !== undefined) {
      validateEmail(input.email);
      const normalizedEmail = input.email.toLowerCase().trim();
      if (normalizedEmail !== guest.email) {
        const existing = await guestRepository.getByEmail(normalizedEmail);
        if (existing) {
          throw new GuestServiceError('Guest with this email already exists', 'EMAIL_EXISTS');
        }
        updates.email = normalizedEmail;
      }
    }

    if (input.phone !== undefined) {
      validatePhone(input.phone);
      const normalizedPhone = input.phone.replace(/[\s\-\(\)]/g, '');
      if (normalizedPhone !== guest.phone) {
        const existing = await guestRepository.getByPhone(normalizedPhone);
        if (existing) {
          throw new GuestServiceError('Guest with this phone already exists', 'PHONE_EXISTS');
        }
        updates.phone = normalizedPhone;
      }
    }

    if (input.dateOfBirth !== undefined) {
      if (input.dateOfBirth !== null) {
        validateDateOfBirth(input.dateOfBirth);
      }
      updates.dateOfBirth = input.dateOfBirth;
    }

    if (input.nationality !== undefined) {
      updates.nationality = input.nationality?.trim() || null;
    }

    if (input.idType !== undefined) {
      updates.idType = input.idType?.trim() || null;
    }

    if (input.idNumber !== undefined) {
      updates.idNumber = input.idNumber?.trim() || null;
    }

    if (input.preferences !== undefined) {
      updates.preferences = { ...guest.preferences, ...input.preferences };
    }

    if (input.notes !== undefined) {
      updates.notes = input.notes?.trim() || null;
    }

    if (input.tags !== undefined) {
      updates.tags = input.tags;
    }

    return guestRepository.update(id, updates);
  }

  async function deleteGuest(id: string): Promise<void> {
    if (!isValidUUID(id)) {
      throw new GuestServiceError('Invalid guest ID', 'INVALID_GUEST_ID');
    }

    const guest = await guestRepository.getById(id);
    if (!guest) {
      throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);
    }

    await guestRepository.delete(id);
  }

  async function setStatus(id: string, status: GuestStatus): Promise<GuestProfile> {
    if (!isValidUUID(id)) {
      throw new GuestServiceError('Invalid guest ID', 'INVALID_GUEST_ID');
    }

    if (!GUEST_STATUSES.includes(status)) {
      throw new GuestServiceError(`Invalid status: ${status}`, 'INVALID_STATUS');
    }

    const guest = await guestRepository.getById(id);
    if (!guest) {
      throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);
    }

    return guestRepository.update(id, { status });
  }

  async function recordVisit(input: RecordVisitInput): Promise<GuestProfile> {
    if (!isValidUUID(input.guestId)) {
      throw new GuestServiceError('Invalid guest ID', 'INVALID_GUEST_ID');
    }

    if (input.amountSpent < 0) {
      throw new GuestServiceError('Amount spent cannot be negative', 'INVALID_AMOUNT');
    }

    const guest = await guestRepository.getById(input.guestId);
    if (!guest) {
      throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);
    }

    return guestRepository.update(input.guestId, {
      totalStays: guest.totalStays + 1,
      totalSpent: guest.totalSpent + input.amountSpent,
      lastVisit: new Date().toISOString(),
    });
  }

  async function addTags(id: string, tags: string[]): Promise<GuestProfile> {
    if (!isValidUUID(id)) {
      throw new GuestServiceError('Invalid guest ID', 'INVALID_GUEST_ID');
    }

    if (!tags || tags.length === 0) {
      throw new GuestServiceError('Tags array is required', 'INVALID_TAGS');
    }

    const guest = await guestRepository.getById(id);
    if (!guest) {
      throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);
    }

    const newTags = [...new Set([...guest.tags, ...tags])];

    return guestRepository.update(id, { tags: newTags });
  }

  async function removeTags(id: string, tags: string[]): Promise<GuestProfile> {
    if (!isValidUUID(id)) {
      throw new GuestServiceError('Invalid guest ID', 'INVALID_GUEST_ID');
    }

    if (!tags || tags.length === 0) {
      throw new GuestServiceError('Tags array is required', 'INVALID_TAGS');
    }

    const guest = await guestRepository.getById(id);
    if (!guest) {
      throw new GuestServiceError('Guest not found', 'GUEST_NOT_FOUND', 404);
    }

    const newTags = guest.tags.filter((t) => !tags.includes(t));

    return guestRepository.update(id, { tags: newTags });
  }

  async function listGuests(filters?: GuestFilters): Promise<GuestProfile[]> {
    return guestRepository.list(filters);
  }

  async function searchGuests(query: string): Promise<GuestProfile[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    return guestRepository.search(query.trim());
  }

  async function getVipGuests(): Promise<GuestProfile[]> {
    return guestRepository.list({ status: 'vip' });
  }

  async function getStats(): Promise<GuestStats> {
    const allGuests = await guestRepository.list();

    const stats: GuestStats = {
      totalGuests: allGuests.length,
      activeGuests: 0,
      vipGuests: 0,
      inactiveGuests: 0,
      bannedGuests: 0,
      totalRevenue: 0,
      avgSpentPerGuest: 0,
      avgStaysPerGuest: 0,
    };

    let totalStays = 0;

    for (const guest of allGuests) {
      switch (guest.status) {
        case 'active':
          stats.activeGuests++;
          break;
        case 'vip':
          stats.vipGuests++;
          break;
        case 'inactive':
          stats.inactiveGuests++;
          break;
        case 'banned':
          stats.bannedGuests++;
          break;
      }

      stats.totalRevenue += guest.totalSpent;
      totalStays += guest.totalStays;
    }

    stats.avgSpentPerGuest = allGuests.length > 0
      ? Math.round((stats.totalRevenue / allGuests.length) * 100) / 100
      : 0;

    stats.avgStaysPerGuest = allGuests.length > 0
      ? Math.round((totalStays / allGuests.length) * 100) / 100
      : 0;

    return stats;
  }

  function getStatuses(): GuestStatus[] {
    return [...GUEST_STATUSES];
  }

  async function mergeProfiles(primaryId: string, secondaryId: string): Promise<GuestProfile> {
    if (!isValidUUID(primaryId)) {
      throw new GuestServiceError('Invalid primary guest ID', 'INVALID_GUEST_ID');
    }

    if (!isValidUUID(secondaryId)) {
      throw new GuestServiceError('Invalid secondary guest ID', 'INVALID_GUEST_ID');
    }

    if (primaryId === secondaryId) {
      throw new GuestServiceError('Cannot merge guest with itself', 'SAME_GUEST');
    }

    const primary = await guestRepository.getById(primaryId);
    if (!primary) {
      throw new GuestServiceError('Primary guest not found', 'GUEST_NOT_FOUND', 404);
    }

    const secondary = await guestRepository.getById(secondaryId);
    if (!secondary) {
      throw new GuestServiceError('Secondary guest not found', 'GUEST_NOT_FOUND', 404);
    }

    // Merge data
    const mergedTags = [...new Set([...primary.tags, ...secondary.tags])];
    const mergedNotes = primary.notes && secondary.notes
      ? `${primary.notes}\n---\nMerged from: ${secondary.notes}`
      : primary.notes || secondary.notes;

    const updated = await guestRepository.update(primaryId, {
      totalStays: primary.totalStays + secondary.totalStays,
      totalSpent: primary.totalSpent + secondary.totalSpent,
      tags: mergedTags,
      notes: mergedNotes,
      lastVisit: primary.lastVisit && secondary.lastVisit
        ? new Date(primary.lastVisit) > new Date(secondary.lastVisit)
          ? primary.lastVisit
          : secondary.lastVisit
        : primary.lastVisit || secondary.lastVisit,
    });

    // Delete secondary profile
    await guestRepository.delete(secondaryId);

    return updated;
  }

  return {
    createGuest,
    getGuest,
    getGuestByEmail,
    getGuestByPhone,
    getGuestByUserId,
    updateGuest,
    deleteGuest,
    setStatus,
    recordVisit,
    addTags,
    removeTags,
    listGuests,
    searchGuests,
    getVipGuests,
    getStats,
    getStatuses,
    mergeProfiles,
  };
}
