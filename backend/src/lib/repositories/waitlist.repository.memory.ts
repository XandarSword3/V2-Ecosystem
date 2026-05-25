import type { WaitlistEntry } from '../container/types';

export class InMemoryWaitlistRepository {
  private entries: Map<string, WaitlistEntry> = new Map();

  async findById(id: string): Promise<WaitlistEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async findAll(): Promise<WaitlistEntry[]> {
    return Array.from(this.entries.values());
  }

  async findActiveByPhone(phone: string): Promise<WaitlistEntry | null> {
    for (const e of this.entries.values()) {
      if (e.guestPhone === phone && (e.status === 'waiting' || e.status === 'notified')) {
        return e;
      }
    }
    return null;
  }

  async save(entry: WaitlistEntry): Promise<WaitlistEntry> {
    this.entries.set(entry.id, { ...entry });
    return entry;
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
  }
}
