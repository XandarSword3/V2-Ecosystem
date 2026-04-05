/**
 * In-Memory Guest Repository
 * Test double for GuestRepository using in-memory data structures.
 */

import type {
  GuestRepository,
  GuestProfile,
  GuestFilters,
} from '../container/types.js';

export class InMemoryGuestRepository implements GuestRepository {
  private guests = new Map<string, GuestProfile>();

  reset() {
    this.guests.clear();
  }

  async create(data: Omit<GuestProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<GuestProfile> {
    const id = crypto.randomUUID();
    const guest: GuestProfile = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.guests.set(id, guest);
    return guest;
  }

  async update(id: string, data: Partial<GuestProfile>): Promise<GuestProfile> {
    const existing = this.guests.get(id);
    if (!existing) throw new Error(`Guest ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.guests.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.guests.delete(id);
  }

  async getById(id: string): Promise<GuestProfile | null> {
    return this.guests.get(id) ?? null;
  }

  async getByEmail(email: string): Promise<GuestProfile | null> {
    for (const g of this.guests.values()) {
      if (g.email === email) return g;
    }
    return null;
  }

  async getByPhone(phone: string): Promise<GuestProfile | null> {
    for (const g of this.guests.values()) {
      if (g.phone === phone) return g;
    }
    return null;
  }

  async getByUserId(userId: string): Promise<GuestProfile | null> {
    for (const g of this.guests.values()) {
      if (g.userId === userId) return g;
    }
    return null;
  }

  async list(filters?: GuestFilters): Promise<GuestProfile[]> {
    let result = [...this.guests.values()];
    if (filters?.status) result = result.filter(g => g.status === filters.status);
    if (filters?.email) result = result.filter(g => g.email === filters.email);
    if (filters?.phone) result = result.filter(g => g.phone === filters.phone);
    if (filters?.tags?.length) result = result.filter(g => filters.tags!.some(tag => g.tags.includes(tag)));
    if (filters?.minStays !== undefined) result = result.filter(g => g.totalStays >= filters.minStays!);
    if (filters?.minSpent !== undefined) result = result.filter(g => g.totalSpent >= filters.minSpent!);
    return result;
  }

  async search(query: string): Promise<GuestProfile[]> {
    const q = query.toLowerCase();
    return [...this.guests.values()].filter(g =>
      g.firstName.toLowerCase().includes(q) ||
      g.lastName.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.includes(q)
    );
  }
}
