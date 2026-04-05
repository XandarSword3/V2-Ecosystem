/**
 * In-Memory Shift Repository
 * Test double for ShiftRepository using in-memory data structures.
 */

import type {
  ShiftRepository,
  Shift,
  ShiftSwapRequest,
  ShiftFilters,
} from '../container/types.js';

export class InMemoryShiftRepository implements ShiftRepository {
  private shifts = new Map<string, Shift>();
  private swapRequests = new Map<string, ShiftSwapRequest>();

  reset() {
    this.shifts.clear();
    this.swapRequests.clear();
  }

  async create(data: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>): Promise<Shift> {
    const id = crypto.randomUUID();
    const shift: Shift = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.shifts.set(id, shift);
    return shift;
  }

  async update(id: string, data: Partial<Shift>): Promise<Shift | null> {
    const existing = this.shifts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.shifts.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.shifts.delete(id);
  }

  async getById(id: string): Promise<Shift | null> {
    return this.shifts.get(id) ?? null;
  }

  async getByStaffId(staffId: string, filters?: ShiftFilters): Promise<Shift[]> {
    let result = [...this.shifts.values()].filter(s => s.staffId === staffId);
    if (filters?.department) result = result.filter(s => s.department === filters.department);
    if (filters?.shiftType) result = result.filter(s => s.shiftType === filters.shiftType);
    if (filters?.status) result = result.filter(s => s.status === filters.status);
    return result;
  }

  async list(filters?: ShiftFilters): Promise<Shift[]> {
    let result = [...this.shifts.values()];
    if (filters?.staffId) result = result.filter(s => s.staffId === filters.staffId);
    if (filters?.department) result = result.filter(s => s.department === filters.department);
    if (filters?.shiftType) result = result.filter(s => s.shiftType === filters.shiftType);
    if (filters?.status) result = result.filter(s => s.status === filters.status);
    if (filters?.startDate) result = result.filter(s => s.scheduledStart >= filters.startDate!);
    if (filters?.endDate) result = result.filter(s => s.scheduledEnd <= filters.endDate!);
    return result;
  }

  async getConflicts(staffId: string, start: string, end: string, excludeId?: string): Promise<Shift[]> {
    return [...this.shifts.values()].filter(s =>
      s.staffId === staffId &&
      s.id !== excludeId &&
      s.scheduledStart < end &&
      s.scheduledEnd > start &&
      s.status !== 'cancelled'
    );
  }

  async createSwapRequest(data: Omit<ShiftSwapRequest, 'id' | 'createdAt'>): Promise<ShiftSwapRequest> {
    const id = crypto.randomUUID();
    const request: ShiftSwapRequest = { ...data, id, createdAt: new Date().toISOString() };
    this.swapRequests.set(id, request);
    return request;
  }

  async getSwapRequest(id: string): Promise<ShiftSwapRequest | null> {
    return this.swapRequests.get(id) ?? null;
  }

  async updateSwapRequest(id: string, data: Partial<ShiftSwapRequest>): Promise<ShiftSwapRequest | null> {
    const existing = this.swapRequests.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.swapRequests.set(id, updated);
    return updated;
  }

  async getSwapRequests(staffId: string): Promise<ShiftSwapRequest[]> {
    return [...this.swapRequests.values()].filter(
      r => r.requestingStaffId === staffId || r.targetStaffId === staffId
    );
  }
}
