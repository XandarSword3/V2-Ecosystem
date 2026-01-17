/**
 * In-Memory Channel Repository
 *
 * Test double for the Channel repository.
 */

import type {
  Channel,
  ChannelRate,
  ChannelReservation,
  ChannelFilters,
  ChannelRepository,
} from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryChannelRepository implements ChannelRepository {
  private channels: Map<string, Channel> = new Map();
  private rates: Map<string, ChannelRate> = new Map();
  private reservations: Map<string, ChannelReservation> = new Map();

  // Channel Operations
  async create(data: Omit<Channel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Channel> {
    const channel: Channel = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  async update(id: string, data: Partial<Channel>): Promise<Channel> {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error(`Channel not found: ${id}`);
    }
    const updated: Channel = {
      ...channel,
      ...data,
      id: channel.id,
      createdAt: channel.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.channels.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.channels.delete(id);
  }

  async getById(id: string): Promise<Channel | null> {
    return this.channels.get(id) || null;
  }

  async getByCode(code: string): Promise<Channel | null> {
    for (const channel of this.channels.values()) {
      if (channel.code === code) {
        return channel;
      }
    }
    return null;
  }

  async list(filters?: ChannelFilters): Promise<Channel[]> {
    let result = Array.from(this.channels.values());

    if (filters?.type) {
      result = result.filter(c => c.type === filters.type);
    }
    if (filters?.status) {
      result = result.filter(c => c.status === filters.status);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.code.toLowerCase().includes(search)
      );
    }

    return result;
  }

  // Rate Operations
  async createRate(data: Omit<ChannelRate, 'id' | 'createdAt'>): Promise<ChannelRate> {
    const rate: ChannelRate = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.rates.set(rate.id, rate);
    return rate;
  }

  async updateRate(id: string, data: Partial<ChannelRate>): Promise<ChannelRate> {
    const rate = this.rates.get(id);
    if (!rate) {
      throw new Error(`Rate not found: ${id}`);
    }
    const updated: ChannelRate = {
      ...rate,
      ...data,
      id: rate.id,
      createdAt: rate.createdAt,
    };
    this.rates.set(id, updated);
    return updated;
  }

  async deleteRate(id: string): Promise<void> {
    this.rates.delete(id);
  }

  async getRateById(id: string): Promise<ChannelRate | null> {
    return this.rates.get(id) || null;
  }

  async getRatesForChannel(channelId: string): Promise<ChannelRate[]> {
    return Array.from(this.rates.values()).filter(r => r.channelId === channelId);
  }

  // Reservation Operations
  async createReservation(data: Omit<ChannelReservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChannelReservation> {
    const reservation: ChannelReservation = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  async updateReservation(id: string, data: Partial<ChannelReservation>): Promise<ChannelReservation> {
    const reservation = this.reservations.get(id);
    if (!reservation) {
      throw new Error(`Reservation not found: ${id}`);
    }
    const updated: ChannelReservation = {
      ...reservation,
      ...data,
      id: reservation.id,
      createdAt: reservation.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.reservations.set(id, updated);
    return updated;
  }

  async getReservationById(id: string): Promise<ChannelReservation | null> {
    return this.reservations.get(id) || null;
  }

  async getReservationByRef(channelId: string, ref: string): Promise<ChannelReservation | null> {
    for (const reservation of this.reservations.values()) {
      if (reservation.channelId === channelId && reservation.channelBookingRef === ref) {
        return reservation;
      }
    }
    return null;
  }

  async listReservations(channelId: string): Promise<ChannelReservation[]> {
    return Array.from(this.reservations.values()).filter(r => r.channelId === channelId);
  }

  // Test helpers
  addChannel(channel: Channel): void {
    this.channels.set(channel.id, channel);
  }

  addRate(rate: ChannelRate): void {
    this.rates.set(rate.id, rate);
  }

  addReservation(reservation: ChannelReservation): void {
    this.reservations.set(reservation.id, reservation);
  }

  clear(): void {
    this.channels.clear();
    this.rates.clear();
    this.reservations.clear();
  }

  getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  getAllRates(): ChannelRate[] {
    return Array.from(this.rates.values());
  }

  getAllReservations(): ChannelReservation[] {
    return Array.from(this.reservations.values());
  }
}
