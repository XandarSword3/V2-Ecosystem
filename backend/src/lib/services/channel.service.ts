/**
 * Channel/Distribution Service
 *
 * Manages booking channels, OTA integrations, and distribution.
 */

import type {
  Container,
  Channel,
  ChannelRate,
  ChannelReservation,
  ChannelFilters,
  ChannelType,
  ChannelStatus,
  ChannelCommissionType,
} from '../container/types.js';

// Error handling
export class ChannelServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ChannelServiceError';
  }
}

// Input types
export interface CreateChannelInput {
  name: string;
  type: ChannelType;
  code: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  commissionType?: ChannelCommissionType;
  commissionRate?: number;
  contractStart?: string;
  contractEnd?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateChannelInput {
  name?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  commissionType?: ChannelCommissionType;
  commissionRate?: number;
  contractStart?: string;
  contractEnd?: string;
  settings?: Record<string, unknown>;
}

export interface CreateRateInput {
  channelId: string;
  roomTypeId: string;
  baseRate: number;
  markup?: number;
  markupType?: 'percentage' | 'fixed';
  minStay?: number;
  maxStay?: number;
  validFrom: string;
  validTo: string;
}

export interface CreateReservationInput {
  channelId: string;
  channelBookingRef: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
}

export interface ChannelStats {
  totalChannels: number;
  activeChannels: number;
  totalReservations: number;
  totalRevenue: number;
  totalCommission: number;
  byType: Record<ChannelType, number>;
  byStatus: Record<ChannelStatus, number>;
}

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNEL_TYPES: ChannelType[] = ['direct', 'ota', 'gds', 'travel_agent', 'corporate', 'metasearch', 'other'];
const CHANNEL_STATUSES: ChannelStatus[] = ['active', 'inactive', 'suspended', 'pending'];
const COMMISSION_TYPES: ChannelCommissionType[] = ['percentage', 'fixed', 'tiered'];

export interface ChannelService {
  // Channel operations
  createChannel(input: CreateChannelInput): Promise<Channel>;
  getChannel(id: string): Promise<Channel | null>;
  getChannelByCode(code: string): Promise<Channel | null>;
  updateChannel(id: string, input: UpdateChannelInput): Promise<Channel>;
  deleteChannel(id: string): Promise<void>;
  listChannels(filters?: ChannelFilters): Promise<Channel[]>;
  
  // Status management
  activateChannel(id: string): Promise<Channel>;
  deactivateChannel(id: string): Promise<Channel>;
  suspendChannel(id: string, reason?: string): Promise<Channel>;
  
  // Rate management
  createRate(input: CreateRateInput): Promise<ChannelRate>;
  updateRate(id: string, data: Partial<ChannelRate>): Promise<ChannelRate>;
  deleteRate(id: string): Promise<void>;
  getChannelRates(channelId: string): Promise<ChannelRate[]>;
  calculateChannelPrice(channelId: string, roomTypeId: string, basePrice: number): Promise<number>;
  
  // Reservation management
  createReservation(input: CreateReservationInput): Promise<ChannelReservation>;
  confirmReservation(id: string, internalBookingId: string): Promise<ChannelReservation>;
  cancelReservation(id: string): Promise<ChannelReservation>;
  syncReservation(id: string): Promise<ChannelReservation>;
  getReservation(id: string): Promise<ChannelReservation | null>;
  getReservationByRef(channelId: string, ref: string): Promise<ChannelReservation | null>;
  getChannelReservations(channelId: string): Promise<ChannelReservation[]>;
  
  // Analytics
  getStats(): Promise<ChannelStats>;
  getChannelPerformance(channelId: string): Promise<{ reservations: number; revenue: number; commission: number }>;
  
  // Utilities
  getChannelTypes(): ChannelType[];
  getChannelStatuses(): ChannelStatus[];
  getCommissionTypes(): ChannelCommissionType[];
}

export function createChannelService(container: Container): ChannelService {
  const { channelRepository, logger } = container;

  // ============================================
  // CHANNEL OPERATIONS
  // ============================================
  async function createChannel(input: CreateChannelInput): Promise<Channel> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new ChannelServiceError('Channel name is required', 'INVALID_NAME');
    }

    // Validate type
    if (!CHANNEL_TYPES.includes(input.type)) {
      throw new ChannelServiceError('Invalid channel type', 'INVALID_TYPE');
    }

    // Validate code
    if (!input.code || input.code.trim().length === 0) {
      throw new ChannelServiceError('Channel code is required', 'INVALID_CODE');
    }

    // Check for duplicate code
    const existing = await channelRepository.getByCode(input.code);
    if (existing) {
      throw new ChannelServiceError('Channel code already exists', 'DUPLICATE_CODE');
    }

