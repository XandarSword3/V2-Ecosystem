// ============================================
// Channels (OTA Distribution) Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type ChannelConnectionStatus = 'pending' | 'active' | 'paused' | 'error';

export interface ChannelConnection extends BaseEntity {
  propertyId: UUID;
  channelCode: string;  // BOOKING, EXPEDIA, AGODA, etc.
  channelName: string;
  status: ChannelConnectionStatus;
  apiKey?: string;
  apiSecret?: string;
  hotelCode?: string;
  connectionType: 'siteminder' | 'direct';
  siteminderPropertyId?: string;
  lastSyncAt?: Date;
  lastError?: string;
  errorCount: number;
  config: Record<string, unknown>;
}

export interface ChannelRoomMapping extends BaseEntity {
  connectionId: UUID;
  roomTypeId: UUID;
  channelRoomCode: string;
  channelRoomName?: string;
  isActive: boolean;
  config: Record<string, unknown>;
}

export interface ChannelRateMapping extends BaseEntity {
  connectionId: UUID;
  ratePlanId: UUID;
  channelRateCode: string;
  channelRateName?: string;
  isActive: boolean;
  markupType: 'percentage' | 'fixed';
  markupValue: number;
  commissionRate?: number;
  config: Record<string, unknown>;
}

export type ChannelSyncStatus = 'pending' | 'sent' | 'confirmed' | 'failed';

export interface ChannelAvailabilityUpdate {
  id: UUID;
  connectionId: UUID;
  roomMappingId: UUID;
  date: string; // ISO date
  availableUnits: number;
  status: ChannelSyncStatus;
  sentAt?: Date;
  confirmedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

export interface ChannelReservation extends BaseEntity {
  connectionId: UUID;
  reservationId?: UUID;
  channelBookingRef: string;
  channelGuestId?: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;  // ISO date
  checkOut: string;  // ISO date
  roomMappingId?: UUID;
  rateMappingId?: UUID;
  numAdults: number;
  numChildren: number;
  totalAmount: number;
  currency: string;
  commissionAmount?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  bookingStatus: 'new' | 'modified' | 'cancelled';
  specialRequests?: string;
  rawData?: Record<string, unknown>;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  receivedAt: Date;
}

export type ChannelSyncType = 'availability_push' | 'rate_push' | 'reservation_pull';
export type ChannelSyncDirection = 'inbound' | 'outbound';

export interface ChannelSyncLog {
  id: UUID;
  connectionId: UUID;
  syncType: ChannelSyncType;
  direction: ChannelSyncDirection;
  status: 'started' | 'success' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  durationMs?: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}
