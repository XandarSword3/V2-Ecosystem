import { randomUUID } from 'crypto';
import type { Container, WaitlistEntry, WaitlistPriority, WaitlistStatus } from '../container/types';
import type { InMemoryWaitlistRepository } from '../repositories/waitlist.repository.memory';

export class WaitlistServiceError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const PRIORITIES: WaitlistPriority[] = ['normal', 'vip', 'reservation'];
const STATUSES: WaitlistStatus[] = ['waiting', 'notified', 'seated', 'cancelled', 'no_show'];
const PRIORITY_ORDER: Record<WaitlistPriority, number> = { vip: 0, reservation: 1, normal: 2 };
const MAX_PARTY_SIZE = 20;
const BASE_WAIT_PER_PARTY = 15; // minutes per party ahead

function isUUID(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

function normalizePhone(raw: string): string {
  // Strip everything except digits and leading +
  const stripped = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return stripped;
}

function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+?[1-9]\d{7,14}$/.test(normalized);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sortQueue(entries: WaitlistEntry[]): WaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function createWaitlistService(container: Container) {
  const repo = container.waitlistRepository as InMemoryWaitlistRepository;

  async function getOrThrow(id: string): Promise<WaitlistEntry> {
    if (!isUUID(id)) throw new WaitlistServiceError('INVALID_ENTRY_ID', 'Invalid entry ID format');
    const e = await repo.findById(id);
    if (!e) throw new WaitlistServiceError('ENTRY_NOT_FOUND', 'Entry not found');
    return e;
  }

  async function getActiveQueue(): Promise<WaitlistEntry[]> {
    const all = await repo.findAll();
    return sortQueue(all.filter(e => e.status === 'waiting' || e.status === 'notified'));
  }

  async function estimateWait(partySize: number): Promise<number> {
    const queue = await getActiveQueue();
    const waiting = queue.filter(e => e.status === 'waiting');
    if (waiting.length === 0) return 0;
    // Base: 15 min per party ahead + 2 min per extra person above 2
    const baseWait = waiting.length * BASE_WAIT_PER_PARTY;
    const sizeExtra = Math.max(0, partySize - 2) * 2;
    return baseWait + sizeExtra;
  }

  return {
    async addToWaitlist(input: { guestName: string; guestPhone: string; partySize: number; priority?: WaitlistPriority; guestEmail?: string; notes?: string }) {
      const name = input.guestName?.trim() ?? '';
      if (!name || name.length < 2) throw new WaitlistServiceError('INVALID_GUEST_NAME', 'Guest name must be at least 2 characters');
      if (name.length > 100) throw new WaitlistServiceError('INVALID_GUEST_NAME', 'Guest name is too long');
      if (!isValidPhone(input.guestPhone)) throw new WaitlistServiceError('INVALID_PHONE', 'Invalid phone number');
      if (input.guestEmail && !isValidEmail(input.guestEmail)) throw new WaitlistServiceError('INVALID_EMAIL', 'Invalid email format');
      if (!Number.isInteger(input.partySize) || input.partySize < 1) throw new WaitlistServiceError('INVALID_PARTY_SIZE', 'Party size must be a positive integer');
      if (input.partySize > MAX_PARTY_SIZE) throw new WaitlistServiceError('INVALID_PARTY_SIZE', `Party size cannot exceed ${MAX_PARTY_SIZE}`);
      const phone = normalizePhone(input.guestPhone);
      // Duplicate check
      const existing = await repo.findActiveByPhone(phone);
      if (existing) throw new WaitlistServiceError('DUPLICATE_ENTRY', 'An active entry already exists for this phone number');
      const now = new Date().toISOString();
      const wait = await estimateWait(input.partySize);
      const entry: WaitlistEntry = {
        id: randomUUID(),
        guestName: name,
        guestPhone: phone,
        guestEmail: input.guestEmail ?? null,
        partySize: input.partySize,
        priority: input.priority ?? 'normal',
        status: 'waiting',
        estimatedWaitMinutes: wait,
        notifiedAt: null, seatedAt: null, tableId: null,
        notes: input.notes?.trim() ?? null,
        createdAt: now, updatedAt: null,
      };
      return repo.save(entry);
    },

    async getEntry(id: string) {
      if (!isUUID(id)) throw new WaitlistServiceError('INVALID_ENTRY_ID', 'Invalid entry ID format');
      return repo.findById(id);
    },

    async updateEntry(id: string, updates: { guestName?: string; guestPhone?: string; partySize?: number; priority?: WaitlistPriority; notes?: string }) {
      const e = await getOrThrow(id);
      if (e.status === 'seated' || e.status === 'cancelled' || e.status === 'no_show') {
        throw new WaitlistServiceError('INVALID_STATUS', 'Cannot update entry in current status');
      }
      if (updates.partySize !== undefined) {
        if (!Number.isInteger(updates.partySize) || updates.partySize < 1 || updates.partySize > MAX_PARTY_SIZE) {
          throw new WaitlistServiceError('INVALID_PARTY_SIZE', 'Invalid party size');
        }
      }
      if (updates.guestPhone && !isValidPhone(updates.guestPhone)) throw new WaitlistServiceError('INVALID_PHONE', 'Invalid phone number');
      const phone = updates.guestPhone ? normalizePhone(updates.guestPhone) : e.guestPhone;
      return repo.save({ ...e, ...updates, guestPhone: phone, updatedAt: new Date().toISOString() });
    },

    async removeFromWaitlist(id: string) {
      const e = await getOrThrow(id);
      await repo.delete(id);
    },

    async getPosition(id: string) {
      const e = await getOrThrow(id);
      if (e.status !== 'waiting' && e.status !== 'notified') throw new WaitlistServiceError('NOT_IN_QUEUE', 'Entry is not in the active queue');
      const queue = await getActiveQueue();
      const idx = queue.findIndex(x => x.id === id);
      const position = idx + 1;
      const partiesAhead = idx;
      const wait = partiesAhead * BASE_WAIT_PER_PARTY + Math.max(0, e.partySize - 2) * 2;
      return { position, partiesAhead, estimatedWaitMinutes: wait };
    },

    async notifyGuest(id: string) {
      const e = await getOrThrow(id);
      if (e.status !== 'waiting') throw new WaitlistServiceError('INVALID_STATUS', 'Can only notify waiting guests');
      return repo.save({ ...e, status: 'notified', notifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },

    async seatGuest(id: string, input: { tableId: string }) {
      if (!isUUID(id)) throw new WaitlistServiceError('INVALID_ENTRY_ID', 'Invalid entry ID format');
      if (!isUUID(input.tableId)) throw new WaitlistServiceError('INVALID_TABLE_ID', 'Invalid table ID format');
      const e = await repo.findById(id);
      if (!e) throw new WaitlistServiceError('ENTRY_NOT_FOUND', 'Entry not found');
      if (e.status !== 'waiting' && e.status !== 'notified') throw new WaitlistServiceError('INVALID_STATUS', 'Can only seat waiting or notified guests');
      return repo.save({ ...e, status: 'seated', tableId: input.tableId, seatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },

    async markNoShow(id: string) {
      const e = await getOrThrow(id);
      if (e.status !== 'notified') throw new WaitlistServiceError('INVALID_STATUS', 'Can only mark notified guests as no-show');
      return repo.save({ ...e, status: 'no_show', updatedAt: new Date().toISOString() });
    },

    async cancelEntry(id: string) {
      const e = await getOrThrow(id);
      if (e.status === 'seated' || e.status === 'cancelled' || e.status === 'no_show') {
        throw new WaitlistServiceError('INVALID_STATUS', 'Cannot cancel entry in current status');
      }
      return repo.save({ ...e, status: 'cancelled', updatedAt: new Date().toISOString() });
    },

    async getQueue(filters?: { status?: WaitlistStatus; priority?: WaitlistPriority; minPartySize?: number; maxPartySize?: number }) {
      const all = await repo.findAll();
      let results = sortQueue(all);
      if (filters?.status) results = results.filter(e => e.status === filters.status);
      if (filters?.priority) results = results.filter(e => e.priority === filters.priority);
      if (filters?.minPartySize) results = results.filter(e => e.partySize >= filters.minPartySize!);
      if (filters?.maxPartySize) results = results.filter(e => e.partySize <= filters.maxPartySize!);
      return results;
    },

    async getNextInQueue() {
      const queue = await getActiveQueue();
      const waiting = queue.filter(e => e.status === 'waiting');
      return waiting[0] ?? null;
    },

    async getWaitingCount() {
      const all = await repo.findAll();
      return all.filter(e => e.status === 'waiting' || e.status === 'notified').length;
    },

    async getActiveEntryByPhone(phone: string) {
      const normalized = normalizePhone(phone);
      return repo.findActiveByPhone(normalized);
    },

    async estimateWaitTime(partySize: number): Promise<number> {
      return estimateWait(partySize);
    },

    async getStats() {
      const all = await repo.findAll();
      const today = new Date().toISOString().slice(0, 10);
      const waiting = all.filter(e => e.status === 'waiting' || e.status === 'notified').length;
      const seatedToday = all.filter(e => e.status === 'seated' && e.seatedAt && e.seatedAt.slice(0, 10) === today).length;
      const noShowsToday = all.filter(e => e.status === 'no_show' && e.updatedAt && e.updatedAt.slice(0, 10) === today).length;
      const cancelledToday = all.filter(e => e.status === 'cancelled' && e.updatedAt && e.updatedAt.slice(0, 10) === today).length;
      const seated = all.filter(e => e.status === 'seated' && e.seatedAt && e.createdAt);
      const avgWait = seated.length
        ? seated.reduce((s, e) => s + (new Date(e.seatedAt!).getTime() - new Date(e.createdAt).getTime()) / 60000, 0) / seated.length
        : 0;
      return { totalWaiting: waiting, averageWaitMinutes: Math.round(avgWait), seatedToday, noShowsToday, cancelledToday };
    },

    getStatuses() { return STATUSES; },
    getPriorities() { return PRIORITIES; },
  };
}
