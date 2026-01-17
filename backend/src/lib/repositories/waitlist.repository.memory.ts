/**
 * In-Memory Waitlist Repository
 *
 * Test double for WaitlistRepository used in unit tests.
 */

import { randomUUID } from 'crypto';
import type { WaitlistEntry, WaitlistFilters, WaitlistRepository } from '../container/types';

export class InMemoryWaitlistRepository implements WaitlistRepository {
  private entries: Map<string, WaitlistEntry> = new Map();

  async create(
    entry: Omit<WaitlistEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<WaitlistEntry> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const newEntry: WaitlistEntry = {
      id,
      ...entry,
      createdAt: now,
      updatedAt: null,
    };

    this.entries.set(id, newEntry);
    return { ...newEntry };
  }

  async update(id: string, data: Partial<WaitlistEntry>): Promise<WaitlistEntry | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;

    const updated: WaitlistEntry = {
      ...entry,
      ...data,
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.entries.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async getById(id: string): Promise<WaitlistEntry | null> {
    const entry = this.entries.get(id);
    return entry ? { ...entry } : null;
  }

  async getByPhone(phone: string): Promise<WaitlistEntry[]> {
    return Array.from(this.entries.values())
      .filter((e) => e.guestPhone === phone)
      .map((e) => ({ ...e }));
  }

  async list(filters?: WaitlistFilters): Promise<WaitlistEntry[]> {
    let results = Array.from(this.entries.values());

    if (filters) {
      if (filters.status) {
        results = results.filter((e) => e.status === filters.status);
      }
      if (filters.priority) {
        results = results.filter((e) => e.priority === filters.priority);
      }
      if (filters.minPartySize !== undefined) {
        results = results.filter((e) => e.partySize >= filters.minPartySize!);
      }
      if (filters.maxPartySize !== undefined) {
        results = results.filter((e) => e.partySize <= filters.maxPartySize!);
      }
      if (filters.fromDate) {
        results = results.filter((e) => e.createdAt >= filters.fromDate!);
      }
      if (filters.toDate) {
        results = results.filter((e) => e.createdAt <= filters.toDate!);
      }
    }

    // Sort by priority (vip first, then reservation, then normal) and then by creation time
    const priorityOrder: Record<string, number> = { vip: 0, reservation: 1, normal: 2 };
    results.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return results.map((e) => ({ ...e }));
  }

  async getPosition(id: string): Promise<number> {
    const entry = this.entries.get(id);
    if (!entry || entry.status !== 'waiting') return -1;

    const waiting = await this.list({ status: 'waiting' });
    const index = waiting.findIndex((e) => e.id === id);
    return index + 1; // 1-indexed position
  }

  async getWaitingCount(): Promise<number> {
    return Array.from(this.entries.values()).filter((e) => e.status === 'waiting').length;
  }

  async getNextInQueue(): Promise<WaitlistEntry | null> {
    const waiting = await this.list({ status: 'waiting' });
    return waiting.length > 0 ? waiting[0] : null;
  }

  // ==========================================
  // TEST HELPERS
  // ==========================================

  addEntry(entry: WaitlistEntry): void {
    this.entries.set(entry.id, { ...entry });
  }

  clear(): void {
    this.entries.clear();
  }

  getAll(): WaitlistEntry[] {
    return Array.from(this.entries.values()).map((e) => ({ ...e }));
  }
}
