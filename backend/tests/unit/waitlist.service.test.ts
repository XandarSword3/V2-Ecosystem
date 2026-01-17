/**
 * Waitlist Service Tests
 *
 * Unit tests for the Waitlist Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWaitlistService, WaitlistServiceError } from '../../src/lib/services/waitlist.service';
import { InMemoryWaitlistRepository } from '../../src/lib/repositories/waitlist.repository.memory';
import type { Container, WaitlistEntry } from '../../src/lib/container/types';

// Test UUIDs
const ENTRY_1 = '11111111-1111-1111-1111-111111111111';
const ENTRY_2 = '22222222-2222-2222-2222-222222222222';
const TABLE_ID = '33333333-3333-3333-3333-333333333333';
const INVALID_UUID = 'not-a-valid-uuid';

// Test phones
const PHONE_1 = '+15551234567';
const PHONE_2 = '+15559876543';

function createMockContainer(waitlistRepository: InMemoryWaitlistRepository): Container {
  return {
    waitlistRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

function createTestEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  const now = new Date().toISOString();
  return {
    id: ENTRY_1,
    guestName: 'John Doe',
    guestPhone: '+15551234567',
    guestEmail: 'john@example.com',
    partySize: 4,
    priority: 'normal',
    status: 'waiting',
    estimatedWaitMinutes: 30,
    notifiedAt: null,
    seatedAt: null,
    tableId: null,
    notes: null,
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

describe('WaitlistService', () => {
  let repository: InMemoryWaitlistRepository;
  let container: Container;
  let service: ReturnType<typeof createWaitlistService>;

  beforeEach(() => {
    repository = new InMemoryWaitlistRepository();
    container = createMockContainer(repository);
    service = createWaitlistService(container);
  });

  // ============================================
  // ADD TO WAITLIST TESTS
  // ============================================
  describe('addToWaitlist', () => {
    it('should add a guest to the waitlist', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 4,
      });

      expect(entry).toBeDefined();
      expect(entry.guestName).toBe('John Doe');
      expect(entry.partySize).toBe(4);
      expect(entry.status).toBe('waiting');
    });

    it('should set default priority to normal', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Jane Doe',
        guestPhone: '+15559876543',
        partySize: 2,
      });

      expect(entry.priority).toBe('normal');
    });

    it('should accept VIP priority', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'VIP Guest',
        guestPhone: '+15551111111',
        partySize: 2,
        priority: 'vip',
      });

      expect(entry.priority).toBe('vip');
    });

    it('should accept reservation priority', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Reserved Guest',
        guestPhone: '+15552222222',
        partySize: 6,
        priority: 'reservation',
      });

      expect(entry.priority).toBe('reservation');
    });

    it('should normalize phone numbers', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Phone Test',
        guestPhone: '+1 (555) 123-4567',
        partySize: 2,
      });

      expect(entry.guestPhone).toBe('+15551234567');
    });

    it('should store optional email', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Email Test',
        guestPhone: '+15553333333',
        guestEmail: 'test@example.com',
        partySize: 2,
      });

      expect(entry.guestEmail).toBe('test@example.com');
    });

    it('should store notes', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Notes Test',
        guestPhone: '+15554444444',
        partySize: 2,
        notes: 'Birthday celebration',
      });

      expect(entry.notes).toBe('Birthday celebration');
    });

    it('should estimate wait time', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Wait Test',
        guestPhone: '+15555555555',
        partySize: 2,
      });

      expect(entry.estimatedWaitMinutes).toBeDefined();
      expect(typeof entry.estimatedWaitMinutes).toBe('number');
    });

    it('should reject empty guest name', async () => {
      await expect(
        service.addToWaitlist({
          guestName: '',
          guestPhone: '+15551234567',
          partySize: 2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_NAME',
      });
    });

    it('should reject whitespace-only guest name', async () => {
      await expect(
        service.addToWaitlist({
          guestName: '   ',
          guestPhone: '+15551234567',
          partySize: 2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_NAME',
      });
    });

    it('should reject guest name too short', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'A',
          guestPhone: '+15551234567',
          partySize: 2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_NAME',
      });
    });

    it('should reject guest name too long', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'A'.repeat(101),
          guestPhone: '+15551234567',
          partySize: 2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_NAME',
      });
    });

    it('should reject invalid phone number', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'Phone Test',
          guestPhone: 'invalid',
          partySize: 2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PHONE',
      });
    });

    it('should reject invalid email format', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'Email Test',
          guestPhone: '+15551234567',
          guestEmail: 'not-an-email',
          partySize: 2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_EMAIL',
      });
    });

    it('should reject zero party size', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'Party Test',
          guestPhone: '+15551234567',
          partySize: 0,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PARTY_SIZE',
      });
    });

    it('should reject negative party size', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'Party Test',
          guestPhone: '+15551234567',
          partySize: -1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PARTY_SIZE',
      });
    });

    it('should reject party size over maximum', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'Party Test',
          guestPhone: '+15551234567',
          partySize: 21,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PARTY_SIZE',
      });
    });

    it('should reject non-integer party size', async () => {
      await expect(
        service.addToWaitlist({
          guestName: 'Party Test',
          guestPhone: '+15551234567',
          partySize: 2.5,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PARTY_SIZE',
      });
    });

    it('should reject duplicate entry for same phone', async () => {
      await service.addToWaitlist({
        guestName: 'First Guest',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await expect(
        service.addToWaitlist({
          guestName: 'Same Phone',
          guestPhone: '+15551234567',
          partySize: 4,
        })
      ).rejects.toMatchObject({
        code: 'DUPLICATE_ENTRY',
      });
    });

    it('should allow same phone after previous entry seated', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'First Guest',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      const newEntry = await service.addToWaitlist({
        guestName: 'Same Phone Again',
        guestPhone: '+15551234567',
        partySize: 4,
      });

      expect(newEntry.guestPhone).toBe('+15551234567');
    });
  });

  // ============================================
  // GET ENTRY TESTS
  // ============================================
  describe('getEntry', () => {
    it('should retrieve entry by ID', async () => {
      const created = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 4,
      });

      const found = await service.getEntry(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent entry', async () => {
      const found = await service.getEntry(ENTRY_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getEntry(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // UPDATE ENTRY TESTS
  // ============================================
  describe('updateEntry', () => {
    let entryId: string;

    beforeEach(async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 4,
      });
      entryId = entry.id;
    });

    it('should update guest name', async () => {
      const updated = await service.updateEntry(entryId, {
        guestName: 'Jane Doe',
      });

      expect(updated.guestName).toBe('Jane Doe');
    });

    it('should update phone number', async () => {
      const updated = await service.updateEntry(entryId, {
        guestPhone: '+15559876543',
      });

      expect(updated.guestPhone).toBe('+15559876543');
    });

    it('should update party size', async () => {
      const updated = await service.updateEntry(entryId, {
        partySize: 6,
      });

      expect(updated.partySize).toBe(6);
    });

    it('should update priority', async () => {
      const updated = await service.updateEntry(entryId, {
        priority: 'vip',
      });

      expect(updated.priority).toBe('vip');
    });

    it('should update notes', async () => {
      const updated = await service.updateEntry(entryId, {
        notes: 'Special occasion',
      });

      expect(updated.notes).toBe('Special occasion');
    });

    it('should reject update for non-existent entry', async () => {
      await expect(
        service.updateEntry(ENTRY_2, { guestName: 'Test' })
      ).rejects.toMatchObject({
        code: 'ENTRY_NOT_FOUND',
      });
    });

    it('should reject update for seated entry', async () => {
      await service.seatGuest(entryId, { tableId: TABLE_ID });

      await expect(
        service.updateEntry(entryId, { partySize: 6 })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject update for cancelled entry', async () => {
      await service.cancelEntry(entryId);

      await expect(
        service.updateEntry(entryId, { partySize: 6 })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid party size', async () => {
      await expect(
        service.updateEntry(entryId, { partySize: 0 })
      ).rejects.toMatchObject({
        code: 'INVALID_PARTY_SIZE',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.updateEntry(INVALID_UUID, { guestName: 'Test' })
      ).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // REMOVE FROM WAITLIST TESTS
  // ============================================
  describe('removeFromWaitlist', () => {
    it('should remove entry from waitlist', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'To Remove',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.removeFromWaitlist(entry.id);

      const found = await service.getEntry(entry.id);
      expect(found).toBeNull();
    });

    it('should reject removal of non-existent entry', async () => {
      await expect(service.removeFromWaitlist(ENTRY_1)).rejects.toMatchObject({
        code: 'ENTRY_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.removeFromWaitlist(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // GET POSITION TESTS
  // ============================================
  describe('getPosition', () => {
    it('should return position for waiting entry', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      const position = await service.getPosition(entry.id);

      expect(position.position).toBe(1);
      expect(position.partiesAhead).toBe(0);
      expect(position.estimatedWaitMinutes).toBeDefined();
    });

    it('should return correct position for multiple entries', async () => {
      await service.addToWaitlist({
        guestName: 'First',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      const second = await service.addToWaitlist({
        guestName: 'Second',
        guestPhone: '+15552222222',
        partySize: 2,
      });

      await service.addToWaitlist({
        guestName: 'Third',
        guestPhone: '+15553333333',
        partySize: 2,
      });

      const position = await service.getPosition(second.id);
      expect(position.position).toBe(2);
      expect(position.partiesAhead).toBe(1);
    });

    it('should prioritize VIP entries', async () => {
      const normal = await service.addToWaitlist({
        guestName: 'Normal Guest',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      const vip = await service.addToWaitlist({
        guestName: 'VIP Guest',
        guestPhone: '+15552222222',
        partySize: 2,
        priority: 'vip',
      });

      const vipPosition = await service.getPosition(vip.id);
      const normalPosition = await service.getPosition(normal.id);

      expect(vipPosition.position).toBe(1); // VIP should be first
      expect(normalPosition.position).toBe(2);
    });

    it('should reject non-existent entry', async () => {
      await expect(service.getPosition(ENTRY_1)).rejects.toMatchObject({
        code: 'ENTRY_NOT_FOUND',
      });
    });

    it('should reject seated entry', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      await expect(service.getPosition(entry.id)).rejects.toMatchObject({
        code: 'NOT_IN_QUEUE',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getPosition(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // NOTIFY GUEST TESTS
  // ============================================
  describe('notifyGuest', () => {
    it('should notify waiting guest', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      const notified = await service.notifyGuest(entry.id);

      expect(notified.status).toBe('notified');
      expect(notified.notifiedAt).toBeDefined();
    });

    it('should reject notifying already notified guest', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.notifyGuest(entry.id);

      await expect(service.notifyGuest(entry.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject notifying seated guest', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      await expect(service.notifyGuest(entry.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent entry', async () => {
      await expect(service.notifyGuest(ENTRY_1)).rejects.toMatchObject({
        code: 'ENTRY_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.notifyGuest(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // SEAT GUEST TESTS
  // ============================================
  describe('seatGuest', () => {
    it('should seat waiting guest', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      const seated = await service.seatGuest(entry.id, { tableId: TABLE_ID });

      expect(seated.status).toBe('seated');
      expect(seated.tableId).toBe(TABLE_ID);
      expect(seated.seatedAt).toBeDefined();
    });

    it('should seat notified guest', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.notifyGuest(entry.id);

      const seated = await service.seatGuest(entry.id, { tableId: TABLE_ID });

      expect(seated.status).toBe('seated');
    });

    it('should reject seating already seated guest', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      await expect(
        service.seatGuest(entry.id, { tableId: TABLE_ID })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject seating cancelled entry', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.cancelEntry(entry.id);

      await expect(
        service.seatGuest(entry.id, { tableId: TABLE_ID })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid table ID', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await expect(
        service.seatGuest(entry.id, { tableId: INVALID_UUID })
      ).rejects.toMatchObject({
        code: 'INVALID_TABLE_ID',
      });
    });

    it('should reject non-existent entry', async () => {
      await expect(
        service.seatGuest(ENTRY_1, { tableId: TABLE_ID })
      ).rejects.toMatchObject({
        code: 'ENTRY_NOT_FOUND',
      });
    });

    it('should reject invalid entry ID format', async () => {
      await expect(
        service.seatGuest(INVALID_UUID, { tableId: TABLE_ID })
      ).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // MARK NO SHOW TESTS
  // ============================================
  describe('markNoShow', () => {
    it('should mark notified guest as no-show', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.notifyGuest(entry.id);

      const noShow = await service.markNoShow(entry.id);

      expect(noShow.status).toBe('no_show');
    });

    it('should reject marking waiting guest as no-show', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await expect(service.markNoShow(entry.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject marking seated guest as no-show', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      await expect(service.markNoShow(entry.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent entry', async () => {
      await expect(service.markNoShow(ENTRY_1)).rejects.toMatchObject({
        code: 'ENTRY_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.markNoShow(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // CANCEL ENTRY TESTS
  // ============================================
  describe('cancelEntry', () => {
    it('should cancel waiting entry', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      const cancelled = await service.cancelEntry(entry.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should cancel notified entry', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.notifyGuest(entry.id);

      const cancelled = await service.cancelEntry(entry.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject cancelling seated entry', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      await expect(service.cancelEntry(entry.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject cancelling already cancelled entry', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.cancelEntry(entry.id);

      await expect(service.cancelEntry(entry.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent entry', async () => {
      await expect(service.cancelEntry(ENTRY_1)).rejects.toMatchObject({
        code: 'ENTRY_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.cancelEntry(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ENTRY_ID',
      });
    });
  });

  // ============================================
  // GET QUEUE TESTS
  // ============================================
  describe('getQueue', () => {
    beforeEach(async () => {
      await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.addToWaitlist({
        guestName: 'Guest 2',
        guestPhone: '+15552222222',
        partySize: 4,
        priority: 'vip',
      });

      await service.addToWaitlist({
        guestName: 'Guest 3',
        guestPhone: '+15553333333',
        partySize: 6,
      });
    });

    it('should return all entries', async () => {
      const queue = await service.getQueue();
      expect(queue.length).toBe(3);
    });

    it('should filter by status', async () => {
      const queue = await service.getQueue({ status: 'waiting' });
      expect(queue.length).toBe(3);
    });

    it('should filter by priority', async () => {
      const queue = await service.getQueue({ priority: 'vip' });
      expect(queue.length).toBe(1);
      expect(queue[0].guestName).toBe('Guest 2');
    });

    it('should filter by minimum party size', async () => {
      const queue = await service.getQueue({ minPartySize: 4 });
      expect(queue.length).toBe(2);
    });

    it('should filter by maximum party size', async () => {
      const queue = await service.getQueue({ maxPartySize: 3 });
      expect(queue.length).toBe(1);
    });

    it('should return sorted by priority then time', async () => {
      const queue = await service.getQueue();
      expect(queue[0].priority).toBe('vip');
    });
  });

  // ============================================
  // GET NEXT IN QUEUE TESTS
  // ============================================
  describe('getNextInQueue', () => {
    it('should return null for empty queue', async () => {
      const next = await service.getNextInQueue();
      expect(next).toBeNull();
    });

    it('should return first waiting entry', async () => {
      await service.addToWaitlist({
        guestName: 'First',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      const next = await service.getNextInQueue();
      expect(next?.guestName).toBe('First');
    });

    it('should return VIP first', async () => {
      await service.addToWaitlist({
        guestName: 'Normal',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.addToWaitlist({
        guestName: 'VIP',
        guestPhone: '+15552222222',
        partySize: 2,
        priority: 'vip',
      });

      const next = await service.getNextInQueue();
      expect(next?.guestName).toBe('VIP');
    });
  });

  // ============================================
  // GET WAITING COUNT TESTS
  // ============================================
  describe('getWaitingCount', () => {
    it('should return 0 for empty queue', async () => {
      const count = await service.getWaitingCount();
      expect(count).toBe(0);
    });

    it('should return count of waiting entries', async () => {
      await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.addToWaitlist({
        guestName: 'Guest 2',
        guestPhone: '+15552222222',
        partySize: 2,
      });

      const count = await service.getWaitingCount();
      expect(count).toBe(2);
    });

    it('should not count seated entries', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      const count = await service.getWaitingCount();
      expect(count).toBe(0);
    });
  });

  // ============================================
  // GET ACTIVE ENTRY BY PHONE TESTS
  // ============================================
  describe('getActiveEntryByPhone', () => {
    it('should return null for no active entry', async () => {
      const entry = await service.getActiveEntryByPhone('+15551234567');
      expect(entry).toBeNull();
    });

    it('should find waiting entry', async () => {
      await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      const entry = await service.getActiveEntryByPhone('+15551234567');
      expect(entry).toBeDefined();
      expect(entry?.guestName).toBe('John Doe');
    });

    it('should find notified entry', async () => {
      const created = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.notifyGuest(created.id);

      const entry = await service.getActiveEntryByPhone('+15551234567');
      expect(entry?.status).toBe('notified');
    });

    it('should not find seated entry', async () => {
      const created = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      await service.seatGuest(created.id, { tableId: TABLE_ID });

      const entry = await service.getActiveEntryByPhone('+15551234567');
      expect(entry).toBeNull();
    });

    it('should normalize phone number in search', async () => {
      await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      const entry = await service.getActiveEntryByPhone('+1 (555) 123-4567');
      expect(entry).toBeDefined();
    });
  });

  // ============================================
  // ESTIMATE WAIT TIME TESTS
  // ============================================
  describe('estimateWaitTime', () => {
    it('should return 0 for empty queue', async () => {
      const wait = await service.estimateWaitTime(2);
      expect(wait).toBe(0);
    });

    it('should increase with queue size', async () => {
      await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.addToWaitlist({
        guestName: 'Guest 2',
        guestPhone: '+15552222222',
        partySize: 2,
      });

      const wait = await service.estimateWaitTime(2);
      expect(wait).toBeGreaterThan(0);
    });

    it('should increase for larger party size', async () => {
      const smallParty = await service.estimateWaitTime(2);
      const largeParty = await service.estimateWaitTime(8);

      expect(largeParty).toBeGreaterThan(smallParty);
    });
  });

  // ============================================
  // GET STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats for no entries', async () => {
      const stats = await service.getStats();

      expect(stats.totalWaiting).toBe(0);
      expect(stats.averageWaitMinutes).toBe(0);
      expect(stats.seatedToday).toBe(0);
      expect(stats.noShowsToday).toBe(0);
      expect(stats.cancelledToday).toBe(0);
    });

    it('should count waiting entries', async () => {
      await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.addToWaitlist({
        guestName: 'Guest 2',
        guestPhone: '+15552222222',
        partySize: 2,
      });

      const stats = await service.getStats();
      expect(stats.totalWaiting).toBe(2);
    });

    it('should count seated today', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.seatGuest(entry.id, { tableId: TABLE_ID });

      const stats = await service.getStats();
      expect(stats.seatedToday).toBe(1);
    });

    it('should count cancelled today', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.cancelEntry(entry.id);

      const stats = await service.getStats();
      expect(stats.cancelledToday).toBe(1);
    });

    it('should count no-shows today', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Guest 1',
        guestPhone: '+15551111111',
        partySize: 2,
      });

      await service.notifyGuest(entry.id);
      await service.markNoShow(entry.id);

      const stats = await service.getStats();
      expect(stats.noShowsToday).toBe(1);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getStatuses', () => {
    it('should return all valid statuses', () => {
      const statuses = service.getStatuses();

      expect(statuses).toContain('waiting');
      expect(statuses).toContain('notified');
      expect(statuses).toContain('seated');
      expect(statuses).toContain('cancelled');
      expect(statuses).toContain('no_show');
    });
  });

  describe('getPriorities', () => {
    it('should return all valid priorities', () => {
      const priorities = service.getPriorities();

      expect(priorities).toContain('normal');
      expect(priorities).toContain('vip');
      expect(priorities).toContain('reservation');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe('Edge Cases', () => {
    it('should handle max party size', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Large Party',
        guestPhone: '+15551234567',
        partySize: 20,
      });

      expect(entry.partySize).toBe(20);
    });

    it('should handle min party size', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'Single Guest',
        guestPhone: '+15551234567',
        partySize: 1,
      });

      expect(entry.partySize).toBe(1);
    });

    it('should trim whitespace from guest name', async () => {
      const entry = await service.addToWaitlist({
        guestName: '  John Doe  ',
        guestPhone: '+15551234567',
        partySize: 2,
      });

      expect(entry.guestName).toBe('John Doe');
    });

    it('should trim whitespace from notes', async () => {
      const entry = await service.addToWaitlist({
        guestName: 'John Doe',
        guestPhone: '+15551234567',
        partySize: 2,
        notes: '  Special request  ',
      });

      expect(entry.notes).toBe('Special request');
    });
  });
});
