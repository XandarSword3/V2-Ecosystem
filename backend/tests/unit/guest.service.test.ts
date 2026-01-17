/**
 * Guest Service Tests
 *
 * Unit tests for the Guest Profile Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGuestService, GuestServiceError } from '../../src/lib/services/guest.service';
import { InMemoryGuestRepository } from '../../src/lib/repositories/guest.repository.memory';
import type { Container, GuestProfile } from '../../src/lib/container/types';

// Test UUIDs
const USER_1 = '11111111-1111-1111-1111-111111111111';
const USER_2 = '22222222-2222-2222-2222-222222222222';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(guestRepository: InMemoryGuestRepository): Container {
  return {
    guestRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

function createTestGuest(overrides: Partial<GuestProfile> = {}): GuestProfile {
  const now = new Date().toISOString();
  return {
    id: '99999999-9999-9999-9999-999999999999',
    userId: null,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+12025551234',
    dateOfBirth: null,
    nationality: null,
    idType: null,
    idNumber: null,
    status: 'active',
    preferences: {},
    notes: null,
    tags: [],
    totalStays: 0,
    totalSpent: 0,
    lastVisit: null,
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

describe('GuestService', () => {
  let repository: InMemoryGuestRepository;
  let container: Container;
  let service: ReturnType<typeof createGuestService>;

  beforeEach(() => {
    repository = new InMemoryGuestRepository();
    container = createMockContainer(repository);
    service = createGuestService(container);
  });

  // ============================================
  // CREATE GUEST TESTS
  // ============================================
  describe('createGuest', () => {
    it('should create a guest', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+12025551234',
      });

      expect(guest).toBeDefined();
      expect(guest.firstName).toBe('John');
      expect(guest.status).toBe('active');
    });

    it('should normalize email to lowercase', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'John.DOE@Example.com',
        phone: '+12025551234',
      });

      expect(guest.email).toBe('john.doe@example.com');
    });

    it('should normalize phone number', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1 (202) 555-1234',
      });

      expect(guest.phone).toBe('+12025551234');
    });

    it('should accept optional userId', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
        userId: USER_1,
      });

      expect(guest.userId).toBe(USER_1);
    });

    it('should accept preferences', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
        preferences: {
          roomType: 'suite',
          floor: 'high',
        },
      });

      expect(guest.preferences.roomType).toBe('suite');
      expect(guest.preferences.floor).toBe('high');
    });

    it('should accept tags', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
        tags: ['frequent', 'business'],
      });

      expect(guest.tags).toContain('frequent');
    });

    it('should reject short first name', async () => {
      await expect(
        service.createGuest({
          firstName: 'J',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+12025551234',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_FIRST NAME',
      });
    });

    it('should reject short last name', async () => {
      await expect(
        service.createGuest({
          firstName: 'John',
          lastName: 'D',
          email: 'john@example.com',
          phone: '+12025551234',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_LAST NAME',
      });
    });

    it('should reject invalid email', async () => {
      await expect(
        service.createGuest({
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          phone: '+12025551234',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_EMAIL',
      });
    });

    it('should reject invalid phone', async () => {
      await expect(
        service.createGuest({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '123',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PHONE',
      });
    });

    it('should reject invalid user ID', async () => {
      await expect(
        service.createGuest({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+12025551234',
          userId: INVALID_UUID,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_USER_ID',
      });
    });

    it('should reject duplicate email', async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      await expect(
        service.createGuest({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+12025559999',
        })
      ).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
      });
    });

    it('should reject duplicate phone', async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      await expect(
        service.createGuest({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phone: '+12025551234',
        })
      ).rejects.toMatchObject({
        code: 'PHONE_EXISTS',
      });
    });

    it('should reject future date of birth', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await expect(
        service.createGuest({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+12025551234',
          dateOfBirth: futureDate.toISOString(),
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DATE_OF_BIRTH',
      });
    });
  });

  // ============================================
  // GET GUEST TESTS
  // ============================================
  describe('getGuest', () => {
    it('should retrieve guest by ID', async () => {
      const created = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      const found = await service.getGuest(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent guest', async () => {
      const found = await service.getGuest(USER_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getGuest(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_GUEST_ID',
      });
    });
  });

  describe('getGuestByEmail', () => {
    it('should find guest by email', async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      const found = await service.getGuestByEmail('john@example.com');
      expect(found).toBeDefined();
      expect(found?.firstName).toBe('John');
    });

    it('should be case-insensitive', async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      const found = await service.getGuestByEmail('JOHN@EXAMPLE.COM');
      expect(found).toBeDefined();
    });

    it('should reject invalid email', async () => {
      await expect(
        service.getGuestByEmail('invalid-email')
      ).rejects.toMatchObject({
        code: 'INVALID_EMAIL',
      });
    });
  });

  describe('getGuestByPhone', () => {
    it('should find guest by phone', async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      const found = await service.getGuestByPhone('+12025551234');
      expect(found).toBeDefined();
      expect(found?.firstName).toBe('John');
    });

    it('should reject invalid phone', async () => {
      await expect(service.getGuestByPhone('123')).rejects.toMatchObject({
        code: 'INVALID_PHONE',
      });
    });
  });

  describe('getGuestByUserId', () => {
    it('should find guest by user ID', async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
        userId: USER_1,
      });

      const found = await service.getGuestByUserId(USER_1);
      expect(found).toBeDefined();
      expect(found?.firstName).toBe('John');
    });

    it('should reject invalid user ID', async () => {
      await expect(
        service.getGuestByUserId(INVALID_UUID)
      ).rejects.toMatchObject({
        code: 'INVALID_USER_ID',
      });
    });
  });

  // ============================================
  // UPDATE GUEST TESTS
  // ============================================
  describe('updateGuest', () => {
    let guestId: string;

    beforeEach(async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });
      guestId = guest.id;
    });

    it('should update first name', async () => {
      const updated = await service.updateGuest(guestId, {
        firstName: 'Johnny',
      });

      expect(updated.firstName).toBe('Johnny');
    });

    it('should update email', async () => {
      const updated = await service.updateGuest(guestId, {
        email: 'johnny@example.com',
      });

      expect(updated.email).toBe('johnny@example.com');
    });

    it('should update preferences', async () => {
      const updated = await service.updateGuest(guestId, {
        preferences: { roomType: 'suite' },
      });

      expect(updated.preferences.roomType).toBe('suite');
    });

    it('should reject duplicate email on update', async () => {
      await service.createGuest({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+12025559999',
      });

      await expect(
        service.updateGuest(guestId, { email: 'jane@example.com' })
      ).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
      });
    });

    it('should reject non-existent guest', async () => {
      await expect(
        service.updateGuest(USER_2, { firstName: 'Test' })
      ).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.updateGuest(INVALID_UUID, { firstName: 'Test' })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_ID',
      });
    });
  });

  // ============================================
  // DELETE GUEST TESTS
  // ============================================
  describe('deleteGuest', () => {
    it('should delete guest', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      await service.deleteGuest(guest.id);

      const found = await service.getGuest(guest.id);
      expect(found).toBeNull();
    });

    it('should reject non-existent guest', async () => {
      await expect(service.deleteGuest(USER_2)).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.deleteGuest(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_GUEST_ID',
      });
    });
  });

  // ============================================
  // SET STATUS TESTS
  // ============================================
  describe('setStatus', () => {
    let guestId: string;

    beforeEach(async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });
      guestId = guest.id;
    });

    it('should set VIP status', async () => {
      const updated = await service.setStatus(guestId, 'vip');
      expect(updated.status).toBe('vip');
    });

    it('should set inactive status', async () => {
      const updated = await service.setStatus(guestId, 'inactive');
      expect(updated.status).toBe('inactive');
    });

    it('should set banned status', async () => {
      const updated = await service.setStatus(guestId, 'banned');
      expect(updated.status).toBe('banned');
    });

    it('should reject invalid status', async () => {
      await expect(
        service.setStatus(guestId, 'invalid' as any)
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent guest', async () => {
      await expect(service.setStatus(USER_2, 'vip')).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });
  });

  // ============================================
  // RECORD VISIT TESTS
  // ============================================
  describe('recordVisit', () => {
    let guestId: string;

    beforeEach(async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });
      guestId = guest.id;
    });

    it('should increment stay count', async () => {
      const updated = await service.recordVisit({
        guestId,
        amountSpent: 500,
      });

      expect(updated.totalStays).toBe(1);
    });

    it('should add to total spent', async () => {
      const updated = await service.recordVisit({
        guestId,
        amountSpent: 500,
      });

      expect(updated.totalSpent).toBe(500);
    });

    it('should update last visit', async () => {
      const updated = await service.recordVisit({
        guestId,
        amountSpent: 500,
      });

      expect(updated.lastVisit).toBeDefined();
    });

    it('should accumulate visits', async () => {
      await service.recordVisit({ guestId, amountSpent: 500 });
      const updated = await service.recordVisit({ guestId, amountSpent: 300 });

      expect(updated.totalStays).toBe(2);
      expect(updated.totalSpent).toBe(800);
    });

    it('should reject negative amount', async () => {
      await expect(
        service.recordVisit({ guestId, amountSpent: -100 })
      ).rejects.toMatchObject({
        code: 'INVALID_AMOUNT',
      });
    });

    it('should reject non-existent guest', async () => {
      await expect(
        service.recordVisit({ guestId: USER_2, amountSpent: 500 })
      ).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });
  });

  // ============================================
  // TAGS TESTS
  // ============================================
  describe('addTags', () => {
    let guestId: string;

    beforeEach(async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });
      guestId = guest.id;
    });

    it('should add tags', async () => {
      const updated = await service.addTags(guestId, ['vip', 'business']);

      expect(updated.tags).toContain('vip');
      expect(updated.tags).toContain('business');
    });

    it('should not duplicate existing tags', async () => {
      await service.addTags(guestId, ['vip']);
      const updated = await service.addTags(guestId, ['vip', 'business']);

      expect(updated.tags.filter((t) => t === 'vip').length).toBe(1);
    });

    it('should reject empty tags array', async () => {
      await expect(service.addTags(guestId, [])).rejects.toMatchObject({
        code: 'INVALID_TAGS',
      });
    });

    it('should reject non-existent guest', async () => {
      await expect(service.addTags(USER_2, ['vip'])).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });
  });

  describe('removeTags', () => {
    let guestId: string;

    beforeEach(async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
        tags: ['vip', 'business', 'frequent'],
      });
      guestId = guest.id;
    });

    it('should remove tags', async () => {
      const updated = await service.removeTags(guestId, ['business']);

      expect(updated.tags).not.toContain('business');
      expect(updated.tags).toContain('vip');
    });

    it('should reject empty tags array', async () => {
      await expect(service.removeTags(guestId, [])).rejects.toMatchObject({
        code: 'INVALID_TAGS',
      });
    });

    it('should reject non-existent guest', async () => {
      await expect(
        service.removeTags(USER_2, ['vip'])
      ).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });
  });

  // ============================================
  // LIST & SEARCH TESTS
  // ============================================
  describe('listGuests', () => {
    beforeEach(async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      const guest2 = await service.createGuest({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+12025559999',
      });
      await service.setStatus(guest2.id, 'vip');

      await service.createGuest({
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob@example.com',
        phone: '+12025558888',
        tags: ['business'],
      });
    });

    it('should return all guests', async () => {
      const guests = await service.listGuests();
      expect(guests.length).toBe(3);
    });

    it('should filter by status', async () => {
      const guests = await service.listGuests({ status: 'vip' });
      expect(guests.length).toBe(1);
    });

    it('should filter by tags', async () => {
      const guests = await service.listGuests({ tags: ['business'] });
      expect(guests.length).toBe(1);
    });
  });

  describe('searchGuests', () => {
    beforeEach(async () => {
      await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      await service.createGuest({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+12025559999',
      });
    });

    it('should search by first name', async () => {
      const guests = await service.searchGuests('John');
      expect(guests.length).toBe(1);
    });

    it('should search by last name', async () => {
      const guests = await service.searchGuests('Smith');
      expect(guests.length).toBe(1);
    });

    it('should search by email', async () => {
      const guests = await service.searchGuests('jane@example');
      expect(guests.length).toBe(1);
    });

    it('should return empty for no query', async () => {
      const guests = await service.searchGuests('');
      expect(guests.length).toBe(0);
    });
  });

  describe('getVipGuests', () => {
    it('should return only VIP guests', async () => {
      const guest1 = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });
      await service.setStatus(guest1.id, 'vip');

      await service.createGuest({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+12025559999',
      });

      const vips = await service.getVipGuests();
      expect(vips.length).toBe(1);
      expect(vips[0].firstName).toBe('John');
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no guests', async () => {
      const stats = await service.getStats();

      expect(stats.totalGuests).toBe(0);
      expect(stats.activeGuests).toBe(0);
    });

    it('should count guests by status', async () => {
      const guest1 = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });
      await service.setStatus(guest1.id, 'vip');

      await service.createGuest({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+12025559999',
      });

      const stats = await service.getStats();

      expect(stats.totalGuests).toBe(2);
      expect(stats.vipGuests).toBe(1);
      expect(stats.activeGuests).toBe(1);
    });

    it('should calculate total revenue', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });
      await service.recordVisit({ guestId: guest.id, amountSpent: 1000 });

      const stats = await service.getStats();

      expect(stats.totalRevenue).toBe(1000);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getStatuses();

      expect(statuses).toContain('active');
      expect(statuses).toContain('inactive');
      expect(statuses).toContain('vip');
      expect(statuses).toContain('banned');
    });
  });

  // ============================================
  // MERGE PROFILES TESTS
  // ============================================
  describe('mergeProfiles', () => {
    it('should merge guest profiles', async () => {
      const primary = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
        tags: ['business'],
      });
      await service.recordVisit({ guestId: primary.id, amountSpent: 500 });

      const secondary = await service.createGuest({
        firstName: 'John',
        lastName: 'D.',
        email: 'johnd@example.com',
        phone: '+12025559999',
        tags: ['vip'],
      });
      await service.recordVisit({ guestId: secondary.id, amountSpent: 300 });

      const merged = await service.mergeProfiles(primary.id, secondary.id);

      expect(merged.totalStays).toBe(2);
      expect(merged.totalSpent).toBe(800);
      expect(merged.tags).toContain('business');
      expect(merged.tags).toContain('vip');
    });

    it('should delete secondary profile', async () => {
      const primary = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      const secondary = await service.createGuest({
        firstName: 'John',
        lastName: 'D.',
        email: 'johnd@example.com',
        phone: '+12025559999',
      });

      await service.mergeProfiles(primary.id, secondary.id);

      const found = await service.getGuest(secondary.id);
      expect(found).toBeNull();
    });

    it('should reject merging with self', async () => {
      const guest = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      await expect(
        service.mergeProfiles(guest.id, guest.id)
      ).rejects.toMatchObject({
        code: 'SAME_GUEST',
      });
    });

    it('should reject non-existent primary', async () => {
      const secondary = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      await expect(
        service.mergeProfiles(USER_2, secondary.id)
      ).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });

    it('should reject non-existent secondary', async () => {
      const primary = await service.createGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+12025551234',
      });

      await expect(
        service.mergeProfiles(primary.id, USER_2)
      ).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
    });
  });
});
