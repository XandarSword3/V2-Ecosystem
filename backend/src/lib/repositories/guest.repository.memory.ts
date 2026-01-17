/**
 * In-Memory Guest Repository
 *
 * Test implementation of the guest repository for unit testing.
 */

import type { GuestProfile, GuestFilters, GuestRepository } from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryGuestRepository implements GuestRepository {
  private guests: Map<string, GuestProfile> = new Map();

  async create(data: Omit<GuestProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<GuestProfile> {
    const guest: GuestProfile = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.guests.set(guest.id, guest);
    return { ...guest };
  }

  async update(id: string, data: Partial<GuestProfile>): Promise<GuestProfile> {
    const guest = this.guests.get(id);
    if (!guest) {
      throw new Error('Guest not found');
    }
    const updated: GuestProfile = {
      ...guest,
      ...data,
      id,
      preferences: data.preferences
        ? { ...guest.preferences, ...data.preferences }
        : guest.preferences,
      updatedAt: new Date().toISOString(),
    };
    this.guests.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.guests.delete(id);
  }

  async getById(id: string): Promise<GuestProfile | null> {
    const guest = this.guests.get(id);
    return guest ? { ...guest } : null;
  }

  async getByEmail(email: string): Promise<GuestProfile | null> {
    for (const guest of this.guests.values()) {
      if (guest.email.toLowerCase() === email.toLowerCase()) {
        return { ...guest };
      }
    }
    return null;
  }

  async getByPhone(phone: string): Promise<GuestProfile | null> {
    for (const guest of this.guests.values()) {
      if (guest.phone === phone) {
        return { ...guest };
      }
    }
    return null;
  }

  async getByUserId(userId: string): Promise<GuestProfile | null> {
    for (const guest of this.guests.values()) {
      if (guest.userId === userId) {
        return { ...guest };
      }
    }
    return null;
  }

  async list(filters?: GuestFilters): Promise<GuestProfile[]> {
    let result = Array.from(this.guests.values());

    if (filters) {
      if (filters.status) {
        result = result.filter((g) => g.status === filters.status);
      }
      if (filters.email) {
        result = result.filter((g) =>
          g.email.toLowerCase().includes(filters.email!.toLowerCase())
        );
      }
      if (filters.phone) {
        result = result.filter((g) => g.phone.includes(filters.phone!));
      }
      if (filters.tags && filters.tags.length > 0) {
        result = result.filter((g) =>
          filters.tags!.some((tag) => g.tags.includes(tag))
        );
      }
      if (filters.minStays !== undefined) {
        result = result.filter((g) => g.totalStays >= filters.minStays!);
      }
      if (filters.minSpent !== undefined) {
        result = result.filter((g) => g.totalSpent >= filters.minSpent!);
      }
    }

    return result.map((g) => ({ ...g }));
  }

  async search(query: string): Promise<GuestProfile[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.guests.values())
      .filter(
        (g) =>
          g.firstName.toLowerCase().includes(lowerQuery) ||
          g.lastName.toLowerCase().includes(lowerQuery) ||
          g.email.toLowerCase().includes(lowerQuery) ||
          g.phone.includes(query)
      )
      .map((g) => ({ ...g }));
  }

  // Test helpers
  addGuest(guest: GuestProfile): void {
    this.guests.set(guest.id, { ...guest });
  }

  clear(): void {
    this.guests.clear();
  }

  getAll(): GuestProfile[] {
    return Array.from(this.guests.values()).map((g) => ({ ...g }));
  }
}

export function createInMemoryGuestRepository(): InMemoryGuestRepository {
  return new InMemoryGuestRepository();
}
