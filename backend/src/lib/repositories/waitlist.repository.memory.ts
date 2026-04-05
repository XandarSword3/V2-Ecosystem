/**
 * In-Memory Waitlist Repository
 * Test double for WaitlistRepository using in-memory data structures.
 */

import type {
  WaitlistRepository,
  WaitlistEntry,
  WaitlistFilters,
} from '../container/types.js';

export class InMemoryWaitlistRepository implements WaitlistRepository {
  private entries = new Map<string, WaitlistEntry>();

  reset() {
    this.entries.clear();
  }

  async create(data: Omit<WaitlistEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<WaitlistEntry> {
    const id = crypto.randomUUID();
    const entry: WaitlistEntry = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.entries.set(id, entry);
    return entry;
  }

  async update(id: string, data: Partial<WaitlistEntry>): Promise<WaitlistEntry | null> {
    const existing = this.entries.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.entries.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async getById(id: string): Promise<WaitlistEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async getByPhone(phone: string): Promise<WaitlistEntry[]> {
    return [...this.entries.values()].filter(e => e.guestPhone === phone);
  }

  async list(filters?: WaitlistFilters): Promise<WaitlistEntry[]> {
    let result = [...this.entries.values()];
    if (filters?.status) result = result.filter(e => e.status === filters.status);
    if (filters?.priority) result = result.filter(e => e.priority === filters.priority);
    if (filters?.minPartySize !== undefined) result = result.filter(e => e.partySize >= filters.minPartySize!);
    if (filters?.maxPartySize !== undefined) result = result.filter(e => e.partySize <= filters.maxPartySize!);
    const priorityOrder: Record<string, number> = { vip: 0, reservation: 1, normal: 2 };
    result.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return a.createdAt.localeCompare(b.createdAt);
    });
    return result;
  }

  async getPosition(id: string): Promise<number> {
    const priorityOrder: Record<string, number> = { vip: 0, reservation: 1, normal: 2 };
    const waiting = [...this.entries.values()]
      .filter(e => e.status === 'waiting')
      .sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        return a.createdAt.localeCompare(b.createdAt);
      });
    const idx = waiting.findIndex(e => e.id === id);
    return idx >= 0 ? idx + 1 : 0;
  }

  async getWaitingCount(): Promise<number> {
    return [...this.entries.values()].filter(e => e.status === 'waiting').length;
  }

  async getNextInQueue(): Promise<WaitlistEntry | null> {
    const waiting = [...this.entries.values()]
      .filter(e => e.status === 'waiting')
      .sort((a, b) => {
        if (a.priority === 'vip' && b.priority !== 'vip') return -1;
        if (b.priority === 'vip' && a.priority !== 'vip') return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
    return waiting[0] ?? null;
  }
}
