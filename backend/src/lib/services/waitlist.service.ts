/**
 * Waitlist Service with Dependency Injection
 *
 * This service handles all waitlist/queue operations including:
 * - Adding guests to waitlist
 * - Position tracking
 * - Notification management
 * - Seating and status updates
 *
 * All dependencies are injected via the container for testability.
 */

import type {
  Container,
  WaitlistEntry,
  WaitlistStatus,
  WaitlistPriority,
  WaitlistFilters,
  WaitlistStats,
} from '../container/types';

// Custom error class
export class WaitlistServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'WaitlistServiceError';
  }
}

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Phone validation (basic E.164 format)
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valid statuses and priorities
const VALID_STATUSES: WaitlistStatus[] = ['waiting', 'notified', 'seated', 'cancelled', 'no_show'];
const VALID_PRIORITIES: WaitlistPriority[] = ['normal', 'vip', 'reservation'];

// Configuration
const DEFAULT_WAIT_MINUTES_PER_PARTY = 15;
const MAX_PARTY_SIZE = 20;
const MIN_PARTY_SIZE = 1;

export interface AddToWaitlistInput {
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  partySize: number;
  priority?: WaitlistPriority;
  notes?: string;
}

export interface UpdateWaitlistInput {
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  partySize?: number;
  priority?: WaitlistPriority;
  notes?: string;
}

export interface SeatGuestInput {
  tableId: string;
}

export interface WaitlistPosition {
  position: number;
  estimatedWaitMinutes: number;
  partiesAhead: number;
}

export interface WaitlistService {
  addToWaitlist(input: AddToWaitlistInput): Promise<WaitlistEntry>;
  getEntry(id: string): Promise<WaitlistEntry | null>;
  updateEntry(id: string, input: UpdateWaitlistInput): Promise<WaitlistEntry>;
  removeFromWaitlist(id: string): Promise<void>;
  getPosition(id: string): Promise<WaitlistPosition>;
  notifyGuest(id: string): Promise<WaitlistEntry>;
  seatGuest(id: string, input: SeatGuestInput): Promise<WaitlistEntry>;
  markNoShow(id: string): Promise<WaitlistEntry>;
  cancelEntry(id: string): Promise<WaitlistEntry>;
  getQueue(filters?: WaitlistFilters): Promise<WaitlistEntry[]>;
  getNextInQueue(): Promise<WaitlistEntry | null>;
  getWaitingCount(): Promise<number>;
  getActiveEntryByPhone(phone: string): Promise<WaitlistEntry | null>;
  estimateWaitTime(partySize: number): Promise<number>;
  getStats(): Promise<WaitlistStats>;
  getStatuses(): WaitlistStatus[];
  getPriorities(): WaitlistPriority[];
}

/**
 * Creates a WaitlistService instance with injected dependencies.
 */
