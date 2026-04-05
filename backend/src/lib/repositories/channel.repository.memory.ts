/**
 * In-Memory Channel Repository
 * Test double for ChannelRepository using in-memory data structures.
 */

import type {
  ChannelRepository,
  Channel,
  ChannelRate,
  ChannelReservation,
  ChannelFilters,
} from '../container/types.js';

export class InMemoryChannelRepository implements ChannelRepository {
  private channels = new Map<string, Channel>();
  private rates = new Map<string, ChannelRate>();
  private reservations = new Map<string, ChannelReservation>();

  reset() {
    this.channels.clear();
    this.rates.clear();
    this.reservations.clear();
  }

  // Channel operations
  async create(data: Omit<Channel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Channel> {
    const id = crypto.randomUUID();
    const channel: Channel = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.channels.set(id, channel);
    return channel;
  }

  async update(id: string, data: Partial<Channel>): Promise<Channel> {
    const existing = this.channels.get(id);
    if (!existing) throw new Error(`Channel ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.channels.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.channels.delete(id);
  }

  async getById(id: string): Promise<Channel | null> {
    return this.channels.get(id) ?? null;
  }

  async getByCode(code: string): Promise<Channel | null> {
    for (const c of this.channels.values()) {
      if (c.code === code) return c;
    }
    return null;
  }

  async list(filters?: ChannelFilters): Promise<Channel[]> {
    let result = [...this.channels.values()];
    if (filters?.type) result = result.filter(c => c.type === filters.type);
    if (filters?.status) result = result.filter(c => c.status === filters.status);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }
    return result;
  }

  // Rate operations
  async createRate(data: Omit<ChannelRate, 'id' | 'createdAt'>): Promise<ChannelRate> {
    const id = crypto.randomUUID();
    const rate: ChannelRate = { ...data, id, createdAt: new Date().toISOString() };
    this.rates.set(id, rate);
    return rate;
  }

  async updateRate(id: string, data: Partial<ChannelRate>): Promise<ChannelRate> {
    const existing = this.rates.get(id);
    if (!existing) throw new Error(`Rate ${id} not found`);
    const updated = { ...existing, ...data };
    this.rates.set(id, updated);
    return updated;
  }

  async deleteRate(id: string): Promise<void> {
    this.rates.delete(id);
  }

  async getRateById(id: string): Promise<ChannelRate | null> {
    return this.rates.get(id) ?? null;
  }

  async getRatesForChannel(channelId: string): Promise<ChannelRate[]> {
    return [...this.rates.values()].filter(r => r.channelId === channelId);
  }

  // Reservation operations
  async createReservation(data: Omit<ChannelReservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChannelReservation> {
    const id = crypto.randomUUID();
    const res: ChannelReservation = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.reservations.set(id, res);
    return res;
  }

  async updateReservation(id: string, data: Partial<ChannelReservation>): Promise<ChannelReservation> {
    const existing = this.reservations.get(id);
    if (!existing) throw new Error(`Reservation ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.reservations.set(id, updated);
    return updated;
  }

  async getReservationById(id: string): Promise<ChannelReservation | null> {
    return this.reservations.get(id) ?? null;
  }

  async getReservationByRef(channelId: string, ref: string): Promise<ChannelReservation | null> {
    for (const r of this.reservations.values()) {
      if (r.channelId === channelId && r.channelBookingRef === ref) return r;
    }
    return null;
  }

  async listReservations(channelId: string): Promise<ChannelReservation[]> {
    return [...this.reservations.values()].filter(r => r.channelId === channelId);
  }
}
