import { createGuestService, GuestServiceError } from '../../../src/services/guest.service';
import { InMemoryGuestRepository } from '../../utils/guest.repository.memory';

const USER_1 = '11111111-1111-1111-1111-111111111111';
const USER_2 = '22222222-2222-2222-2222-222222222222';
const INVALID_UUID = 'not-a-valid-uuid';

describe('GuestService', () => {
  let repository: InMemoryGuestRepository;
  let service: ReturnType<typeof createGuestService>;

  beforeEach(() => {
    repository = new InMemoryGuestRepository();
    service = createGuestService({ guestRepository: repository });
  });

  describe('createGuest', () => {
    it('should create a guest', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phone: '+12025551234' });
      expect(guest.firstName).toBe('John');
      expect(guest.status).toBe('active');
    });
    it('should normalize email to lowercase', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'John.DOE@Example.com', phone: '+12025551234' });
      expect(guest.email).toBe('john.doe@example.com');
    });
    it('should normalize phone number', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+1 (202) 555-1234' });
      expect(guest.phone).toBe('+12025551234');
    });
    it('should accept optional userId', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', userId: USER_1 });
      expect(guest.userId).toBe(USER_1);
    });
    it('should accept preferences', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', preferences: { roomType: 'suite', floor: 'high' } });
      expect(guest.preferences.roomType).toBe('suite');
    });
    it('should accept tags', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', tags: ['frequent', 'business'] });
      expect(guest.tags).toContain('frequent');
    });
    it('should reject short first name', async () => {
      await expect(service.createGuest({ firstName: 'J', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' }))
        .rejects.toMatchObject({ code: 'INVALID_FIRST NAME' });
    });
    it('should reject short last name', async () => {
      await expect(service.createGuest({ firstName: 'John', lastName: 'D', email: 'john@example.com', phone: '+12025551234' }))
        .rejects.toMatchObject({ code: 'INVALID_LAST NAME' });
    });
    it('should reject invalid email', async () => {
      await expect(service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'invalid-email', phone: '+12025551234' }))
        .rejects.toMatchObject({ code: 'INVALID_EMAIL' });
    });
    it('should reject invalid phone', async () => {
      await expect(service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '123' }))
        .rejects.toMatchObject({ code: 'INVALID_PHONE' });
    });
    it('should reject invalid user ID', async () => {
      await expect(service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', userId: INVALID_UUID }))
        .rejects.toMatchObject({ code: 'INVALID_USER_ID' });
    });
    it('should reject duplicate email', async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await expect(service.createGuest({ firstName: 'Jane', lastName: 'Doe', email: 'john@example.com', phone: '+12025559999' }))
        .rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
    });
    it('should reject duplicate phone', async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await expect(service.createGuest({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+12025551234' }))
        .rejects.toMatchObject({ code: 'PHONE_EXISTS' });
    });
    it('should reject future date of birth', async () => {
      const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 1);
      await expect(service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', dateOfBirth: futureDate.toISOString() }))
        .rejects.toMatchObject({ code: 'INVALID_DATE_OF_BIRTH' });
    });
  });

  describe('getGuest', () => {
    it('should retrieve guest by ID', async () => {
      const created = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      const found = await service.getGuest(created.id);
      expect(found?.id).toBe(created.id);
    });
    it('should return null for non-existent guest', async () => {
      expect(await service.getGuest(USER_1)).toBeNull();
    });
    it('should reject invalid ID format', async () => {
      await expect(service.getGuest(INVALID_UUID)).rejects.toMatchObject({ code: 'INVALID_GUEST_ID' });
    });
  });

  describe('getGuestByEmail', () => {
    it('should find guest by email', async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      const found = await service.getGuestByEmail('john@example.com');
      expect(found?.firstName).toBe('John');
    });
    it('should be case-insensitive', async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      expect(await service.getGuestByEmail('JOHN@EXAMPLE.COM')).toBeDefined();
    });
    it('should reject invalid email', async () => {
      await expect(service.getGuestByEmail('invalid-email')).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
    });
  });

  describe('getGuestByPhone', () => {
    it('should find guest by phone', async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      expect((await service.getGuestByPhone('+12025551234'))?.firstName).toBe('John');
    });
    it('should reject invalid phone', async () => {
      await expect(service.getGuestByPhone('123')).rejects.toMatchObject({ code: 'INVALID_PHONE' });
    });
  });

  describe('getGuestByUserId', () => {
    it('should find guest by user ID', async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', userId: USER_1 });
      expect((await service.getGuestByUserId(USER_1))?.firstName).toBe('John');
    });
    it('should reject invalid user ID', async () => {
      await expect(service.getGuestByUserId(INVALID_UUID)).rejects.toMatchObject({ code: 'INVALID_USER_ID' });
    });
  });

  describe('updateGuest', () => {
    let guestId: string;
    beforeEach(async () => {
      guestId = (await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' })).id;
    });
    it('should update first name', async () => {
      expect((await service.updateGuest(guestId, { firstName: 'Johnny' })).firstName).toBe('Johnny');
    });
    it('should update email', async () => {
      expect((await service.updateGuest(guestId, { email: 'johnny@example.com' })).email).toBe('johnny@example.com');
    });
    it('should update preferences', async () => {
      expect((await service.updateGuest(guestId, { preferences: { roomType: 'suite' } })).preferences.roomType).toBe('suite');
    });
    it('should reject duplicate email on update', async () => {
      await service.createGuest({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+12025559999' });
      await expect(service.updateGuest(guestId, { email: 'jane@example.com' })).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
    });
    it('should reject non-existent guest', async () => {
      await expect(service.updateGuest(USER_2, { firstName: 'Test' })).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
    it('should reject invalid ID format', async () => {
      await expect(service.updateGuest(INVALID_UUID, { firstName: 'Test' })).rejects.toMatchObject({ code: 'INVALID_GUEST_ID' });
    });
  });

  describe('deleteGuest', () => {
    it('should delete guest', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await service.deleteGuest(guest.id);
      expect(await service.getGuest(guest.id)).toBeNull();
    });
    it('should reject non-existent guest', async () => {
      await expect(service.deleteGuest(USER_2)).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
    it('should reject invalid ID format', async () => {
      await expect(service.deleteGuest(INVALID_UUID)).rejects.toMatchObject({ code: 'INVALID_GUEST_ID' });
    });
  });

  describe('setStatus', () => {
    let guestId: string;
    beforeEach(async () => {
      guestId = (await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' })).id;
    });
    it('should set VIP status', async () => { expect((await service.setStatus(guestId, 'vip')).status).toBe('vip'); });
    it('should set inactive status', async () => { expect((await service.setStatus(guestId, 'inactive')).status).toBe('inactive'); });
    it('should set banned status', async () => { expect((await service.setStatus(guestId, 'banned')).status).toBe('banned'); });
    it('should reject invalid status', async () => {
      await expect(service.setStatus(guestId, 'invalid' as any)).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    });
    it('should reject non-existent guest', async () => {
      await expect(service.setStatus(USER_2, 'vip')).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
  });

  describe('recordVisit', () => {
    let guestId: string;
    beforeEach(async () => {
      guestId = (await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' })).id;
    });
    it('should increment stay count', async () => {
      expect((await service.recordVisit({ guestId, amountSpent: 500 })).totalStays).toBe(1);
    });
    it('should add to total spent', async () => {
      expect((await service.recordVisit({ guestId, amountSpent: 500 })).totalSpent).toBe(500);
    });
    it('should update last visit', async () => {
      expect((await service.recordVisit({ guestId, amountSpent: 500 })).lastVisit).toBeDefined();
    });
    it('should accumulate visits', async () => {
      await service.recordVisit({ guestId, amountSpent: 500 });
      const updated = await service.recordVisit({ guestId, amountSpent: 300 });
      expect(updated.totalStays).toBe(2);
      expect(updated.totalSpent).toBe(800);
    });
    it('should reject negative amount', async () => {
      await expect(service.recordVisit({ guestId, amountSpent: -100 })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });
    it('should reject non-existent guest', async () => {
      await expect(service.recordVisit({ guestId: USER_2, amountSpent: 500 })).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
  });

  describe('addTags', () => {
    let guestId: string;
    beforeEach(async () => {
      guestId = (await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' })).id;
    });
    it('should add tags', async () => {
      const updated = await service.addTags(guestId, ['vip', 'business']);
      expect(updated.tags).toContain('vip');
      expect(updated.tags).toContain('business');
    });
    it('should not duplicate existing tags', async () => {
      await service.addTags(guestId, ['vip']);
      const updated = await service.addTags(guestId, ['vip', 'business']);
      expect(updated.tags.filter(t => t === 'vip').length).toBe(1);
    });
    it('should reject empty tags array', async () => {
      await expect(service.addTags(guestId, [])).rejects.toMatchObject({ code: 'INVALID_TAGS' });
    });
    it('should reject non-existent guest', async () => {
      await expect(service.addTags(USER_2, ['vip'])).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
  });

  describe('removeTags', () => {
    let guestId: string;
    beforeEach(async () => {
      guestId = (await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', tags: ['vip', 'business', 'frequent'] })).id;
    });
    it('should remove tags', async () => {
      const updated = await service.removeTags(guestId, ['business']);
      expect(updated.tags).not.toContain('business');
      expect(updated.tags).toContain('vip');
    });
    it('should reject empty tags array', async () => {
      await expect(service.removeTags(guestId, [])).rejects.toMatchObject({ code: 'INVALID_TAGS' });
    });
    it('should reject non-existent guest', async () => {
      await expect(service.removeTags(USER_2, ['vip'])).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
  });

  describe('listGuests', () => {
    beforeEach(async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      const g2 = await service.createGuest({ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+12025559999' });
      await service.setStatus(g2.id, 'vip');
      await service.createGuest({ firstName: 'Bob', lastName: 'Wilson', email: 'bob@example.com', phone: '+12025558888', tags: ['business'] });
    });
    it('should return all guests', async () => { expect((await service.listGuests()).length).toBe(3); });
    it('should filter by status', async () => { expect((await service.listGuests({ status: 'vip' })).length).toBe(1); });
    it('should filter by tags', async () => { expect((await service.listGuests({ tags: ['business'] })).length).toBe(1); });
  });

  describe('searchGuests', () => {
    beforeEach(async () => {
      await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await service.createGuest({ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+12025559999' });
    });
    it('should search by first name', async () => { expect((await service.searchGuests('John')).length).toBe(1); });
    it('should search by last name', async () => { expect((await service.searchGuests('Smith')).length).toBe(1); });
    it('should search by email', async () => { expect((await service.searchGuests('jane@example')).length).toBe(1); });
    it('should return empty for no query', async () => { expect((await service.searchGuests('')).length).toBe(0); });
  });

  describe('getVipGuests', () => {
    it('should return only VIP guests', async () => {
      const g1 = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await service.setStatus(g1.id, 'vip');
      await service.createGuest({ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+12025559999' });
      const vips = await service.getVipGuests();
      expect(vips.length).toBe(1);
      expect(vips[0].firstName).toBe('John');
    });
  });

  describe('getStats', () => {
    it('should return empty stats with no guests', async () => {
      const stats = await service.getStats();
      expect(stats.totalGuests).toBe(0); expect(stats.activeGuests).toBe(0);
    });
    it('should count guests by status', async () => {
      const g1 = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await service.setStatus(g1.id, 'vip');
      await service.createGuest({ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+12025559999' });
      const stats = await service.getStats();
      expect(stats.totalGuests).toBe(2); expect(stats.vipGuests).toBe(1); expect(stats.activeGuests).toBe(1);
    });
    it('should calculate total revenue', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await service.recordVisit({ guestId: guest.id, amountSpent: 1000 });
      expect((await service.getStats()).totalRevenue).toBe(1000);
    });
  });

  describe('getStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getStatuses();
      expect(statuses).toContain('active'); expect(statuses).toContain('inactive');
      expect(statuses).toContain('vip'); expect(statuses).toContain('banned');
    });
  });

  describe('mergeProfiles', () => {
    it('should merge guest profiles', async () => {
      const primary = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234', tags: ['business'] });
      await service.recordVisit({ guestId: primary.id, amountSpent: 500 });
      const secondary = await service.createGuest({ firstName: 'John', lastName: 'D.', email: 'johnd@example.com', phone: '+12025559999', tags: ['vip'] });
      await service.recordVisit({ guestId: secondary.id, amountSpent: 300 });
      const merged = await service.mergeProfiles(primary.id, secondary.id);
      expect(merged.totalStays).toBe(2); expect(merged.totalSpent).toBe(800);
      expect(merged.tags).toContain('business'); expect(merged.tags).toContain('vip');
    });
    it('should delete secondary profile', async () => {
      const primary = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      const secondary = await service.createGuest({ firstName: 'John', lastName: 'D.', email: 'johnd@example.com', phone: '+12025559999' });
      await service.mergeProfiles(primary.id, secondary.id);
      expect(await service.getGuest(secondary.id)).toBeNull();
    });
    it('should reject merging with self', async () => {
      const guest = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await expect(service.mergeProfiles(guest.id, guest.id)).rejects.toMatchObject({ code: 'SAME_GUEST' });
    });
    it('should reject non-existent primary', async () => {
      const secondary = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await expect(service.mergeProfiles(USER_2, secondary.id)).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
    it('should reject non-existent secondary', async () => {
      const primary = await service.createGuest({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025551234' });
      await expect(service.mergeProfiles(primary.id, USER_2)).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
    });
  });
});