    // Validate commission rate
    if (input.commissionRate !== undefined && input.commissionRate < 0) {
      throw new ChannelServiceError('Commission rate cannot be negative', 'INVALID_COMMISSION_RATE');
    }

    // Validate commission type
    if (input.commissionType && !COMMISSION_TYPES.includes(input.commissionType)) {
      throw new ChannelServiceError('Invalid commission type', 'INVALID_COMMISSION_TYPE');
    }

    const channel = await channelRepository.create({
      name: input.name.trim(),
      type: input.type,
      status: 'pending',
      code: input.code.trim().toUpperCase(),
      description: input.description || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      commissionType: input.commissionType || 'percentage',
      commissionRate: input.commissionRate ?? 0,
      contractStart: input.contractStart || null,
      contractEnd: input.contractEnd || null,
      settings: input.settings || {},
    });

    logger?.info?.(`Channel created: ${channel.name} (${channel.code})`);
    return channel;
  }

  async function getChannel(id: string): Promise<Channel | null> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }
    return channelRepository.getById(id);
  }

  async function getChannelByCode(code: string): Promise<Channel | null> {
    return channelRepository.getByCode(code.toUpperCase());
  }

  async function updateChannel(id: string, input: UpdateChannelInput): Promise<Channel> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }

    const channel = await channelRepository.getById(id);
    if (!channel) {
      throw new ChannelServiceError('Channel not found', 'CHANNEL_NOT_FOUND', 404);
    }

    if (input.commissionRate !== undefined && input.commissionRate < 0) {
      throw new ChannelServiceError('Commission rate cannot be negative', 'INVALID_COMMISSION_RATE');
    }

    if (input.commissionType && !COMMISSION_TYPES.includes(input.commissionType)) {
      throw new ChannelServiceError('Invalid commission type', 'INVALID_COMMISSION_TYPE');
    }

    return channelRepository.update(id, input);
  }

  async function deleteChannel(id: string): Promise<void> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }

    const channel = await channelRepository.getById(id);
    if (!channel) {
      throw new ChannelServiceError('Channel not found', 'CHANNEL_NOT_FOUND', 404);
    }

    // Check for active reservations
    const reservations = await channelRepository.listReservations(id);
    const activeReservations = reservations.filter(r => r.status === 'pending' || r.status === 'confirmed');
    if (activeReservations.length > 0) {
      throw new ChannelServiceError('Cannot delete channel with active reservations', 'HAS_ACTIVE_RESERVATIONS');
    }

    await channelRepository.delete(id);
    logger?.info?.(`Channel deleted: ${channel.name} (${channel.code})`);
  }

  async function listChannels(filters?: ChannelFilters): Promise<Channel[]> {
    return channelRepository.list(filters);
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================
  async function activateChannel(id: string): Promise<Channel> {
    const channel = await getChannelOrThrow(id);

    if (channel.status === 'active') {
      throw new ChannelServiceError('Channel is already active', 'ALREADY_ACTIVE');
    }

    return channelRepository.update(id, { status: 'active' });
  }

  async function deactivateChannel(id: string): Promise<Channel> {
    const channel = await getChannelOrThrow(id);

    if (channel.status === 'inactive') {
      throw new ChannelServiceError('Channel is already inactive', 'ALREADY_INACTIVE');
    }

    return channelRepository.update(id, { status: 'inactive' });
  }

  async function suspendChannel(id: string, reason?: string): Promise<Channel> {
    const channel = await getChannelOrThrow(id);

    if (channel.status === 'suspended') {
      throw new ChannelServiceError('Channel is already suspended', 'ALREADY_SUSPENDED');
    }

    const settings = { ...channel.settings, suspendReason: reason, suspendedAt: new Date().toISOString() };
    return channelRepository.update(id, { status: 'suspended', settings });
  }

  // ============================================
  // RATE MANAGEMENT
  // ============================================
  async function createRate(input: CreateRateInput): Promise<ChannelRate> {
    if (!UUID_REGEX.test(input.channelId)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }

    const channel = await channelRepository.getById(input.channelId);
    if (!channel) {
      throw new ChannelServiceError('Channel not found', 'CHANNEL_NOT_FOUND', 404);
    }

    if (!UUID_REGEX.test(input.roomTypeId)) {
      throw new ChannelServiceError('Invalid room type ID format', 'INVALID_ROOM_TYPE_ID');
    }

    if (input.baseRate <= 0) {
      throw new ChannelServiceError('Base rate must be positive', 'INVALID_BASE_RATE');
    }

    if (input.minStay !== undefined && input.minStay < 1) {
      throw new ChannelServiceError('Minimum stay must be at least 1', 'INVALID_MIN_STAY');
    }

    if (input.maxStay !== undefined && input.maxStay < (input.minStay || 1)) {
      throw new ChannelServiceError('Maximum stay must be at least minimum stay', 'INVALID_MAX_STAY');
    }

    return channelRepository.createRate({
      channelId: input.channelId,
      roomTypeId: input.roomTypeId,
      baseRate: input.baseRate,
      markup: input.markup ?? 0,
      markupType: input.markupType || 'percentage',
      minStay: input.minStay ?? 1,
      maxStay: input.maxStay ?? 365,
      validFrom: input.validFrom,
      validTo: input.validTo,
      isActive: true,
    });
  }

  async function updateRate(id: string, data: Partial<ChannelRate>): Promise<ChannelRate> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid rate ID format', 'INVALID_RATE_ID');
    }

    const rate = await channelRepository.getRateById(id);
    if (!rate) {
      throw new ChannelServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    return channelRepository.updateRate(id, data);
  }

  async function deleteRate(id: string): Promise<void> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid rate ID format', 'INVALID_RATE_ID');
    }

    const rate = await channelRepository.getRateById(id);
    if (!rate) {
      throw new ChannelServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    await channelRepository.deleteRate(id);
  }

  async function getChannelRates(channelId: string): Promise<ChannelRate[]> {
    if (!UUID_REGEX.test(channelId)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }
    return channelRepository.getRatesForChannel(channelId);
  }

  async function calculateChannelPrice(channelId: string, roomTypeId: string, basePrice: number): Promise<number> {
    if (!UUID_REGEX.test(channelId)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }

    const channel = await channelRepository.getById(channelId);
    if (!channel) {
      throw new ChannelServiceError('Channel not found', 'CHANNEL_NOT_FOUND', 404);
    }

    // Get channel-specific rate
    const rates = await channelRepository.getRatesForChannel(channelId);
    const channelRate = rates.find(r => r.roomTypeId === roomTypeId && r.isActive);

    let price = basePrice;

    if (channelRate) {
      // Apply channel rate markup
      if (channelRate.markupType === 'percentage') {
        price = basePrice * (1 + channelRate.markup / 100);
      } else {
        price = basePrice + channelRate.markup;
      }
    }

    return Math.round(price * 100) / 100;
  }

  // ============================================
  // RESERVATION MANAGEMENT
  // ============================================
  async function createReservation(input: CreateReservationInput): Promise<ChannelReservation> {
    if (!UUID_REGEX.test(input.channelId)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }

    const channel = await channelRepository.getById(input.channelId);
    if (!channel) {
      throw new ChannelServiceError('Channel not found', 'CHANNEL_NOT_FOUND', 404);
    }

    if (channel.status !== 'active') {
      throw new ChannelServiceError('Channel is not active', 'CHANNEL_NOT_ACTIVE');
    }

    // Check for duplicate booking reference
    const existing = await channelRepository.getReservationByRef(input.channelId, input.channelBookingRef);
    if (existing) {
      throw new ChannelServiceError('Booking reference already exists', 'DUPLICATE_BOOKING_REF');
    }

    if (!input.guestName || input.guestName.trim().length === 0) {
      throw new ChannelServiceError('Guest name is required', 'INVALID_GUEST_NAME');
    }

    if (!input.guestEmail || !input.guestEmail.includes('@')) {
      throw new ChannelServiceError('Valid guest email is required', 'INVALID_GUEST_EMAIL');
    }

    if (input.totalAmount <= 0) {
      throw new ChannelServiceError('Total amount must be positive', 'INVALID_AMOUNT');
    }

    // Calculate commission
    let commissionAmount = 0;
    if (channel.commissionType === 'percentage') {
      commissionAmount = input.totalAmount * (channel.commissionRate / 100);
    } else if (channel.commissionType === 'fixed') {
      commissionAmount = channel.commissionRate;
    }

    return channelRepository.createReservation({
      channelId: input.channelId,
      channelBookingRef: input.channelBookingRef,
      internalBookingId: null,
      guestName: input.guestName.trim(),
      guestEmail: input.guestEmail.toLowerCase().trim(),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      totalAmount: input.totalAmount,
      commissionAmount: Math.round(commissionAmount * 100) / 100,
      status: 'pending',
      syncedAt: null,
    });
  }

  async function confirmReservation(id: string, internalBookingId: string): Promise<ChannelReservation> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid reservation ID format', 'INVALID_RESERVATION_ID');
    }

    if (!UUID_REGEX.test(internalBookingId)) {
      throw new ChannelServiceError('Invalid booking ID format', 'INVALID_BOOKING_ID');
    }

    const reservation = await channelRepository.getReservationById(id);
    if (!reservation) {
      throw new ChannelServiceError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
    }

    if (reservation.status === 'cancelled') {
      throw new ChannelServiceError('Cannot confirm cancelled reservation', 'INVALID_STATUS');
    }

    return channelRepository.updateReservation(id, {
      status: 'confirmed',
      internalBookingId,
      syncedAt: new Date().toISOString(),
    });
  }

  async function cancelReservation(id: string): Promise<ChannelReservation> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid reservation ID format', 'INVALID_RESERVATION_ID');
    }

    const reservation = await channelRepository.getReservationById(id);
    if (!reservation) {
      throw new ChannelServiceError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
    }

    if (reservation.status === 'cancelled') {
      throw new ChannelServiceError('Reservation is already cancelled', 'ALREADY_CANCELLED');
    }

    return channelRepository.updateReservation(id, {
      status: 'cancelled',
      syncedAt: new Date().toISOString(),
    });
  }

  async function syncReservation(id: string): Promise<ChannelReservation> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid reservation ID format', 'INVALID_RESERVATION_ID');
    }

    const reservation = await channelRepository.getReservationById(id);
    if (!reservation) {
      throw new ChannelServiceError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
    }

    return channelRepository.updateReservation(id, {
      syncedAt: new Date().toISOString(),
    });
  }

  async function getReservation(id: string): Promise<ChannelReservation | null> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid reservation ID format', 'INVALID_RESERVATION_ID');
    }
    return channelRepository.getReservationById(id);
  }

  async function getReservationByRef(channelId: string, ref: string): Promise<ChannelReservation | null> {
    if (!UUID_REGEX.test(channelId)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }
    return channelRepository.getReservationByRef(channelId, ref);
  }

  async function getChannelReservations(channelId: string): Promise<ChannelReservation[]> {
    if (!UUID_REGEX.test(channelId)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }
    return channelRepository.listReservations(channelId);
  }

  // ============================================
  // ANALYTICS
  // ============================================
  async function getStats(): Promise<ChannelStats> {
    const channels = await channelRepository.list();

    const byType: Record<ChannelType, number> = {
      direct: 0,
      ota: 0,
      gds: 0,
      travel_agent: 0,
      corporate: 0,
      metasearch: 0,
      other: 0,
    };

    const byStatus: Record<ChannelStatus, number> = {
      active: 0,
      inactive: 0,
      suspended: 0,
      pending: 0,
    };

    let totalRevenue = 0;
    let totalCommission = 0;
    let totalReservations = 0;

    for (const channel of channels) {
      byType[channel.type]++;
      byStatus[channel.status]++;

      const reservations = await channelRepository.listReservations(channel.id);
      totalReservations += reservations.length;

      for (const res of reservations) {
        if (res.status === 'confirmed') {
          totalRevenue += res.totalAmount;
          totalCommission += res.commissionAmount;
        }
      }
    }

    return {
      totalChannels: channels.length,
      activeChannels: byStatus.active,
      totalReservations,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      byType,
      byStatus,
    };
  }

  async function getChannelPerformance(channelId: string): Promise<{ reservations: number; revenue: number; commission: number }> {
    if (!UUID_REGEX.test(channelId)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }

    const reservations = await channelRepository.listReservations(channelId);
    const confirmed = reservations.filter(r => r.status === 'confirmed');

    const revenue = confirmed.reduce((sum, r) => sum + r.totalAmount, 0);
    const commission = confirmed.reduce((sum, r) => sum + r.commissionAmount, 0);

    return {
      reservations: reservations.length,
      revenue: Math.round(revenue * 100) / 100,
      commission: Math.round(commission * 100) / 100,
    };
  }

  // ============================================
  // UTILITIES
  // ============================================
  function getChannelTypes(): ChannelType[] {
    return [...CHANNEL_TYPES];
  }

  function getChannelStatuses(): ChannelStatus[] {
    return [...CHANNEL_STATUSES];
  }

  function getCommissionTypes(): ChannelCommissionType[] {
    return [...COMMISSION_TYPES];
  }

  // Helper function
  async function getChannelOrThrow(id: string): Promise<Channel> {
    if (!UUID_REGEX.test(id)) {
      throw new ChannelServiceError('Invalid channel ID format', 'INVALID_CHANNEL_ID');
    }

    const channel = await channelRepository.getById(id);
    if (!channel) {
      throw new ChannelServiceError('Channel not found', 'CHANNEL_NOT_FOUND', 404);
    }

    return channel;
  }

  return {
    createChannel,
    getChannel,
    getChannelByCode,
    updateChannel,
    deleteChannel,
    listChannels,
    activateChannel,
    deactivateChannel,
    suspendChannel,
    createRate,
    updateRate,
    deleteRate,
    getChannelRates,
    calculateChannelPrice,
    createReservation,
    confirmReservation,
    cancelReservation,
    syncReservation,
    getReservation,
    getReservationByRef,
    getChannelReservations,
    getStats,
    getChannelPerformance,
    getChannelTypes,
    getChannelStatuses,
    getCommissionTypes,
  };
}
