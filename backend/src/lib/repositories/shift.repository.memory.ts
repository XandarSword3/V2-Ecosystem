/**
 * In-Memory Shift Repository
 *
 * Test double for ShiftRepository used in unit tests.
 */

import { randomUUID } from 'crypto';
import type { Shift, ShiftFilters, ShiftSwapRequest, ShiftRepository } from '../container/types';

export class InMemoryShiftRepository implements ShiftRepository {
  private shifts: Map<string, Shift> = new Map();
  private swapRequests: Map<string, ShiftSwapRequest> = new Map();

  async create(shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>): Promise<Shift> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const newShift: Shift = {
      id,
      ...shift,
      createdAt: now,
      updatedAt: null,
    };

    this.shifts.set(id, newShift);
    return { ...newShift };
  }

  async update(id: string, data: Partial<Shift>): Promise<Shift | null> {
    const shift = this.shifts.get(id);
    if (!shift) return null;

    const updated: Shift = {
      ...shift,
      ...data,
      id: shift.id,
      createdAt: shift.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.shifts.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.shifts.delete(id);
  }

  async getById(id: string): Promise<Shift | null> {
    const shift = this.shifts.get(id);
    return shift ? { ...shift } : null;
  }

  async getByStaffId(staffId: string, filters?: ShiftFilters): Promise<Shift[]> {
    let results = Array.from(this.shifts.values()).filter((s) => s.staffId === staffId);

    if (filters) {
      results = this.applyFilters(results, filters);
    }

    return results.map((s) => ({ ...s }));
  }

  async list(filters?: ShiftFilters): Promise<Shift[]> {
    let results = Array.from(this.shifts.values());

    if (filters) {
      results = this.applyFilters(results, filters);
    }

    // Sort by scheduled start time
    results.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

    return results.map((s) => ({ ...s }));
  }

  async getConflicts(staffId: string, start: string, end: string, excludeId?: string): Promise<Shift[]> {
    const staffShifts = await this.getByStaffId(staffId);

    return staffShifts.filter((s) => {
      if (excludeId && s.id === excludeId) return false;
      if (s.status === 'cancelled') return false;

      const shiftStart = new Date(s.scheduledStart).getTime();
      const shiftEnd = new Date(s.scheduledEnd).getTime();
      const checkStart = new Date(start).getTime();
      const checkEnd = new Date(end).getTime();

      // Check for overlap
      return shiftStart < checkEnd && shiftEnd > checkStart;
    });
  }

  async createSwapRequest(
    request: Omit<ShiftSwapRequest, 'id' | 'createdAt'>
  ): Promise<ShiftSwapRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const newRequest: ShiftSwapRequest = {
      id,
      ...request,
      createdAt: now,
    };

    this.swapRequests.set(id, newRequest);
    return { ...newRequest };
  }

  async getSwapRequest(id: string): Promise<ShiftSwapRequest | null> {
    const request = this.swapRequests.get(id);
    return request ? { ...request } : null;
  }

  async updateSwapRequest(
    id: string,
    data: Partial<ShiftSwapRequest>
  ): Promise<ShiftSwapRequest | null> {
    const request = this.swapRequests.get(id);
    if (!request) return null;

    const updated: ShiftSwapRequest = {
      ...request,
      ...data,
      id: request.id,
      createdAt: request.createdAt,
    };

    this.swapRequests.set(id, updated);
    return { ...updated };
  }

  async getSwapRequests(staffId: string): Promise<ShiftSwapRequest[]> {
    return Array.from(this.swapRequests.values())
      .filter((r) => r.requestingStaffId === staffId || r.targetStaffId === staffId)
      .map((r) => ({ ...r }));
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private applyFilters(shifts: Shift[], filters: ShiftFilters): Shift[] {
    let results = shifts;

    if (filters.staffId) {
      results = results.filter((s) => s.staffId === filters.staffId);
    }
    if (filters.department) {
      results = results.filter((s) => s.department === filters.department);
    }
    if (filters.shiftType) {
      results = results.filter((s) => s.shiftType === filters.shiftType);
    }
    if (filters.status) {
      results = results.filter((s) => s.status === filters.status);
    }
    if (filters.startDate) {
      results = results.filter((s) => s.scheduledStart >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter((s) => s.scheduledEnd <= filters.endDate!);
    }

    return results;
  }

  // ==========================================
  // TEST HELPERS
  // ==========================================

  addShift(shift: Shift): void {
    this.shifts.set(shift.id, { ...shift });
  }

  addSwapRequest(request: ShiftSwapRequest): void {
    this.swapRequests.set(request.id, { ...request });
  }

  clear(): void {
    this.shifts.clear();
    this.swapRequests.clear();
  }

  getAll(): Shift[] {
    return Array.from(this.shifts.values()).map((s) => ({ ...s }));
  }

  getAllSwapRequests(): ShiftSwapRequest[] {
    return Array.from(this.swapRequests.values()).map((r) => ({ ...r }));
  }
}