export function createWaitlistService(container: Container): WaitlistService {
  const { waitlistRepository, logger } = container;

  // ----------------------------------------
  // VALIDATION HELPERS
  // ----------------------------------------

  function isValidUuid(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  function validateGuestName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new WaitlistServiceError('Guest name is required', 'INVALID_GUEST_NAME');
    }
    if (trimmed.length < 2) {
      throw new WaitlistServiceError('Guest name must be at least 2 characters', 'INVALID_GUEST_NAME');
    }
    if (trimmed.length > 100) {
      throw new WaitlistServiceError('Guest name must be at most 100 characters', 'INVALID_GUEST_NAME');
    }
  }

  function validatePhone(phone: string): void {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!PHONE_REGEX.test(cleaned)) {
      throw new WaitlistServiceError('Invalid phone number format', 'INVALID_PHONE');
    }
  }

  function validateEmail(email: string | undefined): void {
    if (email && !EMAIL_REGEX.test(email)) {
      throw new WaitlistServiceError('Invalid email format', 'INVALID_EMAIL');
    }
  }

  function validatePartySize(size: number): void {
    if (!Number.isInteger(size)) {
      throw new WaitlistServiceError('Party size must be a whole number', 'INVALID_PARTY_SIZE');
    }
    if (size < MIN_PARTY_SIZE) {
      throw new WaitlistServiceError(`Party size must be at least ${MIN_PARTY_SIZE}`, 'INVALID_PARTY_SIZE');
    }
    if (size > MAX_PARTY_SIZE) {
      throw new WaitlistServiceError(`Party size must be at most ${MAX_PARTY_SIZE}`, 'INVALID_PARTY_SIZE');
    }
  }

  function normalizePhone(phone: string): string {
    return phone.replace(/[\s\-()]/g, '');
  }

  // ----------------------------------------
  // SERVICE METHODS
  // ----------------------------------------

  async function addToWaitlist(input: AddToWaitlistInput): Promise<WaitlistEntry> {
    validateGuestName(input.guestName);
    validatePhone(input.guestPhone);
    validateEmail(input.guestEmail);
    validatePartySize(input.partySize);

    const normalizedPhone = normalizePhone(input.guestPhone);

    // Check if guest already has an active entry
    const existing = await getActiveEntryByPhone(normalizedPhone);
    if (existing) {
      throw new WaitlistServiceError(
        'Guest already has an active waitlist entry',
        'DUPLICATE_ENTRY'
      );
    }

    const priority = input.priority || 'normal';
    if (!VALID_PRIORITIES.includes(priority)) {
      throw new WaitlistServiceError('Invalid priority', 'INVALID_PRIORITY');
    }

    // Estimate wait time
    const estimatedWait = await estimateWaitTime(input.partySize);

    const entry = await waitlistRepository.create({
      guestName: input.guestName.trim(),
      guestPhone: normalizedPhone,
      guestEmail: input.guestEmail || null,
      partySize: input.partySize,
      priority,
      status: 'waiting',
      estimatedWaitMinutes: estimatedWait,
      notifiedAt: null,
      seatedAt: null,
      tableId: null,
      notes: input.notes?.trim() || null,
    });

    logger.info(`Guest ${input.guestName} added to waitlist (party of ${input.partySize})`);
    return entry;
  }

  async function getEntry(id: string): Promise<WaitlistEntry | null> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }
    return waitlistRepository.getById(id);
  }

  async function updateEntry(id: string, input: UpdateWaitlistInput): Promise<WaitlistEntry> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }

    const entry = await waitlistRepository.getById(id);
    if (!entry) {
      throw new WaitlistServiceError('Waitlist entry not found', 'ENTRY_NOT_FOUND');
    }

    if (entry.status === 'seated' || entry.status === 'cancelled') {
      throw new WaitlistServiceError(
        `Cannot update entry with status: ${entry.status}`,
        'INVALID_STATUS'
      );
    }

    const updates: Partial<WaitlistEntry> = {};

    if (input.guestName !== undefined) {
      validateGuestName(input.guestName);
      updates.guestName = input.guestName.trim();
    }

    if (input.guestPhone !== undefined) {
      validatePhone(input.guestPhone);
      updates.guestPhone = normalizePhone(input.guestPhone);
    }

    if (input.guestEmail !== undefined) {
      validateEmail(input.guestEmail);
      updates.guestEmail = input.guestEmail || null;
    }

    if (input.partySize !== undefined) {
      validatePartySize(input.partySize);
      updates.partySize = input.partySize;
      updates.estimatedWaitMinutes = await estimateWaitTime(input.partySize);
    }

    if (input.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(input.priority)) {
        throw new WaitlistServiceError('Invalid priority', 'INVALID_PRIORITY');
      }
      updates.priority = input.priority;
    }

    if (input.notes !== undefined) {
      updates.notes = input.notes?.trim() || null;
    }

    const updated = await waitlistRepository.update(id, updates);
    if (!updated) {
      throw new WaitlistServiceError('Failed to update entry', 'UPDATE_FAILED');
    }

    logger.info(`Waitlist entry ${id} updated`);
    return updated;
  }

  async function removeFromWaitlist(id: string): Promise<void> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }

    const entry = await waitlistRepository.getById(id);
    if (!entry) {
      throw new WaitlistServiceError('Waitlist entry not found', 'ENTRY_NOT_FOUND');
    }

    const deleted = await waitlistRepository.delete(id);
    if (!deleted) {
      throw new WaitlistServiceError('Failed to remove entry', 'DELETE_FAILED');
    }

    logger.info(`Waitlist entry ${id} removed`);
  }

  async function getPosition(id: string): Promise<WaitlistPosition> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }

    const entry = await waitlistRepository.getById(id);
    if (!entry) {
      throw new WaitlistServiceError('Waitlist entry not found', 'ENTRY_NOT_FOUND');
    }

    if (entry.status !== 'waiting' && entry.status !== 'notified') {
      throw new WaitlistServiceError(
        `Entry is not in queue (status: ${entry.status})`,
        'NOT_IN_QUEUE'
      );
    }

    const position = await waitlistRepository.getPosition(id);
    const partiesAhead = position - 1;
    const estimatedWait = partiesAhead * DEFAULT_WAIT_MINUTES_PER_PARTY;

    return {
      position,
      estimatedWaitMinutes: estimatedWait,
      partiesAhead,
    };
  }

  async function notifyGuest(id: string): Promise<WaitlistEntry> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }

    const entry = await waitlistRepository.getById(id);
    if (!entry) {
      throw new WaitlistServiceError('Waitlist entry not found', 'ENTRY_NOT_FOUND');
    }

    if (entry.status !== 'waiting') {
      throw new WaitlistServiceError(
        `Cannot notify entry with status: ${entry.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await waitlistRepository.update(id, {
      status: 'notified',
      notifiedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new WaitlistServiceError('Failed to notify guest', 'UPDATE_FAILED');
    }

    logger.info(`Guest ${entry.guestName} notified (entry ${id})`);
    return updated;
  }

  async function seatGuest(id: string, input: SeatGuestInput): Promise<WaitlistEntry> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }

    if (!isValidUuid(input.tableId)) {
      throw new WaitlistServiceError('Invalid table ID format', 'INVALID_TABLE_ID');
    }

    const entry = await waitlistRepository.getById(id);
    if (!entry) {
      throw new WaitlistServiceError('Waitlist entry not found', 'ENTRY_NOT_FOUND');
    }

    if (entry.status !== 'waiting' && entry.status !== 'notified') {
      throw new WaitlistServiceError(
        `Cannot seat entry with status: ${entry.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await waitlistRepository.update(id, {
      status: 'seated',
      seatedAt: new Date().toISOString(),
      tableId: input.tableId,
    });

    if (!updated) {
      throw new WaitlistServiceError('Failed to seat guest', 'UPDATE_FAILED');
    }

    logger.info(`Guest ${entry.guestName} seated at table ${input.tableId} (entry ${id})`);
    return updated;
  }

  async function markNoShow(id: string): Promise<WaitlistEntry> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }

    const entry = await waitlistRepository.getById(id);
    if (!entry) {
      throw new WaitlistServiceError('Waitlist entry not found', 'ENTRY_NOT_FOUND');
    }

    if (entry.status !== 'notified') {
      throw new WaitlistServiceError(
        `Cannot mark as no-show for entry with status: ${entry.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await waitlistRepository.update(id, {
      status: 'no_show',
    });

    if (!updated) {
      throw new WaitlistServiceError('Failed to mark as no-show', 'UPDATE_FAILED');
    }

    logger.info(`Guest ${entry.guestName} marked as no-show (entry ${id})`);
    return updated;
  }

  async function cancelEntry(id: string): Promise<WaitlistEntry> {
    if (!isValidUuid(id)) {
      throw new WaitlistServiceError('Invalid entry ID format', 'INVALID_ENTRY_ID');
    }

    const entry = await waitlistRepository.getById(id);
    if (!entry) {
      throw new WaitlistServiceError('Waitlist entry not found', 'ENTRY_NOT_FOUND');
    }

    if (entry.status === 'seated' || entry.status === 'cancelled') {
      throw new WaitlistServiceError(
        `Cannot cancel entry with status: ${entry.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await waitlistRepository.update(id, {
      status: 'cancelled',
    });

    if (!updated) {
      throw new WaitlistServiceError('Failed to cancel entry', 'UPDATE_FAILED');
    }

    logger.info(`Waitlist entry ${id} cancelled`);
    return updated;
  }

  async function getQueue(filters?: WaitlistFilters): Promise<WaitlistEntry[]> {
    return waitlistRepository.list(filters);
  }

  async function getNextInQueue(): Promise<WaitlistEntry | null> {
    return waitlistRepository.getNextInQueue();
  }

  async function getWaitingCount(): Promise<number> {
    return waitlistRepository.getWaitingCount();
  }

  async function getActiveEntryByPhone(phone: string): Promise<WaitlistEntry | null> {
    const normalizedPhone = normalizePhone(phone);
    const entries = await waitlistRepository.getByPhone(normalizedPhone);
    return entries.find((e) => e.status === 'waiting' || e.status === 'notified') || null;
  }

  async function estimateWaitTime(partySize: number): Promise<number> {
    const waitingCount = await waitlistRepository.getWaitingCount();
    // Larger parties take longer; estimate 15 min base + 2 min per additional guest
    const baseWait = waitingCount * DEFAULT_WAIT_MINUTES_PER_PARTY;
    const partySizeAdjustment = Math.max(0, (partySize - 2) * 2);
    return baseWait + partySizeAdjustment;
  }

  async function getStats(): Promise<WaitlistStats> {
    const allEntries = await waitlistRepository.list();
    const today = new Date().toISOString().split('T')[0];

    const todayEntries = allEntries.filter((e) => e.createdAt.startsWith(today));

    const waiting = allEntries.filter((e) => e.status === 'waiting');
    const seatedToday = todayEntries.filter((e) => e.status === 'seated');
    const noShowsToday = todayEntries.filter((e) => e.status === 'no_show');
    const cancelledToday = todayEntries.filter((e) => e.status === 'cancelled');

    // Calculate average wait for seated entries
    let totalWaitMinutes = 0;
    let seatedWithWait = 0;
    for (const entry of seatedToday) {
      if (entry.seatedAt) {
        const created = new Date(entry.createdAt).getTime();
        const seated = new Date(entry.seatedAt).getTime();
        totalWaitMinutes += (seated - created) / (1000 * 60);
        seatedWithWait++;
      }
    }

    const averageWait = seatedWithWait > 0 ? Math.round(totalWaitMinutes / seatedWithWait) : 0;

    return {
      totalWaiting: waiting.length,
      averageWaitMinutes: averageWait,
      seatedToday: seatedToday.length,
      noShowsToday: noShowsToday.length,
      cancelledToday: cancelledToday.length,
    };
  }

  function getStatuses(): WaitlistStatus[] {
    return [...VALID_STATUSES];
  }

  function getPriorities(): WaitlistPriority[] {
    return [...VALID_PRIORITIES];
  }

  return {
    addToWaitlist,
    getEntry,
    updateEntry,
    removeFromWaitlist,
    getPosition,
    notifyGuest,
    seatGuest,
    markNoShow,
    cancelEntry,
    getQueue,
    getNextInQueue,
    getWaitingCount,
    getActiveEntryByPhone,
    estimateWaitTime,
    getStats,
    getStatuses,
    getPriorities,
  };
}
