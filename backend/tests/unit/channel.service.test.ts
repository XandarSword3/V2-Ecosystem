/**
 * Channel Service Tests
 *
 * Unit tests for the Channel Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createChannelService, ChannelServiceError } from '../../src/lib/services/channel.service';
import { InMemoryChannelRepository } from '../../src/lib/repositories/channel.repository.memory';
import type { Container } from '../../src/lib/container/types';

// Test UUIDs
const CHANNEL_1 = '11111111-1111-1111-1111-111111111111';
const ROOM_TYPE_1 = '22222222-2222-2222-2222-222222222222';
const BOOKING_1 = '33333333-3333-3333-3333-333333333333';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(channelRepository: InMemoryChannelRepository): Container {
  return {
    channelRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

describe('ChannelService', () => {
  let repository: InMemoryChannelRepository;
  let container: Container;
  let service: ReturnType<typeof createChannelService>;

  beforeEach(() => {
    repository = new InMemoryChannelRepository();
    container = createMockContainer(repository);
    service = createChannelService(container);
  });

  // ============================================
  // CREATE CHANNEL TESTS
  // ============================================
  describe('createChannel', () => {
    it('should create a channel with required fields', async () => {
      const channel = await service.createChannel({
        name: 'Booking.com',
        type: 'ota',
        code: 'BCOM',
      });

      expect(channel).toBeDefined();
      expect(channel.name).toBe('Booking.com');
      expect(channel.type).toBe('ota');
      expect(channel.code).toBe('BCOM');
      expect(channel.status).toBe('pending');
    });

    it('should create a channel with commission settings', async () => {
      const channel = await service.createChannel({
        name: 'Expedia',
        type: 'ota',
        code: 'EXPD',
        commissionType: 'percentage',
        commissionRate: 15,
      });

      expect(channel.commissionType).toBe('percentage');
      expect(channel.commissionRate).toBe(15);
    });

    it('should create a direct channel', async () => {
      const channel = await service.createChannel({
        name: 'Website Direct',
        type: 'direct',
        code: 'WEB',
        commissionRate: 0,
      });

      expect(channel.type).toBe('direct');
      expect(channel.commissionRate).toBe(0);
    });

    it('should uppercase the channel code', async () => {
      const channel = await service.createChannel({
        name: 'Test Channel',
        type: 'other',
        code: 'test',
      });

      expect(channel.code).toBe('TEST');
    });

    it('should reject empty name', async () => {
      await expect(
        service.createChannel({
          name: '',
          type: 'ota',
          code: 'TEST',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_NAME',
      });
    });

    it('should reject invalid type', async () => {
      await expect(
        service.createChannel({
          name: 'Test',
          type: 'invalid' as any,
          code: 'TEST',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_TYPE',
      });
    });

    it('should reject empty code', async () => {
      await expect(
        service.createChannel({
          name: 'Test',
          type: 'ota',
          code: '',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CODE',
      });
    });

    it('should reject duplicate code', async () => {
      await service.createChannel({
        name: 'First Channel',
        type: 'ota',
        code: 'DUP',
      });

      await expect(
        service.createChannel({
          name: 'Second Channel',
          type: 'ota',
          code: 'DUP',
        })
      ).rejects.toMatchObject({
        code: 'DUPLICATE_CODE',
      });
    });

    it('should reject negative commission rate', async () => {
      await expect(
        service.createChannel({
          name: 'Test',
          type: 'ota',
          code: 'TEST',
          commissionRate: -5,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_COMMISSION_RATE',
      });
    });

    it('should reject invalid commission type', async () => {
      await expect(
        service.createChannel({
          name: 'Test',
          type: 'ota',
          code: 'TEST',
          commissionType: 'invalid' as any,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_COMMISSION_TYPE',
      });
    });
  });

  // ============================================
  // GET CHANNEL TESTS
  // ============================================
  describe('getChannel', () => {
    it('should retrieve channel by ID', async () => {
      const created = await service.createChannel({
        name: 'Test Channel',
        type: 'ota',
        code: 'TEST',
      });

      const found = await service.getChannel(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Test Channel');
    });

    it('should return null for non-existent channel', async () => {
      const found = await service.getChannel(CHANNEL_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getChannel(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_CHANNEL_ID',
      });
    });
  });

  describe('getChannelByCode', () => {
    it('should retrieve channel by code', async () => {
      await service.createChannel({
        name: 'Test Channel',
        type: 'ota',
        code: 'FINDME',
      });

      const found = await service.getChannelByCode('FINDME');
      expect(found).toBeDefined();
      expect(found?.code).toBe('FINDME');
    });

    it('should be case-insensitive', async () => {
      await service.createChannel({
        name: 'Test Channel',
        type: 'ota',
        code: 'UPPER',
      });

      const found = await service.getChannelByCode('upper');
      expect(found).toBeDefined();
    });
  });

  // ============================================
  // UPDATE CHANNEL TESTS
  // ============================================
  describe('updateChannel', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await service.createChannel({
        name: 'Original Name',
        type: 'ota',
        code: 'ORIG',
      });
      channelId = channel.id;
    });

    it('should update channel name', async () => {
      const updated = await service.updateChannel(channelId, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should update commission settings', async () => {
      const updated = await service.updateChannel(channelId, {
        commissionRate: 12,
        commissionType: 'percentage',
      });

      expect(updated.commissionRate).toBe(12);
    });

    it('should reject non-existent channel', async () => {
      await expect(
        service.updateChannel(CHANNEL_1, { name: 'New' })
      ).rejects.toMatchObject({
        code: 'CHANNEL_NOT_FOUND',
      });
    });

    it('should reject invalid channel ID', async () => {
      await expect(
        service.updateChannel(INVALID_UUID, { name: 'New' })
      ).rejects.toMatchObject({
        code: 'INVALID_CHANNEL_ID',
      });
    });
  });

  // ============================================
  // DELETE CHANNEL TESTS
  // ============================================
  describe('deleteChannel', () => {
    it('should delete channel', async () => {
      const channel = await service.createChannel({
        name: 'To Delete',
        type: 'ota',
        code: 'DEL',
      });

      await service.deleteChannel(channel.id);

      const found = await service.getChannel(channel.id);
      expect(found).toBeNull();
    });

    it('should reject non-existent channel', async () => {
      await expect(service.deleteChannel(CHANNEL_1)).rejects.toMatchObject({
        code: 'CHANNEL_NOT_FOUND',
      });
    });

    it('should reject channel with active reservations', async () => {
      const channel = await service.createChannel({
        name: 'With Reservation',
        type: 'ota',
        code: 'RES',
      });

      await service.activateChannel(channel.id);

      await service.createReservation({
        channelId: channel.id,
        channelBookingRef: 'REF001',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 500,
      });

      await expect(service.deleteChannel(channel.id)).rejects.toMatchObject({
        code: 'HAS_ACTIVE_RESERVATIONS',
      });
    });
  });

  // ============================================
  // STATUS MANAGEMENT TESTS
  // ============================================
  describe('activateChannel', () => {
    it('should activate channel', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'ACT',
      });

      const activated = await service.activateChannel(channel.id);
      expect(activated.status).toBe('active');
    });

    it('should reject already active channel', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'ACT2',
      });
      await service.activateChannel(channel.id);

      await expect(service.activateChannel(channel.id)).rejects.toMatchObject({
        code: 'ALREADY_ACTIVE',
      });
    });
  });

  describe('deactivateChannel', () => {
    it('should deactivate channel', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'DEACT',
      });
      await service.activateChannel(channel.id);

      const deactivated = await service.deactivateChannel(channel.id);
      expect(deactivated.status).toBe('inactive');
    });

    it('should reject already inactive channel', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'DEACT2',
      });
      await service.activateChannel(channel.id);
      await service.deactivateChannel(channel.id);

      await expect(service.deactivateChannel(channel.id)).rejects.toMatchObject({
        code: 'ALREADY_INACTIVE',
      });
    });
  });

  describe('suspendChannel', () => {
    it('should suspend channel with reason', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'SUSP',
      });
      await service.activateChannel(channel.id);

      const suspended = await service.suspendChannel(channel.id, 'Contract violation');
      expect(suspended.status).toBe('suspended');
      expect(suspended.settings).toHaveProperty('suspendReason', 'Contract violation');
    });

    it('should reject already suspended channel', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'SUSP2',
      });
      await service.activateChannel(channel.id);
      await service.suspendChannel(channel.id);

      await expect(service.suspendChannel(channel.id)).rejects.toMatchObject({
        code: 'ALREADY_SUSPENDED',
      });
    });
  });

  // ============================================
  // RATE MANAGEMENT TESTS
  // ============================================
  describe('createRate', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'RATE',
      });
      channelId = channel.id;
    });

    it('should create rate for channel', async () => {
      const rate = await service.createRate({
        channelId,
        roomTypeId: ROOM_TYPE_1,
        baseRate: 100,
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      });

      expect(rate).toBeDefined();
      expect(rate.baseRate).toBe(100);
      expect(rate.isActive).toBe(true);
    });

    it('should accept markup settings', async () => {
      const rate = await service.createRate({
        channelId,
        roomTypeId: ROOM_TYPE_1,
        baseRate: 100,
        markup: 10,
        markupType: 'percentage',
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      });

      expect(rate.markup).toBe(10);
      expect(rate.markupType).toBe('percentage');
    });

    it('should reject invalid channel ID', async () => {
      await expect(
        service.createRate({
          channelId: INVALID_UUID,
          roomTypeId: ROOM_TYPE_1,
          baseRate: 100,
          validFrom: '2024-01-01',
          validTo: '2024-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CHANNEL_ID',
      });
    });

    it('should reject non-existent channel', async () => {
      await expect(
        service.createRate({
          channelId: CHANNEL_1,
          roomTypeId: ROOM_TYPE_1,
          baseRate: 100,
          validFrom: '2024-01-01',
          validTo: '2024-12-31',
        })
      ).rejects.toMatchObject({
        code: 'CHANNEL_NOT_FOUND',
      });
    });

    it('should reject zero base rate', async () => {
      await expect(
        service.createRate({
          channelId,
          roomTypeId: ROOM_TYPE_1,
          baseRate: 0,
          validFrom: '2024-01-01',
          validTo: '2024-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_BASE_RATE',
      });
    });

    it('should reject invalid min stay', async () => {
      await expect(
        service.createRate({
          channelId,
          roomTypeId: ROOM_TYPE_1,
          baseRate: 100,
          minStay: 0,
          validFrom: '2024-01-01',
          validTo: '2024-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_MIN_STAY',
      });
    });

    it('should reject max stay less than min stay', async () => {
      await expect(
        service.createRate({
          channelId,
          roomTypeId: ROOM_TYPE_1,
          baseRate: 100,
          minStay: 5,
          maxStay: 3,
          validFrom: '2024-01-01',
          validTo: '2024-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_MAX_STAY',
      });
    });
  });

  describe('calculateChannelPrice', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'CALC',
      });
      channelId = channel.id;
    });

    it('should return base price when no rate configured', async () => {
      const price = await service.calculateChannelPrice(channelId, ROOM_TYPE_1, 100);
      expect(price).toBe(100);
    });

    it('should apply percentage markup', async () => {
      await service.createRate({
        channelId,
        roomTypeId: ROOM_TYPE_1,
        baseRate: 100,
        markup: 10,
        markupType: 'percentage',
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      });

      const price = await service.calculateChannelPrice(channelId, ROOM_TYPE_1, 100);
      expect(price).toBe(110);
    });

    it('should apply fixed markup', async () => {
      await service.createRate({
        channelId,
        roomTypeId: ROOM_TYPE_1,
        baseRate: 100,
        markup: 20,
        markupType: 'fixed',
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      });

      const price = await service.calculateChannelPrice(channelId, ROOM_TYPE_1, 100);
      expect(price).toBe(120);
    });
  });

  // ============================================
  // RESERVATION TESTS
  // ============================================
  describe('createReservation', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await service.createChannel({
        name: 'Booking.com',
        type: 'ota',
        code: 'BCOM',
        commissionType: 'percentage',
        commissionRate: 15,
      });
      await service.activateChannel(channel.id);
      channelId = channel.id;
    });

    it('should create reservation with commission', async () => {
      const reservation = await service.createReservation({
        channelId,
        channelBookingRef: 'BCOM123456',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 500,
      });

      expect(reservation).toBeDefined();
      expect(reservation.guestName).toBe('John Doe');
      expect(reservation.status).toBe('pending');
      expect(reservation.commissionAmount).toBe(75); // 15% of 500
    });

    it('should reject inactive channel', async () => {
      await service.deactivateChannel(channelId);

      await expect(
        service.createReservation({
          channelId,
          channelBookingRef: 'REF001',
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          checkIn: '2024-07-15',
          checkOut: '2024-07-18',
          totalAmount: 500,
        })
      ).rejects.toMatchObject({
        code: 'CHANNEL_NOT_ACTIVE',
      });
    });

    it('should reject duplicate booking reference', async () => {
      await service.createReservation({
        channelId,
        channelBookingRef: 'DUPREF',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 500,
      });

      await expect(
        service.createReservation({
          channelId,
          channelBookingRef: 'DUPREF',
          guestName: 'Jane Doe',
          guestEmail: 'jane@example.com',
          checkIn: '2024-07-20',
          checkOut: '2024-07-22',
          totalAmount: 300,
        })
      ).rejects.toMatchObject({
        code: 'DUPLICATE_BOOKING_REF',
      });
    });

    it('should reject empty guest name', async () => {
      await expect(
        service.createReservation({
          channelId,
          channelBookingRef: 'REF001',
          guestName: '',
          guestEmail: 'john@example.com',
          checkIn: '2024-07-15',
          checkOut: '2024-07-18',
          totalAmount: 500,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_NAME',
      });
    });

    it('should reject invalid email', async () => {
      await expect(
        service.createReservation({
          channelId,
          channelBookingRef: 'REF001',
          guestName: 'John Doe',
          guestEmail: 'invalid-email',
          checkIn: '2024-07-15',
          checkOut: '2024-07-18',
          totalAmount: 500,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_EMAIL',
      });
    });

    it('should reject non-positive amount', async () => {
      await expect(
        service.createReservation({
          channelId,
          channelBookingRef: 'REF001',
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          checkIn: '2024-07-15',
          checkOut: '2024-07-18',
          totalAmount: 0,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_AMOUNT',
      });
    });
  });

  describe('confirmReservation', () => {
    let channelId: string;
    let reservationId: string;

    beforeEach(async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'CONF',
      });
      await service.activateChannel(channel.id);
      channelId = channel.id;

      const reservation = await service.createReservation({
        channelId,
        channelBookingRef: 'REF001',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 500,
      });
      reservationId = reservation.id;
    });

    it('should confirm reservation', async () => {
      const confirmed = await service.confirmReservation(reservationId, BOOKING_1);

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.internalBookingId).toBe(BOOKING_1);
      expect(confirmed.syncedAt).toBeDefined();
    });

    it('should reject cancelled reservation', async () => {
      await service.cancelReservation(reservationId);

      await expect(
        service.confirmReservation(reservationId, BOOKING_1)
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  describe('cancelReservation', () => {
    it('should cancel reservation', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'CANC',
      });
      await service.activateChannel(channel.id);

      const reservation = await service.createReservation({
        channelId: channel.id,
        channelBookingRef: 'REF001',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 500,
      });

      const cancelled = await service.cancelReservation(reservation.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject already cancelled', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'CANC2',
      });
      await service.activateChannel(channel.id);

      const reservation = await service.createReservation({
        channelId: channel.id,
        channelBookingRef: 'REF001',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 500,
      });
      await service.cancelReservation(reservation.id);

      await expect(
        service.cancelReservation(reservation.id)
      ).rejects.toMatchObject({
        code: 'ALREADY_CANCELLED',
      });
    });
  });

  // ============================================
  // LIST AND FILTER TESTS
  // ============================================
  describe('listChannels', () => {
    beforeEach(async () => {
      await service.createChannel({ name: 'Direct', type: 'direct', code: 'DIR' });
      await service.createChannel({ name: 'Booking.com', type: 'ota', code: 'BCOM' });
      await service.createChannel({ name: 'Expedia', type: 'ota', code: 'EXPD' });
    });

    it('should return all channels', async () => {
      const channels = await service.listChannels();
      expect(channels.length).toBe(3);
    });

    it('should filter by type', async () => {
      const channels = await service.listChannels({ type: 'ota' });
      expect(channels.length).toBe(2);
    });

    it('should filter by search', async () => {
      const channels = await service.listChannels({ search: 'booking' });
      expect(channels.length).toBe(1);
      expect(channels[0].code).toBe('BCOM');
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats', async () => {
      const stats = await service.getStats();

      expect(stats.totalChannels).toBe(0);
      expect(stats.activeChannels).toBe(0);
      expect(stats.totalRevenue).toBe(0);
    });

    it('should count channels by type and status', async () => {
      const channel = await service.createChannel({
        name: 'OTA Channel',
        type: 'ota',
        code: 'OTA1',
        commissionType: 'percentage',
        commissionRate: 10,
      });
      await service.activateChannel(channel.id);

      const stats = await service.getStats();

      expect(stats.totalChannels).toBe(1);
      expect(stats.activeChannels).toBe(1);
      expect(stats.byType.ota).toBe(1);
      expect(stats.byStatus.active).toBe(1);
    });

    it('should calculate revenue and commission from confirmed reservations', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'TEST',
        commissionType: 'percentage',
        commissionRate: 10,
      });
      await service.activateChannel(channel.id);

      const reservation = await service.createReservation({
        channelId: channel.id,
        channelBookingRef: 'REF001',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 500,
      });
      await service.confirmReservation(reservation.id, BOOKING_1);

      const stats = await service.getStats();

      expect(stats.totalReservations).toBe(1);
      expect(stats.totalRevenue).toBe(500);
      expect(stats.totalCommission).toBe(50);
    });
  });

  describe('getChannelPerformance', () => {
    it('should return channel performance', async () => {
      const channel = await service.createChannel({
        name: 'Test',
        type: 'ota',
        code: 'PERF',
        commissionType: 'percentage',
        commissionRate: 15,
      });
      await service.activateChannel(channel.id);

      const reservation = await service.createReservation({
        channelId: channel.id,
        channelBookingRef: 'REF001',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2024-07-15',
        checkOut: '2024-07-18',
        totalAmount: 1000,
      });
      await service.confirmReservation(reservation.id, BOOKING_1);

      const performance = await service.getChannelPerformance(channel.id);

      expect(performance.reservations).toBe(1);
      expect(performance.revenue).toBe(1000);
      expect(performance.commission).toBe(150);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getChannelTypes', () => {
    it('should return all channel types', () => {
      const types = service.getChannelTypes();

      expect(types).toContain('direct');
      expect(types).toContain('ota');
      expect(types).toContain('gds');
      expect(types).toContain('travel_agent');
      expect(types).toContain('corporate');
      expect(types).toContain('metasearch');
    });
  });

  describe('getChannelStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getChannelStatuses();

      expect(statuses).toContain('active');
      expect(statuses).toContain('inactive');
      expect(statuses).toContain('suspended');
      expect(statuses).toContain('pending');
    });
  });

  describe('getCommissionTypes', () => {
    it('should return all commission types', () => {
      const types = service.getCommissionTypes();

      expect(types).toContain('percentage');
      expect(types).toContain('fixed');
      expect(types).toContain('tiered');
    });
  });
});
